// lib/cartulina.js — leer cartulinas y cuadernos con Gemini Vision.
//
// ══ POR QUÉ ESTO SALE A UN ARCHIVO PROPIO ═════════════════════════════════
//
// Vivía entero dentro de `app/api/herramientas/leer-cartulina/route.js`, que
// lee UNA cartulina y devuelve UN cliente. Ahora hacen falta dos endpoints —el
// de siempre y el de lote— y la alternativa era copiar la llamada a Gemini, la
// rotación de claves, el redimensionado y los límites del plan. Copiar eso es
// garantizar que dentro de un mes uno de los dos tenga la clave de pago primero
// y el otro no.
//
// Aquí vive el TRANSPORTE. Los dos prompts también, porque son parte del
// contrato: si alguien cambia el JSON que pide el prompt sin cambiar el que
// parsea la pantalla, no falla nada — simplemente dejan de llegar campos.
//
// ══ EL PROBLEMA QUE VIENE A RESOLVER ══════════════════════════════════════
//
// Medido en producción: de 429 negocios, 226 cargaron su cartera A MANO a razón
// de uno o dos clientes por minuto, y el 73 % se quedó en cinco clientes o
// menos. De los que pasan de 21 clientes, la mitad paga; de los que se quedan
// en cinco, el 1 %. El muro no es entender la app: es pasar el cuaderno.

import sharp from 'sharp'

/* ── LAS CLAVES ───────────────────────────────────────────────────────────
   ⚠ LA PRIMERA ES LA QUE MANDA, no hay rueda. Antes era round-robin puro
   (`geminiKeyIndex++`), y eso reparte la carga por igual entre claves que NO
   son iguales: el dueño pagó UNA y las otras cuatro son de cuota gratis. Con
   la rueda, la que se pagó atendía una de cada cinco peticiones y las otras
   cuatro seguían topando.

   Ahora se prueba siempre la primera y las demás quedan de respaldo para
   cuando esa devuelva 429. Pon la de pago primera en `GEMINI_API_KEYS`. */
export const GEMINI_KEYS = (process.env.GEMINI_API_KEYS ?? '')
  .split(',').map((k) => k.trim()).filter(Boolean)

const MODELO = 'gemini-2.5-flash'
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

/* ══ LOS DOS PROMPTS ══════════════════════════════════════════════════════

   Están separados a propósito. El de UNO lleva meses en producción y es el que
   usan `/migrador` y el asistente de arranque: tocarlo para meterle el lote
   habría cambiado el comportamiento de las dos pantallas a la vez.

   ⚠ NO SE PIDE «confianza» AL MODELO. Es tentador —una nota por campo para
   pintar el semáforo— y es peor: un modelo que se autoevalúa dice que está
   seguro casi siempre, y encima gasta tokens. La regla que sí funciona ya está
   escrita en las dos: OMITE lo que no puedas leer. Con eso, «campo ausente» ES
   la señal de baja confianza, y la pantalla pinta el semáforo contando qué
   llegó. Un dato que falta se ve; uno inventado, no. */

const CAMPOS = `{
  "nombre": "",
  "cedula": "",
  "telefono": "",
  "direccion": "",
  "montoPrestado": 0,
  "tasaInteres": 0,
  "frecuencia": "diario|semanal|quincenal|mensual",
  "diasPlazo": 0,
  "fechaInicio": "YYYY-MM-DD",
  "cuotasPagadas": 0,
  "montoPagadoHasta": 0,
  "saldoPendiente": 0,
  "notas": ""
}`

const REGLAS = `Reglas:
- cedula y telefono: solo dígitos, sin espacios ni guiones
- los números: sin puntos ni comas de miles
- Si ves cuotas tachadas, marcadas o con visto bueno, cuéntalas en cuotasPagadas
- Si detectas la frecuencia por el patrón de pagos (diario, semanal...), inclúyela
- Si ves un saldo, un "debe" o un "resta", ponlo en saldoPendiente
- Si ves un total a pagar y un monto prestado, calcula la tasa si no está explícita
- ⚠ Si no puedes leer un campo con certeza, OMÍTELO. No pongas 0 ni texto
  inventado: es preferible que falte a que esté mal, porque lo que falta se ve
  y lo inventado no
- Solo devuelve el JSON puro, sin texto antes ni después, sin markdown`

/** El de siempre: una cartulina, un cliente. No se toca. */
export const PROMPT_UNO = `Eres un asistente para una app de gestión de préstamos informales en Colombia/LATAM.
El usuario te envía una foto de un registro de préstamo. Puede ser una cartulina, cuaderno, libreta, hoja, tarjeta de cobro, anotación en papel, o cualquier documento manuscrito o impreso donde se registre información de un préstamo.
Extrae todos los datos que puedas en el siguiente JSON (omite los campos que no aparezcan claramente):
${CAMPOS}
${REGLAS}`

/* El nuevo. Dos diferencias con el de arriba, y las dos vienen de lo que el
   dueño describió: sus clientes llevan los registros de las TRES formas —una
   cartulina por persona, un cuaderno con lista de muchos, y mezclado—.

   1. Devuelve un ARRAY. Una foto de una hoja de cuaderno trae treinta clientes,
      y el endpoint viejo no podía devolver más de uno.
   2. Dice QUÉ está viendo (`tipo`). La pantalla lo necesita para saber si
      juntar varias fotos en un cliente o tratarlas como clientes distintos. */
export const PROMPT_LOTE = `Eres un asistente para una app de gestión de préstamos informales en Colombia/LATAM.
El usuario te envía la foto de un registro de préstamos. Puede ser:
  (a) una CARTULINA o tarjeta de cobro de UN solo cliente
  (b) una HOJA DE CUADERNO o listado con VARIOS clientes, uno por renglón
  (c) una hoja con varias cartulinas pequeñas juntas

Primero decide cuál es. Después extrae TODOS los clientes que veas.

Responde este JSON:
{
  "tipo": "cartulina" | "lista",
  "clientes": [ ${CAMPOS} ]
}

- "cartulina": la foto es de UNA persona. Devuelve un solo elemento.
- "lista": la foto tiene VARIAS personas. Devuelve uno por cada una, en el
  orden en que aparecen. No te saltes ninguno aunque el renglón esté a medias.
- Si un renglón solo tiene nombre y monto, devuélvelo igual con esos dos campos.
${REGLAS}`

/* ── LA LLAMADA ──
   Recorre las claves EN ORDEN, no en rueda. Solo pasa a la siguiente si la
   anterior devolvió 429 (cuota agotada). */
export async function llamarGemini(base64, mimeType, prompt, { maxTokens = 1024 } = {}) {
  if (GEMINI_KEYS.length === 0) throw new Error('No hay claves Gemini configuradas')

  let ultimo429 = false
  for (const key of GEMINI_KEYS) {
    const res = await fetch(`${BASE}/${MODELO}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: maxTokens },
      }),
    })

    if (res.status === 429) { ultimo429 = true; continue }
    if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`)

    const json = await res.json()
    return json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  }

  throw new Error(ultimo429
    ? 'Todas las claves agotaron su cuota por hoy. Intenta más tarde.'
    : 'No pudimos leer la foto.')
}

/** Saca el JSON aunque venga con markdown o texto alrededor. Objeto o array. */
export function parsearRespuesta(texto) {
  const match = String(texto ?? '').match(/[{[][\s\S]*[}\]]/)
  if (!match) return null
  try { return JSON.parse(match[0]) } catch { return null }
}

/* Reducir a 1600px ahorra tokens sin perder legibilidad del texto.
   ⚠ Una hoja de cuaderno con treinta renglones necesita MÁS resolución que una
   cartulina: a 1600 los números de la última columna se pierden. Por eso el
   lote sube a 2000. */
export async function procesarImagen(buffer, mimeType, prompt, { lado = 1600, maxTokens = 1024 } = {}) {
  const reducida = await sharp(buffer)
    .resize({ width: lado, height: lado, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()
  const texto = await llamarGemini(reducida.toString('base64'), 'image/jpeg', prompt, { maxTokens })
  return parsearRespuesta(texto)
}

/* ── LA NORMALIZACIÓN, EN UN SOLO SITIO ───────────────────────────────────
   El prompt pide «cedula» sin tilde pero el modelo devuelve «cédula» a
   menudo, y la pantalla hacía `d['cédula'] || d.cedula` a mano campo por
   campo. Cada pantalla nueva que lea cartulinas repetiría esas líneas hasta
   que una se olvidara de una tilde y el dato se perdiera en silencio. */
const CLAVES = {
  nombre: ['nombre'],
  cedula: ['cedula', 'cédula'],
  telefono: ['telefono', 'teléfono'],
  direccion: ['direccion', 'dirección'],
  montoPrestado: ['montoPrestado', 'monto', 'prestado'],
  tasaInteres: ['tasaInteres', 'tasa', 'interes', 'interés'],
  frecuencia: ['frecuencia'],
  diasPlazo: ['diasPlazo', 'plazo'],
  fechaInicio: ['fechaInicio', 'fecha'],
  cuotasPagadas: ['cuotasPagadas'],
  montoPagadoHasta: ['montoPagadoHasta', 'abonado', 'pagado'],
  saldoPendiente: ['saldoPendiente', 'saldo', 'debe', 'resta'],
  notas: ['notas', 'nota'],
}

const FRECUENCIAS = ['diario', 'semanal', 'quincenal', 'mensual']

/** Un cliente crudo del modelo → la forma que usa la app. Sin inventar nada. */
export function normalizarCliente(crudo = {}) {
  const out = {}
  for (const [campo, alias] of Object.entries(CLAVES)) {
    for (const a of alias) {
      const v = crudo[a]
      if (v !== undefined && v !== null && v !== '') { out[campo] = v; break }
    }
  }
  // Los números llegan como texto con puntos más veces de las que uno querría.
  for (const n of ['montoPrestado', 'tasaInteres', 'diasPlazo', 'cuotasPagadas', 'montoPagadoHasta', 'saldoPendiente']) {
    if (out[n] != null) {
      const limpio = Number(String(out[n]).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'))
      if (Number.isFinite(limpio) && limpio !== 0) out[n] = limpio
      else delete out[n]
    }
  }
  if (out.frecuencia && !FRECUENCIAS.includes(String(out.frecuencia).toLowerCase())) delete out.frecuencia
  else if (out.frecuencia) out.frecuencia = String(out.frecuencia).toLowerCase()
  for (const t of ['cedula', 'telefono']) {
    if (out[t]) out[t] = String(out[t]).replace(/\D/g, '') || undefined
  }
  return out
}

/* ── EL SEMÁFORO ──
   Se calcula CONTANDO qué llegó, no preguntándole al modelo. Ver la nota de
   arriba sobre por qué no se pide «confianza».

     verde  — se puede crear el cliente Y su préstamo sin tocar nada
     ámbar  — se crea, pero falta algo que conviene revisar
     rojo   — sin nombre o sin monto no hay préstamo que crear */
export function semaforo(c = {}) {
  if (!c.nombre || !(c.montoPrestado > 0)) return 'rojo'
  if (!c.frecuencia || !(c.tasaInteres > 0) || !(c.diasPlazo > 0)) return 'ambar'
  return 'verde'
}

/* ── LOS LÍMITES DEL PLAN ──
   El cupo ampliado de los primeros días NO es generosidad: es cuando el
   prestamista está pasando su cuaderno entero, y es el momento que decide si
   se queda o se va. Toparlo ahí es cerrarle la puerta el día 1. */
export const LIMITES_PLAN = {
  test: 3, starter: 15, basic: 20, growth: 30, standard: 40, professional: 80,
}
export const LIMITE_DEFAULT = 15
export const DIAS_ACTIVACION = 14
/* ⚠ 300, no 60. Con la clave de pago primera el freno deja de ser la cuota de
   Google y pasa a ser el costo, que a 2.5-flash es de centavos por foto. Un
   prestamista con 200 clientes en el cuaderno necesita 200 lecturas, no 60, y
   cortarle a mitad de la migración es perderlo entero. */
export const LIMITE_ACTIVACION = 300

export function limiteDelDia(plan, createdAt) {
  const dias = createdAt ? (Date.now() - new Date(createdAt).getTime()) / 86400000 : 999
  const suyo = LIMITES_PLAN[plan] ?? LIMITE_DEFAULT
  return dias <= DIAS_ACTIVACION ? Math.max(LIMITE_ACTIVACION, suyo) : suyo
}
