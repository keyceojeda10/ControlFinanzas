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
  "tipoPrestamo": "plata|mercancia",
  "montoPrestado": 0,
  "totalAPagar": 0,
  "valorCuota": 0,
  "numeroCuotas": 0,
  "tasaInteres": 0,
  "frecuencia": "diario|semanal|quincenal|mensual",
  "fechaInicio": "YYYY-MM-DD",
  "cuotasPagadas": 0,
  "montoPagadoHasta": 0,
  "saldoPendiente": 0,
  "notas": ""
}`

/* ══ LAS REGLAS, ESCRITAS CONTRA CARTULINAS DE VERDAD ═════════════════════════
 *
 * 17 ago 2026. El dueño mandó las dos primeras cartulinas reales que nos llegan
 * de un cliente y el lector las hizo trizas: montos mil veces más chicos,
 * teléfono perdido, plazo confundido con número de cobros, y la fecha del año
 * 2013. Cada regla de aquí abajo sale de UN fallo concreto de esas dos fotos.
 *
 * ⚠ NO SE INVENTA NADA NUEVO SOBRE EL NEGOCIO: se le cuenta al modelo cómo son
 * los papeles que la gente usa de verdad. Un talonario preimpreso tiene renglones
 * fijos —FECHA, SEÑOR, DIRECCIÓN, BARRIO, ARTÍCULO, VENDEDOR— y el prestamista
 * escribe donde le cabe, no donde dice. Leer por el rótulo es leer mal. */
const REGLAS = `Reglas:

⚠ LOS NÚMEROS ESTÁN EN MILES. En estas libretas nadie escribe los ceros: "500"
  es quinientos mil, "30" es treinta mil, "1200" es un millón doscientos mil.
  Escribe el número TAL COMO ESTÁ EN EL PAPEL, sin agregarle ceros: la app se
  encarga de la escala. Nunca conviertas "500" en "500000" tú.

⚠ LOS RÓTULOS IMPRESOS MIENTEN. El talonario viene preimpreso y la gente escribe
  donde le cabe. Guíate por lo que DICE el dato, no por el renglón:
  - un número de 10 cifras que empieza por 3 es un CELULAR, aunque esté escrito
    en el renglón "VENDEDOR" o "ARTÍCULO"
  - un número de 6 a 10 cifras junto a "CC" o "CÉDULA" es la cédula
  - "BARRIO" suele ser la dirección real cuando "DIRECCIÓN" trae otra cosa
  - en "DIRECCIÓN" a veces hay una nota de quién es la persona ("esposo Daniela",
    "sobrina de Nelson"): eso va en notas, no en direccion
  - "ARTÍCULO" puede traer el plan de pago ("8 x 150") en vez de un producto

- "8 x 150" significa 8 cobros de 150 cada uno: numeroCuotas=8, valorCuota=150.
  Si además hay un "Valor", comprueba que 8 × 150 = ese valor.

- "VALOR" casi siempre es el TOTAL A PAGAR (capital + interés), no lo prestado.
  Ponlo en totalAPagar. Solo ponlo en montoPrestado si el papel dice claramente
  que eso fue lo entregado.

- LA TABLA DE ABONOS (FECHA · ABONO · SALDO) es la mitad de la cartulina:
  - la frecuencia sale de la distancia entre fechas: 7 días = semanal,
    15 = quincenal, 30 = mensual, 1 = diario
  - ⚠ LA FRECUENCIA SOLO SALE DE AHÍ. Si la tabla está vacía o tiene un solo
    renglón, OMITE "frecuencia": no la supongas por el tipo de papel ni por el
    monto. Una frecuencia inventada cambia el calendario entero del préstamo, y
    el prestamista ya la pone una vez arriba para toda la tanda
  - saldoPendiente = el ÚLTIMO saldo de la columna, el de más abajo
  - ⚠ SI EL SALDO BAJA Y DE GOLPE SUBE, ahí empezó OTRO préstamo. Todo lo que
    informes tiene que ser del ÚLTIMO, el que sigue vivo:
      · totalAPagar = el saldo que aparece JUSTO DESPUÉS del salto
      · cuotasPagadas = solo los renglones POSTERIORES al salto
      · montoPagadoHasta = solo la suma de ESOS abonos, no la de toda la hoja
      · el préstamo anterior se menciona en notas y nada más
    Ejemplo: saldos 210, 180, 150, 120, 90, 60, 30 y luego 600, 525, 450, 375
    → el préstamo vivo es de 600, lleva 3 abonos de 75 (225) y debe 375.
    Los 30 de arriba son del préstamo viejo, que ya está saldado.
  - cuotasPagadas = renglones escritos del préstamo vivo
    y montoPagadoHasta = la suma de sus abonos; los dos tienen que cuadrar con
    el valor de la cuota: 3 renglones de 75 son 225, no 750

- tipoPrestamo: "plata" si es dinero prestado (a veces lo escriben arriba),
  "mercancia" si lo fiado fue un producto. Si no lo dice, omítelo.

- FECHAS: van día-mes-año. "13-05-26" es el 13 de mayo de 2026, no 2013.
  Estas libretas son del año en curso o del anterior, nunca de hace diez años.

- cedula y telefono: solo dígitos, sin espacios ni guiones
- los números: sin puntos ni comas de miles
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
  let ultimoFallo = ''
  for (const key of GEMINI_KEYS) {
    const res = await fetch(`${BASE}/${MODELO}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: maxTokens,
          /* ⚠ ESTA LÍNEA ES LA QUE HACÍA QUE EL LECTOR NO LEYERA NADA.
           *
           * `gemini-2.5-flash` razona antes de contestar y ese razonamiento SALE
           * DEL MISMO `maxOutputTokens`. Medido el 17 ago 2026 con las dos
           * primeras cartulinas reales de un cliente:
           *
           *   como estaba (1024):  pensó 979 tokens · escribió 39 · MAX_TOKENS
           *   → «```json { "nombre": "Lorena", "telefono": "31607782»  ← cortado
           *
           * El JSON llegaba partido a la mitad, `parsearRespuesta` no podía
           * parsearlo y la pantalla decía «No pudimos leer la foto». O sea que
           * la premisa principal del producto fallaba en casi todas las fotos, y
           * no por leer mal: por no llegar a contestar.
           *
           * Con el pensamiento apagado responde ENTERO con el mismo presupuesto
           * (124 tokens de salida), más rápido y más barato. Estos papeles se
           * transcriben, no se razonan. */
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    })

    if (res.status === 429) { ultimo429 = true; continue }
    /* ⚠ UN TROPIEZO DE GOOGLE NO PUEDE COSTARLE LA FOTO AL PRESTAMISTA.
     *
     * Antes cualquier código distinto de 429 reventaba en el acto, y el 503
     * —«este modelo tiene mucha demanda, prueba más tarde»— es pasajero y
     * frecuente: lo cacé el 17 ago probando estas mismas cartulinas. Con cinco
     * claves configuradas, la lectura moría en la primera teniendo cuatro
     * puertas sanas al lado, y el usuario leía «no pudimos leer la foto» en
     * mitad de la migración de su cuaderno. */
    if (res.status === 503 || res.status === 500) {
      ultimoFallo = `Gemini ${res.status}`
      continue
    }
    /* ⚠ Y UNA CLAVE MUERTA TAMPOCO. El 17 ago, probando estas cartulinas, una de
     * las cinco contestó 403 «Your project has been denied access»: la clave
     * está revocada. Reventar ahí es dejar que una clave caída tumbe el lector
     * entero teniendo cuatro buenas detrás. Se salta y se sigue. */
    if (res.status === 403 || res.status === 401) {
      ultimoFallo = `Gemini ${res.status} (clave rechazada)`
      continue
    }
    if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`)

    const json = await res.json()
    const candidato = json.candidates?.[0]

    /* ⚠ UNA RESPUESTA CORTADA NO SE DEVUELVE COMO SI FUERA BUENA.
     *
     * Es el mismo fallo que tenía el pensamiento, por la otra punta: si el
     * modelo se queda sin presupuesto a mitad de la lista, el JSON llega
     * partido. Y hay dos finales posibles, los dos malos:
     *
     *   · no parsea → «no pudimos leer la foto», y el prestamista no sabe que
     *     la foto estaba bien y lo que faltó fue sitio;
     *   · parsea de milagro porque el corte cayó en un sitio equilibrado → se
     *     guardan VEINTE clientes de treinta y nadie se entera. Ese es el
     *     peligroso: una hoja de cuaderno a medias parece una hoja entera.
     *
     * Con `finishReason: 'MAX_TOKENS'` se dice lo que pasó y qué hacer. */
    if (candidato?.finishReason === 'MAX_TOKENS') {
      throw new Error('Esa foto trae más renglones de los que caben en una lectura. Pruébala en dos partes, o recórtala.')
    }
    return candidato?.content?.parts?.[0]?.text ?? ''
  }

  throw new Error(ultimo429
    ? 'Todas las claves agotaron su cuota por hoy. Intenta más tarde.'
    : ultimoFallo
      ? 'El lector de fotos está saturado ahora mismo. Vuelve a intentarlo en un minuto.'
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
/* ⚠ EL PRESUPUESTO SE MIDIÓ, no se eligió a ojo. Con el pensamiento apagado, una
   cartulina gasta ~130 tokens de salida; los 1024 de antes sobran de largo para
   una y se quedan cortos para una LISTA. Cada cliente son 16 campos —cuatro más
   desde el 17 ago— y ronda los 180 tokens: una hoja de treinta renglones pide
   unos 5.400. Se deja el doble de margen porque quedarse corto ya no falla en
   silencio, pero sigue siendo una foto perdida para quien la subió. */
export async function procesarImagen(buffer, mimeType, prompt, { lado = 1600, maxTokens = 2048 } = {}) {
  const reducida = await sharp(buffer)
    .resize({ width: lado, height: lado, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()
  const texto = await llamarGemini(reducida.toString('base64'), 'image/jpeg', prompt, { maxTokens })
  return parsearRespuesta(texto)
}

/* ── LAS CUENTAS VIVEN EN `cartulina-datos.js` ──
   Se reexportan desde aquí para no romper a los seis sitios que ya importaban
   de este archivo. Lo que cambió es dónde están, no qué hacen: `sharp` no puede
   viajar al navegador y las pantallas necesitan `montoConTasa`. */
export {
  normalizarCliente, completar, semaforo, montoConTasa, aPesos, UMBRAL_MILES,
} from './cartulina-datos.js'

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
