// lib/bot/sales-agent.js — Sistema multi-agente para WhatsApp
// Router determinístico + 3 prompts especializados (ventas, soporte, cliente).
// Interfaz pública: responder() y generarSeguimiento() — sin cambios para los callers.

import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { calcularCosto } from './constants'
import { getGuia } from './guias-catalogo'
import { clasificar } from './router'
import { PROMPT_VENTAS } from './prompts/ventas'
import { PROMPT_SOPORTE } from './prompts/soporte'
import { PROMPT_CLIENTE } from './prompts/cliente'
import { construirContextoLead, construirContextoDatos, CONOCIMIENTO_TECNICO, DATOS_SISTEMA } from './prompts/contexto'

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

// Prompt por tipo de agente
const PROMPTS = {
  ventas: PROMPT_VENTAS,
  soporte: PROMPT_SOPORTE,
  cliente: PROMPT_CLIENTE,
  escalamiento: null, // no necesita IA — respuesta fija
}

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

// Ensambla el system prompt completo para un agente
function ensamblarPrompt(tipoAgente, estadoRegistro) {
  const basePrompt = PROMPTS[tipoAgente]
  if (!basePrompt) return ''

  const datos = construirContextoDatos()

  const partes = [basePrompt]

  // Conocimiento técnico para soporte y cliente (ventas no lo necesita tan detallado)
  if (tipoAgente === 'soporte' || tipoAgente === 'cliente') {
    partes.push(`\n## CONOCIMIENTO TECNICO DEL SISTEMA\n${CONOCIMIENTO_TECNICO}`)
  }

  // Datos estáticos siempre al final
  partes.push(`\n${datos}`)

  return partes.join('\n')
}

/**
 * Genera respuesta del agente para un mensaje entrante.
 */
export async function responder(lead, historial, entrante) {
  if (!anthropic && !DEEPSEEK_API_KEY) {
    throw new Error('No hay API configurada — falta ANTHROPIC_API_KEY y DEEPSEEK_API_KEY.')
  }

  const modelo = await getModelo()

  // Verificar si el lead ya se registró en el sistema
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

  // Router: clasificar qué agente usar
  const tipoAgente = clasificar({
    mensaje: entrante.texto || '',
    estadoRegistro,
    estadoLead: lead.estado,
    historial,
  })

  console.log(`[Bot Router] ${lead.nombre}: "${(entrante.texto || '').slice(0, 50)}" → ${tipoAgente}`)

  // Escalamiento no necesita IA — respuesta fija directa
  if (tipoAgente === 'escalamiento') {
    return {
      mensaje: `Claro, le paso su caso a nuestro equipo para que lo atiendan directamente. Puede escribirles al ${DATOS_SISTEMA.telefonoSoporte} (${DATOS_SISTEMA.horarioSoporte}) o si prefiere agendar una videollamada: ${DATOS_SISTEMA.linkCalendario15}`,
      temperatura: lead.temperatura || 50,
      escalar: true,
      motivo: 'lead pidio atencion humana',
      enviarGuia: null,
      usage: { modelo: 'router', tokensIn: 0, tokensOut: 0, costoUsd: 0 },
    }
  }

  // Ensamblar prompt especializado
  const systemPrompt = ensamblarPrompt(tipoAgente, estadoRegistro)

  // Hora Colombia
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

  // Mensaje entrante
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

  // Post-procesamiento del resultado
  function postProcesar(mensaje) {
    let msg = String(mensaje || '').trim() || 'Permitame un momento, ya le respondo.'

    const REGISTRO_URL = 'https://app.control-finanzas.com/registro?r=2'
    const RESET_URL = 'https://app.control-finanzas.com/reset-password'

    // Inyectar link de registro si menciona registro pero no tiene la URL
    if (!yaRegistrado && /registr|inscrib|probar|prueb.*gratis|dias gratis|14 dias/i.test(msg) && !msg.includes('app.control-finanzas.com')) {
      msg += `\n\n${REGISTRO_URL}`
    }

    // Quitar link de registro si el lead ya está registrado
    if (yaRegistrado && msg.includes('registro?r=2')) {
      msg = msg.replace(/\n*\s*https?:\/\/app\.control-finanzas\.com\/registro\?r=2/gi, '').trim()
    }

    // Inyectar link de reset solo en agentes de soporte/cliente (no ventas)
    if (tipoAgente !== 'ventas' && /contrase[nñ]a|reset|recuperar.*cuenta|no puede entrar/i.test(msg) && !msg.includes('reset-password')) {
      msg += `\n\n${RESET_URL}`
    }

    // Quitar link duplicado si el último mensaje del bot ya lo tenía
    const ultimoBot = [...historial].reverse().find(m => m.rol === 'bot')
    const ultimoBotTieneLink = ultimoBot && (ultimoBot.texto || '').includes('app.control-finanzas.com/registro')
    const leadPideLink = /link|registro|registr|como entro|como hago|donde|enviam/i.test(entrante.texto || '')
    if (ultimoBotTieneLink && !leadPideLink && msg.includes('app.control-finanzas.com/registro')) {
      msg = msg.replace(/\s*https:\/\/app\.control-finanzas\.com\/registro\S*/g, '').trim()
    }

    return msg
  }

  // DeepSeek principal, Claude fallback
  try {
    const ds = await llamarDeepSeek(systemPrompt, messages, TOOL_RESPONDER, 'responder_lead')
    const dsUsage = { modelo: `${DEEPSEEK_MODEL}:${tipoAgente}`, tokensIn: ds.usage.prompt_tokens || 0, tokensOut: ds.usage.completion_tokens || 0, costoUsd: 0 }
    await registrarGasto('deepseek', `${DEEPSEEK_MODEL}:${tipoAgente}`, dsUsage.tokensIn, dsUsage.tokensOut, 0)

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

  // Fallback a Claude
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
    modelo: `${modelo}:${tipoAgente}`,
    tokensIn: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0),
    tokensOut: u.output_tokens || 0,
    costoUsd: costo,
  }

  if (costo > 0) {
    await registrarGasto('anthropic', `${modelo}:${tipoAgente}`, usage.tokensIn, usage.tokensOut, costo)
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

  const historialTexto = (historial || [])
    .map(m => `${m.rol === 'bot' ? 'Asesor' : 'Prospecto'}: ${m.texto || ''}`)
    .join('\n') || '(el prospecto nunca respondio)'

  const ahoraCol = new Date(Date.now() - 5 * 3600 * 1000)
  const horaCol = ahoraCol.getUTCHours()
  const franja = horaCol < 12 ? 'mañana (buenos días)' : horaCol < 19 ? 'tarde (buenas tardes)' : 'noche (buenas noches)'
  const fechaCol = ahoraCol.toISOString().slice(0, 16).replace('T', ' ')

  const estrategiaPorIntento = {
    1: 'Lee la conversacion y responde segun lo que REALMENTE paso: si le mandaste un link, pregunta si lo pudo abrir. Si solo le hiciste una pregunta y no respondio, retoma esa pregunta de otra forma o aporta un beneficio corto. NUNCA hables de "el enlace que te comparti" si no mandaste ningun enlace.',
    2: 'Comparte un CASO DE EXITO o dato nuevo que no hayas dicho: "Un prestamista me dijo que en 2 dias ya tenia toda su cartera digitalizada" o menciona una funcion relevante al dolor que el lead menciono.',
    3: `Ofrece VIDEOLLAMADA o soporte humano: "Si le queda mas facil, puede escribirle a nuestro equipo al ${DATOS_SISTEMA.telefonoSoporte} o agendamos una videollamada de 15 min para mostrarle todo en vivo. Que dia le queda bien?"`,
    4: 'Ultimo empujon suave. Reconoce que has insistido, aporta UN dato de valor final: "Solo queria dejarle el dato de que el sistema funciona hasta sin internet" o similar. Breve.',
    5: 'Cierre final: "Quedo atento si en algun momento lo necesita. Le dejo mi contacto por si mas adelante quiere darle una mirada." Deja la puerta abierta sin presion.',
  }
  const estrategia = estrategiaPorIntento[numeroIntento] || estrategiaPorIntento[5]

  const instruccion = `Eres asesor de Control Finanzas (sistema de cartera y cobros para prestamistas). Estas haciendo SEGUIMIENTO a un prospecto (${lead.nombre || 'prestamista'}) que no ha avanzado. Intento ${numeroIntento} de 5.

Hora actual en Colombia: ${fechaCol} — es de ${franja}. Si tu mensaje incluye un saludo, usa el correcto segun esta hora; nunca digas "buenos dias" si es tarde o noche.

Datos del lead:
- Metodo actual: ${lead.metodoActual || 'no especificado'}
- Cant clientes: ${lead.cantClientes || 'no especificado'}
- Temperatura: ${lead.temperatura || 0}

Conversacion hasta ahora:
${historialTexto}

ESTRATEGIA PARA ESTE INTENTO (#${numeroIntento}):
${estrategia}

Reglas:
- CADA followup debe ser DISTINTO al anterior. NUNCA repitas el mismo mensaje reformulado.
- NO repitas el link de registro si ya lo mandaste antes. El lead ya lo tiene.
- Si ya dejo claro que NO le interesa: marca darPorPerdido=true.
- Evita abrir siempre con un saludo tipo "Hola" — varia la forma de retomar.
- Maximo 2-3 lineas. Mensajes largos en followup se ignoran.

Responde usando la herramienta seguimiento_lead.`

  try {
    const ds = await llamarDeepSeek(instruccion, [{ role: 'user', content: instruccion }], TOOL_SEGUIMIENTO, 'seguimiento_lead')
    const dsUsage = { modelo: DEEPSEEK_MODEL, tokensIn: ds.usage.prompt_tokens || 0, tokensOut: ds.usage.completion_tokens || 0, costoUsd: 0 }
    await registrarGasto('deepseek', DEEPSEEK_MODEL, dsUsage.tokensIn, dsUsage.tokensOut, 0)

    if (ds.parsed) {
      return {
        mensaje: String(ds.parsed.mensaje || '').trim(),
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
      mensaje: String(toolUse.input.mensaje || '').trim(),
      darPorPerdido: Boolean(toolUse.input.darPorPerdido),
      usage,
    }
  }
  return { mensaje: '', darPorPerdido: false, usage }
}
