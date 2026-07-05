// Benchmark: DeepSeek vs GPT-4o en el bot multi-agente
// Toma conversaciones reales de la BD, las pasa por ambos modelos
// con el mismo prompt, y compara calidad, latencia y costo.
//
// Ejecutar: node scripts/benchmark-deepseek-vs-openai.cjs

require('dotenv').config()
const { crearPrisma } = require('../lib/prisma-cjs.cjs')

const prisma = crearPrisma()

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'
const DEEPSEEK_MODEL = 'deepseek-chat'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = 'gpt-4o'

// ── Prompts (copiados del sistema multi-agente) ──

const DATOS_SISTEMA = {
  linkRegistro: 'https://app.control-finanzas.com/registro?r=2',
  linkResetPassword: 'https://app.control-finanzas.com/reset-password',
  linkCalendario15: 'https://cal.com/control-finanzas/soporte-15min',
  telefonoSoporte: '301 199 3001',
  whatsappSoporte: 'https://wa.me/573011993001',
  horarioSoporte: 'lunes a sábado, 7am a 10pm',
  diasPrueba: 14,
}

const PROMPT_VENTAS = `Eres asesor comercial de Control Finanzas, sistema de cartera y cobros para prestamistas. Hablas por WhatsApp con prospectos que llenaron un formulario en Facebook.

## COMO HABLAS
Escribes como persona real por WhatsApp. Mensajes CORTOS. Una idea por mensaje. Si necesitas decir dos cosas, usa doble salto de linea.
Trato: "usted" amable. Si te tutean, tutea. Natural: "dale", "listo", "claro", "si senor", "para servirle".

## EXPRESIONES COLOMBIANAS
CUIDADO — estas NO son rechazo:
- "No si quiero" / "No, si quiero" = SI quiere. "No si" al inicio es muletilla afirmativa.
- "De una" / "Hagale" / "Dele" = si, adelante

## FLUJO DE CONVERSACION
1. "Como lleva el control de su cartera hoy?"
2. "Y cuando necesita saber cuanto le deben en total, como hace?"
3. "Y sabe exactamente cuanto esta ganando hoy?"
4. Conecta la solucion: "Con Control Finanzas eso lo sabe en segundos, sin sumar nada"
5. Cierre: "Son ${DATOS_SISTEMA.diasPrueba} dias gratis, sin tarjeta, lo prueba con sus clientes reales"

## ARGUMENTOS QUE CIERRAN
- "Lo sabe en tiempo real, al instante, sin sumar nada"
- "Su cobrador registra el pago en la calle y usted lo ve al instante"

## OBJECIONES
- "Esta caro" → "El plan inicial esta en 39 mil. Pero puede probarlo ${DATOS_SISTEMA.diasPrueba} dias gratis"
- "Ya tengo libreta/Excel" → "Sabe cuanto cobro cada cobrador hoy?"

## LO QUE NO DEBES HACER
- NO hagas soporte tecnico.
- NO mandes parrafos largos.
- NO digas que eres bot/IA/asistente virtual.

Usa SIEMPRE la herramienta "responder_lead". Nunca texto suelto.`

const PROMPT_CLIENTE = `Eres soporte de Control Finanzas. Hablas por WhatsApp con un USUARIO YA REGISTRADO.

## TU ROL
El usuario YA usa el sistema. Tu trabajo es AYUDARLO, no venderle nada.

## COMO HABLAS
Mensajes CORTOS. Una idea por mensaje.
NUNCA inventes botones, pasos o pantallas que no existen.

## QUE PUEDES HACER
- Explicar como crear clientes, prestamos, pagos, rutas, cobradores
- Problemas de acceso: ${DATOS_SISTEMA.linkResetPassword}

## PAGOS DEL SERVICIO
Si quiere pagar o activar plan: "Escribanos por aqui: ${DATOS_SISTEMA.whatsappSoporte}"

## REGLA DE RESPALDO
Cada vez que expliques algo, agrega: "Si no le funciona, escriba al ${DATOS_SISTEMA.telefonoSoporte} o agende videollamada: ${DATOS_SISTEMA.linkCalendario15}"

## MIEDO A LA TECNOLOGIA
Si dice "es complicado", "no supe", "me da miedo":
- Ofrece contacto humano DE INMEDIATO.
- Marca escalar=true

## LO QUE NO DEBES HACER
- NO vendas. NUNCA mandes el link de registro.
- NO digas que eres bot/IA/asistente virtual.

Usa SIEMPRE la herramienta "responder_lead". Nunca texto suelto.`

const PROMPT_SOPORTE = `Eres soporte tecnico de Control Finanzas. Hablas por WhatsApp.

## TU ROL
Resuelves problemas tecnicos BASICOS. Si no puedes resolverlo en UN intento, escalas.

## REGLA PRINCIPAL
1. Da UNA sola indicacion basica
2. INMEDIATAMENTE despues, ofrece soporte humano: "Escriba al ${DATOS_SISTEMA.telefonoSoporte} o agende videollamada: ${DATOS_SISTEMA.linkCalendario15}"
3. Marca escalar=true

## LO QUE NO DEBES HACER
- NO vendas.
- NO digas que eres bot/IA/asistente virtual.

Usa SIEMPRE la herramienta "responder_lead". Nunca texto suelto.`

// ── Tool definition ──

const TOOL_RESPONDER = {
  type: 'function',
  function: {
    name: 'responder_lead',
    description: 'Entrega la respuesta del agente.',
    parameters: {
      type: 'object',
      properties: {
        mensaje: { type: 'string', description: 'Texto a enviar por WhatsApp.' },
        temperatura: { type: 'integer', description: 'Que tan caliente esta el lead (0-100).' },
        escalar: { type: 'boolean', description: 'true si hay que pasar a un humano.' },
        motivo: { type: 'string', description: 'Si escalar, por que.' },
      },
      required: ['mensaje', 'temperatura', 'escalar', 'motivo'],
    },
  },
}

// ── Router (simplificado) ──

function quitarAcentos(s) {
  return s.replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
}

function clasificar(estado, mensaje) {
  const txt = quitarAcentos((mensaje || '').toLowerCase().trim())
  const ESCALAMIENTO = ['hablar con', 'persona real', 'asesor', 'videollamada', 'llamada', 'llamame']
  if (ESCALAMIENTO.some(k => txt.includes(k))) return 'escalamiento'
  const registrado = (estado || '').startsWith('registrado')
  if (registrado) {
    const PAGO = ['quiero pagar', 'como pago', 'se vencio', 'se me vencio', 'quiero seguir']
    if (PAGO.some(k => txt.includes(k))) return 'escalamiento'
    return 'cliente'
  }
  const SOPORTE = ['no puedo entrar', 'error', 'no funciona', 'no me deja', 'pantalla blanca', 'no carga']
  if (SOPORTE.some(k => txt.includes(k))) return 'soporte'
  return 'ventas'
}

function getPrompt(tipo) {
  if (tipo === 'ventas') return PROMPT_VENTAS
  if (tipo === 'cliente') return PROMPT_CLIENTE
  if (tipo === 'soporte') return PROMPT_SOPORTE
  return PROMPT_VENTAS
}

// ── API callers ──

async function callModel(url, apiKey, model, systemPrompt, messages) {
  const openaiMessages = [{ role: 'system', content: systemPrompt }]
  for (const m of messages) {
    openaiMessages.push({ role: m.role, content: m.content })
  }

  const start = Date.now()
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      messages: openaiMessages,
      tools: [TOOL_RESPONDER],
      tool_choice: { type: 'function', function: { name: 'responder_lead' } },
    }),
    signal: AbortSignal.timeout(30000),
  })
  const latencia = Date.now() - start

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${model} error ${res.status}: ${body.slice(0, 300)}`)
  }

  const data = await res.json()
  const choice = data.choices?.[0]
  const toolCall = choice?.message?.tool_calls?.[0]
  const usage = data.usage || {}

  let parsed = null
  if (toolCall?.function?.arguments) {
    try { parsed = JSON.parse(toolCall.function.arguments) } catch {}
  }

  return { parsed, usage, latencia, model }
}

// ── Costos (USD por 1M tokens) ──
const PRECIOS = {
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'gpt-4o': { input: 2.50, output: 10.00 },
}

function calcCosto(model, tokensIn, tokensOut) {
  const p = PRECIOS[model] || { input: 0, output: 0 }
  return (tokensIn * p.input + tokensOut * p.output) / 1_000_000
}

// ── Criterios de calidad ──

function evaluar(resp, tipo, leadNombre) {
  if (!resp) return { score: 0, notas: ['NO RESPONDIO - no parseo tool call'] }
  const msg = (resp.mensaje || '').toLowerCase()
  const notas = []
  let score = 5 // base

  // Longitud (corto es mejor para WA)
  const palabras = (resp.mensaje || '').split(/\s+/).length
  if (palabras <= 50) { score += 2; notas.push('Conciso (' + palabras + ' palabras)') }
  else if (palabras <= 80) { score += 1; notas.push('Aceptable (' + palabras + ' palabras)') }
  else { score -= 1; notas.push('Largo (' + palabras + ' palabras)') }

  // Personalización (usa el nombre)
  if (msg.includes(leadNombre.split(' ')[0].toLowerCase())) {
    score += 1; notas.push('Usa nombre del lead')
  }

  // NO dice que es bot
  if (/bot|ia |inteligencia artificial|asistente virtual/i.test(msg)) {
    score -= 3; notas.push('SE IDENTIFICA COMO BOT')
  }

  // Emojis (no queremos)
  if (/[\u{1F300}-\u{1FAFF}]/u.test(resp.mensaje || '')) {
    score -= 1; notas.push('Usa emojis')
  }

  // Escalamiento correcto
  if (tipo === 'escalamiento' && !resp.escalar) {
    score -= 2; notas.push('Debia escalar y no lo hizo')
  }

  // Para ventas: tiene pregunta?
  if (tipo === 'ventas' && !/\?/.test(resp.mensaje || '')) {
    score -= 1; notas.push('No termina con pregunta (ventas)')
  }

  // Para cliente registrado: no manda link de registro
  if (tipo === 'cliente' && /registro\?r=2/.test(msg)) {
    score -= 3; notas.push('MANDA LINK REGISTRO A REGISTRADO')
  }

  // Temperatura coherente
  if (resp.temperatura < 0 || resp.temperatura > 100) {
    score -= 1; notas.push('Temperatura fuera de rango: ' + resp.temperatura)
  }

  return { score: Math.max(0, Math.min(10, score)), notas }
}

// ── Main ──

async function run() {
  console.log('='.repeat(80))
  console.log('  BENCHMARK: DeepSeek-Chat vs GPT-4o')
  console.log('  Conversaciones reales del bot de WhatsApp')
  console.log('='.repeat(80))

  // Obtener conversaciones reales variadas
  const leads = await prisma.botLead.findMany({
    where: { conversaciones: { some: {} } },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: {
      id: true, nombre: true, estado: true, temperatura: true,
      metodoActual: true, cantClientes: true, telefono: true,
      conversaciones: {
        orderBy: { createdAt: 'asc' },
        select: { rol: true, texto: true, tipoMensaje: true },
      },
    },
  })

  // Seleccionar variedad
  const registrados = leads.filter(l => l.estado === 'registrado').slice(0, 3)
  const interesados = leads.filter(l => l.estado === 'interesado').slice(0, 4)
  const contactados = leads.filter(l => l.estado === 'contactado').slice(0, 3)
  const sample = [...registrados, ...interesados, ...contactados].slice(0, 8)

  console.log(`\nUsando ${sample.length} leads reales\n`)

  const resultados = { deepseek: [], openai: [] }
  let totalCostoDS = 0, totalCostoOAI = 0

  for (const lead of sample) {
    const lastLeadMsg = [...lead.conversaciones].reverse().find(c => c.rol === 'lead')
    if (!lastLeadMsg || !lastLeadMsg.texto) continue

    const tipo = clasificar(lead.estado, lastLeadMsg.texto)
    if (tipo === 'escalamiento') continue // no tiene sentido benchmarkear respuesta fija

    const prompt = getPrompt(tipo)

    // Construir historial como messages
    const messages = []
    const ctx = `Lead: ${lead.nombre}\nTelefono: ${lead.telefono}\nMetodo actual: ${lead.metodoActual || 'desconocido'}\nClientes: ${lead.cantClientes || 'desconocido'}`
    messages.push({ role: 'user', content: ctx + '\n\n(Inicio de la conversacion)' })

    for (const m of lead.conversaciones) {
      if (m.rol === 'bot') {
        messages.push({ role: 'assistant', content: m.texto || '...' })
      } else {
        messages.push({ role: 'user', content: m.texto || '' })
      }
    }

    console.log(`\n${'─'.repeat(70)}`)
    console.log(`Lead: ${lead.nombre} (${lead.estado}, temp:${lead.temperatura})`)
    console.log(`Agente: ${tipo} | Ultimo msg: "${(lastLeadMsg.texto || '').slice(0, 60)}"`)
    console.log('─'.repeat(70))

    // DeepSeek
    let ds, oai
    try {
      ds = await callModel(DEEPSEEK_URL, DEEPSEEK_API_KEY, DEEPSEEK_MODEL, prompt, messages)
      const costo = calcCosto(DEEPSEEK_MODEL, ds.usage.prompt_tokens || 0, ds.usage.completion_tokens || 0)
      totalCostoDS += costo
      const ev = evaluar(ds.parsed, tipo, lead.nombre)
      resultados.deepseek.push({ lead: lead.nombre, ...ev, latencia: ds.latencia, costo, tokensIn: ds.usage.prompt_tokens, tokensOut: ds.usage.completion_tokens })
      console.log(`\n  [DeepSeek] ${ds.latencia}ms | ${ds.usage.prompt_tokens}→${ds.usage.completion_tokens} tok | $${costo.toFixed(5)}`)
      console.log(`  Score: ${ev.score}/10 | ${ev.notas.join(', ')}`)
      console.log(`  Resp: "${(ds.parsed?.mensaje || '(sin tool call)').slice(0, 120)}"`)
    } catch (e) {
      console.log(`  [DeepSeek] ERROR: ${e.message.slice(0, 100)}`)
      resultados.deepseek.push({ lead: lead.nombre, score: 0, notas: ['ERROR'], latencia: 0, costo: 0 })
    }

    // GPT-4o
    try {
      oai = await callModel(OPENAI_URL, OPENAI_API_KEY, OPENAI_MODEL, prompt, messages)
      const costo = calcCosto(OPENAI_MODEL, oai.usage.prompt_tokens || 0, oai.usage.completion_tokens || 0)
      totalCostoOAI += costo
      const ev = evaluar(oai.parsed, tipo, lead.nombre)
      resultados.openai.push({ lead: lead.nombre, ...ev, latencia: oai.latencia, costo, tokensIn: oai.usage.prompt_tokens, tokensOut: oai.usage.completion_tokens })
      console.log(`\n  [GPT-4o]   ${oai.latencia}ms | ${oai.usage.prompt_tokens}→${oai.usage.completion_tokens} tok | $${costo.toFixed(5)}`)
      console.log(`  Score: ${ev.score}/10 | ${ev.notas.join(', ')}`)
      console.log(`  Resp: "${(oai.parsed?.mensaje || '(sin tool call)').slice(0, 120)}"`)
    } catch (e) {
      console.log(`  [GPT-4o]   ERROR: ${e.message.slice(0, 100)}`)
      resultados.openai.push({ lead: lead.nombre, score: 0, notas: ['ERROR'], latencia: 0, costo: 0 })
    }
  }

  // ── Resumen ──
  console.log('\n' + '='.repeat(80))
  console.log('  RESUMEN FINAL')
  console.log('='.repeat(80))

  const avgScore = arr => arr.length ? (arr.reduce((s, r) => s + r.score, 0) / arr.length).toFixed(1) : '0'
  const avgLatencia = arr => arr.length ? Math.round(arr.reduce((s, r) => s + r.latencia, 0) / arr.length) : 0
  const totalTokensIn = arr => arr.reduce((s, r) => s + (r.tokensIn || 0), 0)
  const totalTokensOut = arr => arr.reduce((s, r) => s + (r.tokensOut || 0), 0)

  const dsResults = resultados.deepseek
  const oaiResults = resultados.openai

  console.log(`
  Metrica              DeepSeek-Chat       GPT-4o
  ─────────────────────────────────────────────────
  Score promedio        ${avgScore(dsResults).padEnd(20)}${avgScore(oaiResults)}
  Latencia promedio     ${(avgLatencia(dsResults) + 'ms').padEnd(20)}${avgLatencia(oaiResults)}ms
  Tokens in (total)     ${String(totalTokensIn(dsResults)).padEnd(20)}${totalTokensIn(oaiResults)}
  Tokens out (total)    ${String(totalTokensOut(dsResults)).padEnd(20)}${totalTokensOut(oaiResults)}
  Costo total           $${totalCostoDS.toFixed(5).padEnd(18)}$${totalCostoOAI.toFixed(5)}
  Costo x1000 msgs      $${(totalCostoDS / dsResults.length * 1000).toFixed(2).padEnd(18)}$${(totalCostoOAI / oaiResults.length * 1000).toFixed(2)}
  `)

  const dsWins = dsResults.filter((r, i) => r.score > (oaiResults[i]?.score || 0)).length
  const oaiWins = oaiResults.filter((r, i) => r.score > (dsResults[i]?.score || 0)).length
  const ties = dsResults.length - dsWins - oaiWins

  console.log(`  Victorias:  DeepSeek ${dsWins} | GPT-4o ${oaiWins} | Empate ${ties}`)

  const factor = totalCostoOAI / (totalCostoDS || 0.00001)
  console.log(`  GPT-4o es ${factor.toFixed(1)}x más caro que DeepSeek`)

  if (avgScore(oaiResults) > avgScore(dsResults)) {
    console.log(`\n  → GPT-4o tiene mejor score, pero a ${factor.toFixed(0)}x el costo.`)
    const diff = parseFloat(avgScore(oaiResults)) - parseFloat(avgScore(dsResults))
    if (diff <= 1) {
      console.log(`    La diferencia es mínima (${diff.toFixed(1)} pts). DeepSeek sigue siendo la mejor relación calidad/precio.`)
    } else {
      console.log(`    La diferencia es notable (${diff.toFixed(1)} pts). Considerar GPT-4o si el presupuesto lo permite.`)
    }
  } else {
    console.log(`\n  → DeepSeek gana o empata en calidad Y es ${factor.toFixed(0)}x más barato. No hay razón para cambiar.`)
  }

  process.exit()
}

run().catch(e => { console.error('Error fatal:', e.message); process.exit(1) })
