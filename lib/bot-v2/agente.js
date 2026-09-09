// lib/bot-v2/agente.js — Cerebro del bot v2.
// El codigo decide el stage y el prompt. El AI solo genera el texto.

import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { intencionDeClasificacion } from './cadencia.js'
import { promptIdDe, FIJO } from './traza.js'
import { clasificar, PAGO_KEYWORDS } from './clasificador.js'
import { respuestaEscalamiento, RECHAZO, TUTORIALES, ACCESO, esPrimerTurnoTrasApertura, esRespuestaGenerica, pitchTrasSolicitud } from './respuestas-fijas.js'
import { sanitizar, detectarViolaciones } from './sanitizador.js'
import { validar, correccionPara, linkPermitidoEn, leadPideLink } from './validador.js'
import { nivelDeSoporte } from './soporte.js'
import { segmentoDe, objecionDe, argumentosPara, textoArgumentos } from './argumentos.js'
import { elegirVideo, textoDeVideo } from './videos.js'
import { EMPRESA } from './producto.js'
import { detectarStage, etapaDesdeIntencion } from './stages.js'
import { contextoDe } from './contexto.js'
import { clasificarIntencion, necesitaSemantica, varianteDe } from './intencion.js'
import { variarSiRepetido, esCalcoLargo, tieneDudasAbiertas, esDespedida } from './anti-repeticion.js'
import * as prompts from './prompts.js'
/* El rango de clientes ENTRA AL PROMPT, así que lo lee el cliente en el primer
   mensaje. Salía por `.replace(/_/g, ' ')`, que convierte `20_50` en «20 50»:
   medido, 610 de 1.220 leads con dato lo recibieron así, y con el formulario
   v18 (`20_50`, `50_100`) le tocaría a TODOS los de 20 a 100. `fb-leads` no
   importa nada —es un módulo hoja—, así que traerlo aquí no arrastra nada. */
import { textoCantClientes } from '@/lib/fb-leads'

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

/* ══ EL MODELO PRINCIPAL SE ELIGE POR VARIABLE, SIN DESPLEGAR ═══════════════
   `BOT_MODELO=claude` (por defecto) o `deepseek`. El otro queda de respaldo.
   ⚠ Las tres auditorías del 8 sep 2026 dijeron NO cambiar de modelo primero:
   el fallo estaba en el código que decide, no en el que redacta. Y el gasto
   entero de IA es ~6 dólares al mes. Se deja configurable para que la
   decisión sea del dueño y con las dos salidas delante, no de un despliegue.
   ⚠ DeepSeek no ve imágenes: con foto, Claude va primero pase lo que pase. */
const MODELO_PRINCIPAL = process.env.BOT_MODELO === 'deepseek' ? 'deepseek' : 'claude'

async function conClaude(prompt, tool, toolName, imagen, t0) {
  const cl = await llamarClaude(prompt, tool, toolName, imagen)
  if (!cl?.parsed) return null
  const u = cl.usage
  const costo = ((u.input_tokens || 0) * 0.80 + (u.output_tokens || 0) * 4) / 1_000_000
  await registrarGasto('anthropic', MODELO_CLAUDE, u.input_tokens || 0, u.output_tokens || 0, costo)
  return { ...cl.parsed, _proveedor: 'claude', _latenciaMs: Date.now() - t0 }
}
async function conDeepSeek(prompt, tool, toolName, t0) {
  const ds = await llamarDeepSeek(prompt, tool, toolName)
  if (!ds?.parsed) return null
  const u = ds.usage
  const tin = u.prompt_tokens || 0, tout = u.completion_tokens || 0
  await registrarGasto('deepseek', DEEPSEEK_MODEL, tin, tout, (tin * DEEPSEEK_PRECIO_IN + tout * DEEPSEEK_PRECIO_OUT) / 1_000_000)
  return { ...ds.parsed, _proveedor: 'deepseek', _latenciaMs: Date.now() - t0 }
}

async function llamarAI(prompt, tool, toolName, imagen) {
  const t0 = Date.now()
  const orden = (MODELO_PRINCIPAL === 'deepseek' && !imagen?.base64) ? ['deepseek', 'claude'] : ['claude', 'deepseek']
  for (const p of orden) {
    try {
      const r = p === 'claude' ? await conClaude(prompt, tool, toolName, imagen, t0) : await conDeepSeek(prompt, tool, toolName, t0)
      if (r) return r
    } catch (e) {
      console.warn(`[Bot v2] ${p} fallo:`, e.message)
    }
  }
  return null
}

/* La traza (BOT v3 · sprint 1): `promptIdDe` y `FIJO` viven en ./traza.js,
   que es puro y se puede probar sin levantar prisma. */

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

// --- Procesar link en mensaje ---

/* BOT v3 · sprint 6: el link es una ACCIÓN que autoriza el código. `linkPermitido`
   lo decide `linkPermitidoEn` (etapa + petición + registro + intención). La
   heurística vieja («menciona registro → pega el link») solo corre si la
   política lo permite: era la vía por la que el link caía en VALOR y
   DESCUBRIMIENTO antes de tiempo. Si el lead lo PIDE, va siempre. */
function procesarLink(mensaje, yaRegistrado, historial, textoEntrante, { linkPermitido = true } = {}) {
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
  if (linkPermitido && !yaRegistrado && mencionaRegistro && !esPreguntaSobreLink && !mensaje.includes('app.control-finanzas.com')) {
    return mensaje + `\n\n${LINK}`
  }
  return mensaje
}

// ============================================================
// FUNCION PRINCIPAL: responder al lead
// ============================================================

/**
 * @param entrante.forzarRegistrado  SOLO EL SIMULADOR. Si viene definido, se usa
 *   en vez de buscar el teléfono en la base.
 *
 *   ⚠ Sin esto, el interruptor «simular que se registró» del simulador NO HACÍA
 *   NADA con el bot v3: el teléfono del simulador es ficticio, `verificarRegistro`
 *   no lo encuentra y todo caía por el camino de venta. O sea que los caminos de
 *   cliente —el enlace de acceso, los vídeos, las preguntas de plata— no se
 *   podían probar. Se vio el 8 sep probando el simulador de punta a punta.
 */
export async function responder(lead, historial, entrante) {
  const forzado = entrante?.forzarRegistrado
  const real = await verificarRegistro(lead.telefono)
  const { yaRegistrado, estadoRegistro, organizationId: orgDelUsuario } = typeof forzado === 'boolean'
    ? { yaRegistrado: forzado, estadoRegistro: forzado ? 'registrado' : 'no_registrado', organizationId: forzado ? (lead.organizationId || 'simulado') : null }
    : real

  // Auto-marcar registrado. Se guarda TAMBIEN la organizacion: sin eso no se puede
  // atribuir el MRR al bot (la atribucion llevaba roto desde el 5 jul). Si el lead
  // ya tenia organizationId no se pisa.
  // Con el registro forzado (simulador) no se escribe nada: ese lead no existe.
  if (typeof forzado !== 'boolean'
      && yaRegistrado && (lead.estado !== 'registrado' || (!lead.organizationId && orgDelUsuario))) {
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
    /* `rechazo: true` lo lee el webhook para dejar de programarle seguimientos.
       Sin esa marca, quien contesta «no me interesa» caía en la rama de abajo:
       pasaba a `interesado`, se le programaba seguimiento a 1-2 días y se le
       reportaba a Meta como lead cualificado. Con la apertura de utilidad, que
       pregunta «¿quiere que le contemos?», el «no» explícito es mucho más
       frecuente que con el hook viejo, que no preguntaba nada. */
    return {
      mensaje: RECHAZO,
      temperatura: 0, escalar: false, rechazo: true,
      usage: { modelo: 'fijo', tokensIn: 0, tokensOut: 0, costoUsd: 0 },
      traza: FIJO(`rechazo:${razon}`),
    }
  }
  /* ⚠ `escalar: false`. Pedir un tutorial no es un problema que atender: si
     escalara, cada «tienen videos?» le sonaría el WhatsApp al equipo para
     mandar un enlace que ya está escrito. */
  if (tipo === 'tutoriales') {
    /* Si se entiende de QUÉ quiere el vídeo, va ese y no la lista de 17. */
    const suyo = elegirVideo(entrante.texto)
    if (suyo) {
      return {
        mensaje: textoDeVideo(suyo, { registrado: yaRegistrado }),
        temperatura: lead.temperatura || 50, escalar: false,
        usage: { modelo: 'fijo', tokensIn: 0, tokensOut: 0, costoUsd: 0 },
        traza: FIJO(`tutoriales:${razon}`, { promptId: `video:${suyo.n}` }),
      }
    }
    return {
      mensaje: TUTORIALES[razon] || TUTORIALES.lead,
      temperatura: lead.temperatura || 50,
      escalar: false,
      usage: { modelo: 'fijo', tokensIn: 0, tokensOut: 0, costoUsd: 0 },
      traza: FIJO(`tutoriales:${razon}`),
    }
  }
  if (tipo === 'escalar') {
    /* ══ SOPORTE EN TRES NIVELES AL QUE YA ES CLIENTE (sprint 8, Kimi #7) ═══
     *
     * Va AQUÍ DENTRO, y no después, porque el clasificador manda a
     * `soporte_registrado` casi todo lo que escribe un cliente: «como creo una
     * ruta a ver» incluido. Puesto más abajo no se habría mandado una sola
     * guía, que es exactamente el error que ya llevaba meses cometido.
     *
     * De los tres niveles, el bot solo contesta uno. Las preguntas de plata y
     * los fallos técnicos siguen yendo a una persona, con un texto que dice
     * algo del problema en vez de despachar. */
    if (yaRegistrado && (razon === 'soporte' || razon === 'soporte_registrado')) {
      const nivel = nivelDeSoporte(entrante.texto, { yaRegistrado })
      if (nivel === 'dinero' || nivel === 'tecnico') {
        return { mensaje: respuestaEscalamiento(nivel), temperatura: lead.temperatura || 50, escalar: true, motivo: nivel,
          usage: { modelo: 'fijo', tokensIn: 0, tokensOut: 0, costoUsd: 0 }, traza: FIJO(`escalar:${nivel}`) }
      }
      /* El que contesta «cómo se hace tal cosa» es el VÍDEO del tema. Los
         tutoriales se publicaron el 24 de agosto y sí enseñan la interfaz de
         hoy, comprobado fotograma a fotograma contra el espejo. */
      const video = elegirVideo(entrante.texto)
      if (video) {
        return { mensaje: textoDeVideo(video, { registrado: true }), temperatura: lead.temperatura || 50, escalar: false,
          usage: { modelo: 'fijo', tokensIn: 0, tokensOut: 0, costoUsd: 0 }, traza: FIJO('video', { promptId: `video:${video.n}` }) }
      }
    }
    /* El cliente que quiere pagar recibe el sitio donde se paga, no un
       teléfono. Y se sigue avisando al equipo: es dinero entrando. */
    const razonFinal = (razon === 'intencion_pago' && yaRegistrado) ? 'intencion_pago_registrado' : razon
    return {
      mensaje: respuestaEscalamiento(razonFinal),
      temperatura: lead.temperatura || 50,
      escalar: true,
      motivo: razonFinal,
      usage: { modelo: 'fijo', tokensIn: 0, tokensOut: 0, costoUsd: 0 },
      traza: FIJO(`escalar:${razonFinal}`),
    }
  }

  /* ══ LA INTENCIÓN, CON MODELO (BOT v3 · sprint 3) ═════════════════════════
     Solo para mensajes de venta que ningún regex fuerte resolvió, y solo en la
     variante «semantica» del A/B por lead. Si el modelo no contesta o no está
     seguro, decide `detectarStage` de siempre: la semántica nunca puede dejar
     al bot mudo. Lo que decidió queda en la traza (`clasificacion`). */
  const variante = varianteDe(lead.id)
  let intencion = null
  let clasificacionTraza = 'ventas'
  if (variante === 'semantica' && necesitaSemantica(entrante.texto)) {
    const ultimoBot = [...historial].reverse().find(m => m.rol === 'bot')?.texto || ''
    const ultimoLead = [...historial].reverse().filter(m => m.rol === 'lead').slice(1, 2)[0]?.texto || ''
    const linkEnviado = historial.some(m => m.rol === 'bot' && /app\.control-finanzas\.com\/registro/.test(m.texto || ''))
    intencion = await clasificarIntencion({ texto: entrante.texto, ultimoBot, ultimoLead, linkEnviado, registrado: yaRegistrado })
    if (intencion) {
      clasificacionTraza = `ventas>${intencion.intencion}(${intencion.confianza.toFixed(2)})`
      await registrarGasto('anthropic', 'intencion', intencion.tokensIn, intencion.tokensOut, (intencion.tokensIn * 0.80 + intencion.tokensOut * 4) / 1_000_000)
    } else {
      clasificacionTraza = 'ventas>sin-semantica'
    }
  } else if (variante === 'semantica') {
    clasificacionTraza = 'ventas>regex-fuerte'
  }

  const semantica = intencion ? etapaDesdeIntencion(intencion, { historial, yaRegistrado, lead }) : null
  // El modelo vio lo que el regex no vio: soporte, humano, rechazo, tutoriales.
  if (semantica?.rechazo) {
    return { mensaje: RECHAZO, temperatura: 0, escalar: false, rechazo: true,
      usage: { modelo: 'fijo', tokensIn: 0, tokensOut: 0, costoUsd: 0 }, traza: FIJO(`${clasificacionTraza}>rechazo`) }
  }
  if (semantica?.tutoriales) {
    // Igual que por el camino de regex: el vídeo de SU tema si se entiende cuál.
    const suyo = elegirVideo(entrante.texto)
    return { mensaje: suyo ? textoDeVideo(suyo, { registrado: yaRegistrado }) : (TUTORIALES[semantica.tutoriales] || TUTORIALES.lead),
      temperatura: lead.temperatura || 50, escalar: false,
      usage: { modelo: 'fijo', tokensIn: 0, tokensOut: 0, costoUsd: 0 },
      traza: FIJO(`${clasificacionTraza}>tutoriales`, suyo ? { promptId: `video:${suyo.n}` } : {}) }
  }
  if (semantica?.escalar) {
    return { mensaje: respuestaEscalamiento(semantica.escalar), temperatura: lead.temperatura || 50, escalar: true, motivo: semantica.escalar,
      usage: { modelo: 'fijo', tokensIn: 0, tokensOut: 0, costoUsd: 0 }, traza: FIJO(`${clasificacionTraza}>escalar`) }
  }

  /* ══ «¿POR DÓNDE ENTRO?» → EL ENLACE, Y YA ═════════════════════════════════
   *
   * Es la pregunta número uno de la gente registrada: 38 de las 204 medidas el
   * 2 sep, de 28 personas. El dueño, viendo el tutorial que le habíamos hecho:
   * «eso se solucionaba fácilmente enviándole el link de acceso con el
   * respectivo mensaje, es una pendejada». Quien pregunta dónde está la puerta
   * quiere la puerta.
   *
   * Va como camino fijo y ANTES del modelo: la URL tiene que salir exacta
   * siempre, y no hay nada que redactar. El vídeo de instalar va detrás, en una
   * línea, porque poner el icono sí hay que enseñarlo. */
  if (yaRegistrado && leadPideLink(entrante.texto)) {
    return {
      mensaje: ACCESO,
      temperatura: lead.temperatura || 50, escalar: false,
      usage: { modelo: 'fijo', tokensIn: 0, tokensOut: 0, costoUsd: 0 },
      traza: FIJO(`${clasificacionTraza}>acceso`, { promptId: 'acceso' }),
    }
  }

  /* ══ AL QUE YA ES CLIENTE Y PREGUNTA CÓMO SE HACE ALGO ════════════════════
   *
   * Es el grupo más grande de lo que escribe la gente registrada: 27 % de 204
   * preguntas medidas el 2 sep. Se contesta con el VÍDEO de ese tema.
   *
   * Este camino recoge al que NO cayó en el de soporte: «¿dónde descargo la
   * app?» se clasifica como venta y aun así merece su respuesta. */
  if (yaRegistrado) {
    /* ⚠ La plata y los fallos técnicos, TAMBIÉN por aquí. El bloque de dentro
       del escalamiento solo los ve si el clasificador mandó a `soporte`, y hay
       preguntas que no pasan por ahí: «no me cuadra la caja de hoy» se
       clasificaba como venta y la contestaba el modelo. Se vio probando el
       simulador de punta a punta el 8 sep. */
    const nivel = nivelDeSoporte(entrante.texto, { yaRegistrado })
    if (nivel === 'dinero' || nivel === 'tecnico') {
      return { mensaje: respuestaEscalamiento(nivel), temperatura: lead.temperatura || 50, escalar: true, motivo: nivel,
        usage: { modelo: 'fijo', tokensIn: 0, tokensOut: 0, costoUsd: 0 }, traza: FIJO(`${clasificacionTraza}>${nivel}`) }
    }
    const video = elegirVideo(entrante.texto)
    if (video) {
      return { mensaje: textoDeVideo(video, { registrado: true }), temperatura: lead.temperatura || 50, escalar: false,
        usage: { modelo: 'fijo', tokensIn: 0, tokensOut: 0, costoUsd: 0 }, traza: FIJO(`${clasificacionTraza}>video`, { promptId: `video:${video.n}` }) }
    }
  }

  // Detectar stage: la semántica si la hubo y mereció confianza; si no, el árbol.
  const stage = semantica?.etapa || detectarStage(historial, entrante.texto, yaRegistrado, lead)

  /* ══ TRAS LA APERTURA DE UTILIDAD, EL PITCH ES FIJO ═══════════════════════
     Primer mensaje del lead después de «recibimos tu solicitud», y es un
     «sí / claro / cuénteme»: el mensaje que vende sale siempre igual, de
     `pitchTrasSolicitud`, no del modelo. Si lo primero que dice es de precio,
     una objeción o algo concreto suyo («¿sirve para diario?»), eso se
     contesta a lo suyo con el modelo. Desde el segundo turno, sus etapas. */
  if (!['PRECIOS', 'OBJECION', 'POST_LINK'].includes(stage)
      && esPrimerTurnoTrasApertura(historial) && esRespuestaGenerica(entrante.texto)) {
    return {
      mensaje: pitchTrasSolicitud({ nombre: lead.nombre, diasPrueba: EMPRESA.diasPrueba }),
      temperatura: Math.max(45, lead.temperatura || 0),
      escalar: false,
      usage: { modelo: 'fijo', tokensIn: 0, tokensOut: 0, costoUsd: 0 },
      traza: FIJO(clasificacionTraza, { etapa: stage, promptId: 'pitchTrasSolicitud' }),
    }
  }
  const hist = historialTexto(historial)
  const franja = franjaHoraria()
  // Lo que ya pasó, UNA vez y para todos los prompts (BOT v3 · sprint 4).
  const contexto = contextoDe(historial, { lead, yaRegistrado })

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
        clientes: textoCantClientes(lead.cantClientes), franja,
      })
      break
    case 'DESCUBRIMIENTO':
      prompt = prompts.promptDescubrimiento({ nombre: lead.nombre, historial: hist, contexto })
      break
    case 'VALOR': {
      const linkEnviado = historial.some(m => m.rol === 'bot' && /app\.control-finanzas\.com\/registro/.test(m.texto || ''))
      /* La munición del vendedor: los argumentos que le sirven a ESTE lead
         —según cómo cobra— y que todavía no se han usado. Sin lo segundo, el
         bot repite el mismo tres veces: medido en producción el 8 sep, un lead
         con 60 cartulinas recibió cuatro mensajes con el mismo argumento. */
      const segmento = segmentoDe(entrante.texto, historial)
      const argumentos = textoArgumentos(argumentosPara({ segmento, usados: contexto?.argumentosUsados || [] }))
      prompt = prompts.promptValor({
        nombre: lead.nombre, historial: hist, dolorDetectado, linkEnviado, contexto,
        argumentos, objecion: objecionDe(entrante.texto)?.responder || null,
      })
      break
    }
    case 'CIERRE':
      prompt = prompts.promptCierre({ nombre: lead.nombre, historial: hist, contexto })
      break
    case 'POST_LINK':
      prompt = prompts.promptPostLink({ nombre: lead.nombre, historial: hist, yaRegistrado, estadoRegistro, contexto })
      break
    case 'PRECIOS':
      prompt = prompts.promptPrecios({
        nombre: lead.nombre, historial: hist,
        clientes: textoCantClientes(lead.cantClientes), contexto,
      })
      break
    case 'OBJECION':
      prompt = prompts.promptObjecion({
        respuesta: objecionDe(entrante.texto)?.responder || null,
        nombre: lead.nombre, historial: hist,
        objecion: entrante.texto, contexto,
      })
      break
    default:
      prompt = prompts.promptValor({ nombre: lead.nombre, historial: hist, contexto })
  }

  /* La política del link se decide ANTES de llamar al modelo, y se le dice.
     Medido sobre los 679 turnos reales: 111 de las 236 correcciones habrían
     sido solo por el link. Avisar cuesta una línea de prompt; corregir cuesta
     una llamada entera. El aviso no entra en el `promptId` (`promptBase`), para
     que la traza siga teniendo un hash por etapa y no dos. */
  const linkPermitido = linkPermitidoEn({ stage, leadPideLink: leadPideLink(entrante.texto), yaRegistrado, intencion })
  const promptBase = prompt
  if (!linkPermitido) {
    prompt += yaRegistrado
      ? '\n\nIMPORTANTE: este lead YA ESTÁ REGISTRADO. NO escribas el enlace de registro. Si necesita entrar, es app.control-finanzas.com.'
      : '\n\nIMPORTANTE: en este punto NO toca mandar el enlace de registro; el lead no lo ha pedido y todavía no está cerrando. Responde a lo que dijo, sin enlace. Si él lo pide, entonces sí.'
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
      traza: { etapa: stage, clasificacion: clasificacionTraza, proveedor: 'ninguno', promptId: promptIdDe(stage, promptBase, hist, lead.nombre, entrante.texto) },
    }
  }

  console.log(`[Bot v2] ${lead.nombre}: AI=${resultado._proveedor} stage=${stage}`)

  // Post-procesar
  let mensaje = sanitizar(resultado.mensaje, entrante.texto)
  mensaje = procesarLink(mensaje, yaRegistrado, historial, entrante.texto, { linkPermitido })
  // Para la traza: lo que dijo el modelo ANTES de tocarlo, y cuánto tardó.
  let crudo = resultado.mensaje
  let latenciaMs = (resultado._latenciaMs || 0) + (intencion?.latenciaMs || 0)

  /* ══ EL VALIDADOR Y LA REGENERACIÓN CON MOTIVO (BOT v3 · sprints 6 y 7) ═══
   *
   * Antes: una «segunda pasada» que solo miraba dos cosas (calco largo y
   * despedida con dudas), y un sanitizador que borraba oraciones a ciegas.
   * Ahora `validar()` mira trece cosas, con nombre, y si algo falla el modelo
   * recibe EXACTAMENTE qué hizo mal y vuelve a escribir. Se paga solo cuando
   * el fallo ya ocurrió. Si vuelve a fallar en algo DURO, el sanitizador lo
   * recorta a la fuerza (última red); en algo blando, se manda el intento con
   * menos motivos. Todo queda en la traza (`violaciones`, `segundaPasada`).
   *
   * Y EL LINK ES UNA ACCIÓN, no un reflejo: `linkPermitidoEn` decide si en
   * este punto toca; si el modelo lo puso donde no toca, se le pide otra
   * respuesta y, si insiste, se le quita. Si toca y no lo puso, lo añade el
   * código (`procesarLink`), con la URL exacta. */
  const ctxValidar = { textoLead: entrante.texto, contexto, stage, historial, linkPermitido, pais: lead.pais || lead.country || null }
  let v = validar(mensaje, ctxValidar)
  let falla = v.ok ? null : v.motivos.join(',')
  if (!v.ok) {
    console.warn(`[Bot v3] ${lead.nombre}: regenera por ${falla}`)
    const correccion = `\n\nCORRECCIÓN OBLIGATORIA, tu respuesta anterior tenía estos fallos:\n${correccionPara(v.motivos, { contexto, textoLead: entrante.texto })}\nEscribe la respuesta OTRA VEZ, corregida.`
    const reintento = await llamarAI(prompt + correccion, TOOL_RESPONDER, 'responder_lead', imagen)
    latenciaMs += reintento?._latenciaMs || 0
    if (reintento?.mensaje) {
      const m2 = procesarLink(sanitizar(reintento.mensaje, entrante.texto), yaRegistrado, historial, entrante.texto, { linkPermitido })
      const v2 = validar(m2, ctxValidar)
      // Se queda el intento con menos fallos duros y, a igualdad, con menos motivos.
      if (v2.duros.length < v.duros.length || (v2.duros.length === v.duros.length && v2.motivos.length <= v.motivos.length)) {
        mensaje = m2; v = v2; crudo = reintento.mensaje
        resultado.temperatura = reintento.temperatura ?? resultado.temperatura
      }
    }
  }
  /* Última red: si tras la corrección el link sigue donde no toca, se quita.
     Va DESPUÉS de regenerar a propósito —antes se borraba de una y el mensaje
     quedaba cojo («aquí se registra en 2 minutos:» sin nada detrás)—. */
  if (!linkPermitido) mensaje = mensaje.replace(/\n*\s*https?:\/\/app\.control-finanzas\.com\/registro\S*/gi, '').replace(/[:\s]+$/, '').trim()
  const motivosFinales = validar(mensaje, ctxValidar).motivos

  // No contestar con un calco de lo que acabamos de decir. Si el mensaje lleva
  // el link no se toca: ahi el contenido importa mas que la variedad —y para el
  // calco LARGO ya se encargo la segunda pasada de arriba, que si lo mira.
  if (!mensaje.includes('app.control-finanzas.com')) {
    mensaje = variarSiRepetido(mensaje, historial)
  }

  // Detectar violaciones del AI (logging) — sobre el mensaje FINAL, el que de
  // verdad se envía, no el crudo del modelo. Antes corría sobre el crudo y
  // marcaba precio_inventado por montos que el sanitizador ya había corregido
  // (o que venían del propio lead). Con el texto del lead, repetir su monto
  // («$500.000 por cliente») ya no se cuenta como alucinación.
  const violaciones = [...new Set([...motivosFinales, ...detectarViolaciones(mensaje, entrante.texto)])]
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
    usage: { modelo: resultado._proveedor || 'desconocido', tokensIn: 0, tokensOut: 0, costoUsd: 0 },
    traza: {
      etapa: stage,
      clasificacion: clasificacionTraza,
      proveedor: resultado._proveedor || 'desconocido',
      promptId: promptIdDe(stage, promptBase, hist, lead.nombre, entrante.texto),
      respuestaCruda: crudo,
      violaciones: violaciones.length ? violaciones.join(',').slice(0, 255) : null,
      segundaPasada: Boolean(falla),
      latenciaMs,
    },
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
  /* `videoEnviado` se fue con los videos: el bot ya no manda ninguno, así que
     la señal era siempre falsa y el prompt de seguimiento la recibía sin usarla. */
  const videollamadaOfrecida = /videollamada|llamada.*15 min|agendamos/i.test(textosBot)

  const leadRespondio = msgs.some(m => m.rol === 'lead')

  /* Lo último que quiso el lead, según la traza del sprint 3. Si no hay traza
     (mensajes anteriores al 8 sep 2026) el seguimiento va como iba. */
  const ultimaIntencion = intencionDeClasificacion(
    msgs.filter((m) => m.rol === 'bot' && m.clasificacion).at(-1)?.clasificacion)

  const prompt = prompts.promptSeguimiento({
    nombre: lead.nombre, historial: hist, intento: numeroIntento,
    metodo: lead.metodoActual, clientes: textoCantClientes(lead.cantClientes),
    linkEnviado, videollamadaOfrecida, leadRespondio, franja, ultimaIntencion,
  }) + '\n\nResponde con la herramienta seguimiento_lead.'

  const resultado = await llamarAI(prompt, TOOL_SEGUIMIENTO, 'seguimiento_lead')
  const promptId = promptIdDe(`seguimiento${numeroIntento}`, prompt, hist, lead.nombre)

  if (!resultado) {
    return {
      mensaje: 'Quedo atento si necesita algo.', darPorPerdido: false,
      traza: { etapa: 'SEGUIMIENTO', proveedor: 'ninguno', promptId },
    }
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
    traza: {
      etapa: 'SEGUIMIENTO', proveedor: resultado._proveedor || 'desconocido', promptId,
      respuestaCruda: resultado.mensaje, latenciaMs: resultado._latenciaMs || 0,
    },
  }
}
