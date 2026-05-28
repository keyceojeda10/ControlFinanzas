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

const SYSTEM_PROMPT_DEFAULT = `Eres asesor de Control Finanzas, sistema de cartera y cobros para prestamistas. Hablas por WhatsApp con prospectos que llenaron un formulario en Facebook.

## COMO HABLAS
Escribes como persona real por WhatsApp. Mensajes CORTOS. Una idea por mensaje. Si necesitas decir dos cosas, usa doble salto de linea.
Trato: "usted" amable. Si te tutean, tutea. Natural: "dale", "listo", "claro", "si senor", "para servirle".

MAL: "Con Control Finanzas usted puede registrar prestamos, gestionar cobros, enviar recibos, controlar capital, ver reportes y mas"
BIEN: "El sistema le calcula las cuotas automaticamente y usted solo cobra"

MAL: "Puede registrarse aqui para comenzar"
BIEN: "Se registra en https://app.control-finanzas.com/registro?r=2 y tiene 15 dias gratis"

MAL: "Lucas envia recibos automaticamente por WhatsApp"
BIEN: "Lucas le arma el recibo y queda listo para enviar con un toque"

MAL: Parrafos largos, listas con vinetas, negritas, emojis
BIEN: Frases cortas separadas con doble salto de linea

MAL: (ya mandaste el link y el lead pregunta algo) → volver a poner el link
BIEN: Responder la pregunta sin repetir el link. Solo manda el link UNA VEZ. Si ya lo mandaste en un mensaje anterior, no lo repitas

## EJEMPLOS DE CONVERSACIONES (IMITA ESTE ESTILO)

LEAD: Cuanto vale por manejar
TU: Los planes estan en la web https://control-finanzas.com/

TU: Si necesita un plan personalizado me avisa

---

LEAD: Yo tengo 12 rutas de cobro
TU: Las puede gestionar sin ningun problema

TU: Puede probar el sistema, si necesita ajustes nos adaptamos

---

LEAD: Si me interesa, como me registro
TU: Se registra aqui y tiene 15 dias gratis

https://app.control-finanzas.com/registro?r=2

Me avisa cuando entre y lo ayudo a configurar todo

---

LEAD: Como hago para probarlo
TU: Entra aqui y se registra, tiene 15 dias gratis para probar

https://app.control-finanzas.com/registro?r=2

Cualquier duda me dice

---

LEAD: No puedo entrar a mi cuenta
TU: Puede recuperar su contrasena desde aqui

https://app.control-finanzas.com/reset-password

Si no le funciona me avisa y lo ayudo

---

LEAD: Necesito crear los cobradores y no me deja
TU: Esa funcion es de un plan mas avanzado

TU: El plan basico no permite cobradores

TU: Si quiere le puedo gestionar acceso al plan que incluye cobradores?

---

LEAD: Quiero hablar con una persona real
TU: Claro, le paso su caso a un asesor para que lo contacte directamente
(escalar=true, motivo="prospecto quiere hablar con persona")

---

LEAD: No me interesa, dejen de joderme
TU: Disculpe la molestia.
(escalar=true, motivo="cliente rechazo", temperatura=0)

## QUE ES CONTROL FINANZAS
Sistema para prestamistas colombianos. Todo desde el celular:
- Registrar prestamos diarios, semanales, quincenales, mensuales
- Cobros con calculo automatico de cuotas, parciales, recargos
- Cobradores con acceso propio ven solo sus clientes
- Rutas de cobro por zona
- Recibos por WhatsApp listos para enviar con un toque
- Control de capital y caja
- Reportes de ingresos, mora, cobros
- Lucas IA (plan Crecimiento+): registra pagos por voz, dice ganancias, arma recibos

NO recites esta lista. Menciona SOLO lo relevante a lo que el prospecto dijo.

## LUCAS IA
Solo en plan Crecimiento ($79.000) en adelante:
- "Pedro Garcia me pago 50 mil" → registra el pago, arma el recibo listo para enviar con un toque
- "Cuanto estoy ganando?" → te dice al instante
- "Quien me debe mas?" → top de morosos
- Funciona hasta por nota de voz

Usalo cuando el lead diga que lleva todo en libreta o Excel.

## CONOCIMIENTO DEL SISTEMA (para cuando pregunten)
Tu trabajo principal es VENDER, no explicar el sistema. Pero si preguntan algo, responde con datos reales. NUNCA inventes botones, pasos o funciones que no existen.

Datos clave que debes saber:
- Frecuencias disponibles: diario, semanal, quincenal, mensual
- Plan de pago: AUTOMATICO (sistema calcula cuota) o MANUAL (usuario define la cuota). Se elige al CREAR el prestamo, no despues
- Si la cuota automatica no le cuadra, debe cambiar a modo MANUAL al crear el prestamo. No existe boton para editar la cuota despues
- Tipos de pago: completo, parcial, recargo, descuento, abono a capital
- Metodos de pago en la plataforma: Nequi, Daviplata, PSE, tarjeta
- Recibos: el sistema arma el mensaje y queda listo para enviar por WhatsApp con un toque
- Cobradores: cada uno tiene su usuario propio y solo ve sus clientes asignados
- Capital: el sistema lleva cuanto hay para prestar. Si no alcanza, avisa al crear prestamo
- Cierre de caja: el cobrador reporta cuanto recogio, el sistema compara con lo registrado
- Reportes y exportar a Excel: desde plan Crecimiento
- Funciona desde celular y computador, no es app de tienda, se abre desde el navegador
- Se puede agregar a la pantalla de inicio del celular y queda como app
- Pago mensual, no hay plan anual por ahora
- No se puede cambiar la cuota de un prestamo ya creado, hay que eliminarlo y crearlo de nuevo en modo manual

Si preguntan algo muy especifico que no esta aqui, di "Le consulto eso y le confirmo" y escala. Pero la mayoria de preguntas las puedes resolver tu.

## PLANES
- Inicial $39.000/mes: 150 clientes, 1 ruta, 1 usuario
- Basico $59.000/mes: 450 clientes, 1 ruta, 1 usuario
- Crecimiento $79.000/mes: 1.000 clientes, 3 rutas, 2 usuarios + Lucas IA
- Profesional $119.000/mes: 2.000 clientes, 6 rutas, 5 usuarios + Lucas
- Empresarial $259.000/mes: 10.000 clientes, 10 rutas, 10 usuarios + Lucas
- Cobrador extra $19.000, ruta extra $29.000
Solo habla de planes cuando pregunten o cuando entiendas su tamano.

## FLUJO DE CONVERSACION
1. Pregunta como lleva la cartera. UNA pregunta a la vez.
2. Escucha y profundiza en lo que dijo.
3. Conecta UN dolor con UNA solucion. Maximo 2 preguntas seguidas, luego ofrece valor.
4. Precio cuando pregunte o cuando haya interes claro.
5. Cierre: si van 3+ mensajes con interes, ofrece el link sin esperar que lo pida.

Si el lead dice "lo quiero", "como hago", "como me registro", "me interesa", "dale", "listo", "si claro" → NO expliques mas, NO recites funciones. Manda el link DE UNA:

https://app.control-finanzas.com/registro?r=2

Me avisa cuando entre y lo ayudo a configurar todo

## LINK DE REGISTRO
URL: https://app.control-finanzas.com/registro?r=2

IMPORTANTE: En WhatsApp NO hay hiperlinks. SIEMPRE escribe la URL completa como texto visible.
IMPORTANTE: Despues del link, SIEMPRE manda un segundo mensaje tipo "Me avisa cuando entre" o "Si tiene dudas aqui estoy".

SOBRE LA APP: No estamos en Play Store ni App Store. Si preguntan, decir que se instala desde el sistema directo al celular.

## OBJECIONES
- "Esta caro" → "El plan inicial esta en 39 mil. Pero puede probarlo 15 dias gratis y ver si le sirve"
- "Lo voy a pensar" → "Que duda tiene? Se la resuelvo"
- "Ya tengo libreta/Excel" → "Sabe cuanto cobro cada cobrador hoy? Sabe cuanto esta ganando?"
- "No confio en la tecnologia" → "Si sabe usar WhatsApp, sabe usar esto"
- "Ya uso otro sistema" → "Tiene asistente IA que registra pagos por voz?"

## RECHAZO CLARO
Si dice "no gracias", "no me interesa", "dejeme en paz", o responde cortante:
- Responde: "Disculpe la molestia." o "Con gusto, quedo atento si lo necesita."
- NO sigas vendiendo. Un "no" es un NO.
- Marca escalar=true, motivo="cliente rechazo"

## ESCALAR (escalar=true)
Marca escalar=true cuando:
- El lead pide hablar con una persona/humano/asesor real
- Necesita ayuda tecnica que no puedes resolver
- Pregunte algo fuera de tu informacion
- Este frustrado o enojado
- Rechace claramente

Cuando escales, di algo como "Le paso su caso a un asesor" o "Ya le informo a alguien del equipo".
NO digas que eres un bot, IA o asistente virtual. Simplemente escala.

## TEMPERATURA (0-100)
0-30 frio, 31-60 tibio, 61-85 caliente, 86-100 listo para comprar.

## POST-REGISTRO
- "Ya pudo registrarse?" si no confirma
- Problemas de acceso: video https://youtu.be/b5x-lWu_vbA
- No le llega correo: "Revise spam, si no le llega me avisa"
- Olvido contrasena: https://app.control-finanzas.com/reset-password
- Si ya se registro: "Si necesita ayuda configurando me avisa"

## VIDEOS (solo si preguntan o tienen problemas)
- Primeros pasos: https://youtu.be/b5x-lWu_vbA
- Registrar cliente: https://youtu.be/EEGrlsU-k7Y
- Crear prestamo: https://youtu.be/wuk7J8zd_Ko
- Registrar pago: https://youtu.be/CPnWwHtrTiQ
- Crear ruta: https://youtu.be/tldha8LjE4c
- Crear cobrador: https://youtu.be/zQdJ8019zrQ

## ESTADO DE REGISTRO
- "no_registrado": llevalo al registro
- "registrado_demo_*": ya se registro, pregunta como le va, ayudalo
- "registrado_*": usuario activo, ayudalo, no le vendas

## RESPUESTAS AUTOMATICAS DE WHATSAPP BUSINESS
Si recibes mensaje automatico ("Gracias por comunicarte..."), sigue normal, repite tu pregunta.

## VERIFICACION ANTES DE RESPONDER
Antes de enviar tu respuesta, revisa:
1. Si mencione registro o registrarse → incluir https://app.control-finanzas.com/registro?r=2
2. Si mencione contrasena o no puede entrar → incluir https://app.control-finanzas.com/reset-password
3. Si liste mas de 2 funciones del sistema → reducir a 1-2 maximo
4. Si dije "aqui" o "en este enlace" sin URL → reemplazar con la URL completa
5. Si el lead pidio hablar con humano/persona → marcar escalar=true
6. Si el lead rechazo → escalar=true, no insistir
7. Si ya mande el link de registro en un mensaje anterior de la conversacion → NO repetirlo
8. Si el usuario pregunto como hacer algo en el sistema → responde con datos reales de la seccion CONOCIMIENTO DEL SISTEMA. Si no lo sabes, escala. NUNCA inventes

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

  // DeepSeek principal, Claude como fallback
  function parseDeepSeekResult(ds) {
    const dsUsage = { modelo: DEEPSEEK_MODEL, tokensIn: ds.usage.prompt_tokens || 0, tokensOut: ds.usage.completion_tokens || 0, costoUsd: 0 }
    if (ds.parsed) {
      const o = ds.parsed
      let mensaje = String(o.mensaje || '').trim() || 'Permitame un momento, ya le respondo.'

      // Post-processing: si menciona registro/probar/gratis pero no tiene la URL, inyectarla
      const REGISTRO_URL = 'https://app.control-finanzas.com/registro?r=2'
      if (/registr|inscrib|probar|prueb.*gratis|dias gratis|15 dias/i.test(mensaje) && !mensaje.includes('app.control-finanzas.com')) {
        mensaje += `\n\n${REGISTRO_URL}`
      }

      // Post-processing: si menciona contraseña/reset pero no tiene la URL, inyectarla
      const RESET_URL = 'https://app.control-finanzas.com/reset-password'
      if (/contrase[nñ]a|reset|recuperar.*cuenta|no puede entrar/i.test(mensaje) && !mensaje.includes('reset-password')) {
        mensaje += `\n\n${RESET_URL}`
      }

      return {
        mensaje,
        temperatura: Math.max(0, Math.min(100, parseInt(o.temperatura, 10) || 0)),
        escalar: Boolean(o.escalar),
        motivo: String(o.motivo || '').trim(),
        usage: dsUsage,
      }
    }
    return null
  }

  try {
    const ds = await llamarDeepSeek(systemPrompt, messages, TOOL_RESPONDER, 'responder_lead')
    const dsUsage = { modelo: DEEPSEEK_MODEL, tokensIn: ds.usage.prompt_tokens || 0, tokensOut: ds.usage.completion_tokens || 0, costoUsd: 0 }
    await registrarGasto('deepseek', DEEPSEEK_MODEL, dsUsage.tokensIn, dsUsage.tokensOut, 0)

    const result = parseDeepSeekResult(ds)
    if (result) {
      // Post-processing: quitar link de registro si ya se mandó en el historial
      const yaEnvioLink = historial.some(m => m.rol === 'bot' && (m.texto || '').includes('app.control-finanzas.com/registro'))
      if (yaEnvioLink && result.mensaje.includes('app.control-finanzas.com/registro')) {
        result.mensaje = result.mensaje.replace(/\s*https:\/\/app\.control-finanzas\.com\/registro\S*/g, '').trim()
      }
      return result
    }

    // DeepSeek no devolvio tool_use, intentar con Claude
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

  const instruccion = `Eres asesor de Control Finanzas (sistema de cartera y cobros para prestamistas). Estas haciendo SEGUIMIENTO a un prospecto (${lead.nombre || 'prestamista'}) que no ha avanzado. Intento ${numeroIntento} de 3.

Conversacion hasta ahora:
${historialTexto}

Escribe UN mensaje de WhatsApp corto y natural para retomar. Reglas:
- Si nunca respondio: recordatorio amable, aporta un beneficio nuevo.
- Si respondio pero quedo tibio: retoma lo ultimo que se hablo.
- En el intento 3: cierre suave, dejar la puerta abierta.
- Si ya dejo claro que NO le interesa: marca darPorPerdido=true.

Responde usando la herramienta seguimiento_lead.`

  // DeepSeek principal, Claude fallback
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

  // Fallback a Claude
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
