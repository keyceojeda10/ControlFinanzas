/* ── DE LA FILA DE LA SOLICITUD A LA FILA DEL LOTE ───────────────────────────
 *
 * La carga que lee el sistema (`SolicitudCarga.filas`) guarda las filas en la
 * forma del IMPORTADOR (`montoPrestado`, `tasaInteres`, `abonadoHasta`…). La
 * pantalla donde el dueño las revisa y las carga (`components/migrador/
 * LoteFotos.jsx`) trabaja con otra forma (`monto`, `tasa`, `yaAbonado`,
 * `_dudas` como { campo, texto }…). Aquí se hace el paso de una a otra.
 *
 * ⚠ LAS FILAS DE UN EXCEL LLEGAN COMO TEXTO CRUDO («$ 1.500.000», «20%»,
 *   «Semanal», «15/03/2026»): la hoja se lee con `raw: false` y solo se
 *   renombran las columnas. El lote espera números, frecuencias del sistema y
 *   fechas AAAA-MM-DD; si pasaran tal cual, `Number('1.500.000')` daría NaN y
 *   la fila llegaría sin monto sin que nada reventara.
 *
 * ⚠ LO QUE NO SE ENTIENDE SE PREGUNTA, NO SE SUPLE. Una fecha, una frecuencia o
 *   un abonado que no se pueden leer quedan vacíos Y con una duda: rellenarlos
 *   en silencio (hoy, «diario», cero) crea préstamos con plazos y cuotas que
 *   nadie dijo.
 *
 * Aquí no hay red ni base: se prueba sin nada.
 */

import { parsearNumero, normalizarFecha } from '@/lib/carga-masiva'
import { formatMoney } from '@/lib/i18n'

/* Los mismos días que `LoteFotos`: de «56 días, semanal» salen 8 cobros. */
const DIAS_POR_PERIODO = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }

/* Los mismos alias que el importador (`normalizarFrecuencia`, lib/carga-masiva.js). */
const ALIAS_FRECUENCIA = {
  diario: 'diario', d: 'diario', dia: 'diario', daily: 'diario',
  semanal: 'semanal', s: 'semanal', semana: 'semanal', weekly: 'semanal',
  quincenal: 'quincenal', q: 'quincenal', quincena: 'quincenal',
  mensual: 'mensual', m: 'mensual', mes: 'mensual', monthly: 'mensual',
}

/** Los mensajes del importador (`validarFila`), dichos como los diría una persona. */
export const MOTIVO_CLARO = {
  'Tasa de interés es requerida y no puede ser negativa': 'Falta la tasa',
  'Plazo en días (o número de cuotas) debe ser mayor a 0': 'Falta el plazo o el número de cuotas',
  'Fecha de inicio no válida. Usa DD/MM/YYYY o YYYY-MM-DD': 'Falta la fecha en que empezó el préstamo',
  'Monto debe ser mayor a 0': 'Falta el monto prestado',
  'Nombre es requerido': 'Falta el nombre',
  'Necesitas al menos el nombre o la cédula': 'Falta el nombre o la cédula',
}

const vacio = (v) => v == null || v === ''

/* Un número de lo que venga: 1500000, «$ 1.500.000», «20%». Vacío es vacío (no
   cero) y un texto sin ninguna cifra tampoco es cero. */
function cifra(v) {
  if (vacio(v)) return ''
  if (typeof v === 'number') return Number.isFinite(v) ? v : ''
  if (!/\d/.test(String(v))) return ''
  return parsearNumero(v)
}

/* Una fecha que existe en el calendario. `normalizarFecha` solo da la forma
   (AAAA-MM-DD): «03/15/2026» sale «2026-15-03» y «31/02/2026» sale «2026-02-31».
   Se comprueba la ida y vuelta, como `real()` en lib/cartulina-datos.js: una
   fecha imposible que pasara como válida crearía el préstamo con otro día. */
function fechaReal(cruda) {
  const iso = normalizarFecha(cruda)
  if (!iso) return ''
  const f = new Date(`${iso}T12:00:00Z`)
  return !Number.isNaN(f.getTime()) && f.toISOString().slice(0, 10) === iso ? iso : ''
}

function frecuenciaDe(v) {
  if (vacio(v)) return ''
  const s = String(v).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return ALIAS_FRECUENCIA[s] ?? ''
}

/* El campo que hay que mirar, adivinado por la palabra: las dudas del importador
   y del lector se guardaron como frases sueltas.

   ⚠ CASI NINGUNA DUDA PUEDE QUEDAR SIN CAMPO. `LoteFotos` borra la duda de un
   campo cuando el dueño lo corrige (`d.campo !== campo`); una duda con campo ''
   no se borra nunca y la fila queda en ámbar para siempre, que es la forma más
   rápida de enseñar a ignorar los avisos.

   El orden manda cuando una frase trae varias palabras: lo que ya se resolvía
   (monto, tasa, abonado, fecha) va primero; las pistas más vagas, al final. Sin
   ninguna pista, '' (la frase se enseña, pero no se asocia a un campo). */
const PISTAS_DE_CAMPO = [
  [/monto/i, 'monto'],
  [/tasa/i, 'tasa'],
  [/abon/i, 'yaAbonado'],
  [/fecha/i, 'fechaInicio'],
  [/nombre/i, 'nombre'],
  [/c[eé]dula/i, 'cedula'],
  [/tel[eé]fono/i, 'telefono'],
  [/frecuencia/i, 'frecuencia'],
  [/plazo|cuotas?|cobros/i, 'plazoUnidades'],
  // «Este saldo no está escrito en el papel»: lo que el dueño toca es lo abonado.
  [/saldo/i, 'yaAbonado'],
  // Las dudas del lector de fotos sobre el importe, que no dicen «monto»:
  // «No se pudo leer cuánto le prestaste», «¿Son $14.500 o $14.500.000?»,
  // «hay más de una cifra… dos préstamos».
  [/prestaste|prestado|pr[eé]stamo|cifra|¿son \$/i, 'monto'],
]

function campoDeLaDuda(texto) {
  const t = String(texto ?? '')
  return PISTAS_DE_CAMPO.find(([pista]) => pista.test(t))?.[1] ?? ''
}

const REPETIDA = /^Repetida con la fila (\d+)/

/**
 * Una fila de la solicitud → una fila del lote (la que arma `LoteFotos` al leer
 * unas fotos). `_id`, `_archivo` y `_hoja` pasan tal cual.
 */
export function filaParaLote(fila) {
  const f = fila ?? {}

  const frecuenciaCruda = f.frecuencia
  const frecuencia = frecuenciaDe(frecuenciaCruda)
  const cuotas = cifra(f.numeroCuotas)
  const dias = cifra(f.diasPlazo)
  const plazoUnidades = cuotas > 0
    ? String(cuotas)
    : dias > 0 && frecuencia
      ? String(Math.max(1, Math.round(dias / (DIAS_POR_PERIODO[frecuencia] || 1))))
      : ''

  const fechaCruda = vacio(f.fechaInicio) ? '' : String(f.fechaInicio).trim()
  const fechaInicio = fechaCruda ? fechaReal(fechaCruda) : ''

  const yaAbonado = cifra(f.abonadoHasta)
  const saldoPendiente = cifra(f.saldoActual)
  const cuotaLeida = cifra(f.valorCuota)

  // Las dudas: las frases guardadas, con su campo; «Repetida con la fila N» no
  // es una duda de celda, es una marca de la fila.
  let repetidaDe = null
  const dudas = []
  for (const d of Array.isArray(f._dudas) ? f._dudas : []) {
    if (typeof d === 'string') {
      const rep = d.match(REPETIDA)
      if (rep) { repetidaDe = repetidaDe ?? rep[1]; continue }
      if (d.trim()) dudas.push({ campo: campoDeLaDuda(d), texto: d })
    } else if (d && typeof d === 'object' && d.texto) {
      dudas.push({ campo: d.campo ?? campoDeLaDuda(d.texto), texto: d.texto, ...(d.dato ? { dato: d.dato } : {}) })
    }
  }

  // Lo que no se pudo leer, se pregunta.
  if (frecuenciaCruda && !frecuencia && String(frecuenciaCruda).trim()) {
    dudas.push({ campo: 'frecuencia', texto: `No se entiende la frecuencia «${String(frecuenciaCruda).trim()}»: elígela tú.` })
  }
  if (fechaCruda && !fechaInicio) {
    dudas.push({ campo: 'fechaInicio', texto: `No se entiende la fecha «${fechaCruda}»: ponla tú.` })
  }
  // Debe un saldo pero no dice cuánto ha abonado: el abonado no se inventa restando.
  if (saldoPendiente > 0 && yaAbonado === '') {
    dudas.push({ campo: 'yaAbonado', texto: `Dice que debe ${formatMoney(saldoPendiente, 'co')}: ¿cuánto te ha abonado?` })
  }

  return {
    _id: f._id,
    nombre: String(f.nombre ?? ''),
    cedula: String(f.cedula ?? ''),
    telefono: String(f.telefono ?? ''),
    direccion: String(f.direccion ?? ''),
    monto: cifra(f.montoPrestado),
    tasa: cifra(f.tasaInteres),
    frecuencia,
    plazoUnidades,
    fechaInicio,
    yaAbonado,
    cuotaLeida: cuotaLeida > 0 ? cuotaLeida : '',
    saldoPendiente,
    diaCobro: '',
    _dudas: dudas,
    _avisos: Array.isArray(f._avisos) ? f._avisos.filter(Boolean) : [],
    _archivo: f._archivo ?? null,
    _hoja: f._hoja ?? null,
    _repetidaDe: repetidaDe,
    _ia: null,
  }
}

/** Todas las filas de una solicitud, en su orden. */
export function filasParaLote(filas) {
  return (Array.isArray(filas) ? filas : []).map(filaParaLote)
}

/**
 * El punto de partida de toda la carga: «Cómo prestas por defecto» del negocio.
 * ⚠ Si el negocio no lo tiene, VACÍO: nunca se supone «diario» ni «20 %».
 */
export function baseDesdeNegocio(org) {
  const o = org ?? {}
  return {
    tasa: Number(o.tasaDefault) > 0 ? String(o.tasaDefault) : '',
    frecuencia: Object.prototype.hasOwnProperty.call(DIAS_POR_PERIODO, o.frecuenciaDefault) ? o.frecuenciaDefault : '',
    modoInteres: o.modoInteresDefault || 'fijo',
    rutaId: '',
  }
}

/**
 * Los archivos de la solicitud (`archivosDe(sol)`) que tienen algo que decir: o
 * se leyeron y no dieron ninguna fila (`sinFilas`: el dueño tiene que saber que
 * ESE archivo no entró), o el lector dejó avisos. Los que dieron filas limpias,
 * y los que aún no se han leído, no salen.
 */
export function problemasPorArchivo(archivos) {
  const out = []
  for (const a of Array.isArray(archivos) ? archivos : []) {
    const motivos = (Array.isArray(a?.fallos) ? a.fallos : []).filter(Boolean)
    const sinFilas = typeof a?.filas === 'number' && a.filas === 0
    if (!sinFilas && !motivos.length) continue
    out.push({ n: a.n, nombre: a.nombre, tipo: a.tipo, sinFilas, motivos })
  }
  return out
}

/**
 * Lo que tiene la pantalla + lo que trae el servidor al refrescar: las locales
 * tal cual (lo que el dueño corrigió no se pisa) y, además, las del servidor que
 * no estén ya en ellas ni se hayan creado.
 */
export function unirFilasDelLote(locales, delServidor, creadas) {
  const lista = Array.isArray(locales) ? locales : []
  const conocidas = new Set([...lista.map((f) => f._id), ...(Array.isArray(creadas) ? creadas : [])])
  return [...lista, ...(Array.isArray(delServidor) ? delServidor : []).filter((f) => !conocidas.has(f._id))]
}

/* ══ LA CÉDULA DE RELLENO DE UNA FILA, SIEMPRE LA MISMA ═════════════════════
 *
 * Piloto del 22 nov 2026 (task-8, check C): se cerró la app a mitad de una
 * tanda y el servidor alcanzó a crear tres clientes cuyo préstamo no llegó. Al
 * volver, esas filas se crearon OTRA VEZ: la fila sin cédula recibía un
 * `SIN-<aleatorio>` distinto en cada intento, así que `/api/clientes` no tenía
 * cómo reconocer al que ya existía. Clientes repetidos sin préstamo.
 *
 * Con un marcador que sale SOLO de la solicitud y de la fila, el reintento manda
 * la misma cédula y `/api/clientes` contesta 409 con el `existingId`: la fila
 * sigue con ese cliente y crea solo su préstamo.
 *
 * ⚠ EL PREFIJO ES `SIN-C_`, no `SIN-C` a secas: la carga masiva genera
 *   `SIN-<NOMBRE>` en mayúsculas («SIN-CARLOS-PEREZ») y eso también empieza por
 *   SIN-C. `sinCedulaDe` solo deja A-Z, 0-9 y «-», así que el «_» no lo produce
 *   nadie más. Sigue empezando por `SIN-`: todo el sistema lo trata como «sin
 *   cédula» (no se valida, no se pinta, no se reporta).
 *
 * `Cliente.cedula` es VARCHAR(191). Con ids normales (cuid + «archivo-fila»)
 * cabe de sobra; si alguna vez no, se resume con un hash: sigue siendo el mismo
 * para la misma fila y distinto para otra.
 */
export const PREFIJO_FILA = 'SIN-C_'
const LARGO_MAXIMO_MARCADOR = 120

/* FNV-1a de 32 bits, dos pasadas con semillas distintas: 64 bits, sin red ni
   `crypto` (esto corre también en el teléfono). */
function resumen(texto) {
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i)
    a = Math.imul(a ^ c, 0x01000193) >>> 0
    b = Math.imul(b ^ c, 0x01000193 ^ 0x2f) >>> 0
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0')
}

/**
 * La cédula de relleno de la fila `filaId` de la solicitud `solicitudId`, o
 * null si falta alguno (entonces se usa el marcador aleatorio de siempre).
 */
export function marcadorDeFila(solicitudId, filaId) {
  const s = solicitudId == null ? '' : String(solicitudId).trim()
  const f = filaId == null ? '' : String(filaId).trim()
  if (!s || !f) return null
  const legible = `${PREFIJO_FILA}${s}_${f}`
  return legible.length <= LARGO_MAXIMO_MARCADOR && !s.includes('_')
    ? legible
    : `${PREFIJO_FILA}${resumen(`${s}\u0000${f}`)}`
}
