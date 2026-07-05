// Benchmark: Gemini 2.5 Flash vs DeepSeek Chat
// Toma conversaciones REALES del bot y compara las respuestas lado a lado.
// Ejecutar en VPS: node scripts/benchmark-gemini-vs-deepseek.cjs

const { crearPrisma } = require('../lib/prisma-cjs.cjs')
const prisma = crearPrisma()

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ''
const GEMINI_KEYS = (process.env.GEMINI_API_KEYS || '').split(',').map(k => k.trim().replace(/^"|"$/g, ''))
let geminiKeyIdx = 0

function nextGeminiKey() {
  const k = GEMINI_KEYS[geminiKeyIdx % GEMINI_KEYS.length]
  geminiKeyIdx++
  return k
}

// Prompts del sistema multi-agente (copiados de producción)
const PROMPT_VENTAS = `Eres asesor comercial de Control Finanzas, sistema de cartera y cobros para prestamistas. Hablas por WhatsApp con prospectos que llenaron un formulario en Facebook.

## COMO HABLAS
Escribes como persona real por WhatsApp. Mensajes CORTOS. Una idea por mensaje.
Trato: "usted" amable. Si te tutean, tutea. Natural: "dale", "listo", "claro".

## EXPRESIONES COLOMBIANAS
- "No si quiero" = SI quiere (muletilla colombiana)
- "De una" / "Hagale" / "Dele" = si, adelante

## FLUJO DE CONVERSACION
1. "Como lleva el control de su cartera hoy?"
2. "Y cuando necesita saber cuanto le deben en total, como hace?"
3. "Sabe exactamente cuanto esta ganando hoy?"
4. Conecta: "Con Control Finanzas eso lo sabe en segundos"
5. Cierre: "Son 14 dias gratis, sin tarjeta"

Responde usando la herramienta "responder_lead". Nunca texto suelto.`

const PROMPT_SOPORTE = `Eres soporte tecnico de Control Finanzas. Hablas por WhatsApp.
Resuelves problemas BASICOS. Si no puedes en UN intento, escalas al humano.
Da UNA indicacion + ofrece soporte al 301 199 3001.
Responde usando la herramienta "responder_lead". Nunca texto suelto.`

const PROMPT_CLIENTE = `Eres soporte de Control Finanzas. Hablas con un USUARIO YA REGISTRADO.
Tu trabajo es AYUDARLO, no venderle. Mensajes cortos.
Si quiere pagar: "escribanos al 301 199 3001".
Cada explicacion + "Si no le funciona, escriba al 301 199 3001".
Responde usando la herramienta "responder_lead". Nunca texto suelto.`

const TOOL_DEF = {
  name: 'responder_lead',
  description: 'Respuesta del agente',
  parameters: {
    type: 'object',
    properties: {
      mensaje: { type: 'string', description: 'Texto WhatsApp' },
      temperatura: { type: 'integer', description: '0-100' },
      escalar: { type: 'boolean', description: 'Pasar a humano' },
      motivo: { type: 'string', description: 'Motivo si escala' },
    },
    required: ['mensaje', 'temperatura', 'escalar', 'motivo'],
  },
}

// Router simplificado
function clasificar(msg, estadoRegistro) {
  const txt = (msg || '').toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')

  const escalamiento = ['hablar con', 'persona real', 'asesor', 'videollamada', 'llamada', 'llamame']
  if (escalamiento.some(k => txt.includes(k))) return 'escalamiento'

  const yaRegistrado = (estadoRegistro || '').startsWith('registrado')
  if (yaRegistrado) {
    const pago = ['quiero pagar', 'como pago', 'se vencio', 'se me vencio', 'quiero seguir', 'activar plan']
    if (pago.some(k => txt.includes(k))) return 'escalamiento'
    return 'cliente'
  }

  const soporte = ['no puedo entrar', 'error', 'no funciona', 'no me deja', 'pantalla blanca', 'no carga']
  if (soporte.some(k => txt.includes(k))) return 'soporte'

  return 'ventas'
}

function getPrompt(tipo) {
  if (tipo === 'ventas') return PROMPT_VENTAS
  if (tipo === 'soporte') return PROMPT_SOPORTE
  if (tipo === 'cliente') return PROMPT_CLIENTE
  return PROMPT_VENTAS
}

// --- DeepSeek ---
async function llamarDeepSeek(systemPrompt, userMessages) {
  const messages = [{ role: 'system', content: systemPrompt }, ...userMessages]
  const t0 = Date.now()
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 400,
      messages,
      tools: [{ type: 'function', function: { ...TOOL_DEF } }],
      tool_choice: { type: 'function', function: { name: 'responder_lead' } },
    }),
    signal: AbortSignal.timeout(30000),
  })
  const latency = Date.now() - t0
  if (!res.ok) throw new Error(`DeepSeek ${res.status}`)
  const data = await res.json()
  const tc = data.choices?.[0]?.message?.tool_calls?.[0]
  let parsed = null
  if (tc?.function?.arguments) try { parsed = JSON.parse(tc.function.arguments) } catch {}
  const usage = data.usage || {}
  return {
    parsed,
    fallbackText: data.choices?.[0]?.message?.content || '',
    tokensIn: usage.prompt_tokens || 0,
    tokensOut: usage.completion_tokens || 0,
    latency,
  }
}

// --- Gemini ---
async function llamarGemini(systemPrompt, userMessages) {
  const key = nextGeminiKey()
  const contents = userMessages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    tools: [{
      function_declarations: [{
        name: TOOL_DEF.name,
        description: TOOL_DEF.description,
        parameters: TOOL_DEF.parameters,
      }],
    }],
    tool_config: { function_calling_config: { mode: 'ANY', allowed_function_names: ['responder_lead'] } },
    generation_config: { max_output_tokens: 400, temperature: 0.7 },
  }

  const t0 = Date.now()
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    }
  )
  const latency = Date.now() - t0
  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`Gemini ${res.status}: ${errBody.slice(0, 200)}`)
  }
  const data = await res.json()

  let parsed = null
  const candidate = data.candidates?.[0]
  const parts = candidate?.content?.parts || []
  for (const p of parts) {
    if (p.functionCall?.args) {
      parsed = p.functionCall.args
      break
    }
  }

  // Fallback: si no usó tool, extraer texto
  let fallbackText = ''
  for (const p of parts) {
    if (p.text) fallbackText += p.text
  }

  const usage = data.usageMetadata || {}
  return {
    parsed,
    fallbackText,
    tokensIn: usage.promptTokenCount || 0,
    tokensOut: usage.candidatesTokenCount || 0,
    latency,
  }
}

// --- Benchmark ---
async function run() {
  console.log('=== BENCHMARK: Gemini 2.5 Flash vs DeepSeek Chat ===\n')

  // Tomar conversaciones reales variadas
  const leads = await prisma.botLead.findMany({
    where: { conversaciones: { some: { rol: 'lead' } } },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: {
      id: true, nombre: true, estado: true, temperatura: true,
      metodoActual: true, cantClientes: true,
      conversaciones: {
        orderBy: { createdAt: 'asc' },
        select: { rol: true, texto: true, tipoMensaje: true },
      },
    },
  })

  // Filtrar leads con al menos 1 mensaje del lead
  const conMensaje = leads.filter(l =>
    l.conversaciones.some(c => c.rol === 'lead' && c.texto && c.texto.length > 2)
  )

  // Seleccionar variedad
  const registrados = conMensaje.filter(l => l.estado === 'registrado').slice(0, 3)
  const interesados = conMensaje.filter(l => l.estado === 'interesado').slice(0, 4)
  const contactados = conMensaje.filter(l => l.estado === 'contactado').slice(0, 3)
  const muestra = [...registrados, ...interesados, ...contactados].slice(0, 10)

  console.log(`Leads seleccionados: ${muestra.length} (${registrados.length} reg, ${interesados.length} int, ${contactados.length} cont)\n`)

  const resultados = []
  let dsWins = 0, gemWins = 0, empates = 0

  for (let i = 0; i < muestra.length; i++) {
    const lead = muestra[i]
    const msgs = lead.conversaciones

    // Encontrar el último mensaje del lead
    const lastLeadIdx = msgs.reduce((acc, m, idx) => m.rol === 'lead' ? idx : acc, -1)
    if (lastLeadIdx < 0) continue

    const lastLeadMsg = msgs[lastLeadIdx].texto || ''
    const tipo = clasificar(lastLeadMsg, lead.estado === 'registrado' ? 'registrado_starter' : 'no_registrado')

    if (tipo === 'escalamiento') {
      console.log(`  [${i + 1}] ${lead.nombre} → escalamiento (skip, no necesita IA)`)
      continue
    }

    const prompt = getPrompt(tipo)

    // Construir historial de mensajes para la API
    const apiMsgs = []
    const contextMsg = `Lead: ${lead.nombre}\nMétodo actual: ${lead.metodoActual || 'no especificado'}\nClientes: ${lead.cantClientes || 'no especificado'}\nEstado: ${lead.estado}\nTemperatura: ${lead.temperatura || 0}`
    apiMsgs.push({ role: 'user', content: contextMsg })

    for (let j = 0; j <= lastLeadIdx; j++) {
      const m = msgs[j]
      if (m.rol === 'bot') {
        apiMsgs.push({ role: 'assistant', content: m.texto || '...' })
      } else {
        apiMsgs.push({ role: 'user', content: m.texto || '' })
      }
    }

    console.log(`\n${'─'.repeat(80)}`)
    console.log(`[${i + 1}/${muestra.length}] ${lead.nombre} (${lead.estado}, temp:${lead.temperatura}) → ${tipo}`)
    console.log(`Último msg: "${lastLeadMsg.slice(0, 80)}"`)

    let dsResult, gemResult

    // DeepSeek
    try {
      dsResult = await llamarDeepSeek(prompt, apiMsgs)
    } catch (e) {
      dsResult = { parsed: null, fallbackText: `ERROR: ${e.message}`, tokensIn: 0, tokensOut: 0, latency: 0 }
    }

    // Gemini (con delay para no exceder rate limit)
    await new Promise(r => setTimeout(r, 500))
    try {
      gemResult = await llamarGemini(prompt, apiMsgs)
    } catch (e) {
      gemResult = { parsed: null, fallbackText: `ERROR: ${e.message}`, tokensIn: 0, tokensOut: 0, latency: 0 }
    }

    const dsMsg = dsResult.parsed?.mensaje || dsResult.fallbackText || '(sin respuesta)'
    const gemMsg = gemResult.parsed?.mensaje || gemResult.fallbackText || '(sin respuesta)'
    const dsTemp = dsResult.parsed?.temperatura ?? '?'
    const gemTemp = gemResult.parsed?.temperatura ?? '?'
    const dsEsc = dsResult.parsed?.escalar ?? '?'
    const gemEsc = gemResult.parsed?.escalar ?? '?'

    console.log(`\n  DEEPSEEK (${dsResult.latency}ms, ${dsResult.tokensIn}+${dsResult.tokensOut} tok):`)
    console.log(`  temp:${dsTemp} esc:${dsEsc}`)
    console.log(`  "${dsMsg.slice(0, 200)}"`)
    console.log(`\n  GEMINI (${gemResult.latency}ms, ${gemResult.tokensIn}+${gemResult.tokensOut} tok):`)
    console.log(`  temp:${gemTemp} esc:${gemEsc}`)
    console.log(`  "${gemMsg.slice(0, 200)}"`)

    // Scoring automático simple
    let dsScore = 0, gemScore = 0

    // 1. Usó tool correctamente (2pts)
    if (dsResult.parsed) dsScore += 2
    if (gemResult.parsed) gemScore += 2

    // 2. Mensaje corto (WhatsApp style, <300 chars = 1pt, <150 = 2pts)
    if (dsMsg.length < 300) dsScore += 1
    if (dsMsg.length < 150) dsScore += 1
    if (gemMsg.length < 300) gemScore += 1
    if (gemMsg.length < 150) gemScore += 1

    // 3. No tiene formato Markdown (negritas, bullets, headers = -1 cada uno)
    if (/\*\*/.test(dsMsg)) dsScore -= 1
    if (/^[-•*]\s/m.test(dsMsg)) dsScore -= 1
    if (/^#+\s/m.test(dsMsg)) dsScore -= 1
    if (/\*\*/.test(gemMsg)) gemScore -= 1
    if (/^[-•*]\s/m.test(gemMsg)) gemScore -= 1
    if (/^#+\s/m.test(gemMsg)) gemScore -= 1

    // 4. Tiene pregunta (engagement, +1pt)
    if (/\?/.test(dsMsg)) dsScore += 1
    if (/\?/.test(gemMsg)) gemScore += 1

    // 5. No se presenta como bot/IA (+1pt)
    if (!/bot|inteligencia artificial|asistente virtual|IA /i.test(dsMsg)) dsScore += 1
    if (!/bot|inteligencia artificial|asistente virtual|IA /i.test(gemMsg)) gemScore += 1

    // 6. Temperatura razonable (+1pt)
    const dsT = parseInt(dsTemp, 10)
    const gemT = parseInt(gemTemp, 10)
    if (!isNaN(dsT) && dsT >= 0 && dsT <= 100) dsScore += 1
    if (!isNaN(gemT) && gemT >= 0 && gemT <= 100) gemScore += 1

    const winner = dsScore > gemScore ? 'DEEPSEEK' : gemScore > dsScore ? 'GEMINI' : 'EMPATE'
    if (winner === 'DEEPSEEK') dsWins++
    else if (winner === 'GEMINI') gemWins++
    else empates++

    console.log(`\n  SCORE: DeepSeek ${dsScore} vs Gemini ${gemScore} → ${winner}`)

    resultados.push({
      lead: lead.nombre,
      estado: lead.estado,
      tipo,
      lastMsg: lastLeadMsg.slice(0, 80),
      dsScore, gemScore, winner,
      dsLatency: dsResult.latency,
      gemLatency: gemResult.latency,
      dsTokIn: dsResult.tokensIn,
      dsTokOut: dsResult.tokensOut,
      gemTokIn: gemResult.tokensIn,
      gemTokOut: gemResult.tokensOut,
    })

    // Rate limit breathing room
    await new Promise(r => setTimeout(r, 1000))
  }

  // Resumen final
  console.log(`\n${'═'.repeat(80)}`)
  console.log('RESUMEN FINAL')
  console.log(`${'═'.repeat(80)}`)
  console.log(`Conversaciones evaluadas: ${resultados.length}`)
  console.log(`DeepSeek wins: ${dsWins}`)
  console.log(`Gemini wins:   ${gemWins}`)
  console.log(`Empates:       ${empates}`)

  const avgDsLat = resultados.reduce((s, r) => s + r.dsLatency, 0) / resultados.length
  const avgGemLat = resultados.reduce((s, r) => s + r.gemLatency, 0) / resultados.length
  const avgDsTokIn = resultados.reduce((s, r) => s + r.dsTokIn, 0) / resultados.length
  const avgDsTokOut = resultados.reduce((s, r) => s + r.dsTokOut, 0) / resultados.length
  const avgGemTokIn = resultados.reduce((s, r) => s + r.gemTokIn, 0) / resultados.length
  const avgGemTokOut = resultados.reduce((s, r) => s + r.gemTokOut, 0) / resultados.length

  console.log(`\nLatencia promedio:`)
  console.log(`  DeepSeek: ${Math.round(avgDsLat)}ms`)
  console.log(`  Gemini:   ${Math.round(avgGemLat)}ms`)
  console.log(`\nTokens promedio (in/out):`)
  console.log(`  DeepSeek: ${Math.round(avgDsTokIn)}/${Math.round(avgDsTokOut)}`)
  console.log(`  Gemini:   ${Math.round(avgGemTokIn)}/${Math.round(avgGemTokOut)}`)

  // Costo estimado
  // DeepSeek: $0.14/1M input, $0.28/1M output (cache miss)
  // Gemini 2.5 Flash: FREE tier generous, paid = $0.15/1M input, $0.60/1M output
  const totalDsTokIn = resultados.reduce((s, r) => s + r.dsTokIn, 0)
  const totalDsTokOut = resultados.reduce((s, r) => s + r.dsTokOut, 0)
  const totalGemTokIn = resultados.reduce((s, r) => s + r.gemTokIn, 0)
  const totalGemTokOut = resultados.reduce((s, r) => s + r.gemTokOut, 0)

  const dsCost = (totalDsTokIn * 0.14 + totalDsTokOut * 0.28) / 1_000_000
  const gemCost = (totalGemTokIn * 0.15 + totalGemTokOut * 0.60) / 1_000_000

  console.log(`\nCosto estimado de este benchmark:`)
  console.log(`  DeepSeek: $${dsCost.toFixed(4)}`)
  console.log(`  Gemini:   $${gemCost.toFixed(4)} (o gratis en free tier)`)

  console.log(`\nDetalle por conversación:`)
  console.log('Lead'.padEnd(25) + 'Estado'.padEnd(15) + 'Tipo'.padEnd(10) + 'DS'.padEnd(5) + 'Gem'.padEnd(5) + 'Winner')
  console.log('-'.repeat(70))
  for (const r of resultados) {
    console.log(
      r.lead.slice(0, 22).padEnd(25) +
      r.estado.padEnd(15) +
      r.tipo.padEnd(10) +
      String(r.dsScore).padEnd(5) +
      String(r.gemScore).padEnd(5) +
      r.winner
    )
  }

  process.exit()
}

run().catch(e => { console.error('FATAL:', e); process.exit(1) })
