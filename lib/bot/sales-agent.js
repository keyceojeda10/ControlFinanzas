// lib/bot/sales-agent.js — Bot de ventas para WhatsApp
// Un solo agente (ventas). Problemas técnicos → número de soporte + escalar.
// Interfaz pública: responder() y generarSeguimiento() — sin cambios para los callers.

import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { calcularCosto } from './constants'
import { getGuia } from './guias-catalogo'
import { clasificar } from './router'
import { PROMPT_VENTAS } from './prompts/ventas'
import { construirContextoLead, construirContextoDatos, DATOS_SISTEMA } from './prompts/contexto'

function guiaValida(slug) {
  const g = getGuia(String(slug || '').trim())
  return g ? g.slug : null
}

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ''
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'
const DEEPSEEK_MODEL = 'deepseek-chat'

const MODELO_DEFAULT = 'claude-sonnet-4-6'

const TOOL_RESPONDER = {
  name: 'responder_lead',
  description: 'Entrega la respuesta del agente para el prospecto de Control Finanzas.',
  input_schema: {
    type: 'object',
    properties: {
      mensaje: { type: 'string', description: 'El texto que se le enviara al prospecto por WhatsApp.' },
      temperatura: { type: 'integer', description: 'Que tan caliente esta el lead, de 0 a 100.' },
      escalar: { type: 'boolean', description: 'true si hay que pasar el lead a un humano.' },
      motivo: { type: 'string', description: 'Si escalar es true, una frase explicando por que.' },
      enviarGuia: { type: 'string', description: 'Slug de una guia visual a enviar. Dejar vacio si no se va a enviar ninguna.' },
    },
    required: ['mensaje', 'temperatura', 'escalar', 'motivo'],
  },
}

const TOOL_SEGUIMIENTO = {
  name: 'seguimiento_lead',
  description: 'Mensaje de seguimiento para el lead.',
  input_schema: {
    type: 'object',
    properties: {
      mensaje: { type: 'string', description: 'El mensaje de WhatsApp.' },
      darPorPerdido: { type: 'boolean', description: 'true si no hay que insistir.' },
    },
    required: ['mensaje', 'darPorPerdido'],
  },
}

async function getModelo() {
  try {
    const config = await prisma.botConfig.findFirst()
    return config?.modelo || MODELO_DEFAULT
  } catch {}
  return MODELO_DEFAULT
}

async function registrarGasto(proveedor, modelo, tokensIn, tokensOut, costoUsd) {
  try {
    await prisma.botGastoApi.create({
      data: { proveedor, modelo, tokensIn, tokensOut, costoUsd },
    })
  } catch (e) {
    console.error('[Bot Agent] Error registrando gasto:', e.message)
  }
}

function anthropicToOpenAIMessages(systemPrompt, messages) {
  const out = [{ role: 'system', content: systemPrompt }]
  for (const m of messages) {
    if (typeof m.content === 'string') {
      out.push({ role: m.role, content: m.content })
    } else if (Array.isArray(m.content)) {
      const text = m.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n')
      if (text) out.push({ role: m.role, content: text })
    }
  }
  return out
}

function anthropicToolToOpenAI(tool) {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }
}

async function llamarDeepSeek(systemPrompt, messages, tool, toolName) {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY no configurado — no hay fallback disponible.')
  }

  const openaiMessages = anthropicToOpenAIMessages(systemPrompt, messages)
  const openaiTool = anthropicToolToOpenAI(tool)

  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      max_tokens: 500,
      messages: openaiMessages,
      tools: [openaiTool],
      tool_choice: { type: 'function', function: { name: toolName } },
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`DeepSeek error ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  const choice = data.choices?.[0]
  const toolCall = choice?.message?.tool_calls?.[0]
  const usage = data.usage || {}

  let parsed = null
  if (toolCall?.function?.arguments) {
    try {
      parsed = JSON.parse(toolCall.function.arguments)
    } catch {}
  }

  if (!parsed && choice?.message?.content) {
    parsed = null
  }

  return { parsed, rawText: choice?.message?.content || '', usage }
}

/**
 * Genera respuesta del agente para un mensaje entrante.
 */
export async function responder(lead, historial, entrante) {
  if (!anthropic && !DEEPSEEK_API_KEY) {
    throw new Error('No hay API configurada — falta ANTHROPIC_API_KEY y DEEPSEEK_API_KEY.')
  }

  const modelo = await getModelo()

  let estadoRegistro = 'no_registrado'
  try {
    const digitos = (lead.telefono || '').replace(/\D/g, '')
    const ultimos10 = digitos.slice(-10)
    if (ultimos10) {
      const usuario = await prisma.user.findFirst({
        where: { telefono: { endsWith: ultimos10 } },
        include: { organization: { select: { plan: true, planDemoHasta: true } } },
      })
      if (usuario) {
        const plan = usuario.organization?.plan || 'starter'
        const demo = usuario.organization?.planDemoHasta
        const enDemo = demo && new Date(demo) > new Date()
        estadoRegistro = enDemo ? `registrado_demo_${plan}` : `registrado_${plan}`
      }
    }
  } catch (e) {
    console.error('[Bot Agent] Error verificando registro:', e.message)
  }

  const yaRegistrado = estadoRegistro.startsWith('registrado')

  if (yaRegistrado && lead.estado !== 'registrado') {
    try {
      await prisma.botLead.update({
        where: { id: lead.id },
        data: { estado: 'registrado', temperatura: 100 },
      })
      console.log('[Bot Agent] Lead ' + lead.nombre + ' marcado como registrado automaticamente')
    } catch (e) {
      console.error('[Bot Agent] Error marcando registrado:', e.message)
    }
  }

  const tipoAgente = clasificar({
    mensaje: entrante.texto || '',
    estadoRegistro,
    estadoLead: lead.estado,
    historial,
  })

  console.log(`[Bot Router] ${lead.nombre}: "${(entrante.texto || '').slice(0, 50)}" → ${tipoAgente}`)

  if (tipoAgente === 'escalamiento') {
    return {
      mensaje: `Claro, ya un asesor de nuestro equipo lo va a contactar para atenderlo directamente.\n\nTambien puede escribir al ${DATOS_SISTEMA.telefonoSoporte} si necesita algo ya.`,
      temperatura: lead.temperatura || 50,
      escalar: true,
      motivo: 'lead pidio atencion humana',
      enviarGuia: null,
      usage: { modelo: 'router', tokensIn: 0, tokensOut: 0, costoUsd: 0 },
    }
  }

  // Siempre ventas — un solo prompt
  const systemPrompt = PROMPT_VENTAS + '\n\n' + construirContextoDatos()

  const ahoraCol = new Date(Date.now() - 5 * 3600 * 1000)
  const horaCol = ahoraCol.getUTCHours()
  const franja = horaCol < 12 ? 'mañana (buenos días)' : horaCol < 19 ? 'tarde (buenas tardes)' : 'noche (buenas noches)'
  const fechaCol = ahoraCol.toISOString().slice(0, 16).replace('T', ' ')

  const contexto = construirContextoLead(lead, estadoRegistro, franja, fechaCol)

  const messages = []
  messages.push({ role: 'user', content: contexto + '\n\n(Inicio de la conversacion)' })

  for (const m of historial) {
    if (m.rol === 'bot') {
      messages.push({ role: 'assistant', content: m.texto || '...' })
    } else {
      const etiqueta = m.tipoMensaje === 'audio' ? '[Nota de voz transcrita] '
        : m.tipoMensaje === 'image' ? '[Imagen] ' : ''
      messages.push({ role: 'user', content: etiqueta + (m.texto || '') })
    }
  }

  const contenido = []
  if (entrante.imagenBase64) {
    contenido.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: entrante.imagenMime || 'image/jpeg',
        data: entrante.imagenBase64,
      },
    })
  }
  const etiqueta = entrante.tipoMensaje === 'audio' ? '[Nota de voz transcrita] '
    : entrante.tipoMensaje === 'image' ? '[El prospecto envio esta imagen] ' : ''
  contenido.push({ type: 'text', text: etiqueta + (entrante.texto || '(sin texto)') })
  messages.push({ role: 'user', content: contenido })

  function postProcesar(mensaje) {
    let msg = String(mensaje || '').trim() || 'Permitame un momento, ya le respondo.'

    // 1. Limpiar caracteres no-latinos (chino, arabe, etc.)
    msg = msg.replace(/[^\x00-\x7F -ɏḀ-ỿ -⁯←-➿\u{1F300}-\u{1FAFF}]/gu, '')

    // 2. Corregir "15 días" -> "14 días"
    msg = msg.replace(/\b15 d[ií]as\b/gi, '14 días')

    // 3. Normalizar nombre
    msg = msg.replace(/soy [\wÀ-ɏ]+ de Control Finanzas/gi, 'soy Daniela de Control Finanzas')

    // 4. Eliminar testimonios inventados
    msg = msg.replace(/(?:un|otro|cierto|alg[uú]n) (?:prestamista|cliente|usuario|persona)[\s\S]{0,250}?(?:me |nos )(?:cont[oó]|dijo|escribi[oó]|coment[oó])[\s\S]{0,250}?[.!?\n]/gi, '')
    msg = msg.replace(/(?:me |nos )(?:cont[oó]|dijo) (?:que |un )[\s\S]{0,200}?[.!?\n]/gi, '')
    msg = msg.replace(/(?:hay |muchos |varios )(?:prestamistas|clientes|usuarios) (?:que |nos )[\s\S]{0,200}?[.!?\n]/gi, '')

    // 5. Eliminar cifras inventadas
    msg = msg.replace(/(?:reducir|ahorrar|mejorar|aumentar|duplicar) (?:hasta |un |en )?\d+\s*%/gi, '')
    msg = msg.replace(/\b\d+\s*% (?:de |del |menos |más )/gi, '')

    // 6. Eliminar cupones inventados
    msg = msg.replace(/c[oó]digo\s+["']?\w+["']?/gi, '')
    msg = msg.replace(/cup[oó]n\s+["']?\w+["']?/gi, '')

    // 7. URLs truncadas o rotas
    msg = msg.replace(/https?:\/\/(?:app\.control-fi(?:nan)?(?:\.\.\.)?|[^\s]{1,15})(?=\s|$)/gi, match => {
      if (/control-finanzas\.com/.test(match) && match.length > 30) return match
      return ''
    })

    // 8. Limpiar espacios y lineas vacias multiples
    msg = msg.replace(/\n{3,}/g, '\n\n').replace(/  +/g, ' ').trim()

    // 9. Link de registro: inyectar si el bot menciona registro pero no incluyo URL
    const REGISTRO_URL = 'https://app.control-finanzas.com/registro?r=2'

    const leadPideLink = /link|registro|registr|como entro|como hago|donde|enviam|enlace/i.test(entrante.texto || '')
    const botMencionaLink = /registr|inscrib|probar|prueb.*gratis|dias gratis|14 d[ií]as/i.test(msg)
    const botDiceAquiEsta = /aqu[ií].*(?:link|enlace)|(?:te |le )(?:dejo|comparto|env[ií]o|mando|paso).*(?:link|enlace)|link para|enlace para|enlace directo/i.test(msg)

    if (!yaRegistrado && (botMencionaLink || botDiceAquiEsta || leadPideLink) && !msg.includes('app.control-finanzas.com')) {
      msg += `\n\n${REGISTRO_URL}`
    }

    if (yaRegistrado && msg.includes('registro?r=2')) {
      msg = msg.replace(/\n*\s*https?:\/\/app\.control-finanzas\.com\/registro\?r=2/gi, '').trim()
    }

    // Anti-spam de link: no repetir si el bot anterior ya lo tenía
    const ultimoBot = [...historial].reverse().find(m => m.rol === 'bot')
    const ultimoBotTieneLink = ultimoBot && (ultimoBot.texto || '').includes('app.control-finanzas.com/registro')
    if (ultimoBotTieneLink && !leadPideLink && msg.includes('app.control-finanzas.com/registro')) {
      msg = msg.replace(/\s*https:\/\/app\.control-finanzas\.com\/registro\S*/g, '').trim()
    }

    // Si quedó vacío o solo emojis
    if (!msg.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{1F1E0}-\u{1F1FF}]/gu, '').trim()) {
      msg = 'Quedo atenta, me avisa si tiene alguna duda.'
    }

    return msg
  }

  // DeepSeek principal, Claude fallback
  try {
    const ds = await llamarDeepSeek(systemPrompt, messages, TOOL_RESPONDER, 'responder_lead')
    const dsUsage = { modelo: `${DEEPSEEK_MODEL}:ventas`, tokensIn: ds.usage.prompt_tokens || 0, tokensOut: ds.usage.completion_tokens || 0, costoUsd: 0 }
    await registrarGasto('deepseek', `${DEEPSEEK_MODEL}:ventas`, dsUsage.tokensIn, dsUsage.tokensOut, 0)

    if (ds.parsed) {
      const o = ds.parsed
      return {
        mensaje: postProcesar(o.mensaje),
        temperatura: Math.max(0, Math.min(100, parseInt(o.temperatura, 10) || 0)),
        escalar: Boolean(o.escalar),
        motivo: String(o.motivo || '').trim(),
        enviarGuia: guiaValida(o.enviarGuia),
        usage: dsUsage,
      }
    }
    console.warn('[Bot Agent] DeepSeek no devolvio respuesta estructurada, intentando Claude...')
  } catch (dsError) {
    console.warn('[Bot Agent] DeepSeek fallo, intentando Claude:', dsError.message)
  }

  if (!anthropic) {
    return {
      mensaje: 'Permitame un momento, ya le respondo.',
      temperatura: 40, escalar: true,
      motivo: 'DeepSeek fallo y no hay Claude configurado.',
      usage: { modelo: 'ninguno', tokensIn: 0, tokensOut: 0, costoUsd: 0 },
    }
  }

  const resp = await anthropic.messages.create({
    model: modelo,
    max_tokens: 500,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    tools: [TOOL_RESPONDER],
    tool_choice: { type: 'tool', name: 'responder_lead' },
    messages,
  })

  const u = resp.usage || {}
  const costo = calcularCosto(u)
  const usage = {
    modelo: `${modelo}:ventas`,
    tokensIn: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0),
    tokensOut: u.output_tokens || 0,
    costoUsd: costo,
  }

  if (costo > 0) {
    await registrarGasto('anthropic', `${modelo}:ventas`, usage.tokensIn, usage.tokensOut, costo)
  }

  const toolUse = (resp.content || []).find(b => b.type === 'tool_use')
  if (toolUse?.input) {
    const o = toolUse.input
    return {
      mensaje: postProcesar(o.mensaje),
      temperatura: Math.max(0, Math.min(100, parseInt(o.temperatura, 10) || 0)),
      escalar: Boolean(o.escalar),
      motivo: String(o.motivo || '').trim(),
      enviarGuia: guiaValida(o.enviarGuia),
      usage,
    }
  }

  const textoCrudo = (resp.content || [])
    .filter(b => b.type === 'text').map(b => b.text).join('').trim()
  return {
    mensaje: textoCrudo || 'Permitame un momento, ya le respondo.',
    temperatura: 40,
    escalar: true,
    motivo: 'Claude no devolvio respuesta estructurada.',
    usage,
  }
}

/**
 * Genera mensaje de seguimiento para reactivar un lead.
 */
export async function generarSeguimiento(lead, historial, numeroIntento = 1) {
  if (!anthropic && !DEEPSEEK_API_KEY) {
    throw new Error('No hay API configurada — falta ANTHROPIC_API_KEY y DEEPSEEK_API_KEY.')
  }

  const modelo = await getModelo()

  const msgs = historial || []
  const historialTexto = msgs
    .map(m => `${m.rol === 'bot' ? 'Daniela' : 'Prospecto'}: ${m.texto || ''}`)
    .join('\n') || '(el prospecto nunca respondio)'

  const textosBotJoin = msgs.filter(m => m.rol === 'bot').map(m => m.texto || '').join(' ')
  const linkYaEnviado = textosBotJoin.includes('app.control-finanzas.com/registro')
  const vecesLink = (textosBotJoin.match(/app\.control-finanzas\.com\/registro/g) || []).length
  const videollamadaOfrecida = /videollamada|llamada.*15 min|agendamos/i.test(textosBotJoin)
  const leadRespondio = msgs.some(m => m.rol === 'lead')

  const ahoraCol = new Date(Date.now() - 5 * 3600 * 1000)
  const horaCol = ahoraCol.getUTCHours()
  const franja = horaCol < 12 ? 'mañana (buenos días)' : horaCol < 19 ? 'tarde (buenas tardes)' : 'noche (buenas noches)'
  const fechaCol = ahoraCol.toISOString().slice(0, 16).replace('T', ' ')

  const estrategiaPorIntento = {
    1: linkYaEnviado
      ? 'Ya le mandaste el link. Pregunta si lo pudo abrir o si tiene duda. NO repitas el link.'
      : (leadRespondio
        ? 'Retoma desde lo ultimo que se dijo. Aporta UN beneficio concreto del sistema.'
        : 'No ha respondido. Menciona UNA funcion que resuelva algo: "el sistema calcula la mora automatica" o "cada cobrador cierra caja".'),
    2: 'Menciona UNA funcion real que NO hayas dicho antes. Ejemplos: "calcula la mora automatica", "funciona sin internet", "ve las ganancias del dia en segundos".',
    3: videollamadaOfrecida
      ? 'Ya ofreciste videollamada. Menciona UNA funcion real nueva.'
      : 'Ofrece videollamada: "Si quiere, le agendamos una videollamada de 15 min para mostrarle todo en vivo. Le parece?"',
    4: 'Ultimo mensaje de valor. UNA funcion real que no hayas dicho. 2 lineas max.',
    5: 'Cierre: "Quedo atenta si en algun momento lo necesita." Sin presion, sin link.',
  }
  const estrategia = estrategiaPorIntento[numeroIntento] || estrategiaPorIntento[5]

  const avisos = [
    linkYaEnviado ? `LINK YA ENVIADO ${vecesLink} vez(es) — NO lo repitas.` : '',
    videollamadaOfrecida ? 'VIDEOLLAMADA YA OFRECIDA — no la repitas.' : '',
  ].filter(Boolean).join(' ')

  const instruccion = `Eres Daniela, asesora COMERCIAL de Control Finanzas (cartera y cobros para prestamistas). Tu unico trabajo es VENDER. Seguimiento a ${lead.nombre || 'prestamista'}. Intento ${numeroIntento}/5.

Hora Colombia: ${fechaCol} (${franja}). Usa el saludo correcto.
Datos: metodo=${lead.metodoActual || '?'}, clientes=${(lead.cantClientes || '').replace(/_/g, ' ') || '?'}, temp=${lead.temperatura || 0}
${avisos}

Conversacion:
${historialTexto}

ESTRATEGIA (#${numeroIntento}): ${estrategia}

REGLAS (violarlas = mensaje eliminado):
- Max 2-3 lineas. Nada de parrafos.
- Cada followup DIFERENTE al anterior. Lee lo que ya dijiste.
- Si no le interesa: darPorPerdido=true.
- 14 dias de prueba (no 15).
- PROHIBIDO: "un prestamista me conto", "un cliente nos dijo", cifras inventadas, historias de terceros. SOLO funciones reales.
- Tu nombre es Daniela. No eres bot ni IA.
- NUNCA corrijas al lead por decir "app" o "aplicacion".

Responde con la herramienta seguimiento_lead.`

  function sanitizarMensaje(msg) {
    let m = String(msg || '').trim()
    m = m.replace(/[^\x00-\x7F -ɏḀ-ỿ -⁯←-➿\u{1F300}-\u{1FAFF}]/gu, '')
    m = m.replace(/\b15 d[ií]as\b/gi, '14 días')
    m = m.replace(/(?:un|otro|cierto|alg[uú]n) (?:prestamista|cliente|usuario|persona)[\s\S]{0,250}?(?:me |nos )(?:cont[oó]|dijo|escribi[oó]|coment[oó])[\s\S]{0,250}?[.!?\n]/gi, '')
    m = m.replace(/(?:me |nos )(?:cont[oó]|dijo) (?:que |un )[\s\S]{0,200}?[.!?\n]/gi, '')
    m = m.replace(/(?:hay |muchos |varios )(?:prestamistas|clientes|usuarios) (?:que |nos )[\s\S]{0,200}?[.!?\n]/gi, '')
    m = m.replace(/(?:reducir|ahorrar|mejorar|aumentar|duplicar) (?:hasta |un |en )?\d+\s*%/gi, '')
    m = m.replace(/\b\d+\s*% (?:de |del |menos |más )/gi, '')
    m = m.replace(/soy [\wÀ-ɏ]+ de Control Finanzas/gi, 'soy Daniela de Control Finanzas')
    m = m.replace(/c[oó]digo\s+["']?\w+["']?/gi, '')
    m = m.replace(/cup[oó]n\s+["']?\w+["']?/gi, '')
    m = m.replace(/\n{3,}/g, '\n\n').replace(/  +/g, ' ').trim()
    if (!m.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{1F1E0}-\u{1F1FF}]/gu, '').trim()) {
      m = 'Quedo atenta si necesita algo.'
    }
    return m || 'Quedo atenta si necesita algo.'
  }

  try {
    const ds = await llamarDeepSeek(instruccion, [{ role: 'user', content: instruccion }], TOOL_SEGUIMIENTO, 'seguimiento_lead')
    const dsUsage = { modelo: DEEPSEEK_MODEL, tokensIn: ds.usage.prompt_tokens || 0, tokensOut: ds.usage.completion_tokens || 0, costoUsd: 0 }
    await registrarGasto('deepseek', DEEPSEEK_MODEL, dsUsage.tokensIn, dsUsage.tokensOut, 0)

    if (ds.parsed) {
      return {
        mensaje: sanitizarMensaje(ds.parsed.mensaje),
        darPorPerdido: Boolean(ds.parsed.darPorPerdido),
        usage: dsUsage,
      }
    }
    console.warn('[Bot Agent] DeepSeek no devolvio seguimiento estructurado, intentando Claude...')
  } catch (dsError) {
    console.warn('[Bot Agent] DeepSeek fallo (seguimiento), intentando Claude:', dsError.message)
  }

  if (!anthropic) {
    return { mensaje: '', darPorPerdido: false, usage: { modelo: 'ninguno', tokensIn: 0, tokensOut: 0, costoUsd: 0 } }
  }

  const resp = await anthropic.messages.create({
    model: modelo,
    max_tokens: 300,
    tools: [TOOL_SEGUIMIENTO],
    tool_choice: { type: 'tool', name: 'seguimiento_lead' },
    messages: [{ role: 'user', content: instruccion }],
  })

  const u = resp.usage || {}
  const costo = calcularCosto(u)
  const usage = {
    modelo,
    tokensIn: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0),
    tokensOut: u.output_tokens || 0,
    costoUsd: costo,
  }

  if (costo > 0) {
    await registrarGasto('anthropic', modelo, usage.tokensIn, usage.tokensOut, costo)
  }

  const toolUse = (resp.content || []).find(b => b.type === 'tool_use')
  if (toolUse?.input) {
    return {
      mensaje: sanitizarMensaje(toolUse.input.mensaje),
      darPorPerdido: Boolean(toolUse.input.darPorPerdido),
      usage,
    }
  }
  return { mensaje: '', darPorPerdido: false, usage }
}
