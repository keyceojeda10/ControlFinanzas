// lib/bot-v2/agente.js — Cerebro del bot v2.
// El codigo decide el stage y el prompt. El AI solo genera el texto.

import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { clasificar, PAGO_KEYWORDS } from './clasificador.js'
import { respuestaEscalamiento, RECHAZO } from './respuestas-fijas.js'
import { sanitizar, detectarViolaciones } from './sanitizador.js'
import { EMPRESA } from './producto.js'
import { detectarStage } from './stages.js'
import { variarSiRepetido } from './anti-repeticion.js'
import * as prompts from './prompts.js'

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ''
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'
const DEEPSEEK_MODEL = 'deepseek-chat'
// Tarifa deepseek-chat (USD por millon de tokens). Antes se registraba
// costoUsd=0, lo que hacia invisible el gasto real (millones de tokens en $0).
// Verificar contra la tarifa vigente de DeepSeek si cambian precios.
const DEEPSEEK_PRECIO_IN = 0.27
const DEEPSEEK_PRECIO_OUT = 1.10

const MODELO_CLAUDE = 'claude-haiku-4-5-20251001'

const TOOL_RESPONDER = {
  name: 'responder_lead',
  description: 'Respuesta para el prospecto.',
  input_schema: {
    type: 'object',
    properties: {
      mensaje: { type: 'string', description: 'Texto de WhatsApp para el lead.' },
      temperatura: { type: 'integer', description: 'Que tan caliente esta el lead (0-100).' },
      escalar: { type: 'boolean', description: 'true si hay que pasar a un humano.' },
    },
    required: ['mensaje', 'temperatura', 'escalar'],
  },
}

const TOOL_SEGUIMIENTO = {
  name: 'seguimiento_lead',
  description: 'Mensaje de seguimiento.',
  input_schema: {
    type: 'object',
    properties: {
      mensaje: { type: 'string', description: 'Mensaje de WhatsApp.' },
      darPorPerdido: { type: 'boolean', description: 'true si no hay que insistir.' },
    },
    required: ['mensaje', 'darPorPerdido'],
  },
}

// --- Utilidades ---

function historialTexto(mensajes) {
  return mensajes.map(m =>
    `${m.rol === 'bot' ? 'Bot' : 'Lead'}: ${(m.texto || '').slice(0, 300)}`
  ).join('\n') || '(sin conversacion previa)'
}

function franjaHoraria() {
  const horaCol = new Date(Date.now() - 5 * 3600 * 1000).getUTCHours()
  return horaCol < 12 ? 'mañana (buenos días)' : horaCol < 19 ? 'tarde (buenas tardes)' : 'noche (buenas noches)'
}

async function registrarGasto(proveedor, modelo, tokensIn, tokensOut, costoUsd) {
  try {
    await prisma.botGastoApi.create({
      data: { proveedor, modelo, tokensIn, tokensOut, costoUsd },
    })
  } catch {}
}

// --- Llamar DeepSeek ---

async function llamarDeepSeek(prompt, tool, toolName) {
  if (!DEEPSEEK_API_KEY) return null

  const body = {
    model: DEEPSEEK_MODEL,
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: 'Responde usando la herramienta.' },
    ],
    tools: [{
      type: 'function',
      function: { name: tool.name, description: tool.description, parameters: tool.input_schema },
    }],
    tool_choice: { type: 'function', function: { name: toolName } },
    max_tokens: 400,
    temperature: 0.3,
  }

  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${await res.text()}`)

  const data = await res.json()
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0]
  const usage = data.usage || {}

  let parsed = null
  if (toolCall?.function?.arguments) {
    try { parsed = JSON.parse(toolCall.function.arguments) } catch {}
  }

  return { parsed, usage }
}

// --- Llamar Claude ---

async function llamarClaude(prompt, tool, toolName, imagen) {
  if (!anthropic) return null

  const userContent = []
  if (imagen?.base64) {
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: imagen.mime || 'image/jpeg', data: imagen.base64 },
    })
  }
  userContent.push({ type: 'text', text: 'Responde usando la herramienta.' })

  const resp = await anthropic.messages.create({
    model: MODELO_CLAUDE,
    max_tokens: 400,
    system: [{ type: 'text', text: prompt, cache_control: { type: 'ephemeral' } }],
    tools: [tool],
    tool_choice: { type: 'tool', name: toolName },
    messages: [{ role: 'user', content: userContent }],
  })

  const toolUse = (resp.content || []).find(b => b.type === 'tool_use')
  const usage = resp.usage || {}

  return { parsed: toolUse?.input || null, usage }
}

// --- Llamar AI (Claude Haiku primero, DeepSeek fallback) ---

async function llamarAI(prompt, tool, toolName, imagen) {
  // Claude Haiku primero (mejor calidad + vision)
  try {
    const cl = await llamarClaude(prompt, tool, toolName, imagen)
    if (cl?.parsed) {
      const u = cl.usage
      const costo = ((u.input_tokens || 0) * 0.80 + (u.output_tokens || 0) * 4) / 1_000_000
      await registrarGasto('anthropic', MODELO_CLAUDE, u.input_tokens || 0, u.output_tokens || 0, costo)
      return { ...cl.parsed, _proveedor: 'claude' }
    }
  } catch (e) {
    console.warn('[Bot v2] Claude fallo:', e.message)
  }

  // DeepSeek fallback (sin vision)
  try {
    const ds = await llamarDeepSeek(prompt, tool, toolName)
    if (ds?.parsed) {
      const u = ds.usage
      const tin = u.prompt_tokens || 0
      const tout = u.completion_tokens || 0
      const costo = (tin * DEEPSEEK_PRECIO_IN + tout * DEEPSEEK_PRECIO_OUT) / 1_000_000
      await registrarGasto('deepseek', DEEPSEEK_MODEL, tin, tout, costo)
      return { ...ds.parsed, _proveedor: 'deepseek' }
    }
  } catch (e) {
    console.warn('[Bot v2] DeepSeek fallo:', e.message)
  }

  return null
}

// --- Verificar registro ---

async function verificarRegistro(telefono) {
  if (!telefono) return { yaRegistrado: false, estadoRegistro: 'no_registrado' }
  const digitos = telefono.replace(/\D/g, '')
  const ultimos10 = digitos.slice(-10)
  if (!ultimos10) return { yaRegistrado: false, estadoRegistro: 'no_registrado' }

  try {
    const usuario = await prisma.user.findFirst({
      where: { telefono: { endsWith: ultimos10 } },
      include: { organization: { select: { plan: true, planDemoHasta: true } } },
    })
    if (usuario) {
      const plan = usuario.organization?.plan || 'starter'
      const demo = usuario.organization?.planDemoHasta
      const enDemo = demo && new Date(demo) > new Date()
      return {
        yaRegistrado: true,
        estadoRegistro: enDemo ? `registrado_demo_${plan}` : `registrado_${plan}`,
        // Se devuelve para poder ATRIBUIR el lead a su organizacion. Sin esto la
        // atribucion se rompio el 5 jul: el bot marcaba 'registrado' pero no
        // vinculaba la org, y quedaron 359 leads / 23 registros sin poder medir.
        organizationId: usuario.organizationId || null,
      }
    }
  } catch {}
  return { yaRegistrado: false, estadoRegistro: 'no_registrado', organizationId: null }
}

// --- Detectar si el lead pide explicitamente el link ---

function leadPideLink(texto) {
  const t = (texto || '').toLowerCase()
  if (/(?:mand|env[ií]|pas|comp[aá]rt)[aeiouáéíóú]*(?:me(?:lo)?|nos)\s*(?:el |un |de nuevo |otra vez )?(?:link|enlace|url|click)/i.test(t)) return true
  if (/me\s+(?:puede|puedes?)\s+(?:mandar|enviar|pasar)\s+(?:el\s+)?(?:link|enlace|click)/i.test(t)) return true
  if (/(?:link|enlace)\s+(?:otra vez|de nuevo|nuevamente)/i.test(t)) return true
  if (/(?:d[oó]nde|c[oó]mo)\s+(?:me\s+)?(?:registro|inscribo)/i.test(t)) return true
  if (/(?:quiero\s+registrarme|me\s+quiero\s+registrar)/i.test(t)) return true
  if (/(?:mand[aáe]me(?:lo)?|env[ií]ame(?:lo)?|p[aá]same(?:lo)?)\s*(?:el\s+)?(?:de nuevo\s+)?(?:link|enlace|click)?/i.test(t)) return true
  if (/(?:donde|dónde)\s+(?:est[aá]|queda)\s+(?:el\s+)?(?:link|enlace)/i.test(t)) return true
  if (/necesit[oa]\s+(?:el\s+)?(?:link|enlace)/i.test(t)) return true
  if (/(?:d[ae]me|deme)\s+(?:el\s+)?(?:link|enlace)/i.test(t)) return true
  if (/(?:quiero|necesito)\s+(?:el\s+)?(?:link|enlace|entrar|acceder|ingresar)/i.test(t)) return true
  if (/(?:c[oó]mo|donde|dónde)\s+(?:entro|ingreso|accedo|abro)\s+(?:el |la |al )?(?:sistema|app|aplicaci[oó]n|plataforma)/i.test(t)) return true
  if (/(?:link|enlace|url)\s+(?:del |de la |para (?:entrar|acceder|ingresar))/i.test(t)) return true
  if (/(?:no\s+(?:tengo|encuentro|veo)\s+(?:el\s+)?(?:link|enlace))/i.test(t)) return true
  if (/cu[aá]l\s+(?:es\s+)?(?:el\s+)?(?:link|enlace)/i.test(t)) return true
  if (/se\s+me\s+(?:perdi[oó]|borr[oó]|olvid[oó]).*(?:link|enlace)/i.test(t)) return true
  // Mensajes cortos donde "link" o "enlace" es la palabra clave (ej: "El link", "link", "el enlace")
  if (/^\s*(?:el\s+)?(?:link|enlace|url)\s*[.!?]?\s*$/i.test(t)) return true
  return false
}

// --- Procesar link en mensaje ---

function procesarLink(mensaje, yaRegistrado, historial, textoEntrante) {
  const LINK = EMPRESA.linkRegistro
  const LINK_APP = EMPRESA.linkApp

  // Registrado que pide link: darle la URL del app (login), no la de registro
  if (yaRegistrado && leadPideLink(textoEntrante)) {
    const limpio = mensaje.replace(/\n*\s*https?:\/\/app\.control-finanzas\.com\/registro\S*/gi, '').trim()
    if (!limpio.includes('app.control-finanzas.com')) {
      return limpio + `\n\n${LINK_APP}`
    }
    return limpio
  }

  // Quitar link de registro de mensajes a registrados
  if (yaRegistrado && mensaje.includes('registro?r=2')) {
    return mensaje.replace(/\n*\s*https?:\/\/app\.control-finanzas\.com\/registro\?r=2/gi, '').trim()
  }

  // No-registrado que PIDE el link: SIEMPRE incluirlo aunque ya se envio
  if (!yaRegistrado && leadPideLink(textoEntrante)) {
    if (!mensaje.includes('app.control-finanzas.com')) {
      return mensaje + `\n\n${LINK}`
    }
    return mensaje
  }

  // Agregar link si el bot menciona registro/trial pero no incluyo la URL.
  // No auto-agregar solo porque dice "link" — el bot puede estar preguntando
  // "quiere que le mande el link?" sin intencion de adjuntarlo aun.
  const mencionaRegistro = /registr|probar|prueb.*gratis|d[ií]as gratis/i.test(mensaje)
  const esPreguntaSobreLink = /quiere.*(?:link|enlace)|(?:le |se lo )?(?:mando|env[ií]o).*(?:link|enlace)/i.test(mensaje)
  if (!yaRegistrado && mencionaRegistro && !esPreguntaSobreLink && !mensaje.includes('app.control-finanzas.com')) {
    return mensaje + `\n\n${LINK}`
  }

  return mensaje
}

// ============================================================
// FUNCION PRINCIPAL: responder al lead
// ============================================================

export async function responder(lead, historial, entrante) {
  const { yaRegistrado, estadoRegistro, organizationId: orgDelUsuario } = await verificarRegistro(lead.telefono)

  // Auto-marcar registrado. Se guarda TAMBIEN la organizacion: sin eso no se puede
  // atribuir el MRR al bot (la atribucion llevaba roto desde el 5 jul). Si el lead
  // ya tenia organizationId no se pisa.
  if (yaRegistrado && (lead.estado !== 'registrado' || (!lead.organizationId && orgDelUsuario))) {
    try {
      await prisma.botLead.update({
        where: { id: lead.id },
        data: {
          estado: 'registrado',
          temperatura: 100,
          ...(orgDelUsuario && !lead.organizationId && { organizationId: orgDelUsuario }),
        },
      })
    } catch {}
  }

  // Clasificar ANTES del AI
  const { tipo, razon } = clasificar(entrante.texto, { yaRegistrado })
  console.log(`[Bot v2] ${lead.nombre}: "${(entrante.texto || '').slice(0, 50)}" → ${tipo} (${razon || 'ventas'})`)

  // Respuestas deterministicas
  if (tipo === 'ignorar') return null
  if (tipo === 'rechazo') {
    return {
      mensaje: RECHAZO,
      temperatura: 0, escalar: false,
      usage: { modelo: 'fijo', tokensIn: 0, tokensOut: 0, costoUsd: 0 },
    }
  }
  if (tipo === 'escalar') {
    return {
      mensaje: respuestaEscalamiento(razon),
      temperatura: lead.temperatura || 50,
      escalar: true,
      motivo: razon,
      usage: { modelo: 'fijo', tokensIn: 0, tokensOut: 0, costoUsd: 0 },
    }
  }

  // Detectar stage
  const stage = detectarStage(historial, entrante.texto, yaRegistrado, lead)
  const hist = historialTexto(historial)
  const franja = franjaHoraria()

  // Construir dolor detectado desde datos del formulario FB
  let dolorDetectado = null
  if (lead.metodoActual) {
    const metodo = lead.metodoActual.toLowerCase()
    if (metodo.includes('libreta') || metodo.includes('cuaderno')) {
      dolorDetectado = 'Lleva su cartera en libreta/cuaderno — no sabe cuanto le deben sin sumar a mano'
    } else if ((/\bexcel\b/i.test(metodo) && !/excelente/i.test(metodo)) || metodo.includes('hoja')) {
      dolorDetectado = 'Usa Excel — no tiene control en tiempo real de cobradores ni cobros del dia'
    } else if (metodo.includes('app') || metodo.includes('sistema') || metodo.includes('software')) {
      dolorDetectado = 'Ya usa otro sistema/app — busca algo mejor o mas completo'
    } else {
      dolorDetectado = 'No lleva control organizado — riesgo de perder plata sin darse cuenta'
    }
  }

  // Elegir prompt segun stage
  let prompt
  switch (stage) {
    case 'SALUDO':
      prompt = prompts.promptSaludo({
        nombre: lead.nombre, metodo: lead.metodoActual,
        clientes: (lead.cantClientes || '').replace(/_/g, ' '), franja,
      })
      break
    case 'DESCUBRIMIENTO':
      prompt = prompts.promptDescubrimiento({ nombre: lead.nombre, historial: hist })
      break
    case 'VALOR':
      prompt = prompts.promptValor({ nombre: lead.nombre, historial: hist, dolorDetectado })
      break
    case 'CIERRE':
      prompt = prompts.promptCierre({ nombre: lead.nombre, historial: hist })
      break
    case 'POST_LINK':
      prompt = prompts.promptPostLink({ nombre: lead.nombre, historial: hist, yaRegistrado, estadoRegistro })
      break
    case 'PRECIOS':
      prompt = prompts.promptPrecios({
        nombre: lead.nombre, historial: hist,
        clientes: (lead.cantClientes || '').replace(/_/g, ' '),
      })
      break
    case 'OBJECION':
      prompt = prompts.promptObjecion({
        nombre: lead.nombre, historial: hist,
        objecion: entrante.texto,
      })
      break
    default:
      prompt = prompts.promptValor({ nombre: lead.nombre, historial: hist })
  }

  // Agregar el mensaje entrante al prompt
  const tieneImagen = entrante.tipoMensaje === 'image' && entrante.imagenBase64
  const etiqueta = entrante.tipoMensaje === 'audio' ? '[Nota de voz transcrita] '
    : tieneImagen ? '[El prospecto envió una imagen que puedes ver adjunta. Descríbela brevemente y responde en contexto de ventas.] '
    : entrante.tipoMensaje === 'image' ? '[El prospecto envió una imagen que no se pudo cargar] '
    : ''
  prompt += `\n\nMensaje del lead ahora:\n${etiqueta}${entrante.texto || '(sin texto)'}`
  prompt += '\n\nResponde con la herramienta responder_lead.'

  // Llamar AI (con vision si hay imagen)
  const imagen = tieneImagen ? { base64: entrante.imagenBase64, mime: entrante.imagenMime } : null
  const resultado = await llamarAI(prompt, TOOL_RESPONDER, 'responder_lead', imagen)

  if (!resultado) {
    return {
      mensaje: `Permitame un momento, ya le respondo.\n\nSi necesita algo ya puede escribir al ${EMPRESA.telefonoSoporte}.`,
      temperatura: 40, escalar: true,
      motivo: 'Ambos proveedores fallaron.',
      usage: { modelo: 'ninguno', tokensIn: 0, tokensOut: 0, costoUsd: 0 },
    }
  }

  console.log(`[Bot v2] ${lead.nombre}: AI=${resultado._proveedor} stage=${stage}`)

  // Post-procesar
  let mensaje = sanitizar(resultado.mensaje)
  mensaje = procesarLink(mensaje, yaRegistrado, historial, entrante.texto)

  // No contestar con un calco de lo que acabamos de decir. Si el mensaje lleva
  // el link no se toca: ahi el contenido importa mas que la variedad.
  if (!mensaje.includes('app.control-finanzas.com')) {
    mensaje = variarSiRepetido(mensaje, historial)
  }

  // Detectar violaciones del AI (logging)
  const violaciones = detectarViolaciones(resultado.mensaje)
  if (violaciones.length > 0) {
    console.warn(`[Bot v2] Violaciones detectadas para ${lead.nombre}:`, violaciones)
  }

  // Forzar escalamiento si menciona pago y el AI no escalo
  const textoLead = (entrante.texto || '').toLowerCase()
  let escalar = Boolean(resultado.escalar)
  let motivo = ''
  if (yaRegistrado && PAGO_KEYWORDS.some(k => textoLead.includes(k)) && !escalar) {
    escalar = true
    motivo = 'intencion_pago (forzado)'
    if (!mensaje.includes(EMPRESA.telefonoSoporte)) {
      mensaje += `\n\nPuede escribir al ${EMPRESA.telefonoSoporte}, lo atienden de ${EMPRESA.horarioSoporte}.`
    }
  }

  // Garantizar soporte en escalamientos
  if (escalar && !mensaje.includes(EMPRESA.telefonoSoporte)) {
    mensaje += `\n\nPuede escribir directo al ${EMPRESA.telefonoSoporte}, lo atienden de ${EMPRESA.horarioSoporte}.`
  }

  return {
    mensaje,
    temperatura: Math.max(0, Math.min(100, parseInt(resultado.temperatura, 10) || 0)),
    escalar,
    motivo,
    enviarGuia: null,
    usage: { modelo: resultado._proveedor || 'desconocido', tokensIn: 0, tokensOut: 0, costoUsd: 0 },
  }
}

// ============================================================
// FUNCION: generar seguimiento
// ============================================================

export async function generarSeguimiento(lead, historial, numeroIntento = 1) {
  const msgs = historial || []
  const hist = historialTexto(msgs)
  const franja = franjaHoraria()

  const textosBot = msgs.filter(m => m.rol === 'bot').map(m => (m.texto || '')).join(' ')
  const linkEnviado = textosBot.includes('app.control-finanzas.com/registro')
  const videoEnviado = /youtu\.be|youtube\.com/i.test(textosBot)
  const videollamadaOfrecida = /videollamada|llamada.*15 min|agendamos/i.test(textosBot)

  const leadRespondio = msgs.some(m => m.rol === 'lead')

  const prompt = prompts.promptSeguimiento({
    nombre: lead.nombre, historial: hist, intento: numeroIntento,
    metodo: lead.metodoActual, clientes: (lead.cantClientes || '').replace(/_/g, ' '),
    linkEnviado, videoEnviado, videollamadaOfrecida, leadRespondio, franja,
  }) + '\n\nResponde con la herramienta seguimiento_lead.'

  const resultado = await llamarAI(prompt, TOOL_SEGUIMIENTO, 'seguimiento_lead')

  if (!resultado) {
    return { mensaje: 'Quedo atento si necesita algo.', darPorPerdido: false }
  }

  let mensaje = sanitizar(resultado.mensaje)
  if (!mensaje || mensaje === 'Quedo atento, me avisa si tiene alguna duda.') {
    mensaje = 'Quedo atento si necesita algo.'
  }
  // Un seguimiento que repite el anterior es peor que no mandar nada.
  if (!mensaje.includes('app.control-finanzas.com')) {
    mensaje = variarSiRepetido(mensaje, msgs)
  }

  return {
    mensaje,
    darPorPerdido: Boolean(resultado.darPorPerdido),
    usage: { modelo: resultado._proveedor || 'desconocido', tokensIn: 0, tokensOut: 0, costoUsd: 0 },
  }
}
