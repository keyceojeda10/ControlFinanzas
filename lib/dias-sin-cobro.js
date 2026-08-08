// lib/dias-sin-cobro.js — Lógica de días sin cobro (0=Dom, 1=Lun ... 6=Sáb)

/**
 * Parsea el campo diasSinCobro de la DB (JSON string o null)
 * @returns {number[]} array de días 0-6
 */
export function parsearDiasSinCobro(valor) {
  if (!valor) return null // null = no configurado, hereda
  try {
    const arr = typeof valor === 'string' ? JSON.parse(valor) : valor
    if (!Array.isArray(arr)) return null
    return arr.filter(d => Number.isInteger(d) && d >= 0 && d <= 6)
  } catch {
    return null
  }
}

/**
 * Resuelve la jerarquía: Préstamo > Cliente > Ruta > Organización.
 * null = no configurado (hereda). [] = explícitamente sin días (override).
 */
export function obtenerDiasSinCobro(cliente, ruta, org, prestamo = null) {
  const p = parsearDiasSinCobro(prestamo?.diasSinCobro)
  if (p !== null) return p

  const c = parsearDiasSinCobro(cliente?.diasSinCobro)
  if (c !== null) return c

  const r = parsearDiasSinCobro(ruta?.diasSinCobro)
  if (r !== null) return r

  const o = parsearDiasSinCobro(org?.diasSinCobro)
  if (o !== null) return o

  return []
}

/**
 * Cuenta cuántos días excluidos hay entre fechaInicio y fechaFin (inclusive).
 * Usa cálculo matemático O(1) en vez de iterar día por día.
 */
export function contarDiasExcluidos(fechaInicio, fechaFin, diasExcluidos) {
  if (!diasExcluidos || diasExcluidos.length === 0) return 0

  const inicio = new Date(fechaInicio)
  inicio.setHours(0, 0, 0, 0)
  const fin = new Date(fechaFin)
  fin.setHours(0, 0, 0, 0)

  const totalDias = Math.floor((fin - inicio) / (1000 * 60 * 60 * 24)) + 1
  if (totalDias <= 0) return 0

  const semanasCompletas = Math.floor(totalDias / 7)
  const diasRestantes = totalDias % 7
  let count = semanasCompletas * diasExcluidos.length

  // Contar días excluidos en el residuo
  const diaInicio = inicio.getDay()
  for (let i = 0; i < diasRestantes; i++) {
    if (diasExcluidos.includes((diaInicio + semanasCompletas * 7 + i) % 7)) {
      count++
    }
  }

  return count
}

/**
 * Verifica si hoy es un dia sin cobro para este conjunto de dias.
 * @param {number[]} diasExcluidos
 * @param {number} [offsetHoras=-5] UTC offset en horas (default Colombia)
 */
export function esHoySinCobro(diasExcluidos, offsetHoras = -5) {
  if (!diasExcluidos || diasExcluidos.length === 0) return false
  const ahora = new Date(Date.now() - Math.abs(offsetHoras) * 60 * 60 * 1000)
  return diasExcluidos.includes(ahora.getUTCDay())
}

/**
 * Valida y normaliza el input de diasSinCobro para guardar en DB.
 * @returns {string|null} JSON string o null
 */
export function validarDiasSinCobro(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  const arr = typeof valor === 'string' ? JSON.parse(valor) : valor
  if (!Array.isArray(arr)) throw new Error('Debe ser un array')
  if (arr.length === 0) return '[]'
  const unicos = [...new Set(arr.map(Number))]
  if (unicos.some(d => !Number.isInteger(d) || d < 0 || d > 6)) {
    throw new Error('Días inválidos (deben ser 0-6)')
  }
  if (unicos.length > 6) throw new Error('Máximo 6 días sin cobro')
  return JSON.stringify(unicos.sort())
}

const NOMBRES_DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function nombresDias(diasArray) {
  return diasArray.map(d => NOMBRES_DIAS[d]).join(', ')
}

// ─── FESTIVOS ────────────────────────────────────────────────────

/**
 * Normaliza una fecha a inicio de día UTC (sin hora) para comparación.
 */
function inicioDiaColombiaFestivo(valor) {
  const d = valor instanceof Date ? new Date(valor) : new Date(valor)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/**
 * Cuenta cuántos festivos caen dentro del rango [fechaInicio, fechaFin] (inclusive).
 * @param {Date|string} fechaInicio
 * @param {Date|string} fechaFin
 * @param {Array} festivos — array de objetos con campo `fecha` o directamente Date/string
 * @returns {number}
 */
export function contarFestivosEnRango(fechaInicio, fechaFin, festivos = []) {
  if (!festivos || festivos.length === 0) return 0
  const inicio = inicioDiaColombiaFestivo(fechaInicio)
  const fin = inicioDiaColombiaFestivo(fechaFin)
  return festivos.filter(f => {
    const d = inicioDiaColombiaFestivo(f.fecha ?? f)
    return d >= inicio && d <= fin
  }).length
}

/**
 * Verifica si hoy es un festivo.
 * @param {Array} festivos — array de objetos con campo `fecha` o directamente Date/string
 * @param {number} [offsetHoras=-5] UTC offset en horas (default Colombia)
 * @returns {boolean}
 */
export function esHoyFestivo(festivos = [], offsetHoras = -5) {
  if (!festivos || festivos.length === 0) return false
  const ahora = new Date(Date.now() - Math.abs(offsetHoras) * 60 * 60 * 1000)
  const hoyStr = ahora.toISOString().split('T')[0]
  return festivos.some(f => {
    const fecha = f.fecha ?? f
    return new Date(fecha).toISOString().split('T')[0] === hoyStr
  })
}

/**
 * Verifica si una fecha específica es festivo.
 * @param {Date|string} fecha
 * @param {Array} festivos — array de objetos con campo `fecha` o directamente Date/string
 * @returns {boolean}
 */
export function esFestivo(fecha, festivos = []) {
  if (!festivos || festivos.length === 0) return false
  const str = new Date(fecha).toISOString().split('T')[0]
  return festivos.some(f => {
    const fFecha = f.fecha ?? f
    return new Date(fFecha).toISOString().split('T')[0] === str
  })
}

/* ══ QUÉ DÍAS SE COBRA, DICHO CON PALABRAS ═══════════════════════════════════
 *
 * Reportado por el dueño dos veces: «dentro del préstamo, en ningún lugar dice
 * información relevante como el día que se cobra… dice cuatro cuotas de tantas,
 * pero no dice qué día se cobran». Y la segunda, con la pantalla ya arreglada
 * del PRÓXIMO cobro: «sigo sin ver los días o día de pagos».
 *
 * Son dos preguntas distintas y yo había contestado la otra:
 *   · CUÁNDO es el próximo   → «VENCIÓ EL 24 jul»   (ya está)
 *   · QUÉ DÍAS se cobra      → esto                  (faltaba)
 *
 * En un préstamo diario «30 cuotas diarias» NO significa treinta días
 * seguidos: si la ruta no cobra domingos, son cinco semanas. Ese dato existía
 * —lo resuelve `obtenerDiasSinCobro` en el servidor— y no llegaba a ninguna
 * pantalla.
 *
 * ⚠ LA FRASE TIENE QUE DECIR LO QUE EL CALENDARIO HACE DE VERDAD, y hay una
 * regla que sorprende: **`diasSinCobro` SOLO se aplica en frecuencia diaria**
 * (`calculos.js:1119`). En semanal o mensual se ignora a propósito —una ruta
 * que solo cobra sábados llevaría la primera cuota a siete sábados después—
 * así que nombrar los días excluidos ahí sería mentir sobre el calendario.
 */

const DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const DIA_PLURAL = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados']

/** «lunes, martes y jueves» — la «y» antes del último, como se habla. */
function enumerar(nombres) {
  if (nombres.length <= 1) return nombres[0] ?? ''
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
}

/** El día de la semana / del mes que ancla el calendario, en hora de Bogotá. */
function anclaDeLaFecha(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  // getUTC*: las fechas del sistema llevan el convenio T05:00Z (medianoche de
  // Bogotá). Leerlas en local corre el día entero en un server al oeste.
  return { semana: d.getUTCDay(), mes: d.getUTCDate() }
}

export function calendarioDeCobro(prestamo, diasExcluidos = []) {
  if (!prestamo) return null
  const freq = prestamo.frecuencia || 'diario'
  const ancla = anclaDeLaFecha(prestamo.fechaInicio)

  if (freq === 'diario') {
    const fuera = [...new Set(diasExcluidos ?? [])].filter((d) => d >= 0 && d <= 6).sort()
    if (!fuera.length) return 'Se cobra todos los días'
    if (fuera.length >= 7) return 'No hay ningún día de cobro configurado'
    // Los dos casos que se dicen mejor al revés, porque son los normales.
    const soloDomingo = fuera.length === 1 && fuera[0] === 0
    const finDeSemana = fuera.length === 2 && fuera.includes(0) && fuera.includes(6)
    if (soloDomingo) return 'Se cobra de lunes a sábado'
    if (finDeSemana) return 'Se cobra de lunes a viernes'
    // El resto se dice por los que SÍ: con cuatro excluidos, listar los que
    // faltan es más corto y es la pregunta que se hace el cobrador.
    const dentro = [1, 2, 3, 4, 5, 6, 0].filter((d) => !fuera.includes(d))
    return `Se cobra los ${enumerar(dentro.map((d) => DIA_PLURAL[d]))}`
  }

  const diaMes = Number.isInteger(prestamo.diaCobroMes) ? prestamo.diaCobroMes : null
  const diaMes2 = Number.isInteger(prestamo.diaCobroMes2) ? prestamo.diaCobroMes2 : null
  const diaSem = Number.isInteger(prestamo.diaCobroSemana) ? prestamo.diaCobroSemana : null

  if (freq === 'mensual') {
    const d = diaMes ?? ancla?.mes
    return d ? `Se cobra el ${d} de cada mes` : 'Se cobra una vez al mes'
  }

  if (freq === 'quincenal') {
    if (diaMes && diaMes2) return `Se cobra el ${diaMes} y el ${diaMes2} de cada mes`
    if (diaMes) return `Se cobra el ${diaMes} de cada mes, cada 15 días`
    const d = diaSem ?? ancla?.semana
    return d != null ? `Se cobra cada 15 días, los ${DIA_PLURAL[d]}` : 'Se cobra cada 15 días'
  }

  if (freq === 'semanal') {
    if (diaMes) return `Se cobra el ${diaMes} de cada mes`
    const d = diaSem ?? ancla?.semana
    return d != null ? `Se cobra todos los ${DIA_PLURAL[d]}` : 'Se cobra una vez por semana'
  }

  return null
}

/** El día suelto, para donde no cabe la frase entera. */
export function nombreDia(n) {
  return DIA[((n % 7) + 7) % 7] ?? null
}
