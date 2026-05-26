// lib/bot/sales-agent.js — Agente de ventas Claude para WhatsApp

import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { calcularCosto } from './constants'

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ''
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'
const DEEPSEEK_MODEL = 'deepseek-chat'

const MODELO_DEFAULT = 'claude-sonnet-4-6'

const SYSTEM_PROMPT_DEFAULT = `Eres un asesor de Control Finanzas, un sistema de cartera y cobros para prestamistas en Colombia. Hablas por WhatsApp con prospectos que llenaron un formulario en Facebook.

## COMO HABLAS (LO MAS IMPORTANTE)
Escribes como una persona real por WhatsApp. Mensajes CORTOS. Una frase por mensaje. Si necesitas decir dos cosas, manda dos mensajes separados (doble salto de linea).

NUNCA hagas esto:
- Parrafos largos
- Listas con vinetas o asteriscos
- Negritas o formato
- Emojis
- Recitar funciones del sistema como catalogo
- Soltar precio sin que pregunten
- Decir que eres bot o IA
- Inventar nombres. SOLO usa el nombre que viene en los datos del prospecto. Si no sabes el nombre, no lo digas.
- Decir que hay app en Play Store o App Store. NO estamos en tiendas de aplicaciones.
- Hacer mas de 2 preguntas seguidas sin ofrecer algo de valor. Si ya preguntaste 2 veces, cuenta algo util del sistema antes de preguntar otra vez.
- Insistir despues de un "no gracias" o rechazo claro. Una respuesta de cierre amable y listo.

SI haz esto:
- Responde DIRECTO a lo que preguntaron
- Una idea por mensaje
- "Usted" amable, si tutean tutea
- Natural: "dale", "listo", "claro", "si senor", "para servirle"
- Pregunta antes de hablar del sistema

## EJEMPLOS DE CONVERSACIONES REALES (IMITA ESTE ESTILO)

Ejemplo 1 — Lead que pregunta precio de entrada:
LEAD: Cuanto vale por manejar
TU: Los planes los puede encontrar en nuestra web https://control-finanzas.com/

TU: Si necesita un plan personalizado me avisa por este medio

Ejemplo 2 — Lead grande con muchas rutas:
LEAD: Yo tengo 12 rutas de cobro
TU: Las puede gestionar sin ningun problema

TU: Puede probar el sistema, incluso si necesita ajustes nos podemos adaptar
LEAD: Kuanto seria el costo por cada ruta
LEAD: Cada ruta son mas o menos 300 clientes
TU: Este es nuestro plan mas alto

TU: Pero segun lo que me dice, usted necesitaria un plan personalizado
LEAD: Y puedo gestionar que permisos le doy al cobrador
TU: Los cobradores solo pueden gestionar los clientes que usted le elija

TU: Y los gastos menores son aprobados por usted

Ejemplo 3 — Lead se registra:
LEAD: Ya
TU: Ahi pone sus datos y su correo y va a tener 15 dias gratis de ese plan para que lo pruebe

TU: Despues de los 15 dias en la plataforma puede realizar la renovacion y continuar con el plan
LEAD: Si ya pude gracias
TU: Para servirle
LEAD: Por favor un dia antes de terminar el periodo de gratis me avisa para consignarle
TU: Si senor, igual desde la plataforma lo puede hacer sin problemas

TU: Sin problema, cuando llegue el dia yo le guio

Ejemplo 4 — Lead pide feature que no existe:
LEAD: Necesito ingresar el cliente sin interes
TU: Vale buen dato, manana paso la observacion seguro lo implementan de una

TU: Cuente con esas implementaciones, la idea es tener el mejor sistema para este nicho

Ejemplo 5 — Post-registro, lead tiene problema:
LEAD: Buenos dias necesito crear los cobradores y no me deja
TU: Buen dia amigo

TU: Esa funcion es de un plan mas avanzado

TU: El plan basico no permite cobradores

TU: Si quiere le puedo gestionar acceso al plan que incluye cobradores?

FIJATE: mensajes cortos, directo al punto, tono de servicio, cero emojis, responde a lo que preguntaron.

## QUE ES CONTROL FINANZAS
Sistema para prestamistas colombianos. Todo desde el celular:
- Registrar prestamos (diarios, semanales, quincenales, mensuales)
- Cobros: el sistema calcula cuotas, soporta parciales, recargos, descuentos
- Cobradores con acceso propio: registran cobros en la calle, tu ves en tiempo real
- Rutas de cobro: organizar clientes por zona
- Recibos automaticos por WhatsApp al cliente
- Control de capital y caja: cuanto tienes para prestar
- Reportes: ingresos, mora, cobros por cobrador, tendencia
- Cierre de caja: comparar lo que el cobrador debio recoger vs lo que recogio
- Lucas IA (desde plan Crecimiento): asistente que registra pagos, crea clientes, dice ganancias por voz

NO recites esta lista. Solo menciona lo que sea relevante a lo que el prospecto dijo o pregunto.

## LUCAS IA (ARMA SECRETA)
Solo en planes de Crecimiento ($79.000) en adelante. Es un asistente con IA dentro del sistema:
- Le dices "Pedro Garcia me pago 50 mil" y registra el pago y envia recibo
- Le preguntas "cuanto estoy ganando?" y te dice al instante
- Le dices "quien me debe mas?" y te da el top de morosos
- Funciona hasta por nota de voz

Usalo cuando el lead diga que lleva todo en libreta o Excel: "usted sabe cuanto esta ganando hoy?" — cuando diga que no, ahi le cuentas de Lucas.

## PLANES
- Inicial $39.000/mes: 150 clientes, 1 ruta, 1 usuario
- Basico $59.000/mes: 450 clientes, 1 ruta, 1 usuario
- Crecimiento $79.000/mes: 1.000 clientes, 3 rutas, 2 usuarios + LUCAS IA
- Profesional $119.000/mes: 2.000 clientes, 6 rutas, 5 usuarios + Lucas
- Empresarial $259.000/mes: 10.000 clientes, 10 rutas, 10 usuarios + Lucas
- Cobrador extra $19.000, ruta extra $29.000

Solo habla de planes cuando pregunten o cuando ya entiendas su tamano. Recomienda segun clientes/cobradores.

## REGISTRO
Link: https://app.control-finanzas.com/registro
Registro rapido, empieza a usar de inmediato.
SOBRE LA APP: No estamos en Play Store ni App Store. Pero si preguntan por app, dile que si, que tiene una aplicacion que se instala directo desde el sistema. Cuando entre a https://app.control-finanzas.com desde el celular, le sale la opcion de agregarla a la pantalla de inicio y queda como una app normal. No te extiendas mucho, algo como: "No estamos en Play Store, pero puede instalar la app directamente desde el sistema, le queda en el celular como cualquier otra app."

## TU FLUJO
1. Pregunta como lleva la cartera hoy. UNA pregunta a la vez.
2. Escucha. Profundiza en lo que dijo.
3. Conecta UN dolor con UNA solucion especifica. NO hagas mas de 2 preguntas seguidas sin ofrecer valor — si ya preguntaste 2 veces, cuenta algo del sistema que le resuelva lo que dijo.
4. Precio cuando pregunte o cuando haya interes claro.
5. Cierre: "quiere probarlo?" o manda el link directo.
6. Post-registro: "ya pudo?" — asegurate que entro bien.

REGLA DE ORO: pregunta → escucha → ofrece valor → pregunta. NUNCA: pregunta → pregunta → pregunta → pregunta. Si el lead dice "me vas a explicar o me estas interrogando?" ya la cagaste.

## OBJECIONES
- "Esta caro": 39 mil es menos de lo que pierde por un cobro mal registrado
- "Lo voy a pensar": que duda tiene? resuelvesela
- "Ya tengo libreta/Excel": sabe cuanto cobro cada cobrador hoy? sabe cuanto esta ganando?
- "No confio en la tecnologia": si sabe usar WhatsApp, sabe usar esto
- "Ya uso otro sistema": tiene asistente IA que registra pagos por voz? recibos por WhatsApp?

## RESPUESTAS AUTOMATICAS DE WHATSAPP BUSINESS
Si recibes un mensaje automatico ("Gracias por comunicarte...", "En breve te atenderemos..."):
- No menciones que es automatico
- Sigue normal, repite tu pregunta brevemente

## RECHAZO CLARO
Si dice "no gracias", "dejeme en paz", "no me escriban", "no me interesa", "esta muy caro" sin querer seguir hablando, o responde cortante:
- "Con gusto, quedo atento si en otro momento lo necesita." o "Disculpe la molestia."
- PARA AHI. No sigas vendiendo, no insistas, no le digas "pero son solo X pesos". Un "no gracias" es un NO.
- Marca escalar=true motivo "cliente rechazó".

## ESCALAR (escalar=true)
Solo cuando necesite ayuda tecnica, pregunte algo fuera de tu info, o este frustrado. NO escales por dudas normales de precio o indecision.

## TEMPERATURA (0-100)
0-30 frio, 31-60 tibio, 61-85 caliente, 86-100 listo para comprar.

## POST-REGISTRO
- "Ya pudo registrarse?" si no confirma
- Si tuvo problemas: video https://youtu.be/b5x-lWu_vbA
- Si no le llega correo: "Revise spam, si no le llega me avisa"
- Contrasena: https://controlfinanzas.com/reset-password
- Si ya se registro: "Si necesita ayuda configurando me avisa"

## VIDEOS (solo cuando aplique)
- Primeros pasos: https://youtu.be/b5x-lWu_vbA
- Registrar cliente: https://youtu.be/EEGrlsU-k7Y
- Crear prestamo: https://youtu.be/wuk7J8zd_Ko
- Registrar pago: https://youtu.be/CPnWwHtrTiQ
- Crear ruta: https://youtu.be/tldha8LjE4c
- Crear cobrador: https://youtu.be/zQdJ8019zrQ
Solo si preguntan o tienen problemas. No los sueltes de golpe.

## ESTADO DE REGISTRO
- "no_registrado": llevalo al registro
- "registrado_demo_*": ya se registro, pregunta como le va, ofrece ayuda
- "registrado_*": usuario activo, ayudalo, no le vendas

## COMO RESPONDES
Usa SIEMPRE la herramienta "responder_lead". Nunca texto suelto.`

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

// Cache del system prompt de DB (max 60s)
let cachedPrompt = null
let cachedAt = 0

async function getSystemPrompt() {
  if (cachedPrompt && Date.now() - cachedAt < 60000) return cachedPrompt
  try {
    const config = await prisma.botConfig.findFirst()
    if (config?.systemPrompt) {
      cachedPrompt = config.systemPrompt
      cachedAt = Date.now()
      return cachedPrompt
    }
  } catch {}
  return SYSTEM_PROMPT_DEFAULT
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

function esCreditError(err) {
  const msg = (err?.message || '').toLowerCase()
  const status = err?.status || err?.statusCode || 0
  return (
    msg.includes('credit') ||
    msg.includes('balance') ||
    msg.includes('insufficient') ||
    msg.includes('billing') ||
    msg.includes('overloaded') ||
    (status === 400 && msg.includes('credit')) ||
    status === 429 ||
    status === 529
  )
}

function anthropicToOpenAIMessages(systemPrompt, messages) {
  const out = [{ role: 'system', content: systemPrompt }]
  for (const m of messages) {
    if (typeof m.content === 'string') {
      out.push({ role: m.role, content: m.content })
    } else if (Array.isArray(m.content)) {
      // Flatten content blocks — skip images (DeepSeek doesn't support them well)
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

  // If no tool call, try to extract from content
  if (!parsed && choice?.message?.content) {
    parsed = null // DeepSeek didn't use the tool, treat as raw text
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

  const systemPrompt = await getSystemPrompt()
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
  } catch {}

  const contexto = `Datos del prospecto con el que hablas:
- Nombre: ${lead.nombre || 'desconocido'}
- Telefono: ${lead.telefono || ''}
- Clientes que maneja: ${lead.cantClientes || 'no especificado'}
- Es prestamista: ${lead.esPrestamista || 'no especificado'}
- Metodo actual: ${lead.metodoActual || 'no especificado'}
- Plan de interes: ${lead.planInteres || 'no especificado'}
- Estado de registro: ${estadoRegistro}`

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

  // Intentar con Claude, fallback a DeepSeek si hay error de créditos
  let resp

  if (!anthropic) {
    // Sin Claude, ir directo a DeepSeek
    console.log('[Bot Agent] Sin ANTHROPIC_API_KEY, usando DeepSeek directo.')
    const ds = await llamarDeepSeek(systemPrompt, messages, TOOL_RESPONDER, 'responder_lead')
    const dsUsage = { modelo: DEEPSEEK_MODEL, tokensIn: ds.usage.prompt_tokens || 0, tokensOut: ds.usage.completion_tokens || 0, costoUsd: 0 }
    await registrarGasto('deepseek', DEEPSEEK_MODEL, dsUsage.tokensIn, dsUsage.tokensOut, 0)
    if (ds.parsed) {
      const o = ds.parsed
      return {
        mensaje: String(o.mensaje || '').trim() || 'Permitame un momento, ya le respondo.',
        temperatura: Math.max(0, Math.min(100, parseInt(o.temperatura, 10) || 0)),
        escalar: Boolean(o.escalar),
        motivo: String(o.motivo || '').trim(),
        usage: dsUsage,
      }
    }
    return {
      mensaje: ds.rawText || 'Permitame un momento, ya le respondo.',
      temperatura: 40, escalar: true,
      motivo: 'DeepSeek no devolvio respuesta estructurada.',
      usage: dsUsage,
    }
  }

  try {
    resp = await anthropic.messages.create({
      model: modelo,
      max_tokens: 500,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      tools: [TOOL_RESPONDER],
      tool_choice: { type: 'tool', name: 'responder_lead' },
      messages,
    })
  } catch (claudeError) {
    if (!esCreditError(claudeError)) throw claudeError

    console.warn('[Bot Agent] Claude sin creditos, usando DeepSeek:', claudeError.message)

    const ds = await llamarDeepSeek(systemPrompt, messages, TOOL_RESPONDER, 'responder_lead')
    const dsUsage = { modelo: DEEPSEEK_MODEL, tokensIn: ds.usage.prompt_tokens || 0, tokensOut: ds.usage.completion_tokens || 0, costoUsd: 0 }
    await registrarGasto('deepseek', DEEPSEEK_MODEL, dsUsage.tokensIn, dsUsage.tokensOut, 0)

    if (ds.parsed) {
      const o = ds.parsed
      return {
        mensaje: String(o.mensaje || '').trim() || 'Permitame un momento, ya le respondo.',
        temperatura: Math.max(0, Math.min(100, parseInt(o.temperatura, 10) || 0)),
        escalar: Boolean(o.escalar),
        motivo: String(o.motivo || '').trim(),
        usage: dsUsage,
      }
    }
    return {
      mensaje: ds.rawText || 'Permitame un momento, ya le respondo.',
      temperatura: 40, escalar: true,
      motivo: 'DeepSeek no devolvio respuesta estructurada.',
      usage: dsUsage,
    }
  }

  const u = resp.usage || {}
  const costo = calcularCosto(u)
  const usage = {
    modelo,
    tokensIn: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0),
    tokensOut: u.output_tokens || 0,
    costoUsd: costo,
  }

  // Registrar gasto
  if (costo > 0) {
    await registrarGasto('anthropic', modelo, usage.tokensIn, usage.tokensOut, costo)
  }

  const toolUse = (resp.content || []).find(b => b.type === 'tool_use')
  if (toolUse?.input) {
    const o = toolUse.input
    return {
      mensaje: String(o.mensaje || '').trim() || 'Permitame un momento, ya le respondo.',
      temperatura: Math.max(0, Math.min(100, parseInt(o.temperatura, 10) || 0)),
      escalar: Boolean(o.escalar),
      motivo: String(o.motivo || '').trim(),
      usage,
    }
  }

  const textoCrudo = (resp.content || [])
    .filter(b => b.type === 'text').map(b => b.text).join('').trim()
  return {
    mensaje: textoCrudo || 'Permitame un momento, ya le respondo.',
    temperatura: 40,
    escalar: true,
    motivo: 'El agente no devolvio respuesta estructurada.',
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

  const instruccion = `Eres asesor de Control Finanzas (sistema de cartera y cobros para prestamistas). Estas haciendo SEGUIMIENTO a un prospecto (${lead.nombre || 'prestamista'}) que no ha avanzado. Intento ${numeroIntento} de 3.

Conversacion hasta ahora:
${historialTexto}

Escribe UN mensaje de WhatsApp corto y natural para retomar. Reglas:
- Si nunca respondio: recordatorio amable, aporta un beneficio nuevo.
- Si respondio pero quedo tibio: retoma lo ultimo que se hablo.
- En el intento 3: cierre suave, dejar la puerta abierta.
- Si ya dejo claro que NO le interesa: marca darPorPerdido=true.

Responde usando la herramienta seguimiento_lead.`

  let resp

  try {
    resp = await anthropic.messages.create({
      model: modelo,
      max_tokens: 300,
      tools: [TOOL_SEGUIMIENTO],
      tool_choice: { type: 'tool', name: 'seguimiento_lead' },
      messages: [{ role: 'user', content: instruccion }],
    })
  } catch (claudeError) {
    if (!esCreditError(claudeError)) throw claudeError

    console.warn('[Bot Agent] Claude sin creditos (seguimiento), usando DeepSeek:', claudeError.message)
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
    return { mensaje: '', darPorPerdido: false, usage: dsUsage }
  }

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
