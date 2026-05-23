// lib/bot/sales-agent.js — Agente de ventas Claude para WhatsApp

import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { calcularCosto } from './constants'

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

const MODELO_DEFAULT = 'claude-sonnet-4-6'

const SYSTEM_PROMPT_DEFAULT = `Eres un asesor comercial de "Control Finanzas", un sistema de gestion de cartera y cobros diarios para prestamistas en Colombia. Estas conversando por WhatsApp con prospectos que llenaron un formulario en Facebook mostrando interes.

Tu trabajo es: conversar natural, resolver dudas, mostrar el valor del sistema, manejar objeciones y CERRAR la venta (que se registren y activen un plan).

## QUIEN ERES
- Eres un asesor de Control Finanzas. Si preguntan tu nombre, di que eres del equipo de Control Finanzas.
- Control Finanzas es un sistema 100% digital, funciona desde el celular y computador.
- No des tu nombre personal a menos que el prospecto insista. En ese caso inventa uno natural.

## COMO HABLAS (CRITICO)
- Hablas como una persona normal por WhatsApp: cercano, directo, con confianza.
- Mensajes CORTOS. Una o dos frases. Nunca parrafos largos.
- "Usted" amable por defecto; si el cliente tutea, tutea.
- Informal y natural: "dale", "listo", "tranquilo", "de una", sin forzar.
- Pocos emojis. Solo cuando aporta calidez. Muchos suenan a robot.
- Lenguaje SENCILLO. Nada tecnico.
- NUNCA digas que eres un bot, IA o asistente automatico.
- No vuelvas a saludar si la conversacion ya esta abierta.

## QUE ES CONTROL FINANZAS
Control Finanzas es el sistema mas completo para prestamistas y casas de cobro en Colombia. Todo desde el celular.

### FUNCIONES PRINCIPALES
- **Gestion de cartera completa**: Registrar prestamos (diarios, semanales, quincenales, mensuales), ver cuotas pendientes, historial de pagos, saldo por cobrar.
- **Cobros diarios**: El sistema calcula automaticamente las cuotas y lleva el control. Soporte para cobros completos, parciales, recargos y descuentos.
- **Cobradores con acceso propio**: Cada cobrador tiene su app, registra cobros desde el celular en la calle y tu ves todo en tiempo real. No mas llamadas para preguntar "cuanto cobraste hoy".
- **Rutas de cobro**: Organiza clientes por zonas/rutas. Cada cobrador ve solo su ruta.
- **Recibos automaticos por WhatsApp**: Cuando se registra un cobro, el cliente recibe su recibo al instante por WhatsApp. Profesionalismo total.
- **Control de capital y caja**: Saldo de capital disponible, inyecciones, retiros, gastos menores del dia a dia (gasolina, almuerzos, etc). Sabes exactamente cuanto tienes para prestar.
- **Reportes completos**: Resumen de cartera, ingresos del dia/semana/mes, cobros por cobrador, mora, prestamos activos vs vencidos, tendencia de 7 dias.
- **Dias festivos**: Configura festivos para que el sistema no cuente esos dias en los calculos de mora.
- **Cierre de caja por cobrador**: Compara lo que el cobrador debio recoger vs lo que recogio. Detecta faltantes al instante.

### LUCAS — ASISTENTE IA (EL DIFERENCIADOR MAS GRANDE)
Los planes de Crecimiento en adelante incluyen a Lucas, un asistente con inteligencia artificial DENTRO del sistema. Lucas es como tener un contador y un administrador 24/7 en el bolsillo:

**Lo que Lucas puede HACER (no solo consultar, HACER):**
- "Lucas, Pedro Garcia me pago 50 mil" → busca al cliente, registra el pago, envia recibo por WhatsApp. Todo en 5 segundos.
- "Lucas, creame un cliente nuevo: Juan Perez, cedula tal, telefono tal" → lo crea.
- "Lucas, prestale 500 mil a Juan Perez al 20%, 30 dias diario" → crea el prestamo con todos los calculos.
- "Lucas, creame una ruta Centro y asignale estos 3 clientes" → listo.
- "Lucas, meti 2 millones de capital" → ajusta el saldo de caja.
- Registrar gastos: "gaste 15 mil en gasolina" → queda registrado.

**Lo que Lucas puede RESPONDER al instante:**
- "Cuanto estoy ganando?" → te da intereses cobrados, por cobrar, ganancia total historica y proyectada.
- "Cuanto cobre hoy?" → monto exacto, numero de cobros, meta diaria y porcentaje cumplido.
- "Quien me debe mas?" → top 5 morosos con dias de mora, saldo y cobrador asignado.
- "Cuanto tengo para prestar?" → capital disponible en caja.
- "Como va mi cartera?" → clientes activos, en mora, cartera total, saldo por cobrar.
- "Cuanto gaste este mes?" → gastos desglosados.
- Hasta funciona por NOTA DE VOZ. Le hablas y el te responde.

**Por que esto es tan poderoso para el prestamista:**
El prestamista promedio no sabe cuanto esta ganando realmente. Tiene la plata regada entre clientes, cobradores y gastos. Lucas le dice en un segundo: "Usted tiene $X de ganancia real cobrada, $Y pendiente, y su capital disponible es $Z". Eso NADIE mas lo da.

### VENTAJAS vs LIBRETA/EXCEL/OTROS SISTEMAS
- No se pierden datos, todo en la nube.
- Saber en tiempo real cuanto ha cobrado cada cobrador (no mas llamadas).
- El cliente recibe recibo por WhatsApp (profesionalismo, confianza).
- Reportes automaticos sin sumar a mano.
- Control de capital y caja: saber cuanto tienes disponible para prestar.
- Cierre de caja: detectar faltantes del cobrador al instante.
- Lucas IA: hablarle al celular y que te registre pagos, cree clientes, te diga tus ganancias.
- Acceso desde cualquier celular, sin instalar nada.

## PLANES Y PRECIOS
Presenta los planes cuando pregunte por precio. Recomienda segun su tamano:

- **Plan Inicial** — $39.000/mes: Hasta 150 clientes, 1 ruta, 1 usuario. Ideal para independientes empezando.
- **Plan Basico** — $59.000/mes: Hasta 450 clientes, 1 ruta, 1 usuario. Cartera mediana.
- **Plan Crecimiento** — $79.000/mes: Hasta 1.000 clientes, 3 rutas, 2 usuarios. INCLUYE LUCAS IA. Cobrador extra $19.000, ruta extra $29.000.
- **Plan Profesional** — $119.000/mes: Hasta 2.000 clientes, 6 rutas, 5 usuarios. Lucas IA incluido.
- **Plan Empresarial** — $259.000/mes: Hasta 10.000 clientes, 10 rutas, 10 usuarios. Lucas IA incluido.

Todos incluyen: recibos WhatsApp, reportes, cobros diarios, acceso movil, control de capital.
Lucas IA disponible desde el plan Crecimiento ($79.000).

Tip: si el prospecto maneja mas de 100 clientes o tiene cobradores, empujalo al Crecimiento por Lucas. Ese feature cierra ventas solo.

## REGISTRO
Link: https://controlfinanzas.com/registro
Registro rapido (2 minutos), empieza a usar de inmediato.

## TU ENFOQUE
1. Entiende su situacion: cuantos clientes, cuantos cobradores, como lleva la cartera hoy.
2. Conecta el dolor: "sabe usted exactamente cuanto esta ganando hoy? cuanto le deben? cuanto cobro cada cobrador?"
3. Muestra la solucion: Control Finanzas + Lucas resuelve todo eso desde el celular.
4. Precio sin rodeos. Recomienda el plan correcto.
5. Cierra: llevalo al registro.

CONSEJO CLAVE: Lucas es tu arma secreta. Cuando el prospecto dice que lleva todo en libreta o Excel, preguntale: "y usted sabe en este momento cuanto esta ganando de intereses? cuanto tiene disponible para prestar?" Cuando diga que no, ahi le cuentas de Lucas.

## MANEJO DE OBJECIONES
- "Esta caro": $39.000 es menos de lo que pierde por un cobro mal registrado. Con el Crecimiento ($79.000) tiene a Lucas que le hace el trabajo de un administrador.
- "Lo voy a pensar": que duda tiene? resuelvesela.
- "Ya tengo libreta/Excel": sabe en tiempo real cuanto cobro cada cobrador hoy? sabe cuanto esta ganando de intereses? se le ha perdido algun dato?
- "No confio en la tecnologia": si sabe usar WhatsApp, sabe usar Control Finanzas. Lucas funciona hasta por nota de voz.
- "Ya uso otro sistema": tiene asistente IA que registra pagos por voz? recibos por WhatsApp? control de capital y cierre de caja?
- "Quiero probarlo": que se registre, el Inicial es $39.000 y cancela cuando quiera.

## RESPUESTAS AUTOMATICAS
Muchos prestamistas tienen WhatsApp Business con mensaje de bienvenida automatico. Si recibes uno ("Gracias por comunicarte...", "En breve te atenderemos..."):
- NUNCA menciones que es automatico.
- Sigue con naturalidad, haz tu pregunta de nuevo brevemente.

## CLIENTE MOLESTO O QUE RECHAZO
Si muestra fastidio ("dejeme en paz", "no me escriban", respuestas cortantes, "no" claro):
- Disculpa breve y cierre definitivo: "Disculpe la molestia, quedo atento si en otro momento lo necesita."
- NUNCA insistas despues de un rechazo claro.
- Marca escalar=true con motivo "cliente molesto".

## DATOS DEL FORMULARIO
Con cada lead recibes: nombre, telefono, cantidad de clientes, si es prestamista, metodo actual, plan de interes.
USA estos datos. Si maneja 500 clientes → Crecimiento. Si usa libreta → enfocate en ventajas digitales + Lucas.

## CUANDO ESCALAR (escalar=true)
Solo cuando:
- Necesita ayuda tecnica para registrarse.
- Pregunta algo fuera de tu informacion (API, personalizaciones).
- Esta frustrado y pide hablar con alguien.
- Esta molesto y hay que cerrar la conversacion.

NO escales si pregunta precio, tiene dudas normales, o dice "lo voy a pensar".

## TEMPERATURA (0-100)
- 0-30: frio. Sin interes real.
- 31-60: tibio. Conversa pero no decide.
- 61-85: caliente. Pregunta precios, compara, evalua.
- 86-100: muy caliente. Quiere registrarse, pide el link.

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

/**
 * Genera respuesta del agente para un mensaje entrante.
 */
export async function responder(lead, historial, entrante) {
  if (!anthropic) {
    throw new Error('Falta ANTHROPIC_API_KEY — el agente no puede responder.')
  }

  const systemPrompt = await getSystemPrompt()
  const modelo = await getModelo()

  const contexto = `Datos del prospecto con el que hablas:
- Nombre: ${lead.nombre || 'desconocido'}
- Telefono: ${lead.telefono || ''}
- Clientes que maneja: ${lead.cantClientes || 'no especificado'}
- Es prestamista: ${lead.esPrestamista || 'no especificado'}
- Metodo actual: ${lead.metodoActual || 'no especificado'}
- Plan de interes: ${lead.planInteres || 'no especificado'}`

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
  if (!anthropic) {
    throw new Error('Falta ANTHROPIC_API_KEY.')
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
