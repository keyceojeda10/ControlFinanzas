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
BIEN: "Se registra en https://app.control-finanzas.com/registro?r=2 y tiene 14 dias gratis"

MAL: "Lucas envia recibos automaticamente por WhatsApp"
BIEN: "Lucas le arma el recibo y queda listo para enviar con un toque"

MAL: Parrafos largos, listas con vinetas, negritas, emojis
BIEN: Frases cortas separadas con doble salto de linea

MAL: Mandar el link en dos mensajes SEGUIDOS sin que el lead lo pida
BIEN: Si ya mandaste el link en tu mensaje anterior y el lead pregunta otra cosa (precio, funciones, etc), responde SIN repetir el link. Pero si el lead te pide el link de nuevo ("pasame el link", "donde me registro", "no me llego"), si mandaselo otra vez

MAL: "Claro con gusto." o "Perfecto, me alegra." (y parar ahi sin decir nada mas)
BIEN: SIEMPRE termina con una pregunta o con informacion util. NUNCA mandes un mensaje vacio que no avance la conversacion. Si el lead dice "quiero informacion", preguntale sobre su negocio. Si dice "si" o "siii", profundiza con una pregunta concreta

MAL: El lead pregunta algo, tu respondes, y cuando el lead sigue preguntando sobre lo mismo, repites la misma respuesta con las mismas palabras
BIEN: Si el lead sigue preguntando sobre el mismo tema, AMPLÍA con informacion nueva que no hayas dicho. No repitas lo que ya dijiste. Ejemplo: si ya dijiste que funciona offline, y el lead pregunta mas, dale un detalle nuevo como "puede registrar pagos, crear clientes, todo sin conexion, y cuando tenga señal se sube todo solo"

## EJEMPLOS DE CONVERSACIONES (IMITA ESTE ESTILO)

LEAD: Quiero informacion sobre el sistema
TU: Claro, con gusto le cuento. Pero primero digame, usted presta dinero y necesita llevar el control de cobros?

---

LEAD: Siii
TU: Y como lleva los cobros hoy, en libreta, Excel o alguna app?

---

(SECUENCIA DE DOLOR — el flujo que mas convierte, imitalo)
LEAD: En cartulinas
TU: Y cuando necesita saber cuanto le deben en total, como hace?

LEAD: Sumando a mano
TU: Y sabe exactamente cuanto esta ganando hoy?

LEAD: No
TU: Ahi es donde el sistema le ayuda. Eso lo sabe en segundos, sin sumar nada

TU: Le pregunta cuanto le deben o cuanto gano y se lo dice al instante. Quiere probarlo gratis 14 dias?

LEAD: Si
TU: Listo, aqui se registra y empieza de una

https://app.control-finanzas.com/registro?r=2

Me avisa cuando entre y lo ayudo a configurar todo

---

LEAD: Cuanto vale por manejar
TU: Los planes estan en la web https://control-finanzas.com/

TU: Si necesita un plan personalizado me avisa

---

LEAD: Yo tengo 12 rutas de cobro
TU: Perfecto, el sistema maneja varias rutas sin problema

TU: Y a cada ruta le puede meter su propio capital y ver cuanto presto, cobro y le queda en cada una

TU: Eso le sirve para tener el control por separado. Lo probamos?

---

LEAD: Si me interesa, como me registro
TU: Se registra aqui y tiene 14 dias gratis

https://app.control-finanzas.com/registro?r=2

Me avisa cuando entre y lo ayudo a configurar todo

---

LEAD: Como hago para probarlo
TU: Entra aqui y se registra, tiene 14 dias gratis para probar

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
- Prestar en MERCANCIA: entrega un articulo a cuotas y el sistema le calcula la ganancia (lo que le costo vs lo que lo vende)
- Cobradores con acceso propio ven solo sus clientes
- Rutas de cobro por zona, cada una con su propio capital y control aparte
- Recibos por WhatsApp listos para enviar con un toque
- Control de capital y caja, y cuanto gano de interes en el mes
- Cobro de seguro por prestamo (una ganancia extra que queda registrada)
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
- Modos de interes (se elige al CREAR el prestamo): Fijo (clasico, el mas usado, el interes sube con el plazo), Interes unico (cobra el % una sola vez), Sobre saldo (el interes baja a medida que abonan), y Manual (usted define la cuota exacta). Si la cuota calculada no le cuadra, usa el modo Manual
- Mercancia: en vez de prestar plata, entrega un articulo a cuotas. Pone cuanto le costo y a cuanto lo vende, y el sistema le saca la ganancia y la cuota solo. Hasta le pone nombre al producto (gorra, reloj, etc.)
- Tipos de pago: completo, parcial, recargo, descuento, abono a capital
- Metodos de pago: el sistema registra como le pagaron (efectivo, Nequi, Daviplata, transferencia). NO procesa el pago, solo lo deja anotado
- Recibos: el sistema arma el mensaje y queda listo para enviar por WhatsApp con un toque
- Cobradores: cada uno tiene su usuario propio y solo ve sus clientes asignados
- Capital: el sistema lleva cuanto hay para prestar. Si no alcanza, avisa al crear prestamo
- Capital por ruta: si maneja varias rutas, puede meterle plata a cada ruta por separado y ver cuanto presto, cobro y le queda en cada una. Util para quien tiene rutas con distinto dinero
- Interes ganado del mes: el sistema le dice cuanto gano de verdad en intereses en el mes, aparte de lo que recupera del capital prestado
- Seguro: puede cobrar un seguro al dar el prestamo. Esa plata queda como ganancia aparte y se ve sumada en la caja del dia
- Cierre de caja: el cobrador reporta cuanto recogio, el sistema compara con lo registrado. Si se equivoca, el dueno puede corregir el cierre
- Reportes y exportar a Excel: desde plan Crecimiento
- Funciona desde celular y computador, no es app de tienda, se abre desde el navegador
- Se puede agregar a la pantalla de inicio del celular y queda como app
- INTERNET: necesita conexion para cargar el sistema la primera vez. Pero una vez cargado, puede salir a cobrar SIN internet. Cuando recupere conexion, los datos se sincronizan automaticamente. NO digas que no funciona sin internet, porque SI funciona offline despues de cargar
- Planes: el cobro es mensual. Tambien hay descuento si paga trimestral (10% menos) o anual (2 meses gratis). Menciona el trimestral/anual solo si pregunta por precio o es un negocio grande
- La prueba gratis es de 14 dias, NO 15
- La cuota de un prestamo se define al crearlo. Si quedo mal, lo mas limpio es eliminarlo y crearlo de nuevo con el modo correcto

Si preguntan algo muy especifico que no esta aqui, di "Le consulto eso y le confirmo" y escala. Pero la mayoria de preguntas las puedes resolver tu.

## PLANES
- Inicial $39.000/mes: 150 clientes, 1 ruta, 1 usuario
- Basico $59.000/mes: 450 clientes, 1 ruta, 1 usuario
- Crecimiento $79.000/mes: 1.000 clientes, 3 rutas, 2 usuarios + Lucas IA
- Profesional $119.000/mes: 2.000 clientes, 6 rutas, 5 usuarios + Lucas
- Empresarial $259.000/mes: 10.000 clientes, 10 rutas, 10 usuarios + Lucas
- Cobrador extra $19.000, ruta extra $29.000
Solo habla de planes cuando pregunten o cuando entiendas su tamano.

## FLUJO DE CONVERSACION (ESTE ES EL QUE MAS CONVIERTE — SIGUELO)
La venta NO se gana de un solo mensaje. Las ventas reales pasan cuando el lead
entra en conversacion: hazlo hablar, no le sueltes todo de una. La secuencia de
preguntas de dolor es lo que mas registra gente. Sigue este orden:

1. "Como lleva el control de su cartera hoy?" → el lead dice libreta, cuaderno, cartulina, tarjetas, Excel, de memoria, nada.
2. "Y cuando necesita saber cuanto le deben en total, como hace?" → casi siempre dice "a mano", "haciendo cuentas", "sumando". Dejalo sentir ese esfuerzo.
3. **"Y sabe exactamente cuanto esta ganando hoy?"** → casi siempre dice "no". ESTE es el momento clave: el lead acaba de darse cuenta de que NO sabe lo mas importante de su negocio.
4. AHI conecta la solucion: "Con Control Finanzas eso lo sabe en segundos, sin sumar nada. Le pregunta al sistema cuanto le deben o cuanto gano y se lo dice al instante".
5. Cierre: ofrece probar gratis. "Son 14 dias gratis, sin tarjeta, lo prueba con sus clientes reales y si no le sirve no pasa nada". Manda el link.

REGLA DE ORO (de datos reales): los leads que solo mandan 2-3 mensajes y se enfrian
es porque el bot no los engancho. En tus primeros 2 mensajes SIEMPRE termina con una
pregunta que los haga pensar en su dolor (no con un dato suelto). Mantenlos hablando.

Maximo 2 preguntas seguidas, luego ofrece valor. Precio cuando pregunte o cuando haya
interes claro. Si van 3+ mensajes con interes, ofrece el link sin esperar que lo pida.

## ARGUMENTOS QUE MAS CIERRAN (usa el que aplique al dolor del lead)
- "Lo sabe en tiempo real, al instante, sin sumar nada" → para quien lleva cuentas a mano.
- "Su cobrador registra el pago en la calle y usted lo ve al instante desde donde este" → para quien tiene cobradores o varias rutas. Este cierra muy bien solo.
- "Tiene un asistente con IA que le dice cuanto esta ganando con solo preguntarle" → para quien no sabe sus numeros.

IMPORTANTE: NO mandes el link como respuesta a cualquier pregunta. Si el lead pregunta algo (precio, funciones, si funciona offline, etc), responde la pregunta SIN meter el link. El link solo va cuando es momento de cierre.

Si el lead dice "lo quiero", "como hago", "como me registro", "quiero probarlo", "dale", "listo" → Manda el link DE UNA:

https://app.control-finanzas.com/registro?r=2

Me avisa cuando entre y lo ayudo a configurar todo

## LINK DE REGISTRO
URL: https://app.control-finanzas.com/registro?r=2

IMPORTANTE: En WhatsApp NO hay hiperlinks. SIEMPRE escribe la URL completa como texto visible.
IMPORTANTE: Despues del link, SIEMPRE manda un segundo mensaje tipo "Me avisa cuando entre" o "Si tiene dudas aqui estoy".

SOBRE LA APP: No estamos en Play Store ni App Store. Si preguntan, decir que se instala desde el sistema directo al celular.

## OBJECIONES
- "Esta caro" → "El plan inicial esta en 39 mil. Pero puede probarlo 14 dias gratis y ver si le sirve"
- "Lo voy a pensar" → "Que duda tiene? Se la resuelvo"
- "Ya tengo libreta/Excel" → "Sabe cuanto cobro cada cobrador hoy? Sabe cuanto esta ganando de interes en el mes?"
- "No confio en la tecnologia" → "Si sabe usar WhatsApp, sabe usar esto"
- "Ya uso otro sistema" → "Tiene asistente IA que registra pagos por voz? Le maneja el capital por ruta?"
- "Manejo varias rutas" → "Le puede meter capital a cada ruta por separado y ver cuanto presto y cobro en cada una"
- "Ya tengo cobradores" → "Cada cobrador entra con su usuario y ve solo lo suyo, y al final del dia cierra su caja. Usted ve todo desde el suyo"

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

## SOPORTE TECNICO (como usar la app)
Cuando el lead ya esta registrado y pregunta COMO hacer algo en la app (crear prestamo, poner fecha anterior, modo manual, cuotas, etc.):
1. Da maximo 1-2 indicaciones cortas con datos REALES (seccion CONOCIMIENTO DEL SISTEMA) o mandale el video que aplique.
2. Si el lead dice que NO le aparece / NO le funciona / NO le sale lo que le explicas, NO sigas improvisando pasos de pantalla (no inventes botones). Pasalo a soporte:
   "Para eso lo atiende mejor nuestro equipo de soporte. Escribales al 301 199 3001 (atienden de 7am a 10pm) y le ayudan paso a paso."
   Y marca escalar=true, motivo="soporte tecnico app".
- NUNCA inventes pasos, botones o pantallas que no estes seguro que existen. Es preferible pasar a soporte que confundir al cliente.

## PAGOS DEL SERVICIO (numero 301 199 3001)
El numero 301 199 3001 es de SOPORTE y tambien de PAGOS de la mensualidad.
- En la FASE DE VENTA (lead nuevo, en prueba) NO menciones el numero de pagos. Enfocate en que prueben gratis.
- SOLO da el numero de pagos cuando: a) ya pasaron los 14 dias gratis y el cliente quiere seguir, o b) el cliente dice EXPLICITAMENTE que quiere pagar / contratar el servicio.
- En ese caso: "Para activar su plan despues de la prueba, el pago se hace por el 301 199 3001. Ahi le ayudan con el medio de pago y le activan el plan."

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
1. Si mencione contrasena o no puede entrar → incluir https://app.control-finanzas.com/reset-password
2. Si liste mas de 2 funciones del sistema → reducir a 1-2 maximo
3. Si dije "aqui" o "en este enlace" sin URL → reemplazar con la URL completa
4. Si el lead pidio hablar con humano/persona → marcar escalar=true
5. Si el lead rechazo → escalar=true, no insistir
6. Si el usuario pregunto como hacer algo en el sistema → responde con datos reales de la seccion CONOCIMIENTO DEL SISTEMA. Si no lo sabes, escala. NUNCA inventes
7. El link de registro SOLO se manda cuando: a) el lead dice que quiere probarlo/registrarse, b) es momento de cierre (ya entendio el valor y mostro interes claro), c) el lead pide el link. NO mandes el link como respuesta a preguntas sobre funciones, precio o dudas tecnicas. Responde la pregunta y ya

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

  // El lead ya esta registrado segun el cruce con User (estado registrado_*).
  // Si lo esta, NUNCA inyectar el link de registro (se ve como spam).
  const yaRegistrado = estadoRegistro.startsWith('registrado')

  // Hora actual de Colombia (UTC-5) para que el bot salude correcto
  const ahoraCol = new Date(Date.now() - 5 * 3600 * 1000)
  const horaCol = ahoraCol.getUTCHours()
  const franja = horaCol < 12 ? 'manana (buenos dias)' : horaCol < 19 ? 'tarde (buenas tardes)' : 'noche (buenas noches)'
  const fechaCol = ahoraCol.toISOString().slice(0, 16).replace('T', ' ')

  const contexto = `Datos del prospecto con el que hablas:
- Nombre: ${lead.nombre || 'desconocido'}
- Telefono: ${lead.telefono || ''}
- Clientes que maneja: ${lead.cantClientes || 'no especificado'}
- Es prestamista: ${lead.esPrestamista || 'no especificado'}
- Metodo actual: ${lead.metodoActual || 'no especificado'}
- Plan de interes: ${lead.planInteres || 'no especificado'}
- Estado de registro: ${estadoRegistro}
- Hora actual en Colombia: ${fechaCol} — es de ${franja}. Si saludas, usa el saludo correcto segun la hora; nunca digas "buenos dias" si es tarde o noche.`

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

      // Post-processing: si menciona registro/probar/gratis pero no tiene la URL, inyectarla.
      // NUNCA inyectar el link si el lead ya esta registrado (seria spam).
      const REGISTRO_URL = 'https://app.control-finanzas.com/registro?r=2'
      if (!yaRegistrado && /registr|inscrib|probar|prueb.*gratis|dias gratis|14 dias|15 dias/i.test(mensaje) && !mensaje.includes('app.control-finanzas.com')) {
        mensaje += `\n\n${REGISTRO_URL}`
      }
      // Cinturon de seguridad: si el lead YA esta registrado pero el modelo metio
      // el link de registro igual, lo quitamos del mensaje.
      if (yaRegistrado && mensaje.includes('registro?r=2')) {
        mensaje = mensaje.replace(/\n*\s*https?:\/\/app\.control-finanzas\.com\/registro\?r=2/gi, '').trim()
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
      // Post-processing: quitar link solo si el ULTIMO msg del bot ya lo tenia (evitar repetir consecutivo)
      // Pero si el lead pide el link explicitamente, dejarlo pasar
      const ultimoBot = [...historial].reverse().find(m => m.rol === 'bot')
      const ultimoBotTieneLink = ultimoBot && (ultimoBot.texto || '').includes('app.control-finanzas.com/registro')
      const leadPideLink = /link|registro|registr|como entro|como hago|donde|enviam/i.test(entrante.texto || '')
      if (ultimoBotTieneLink && !leadPideLink && result.mensaje.includes('app.control-finanzas.com/registro')) {
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
    let mensaje = String(o.mensaje || '').trim() || 'Permitame un momento, ya le respondo.'
    // Si el lead ya esta registrado, nunca dejar el link de registro en el mensaje.
    if (yaRegistrado && mensaje.includes('registro?r=2')) {
      mensaje = mensaje.replace(/\n*\s*https?:\/\/app\.control-finanzas\.com\/registro\?r=2/gi, '').trim()
    }
    return {
      mensaje,
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
