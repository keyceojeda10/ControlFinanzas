// lib/dinero/calendario.js — cuándo toca cada cobro. Sin dependencias.
//
// ── POR QUÉ EXISTE ─────────────────────────────────────────────────────────
// Estas tres funciones vivían en `lib/calculos.js`, y eso creaba un ciclo:
// `lib/dinero/tabla.js` necesita el calendario para derivar las fechas, así que
// importaba de `calculos.js`; y para cablear la tabla derivada a la mora,
// `calculos.js` tenía que importar de `tabla.js`. Un ciclo de importación
// justo en el núcleo del dinero.
//
// ESM a veces tolera un ciclo y a veces deja un `undefined` en tiempo de carga,
// según el orden en que se resuelvan los módulos. En un archivo del que cuelgan
// la mora, la caja y los recibos eso es el fallo intermitente que este proyecto
// ya se comió una vez: una función que no existe pasa build, pruebas y
// despliegue —no hay TypeScript— y revienta dentro de un ternario en producción.
//
// La regla que deja el ciclo imposible: el calendario NO sabe de dinero. No
// importa nada. Cualquiera puede depender de él y él de nadie.
//
// `calculos.js` los re-exporta, así que los que ya los importaban de allí
// siguen funcionando sin tocar una línea.

/** Cuántos días tiene un periodo de cobro, por frecuencia. */
export function obtenerDiasPorPeriodo(frecuencia = 'diario') {
  return { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }[frecuencia] || 1
}

/**
 * Suma `n` meses de CALENDARIO, no bloques de 30 días.
 *
 * El día se ancla al `diaAncla` si viene, y si no al día del mes de la fecha
 * base — «presto el 5, cobro los 5», que es lo que el prestamista da por hecho.
 * Se acota al último día del mes para que el 31 no se desborde a marzo.
 */
export function sumarMeses(fecha, n, diaAncla = null) {
  const base = new Date(fecha)
  const dia = Number.isInteger(diaAncla) && diaAncla >= 1 ? diaAncla : base.getUTCDate()
  base.setUTCDate(1)
  base.setUTCMonth(base.getUTCMonth() + n)
  const ultimoDiaDelMes = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate()
  base.setUTCDate(Math.min(Math.max(1, dia), ultimoDiaDelMes))
  return base
}

/**
 * Cuándo cae el PRIMER cobro cuando el prestamista tiene un día de corte.
 *
 * ── EL FALLO QUE ARREGLA ───────────────────────────────────────────────────
 * `fechaDePeriodo` suma un mes ENTERO y después ancla al día de corte, así que
 * el primer periodo salía de cualquier tamaño: presta el 13 y cobra los 30 y la
 * primera cuota se iba al **30 de septiembre, 48 días después**, cobrando un mes
 * de interés. Al revés —presta el 25, cobra los 1— caía **7 días después**, con
 * el mes entero de interés encima. Medido en producción: de 205 préstamos
 * mensuales con día de corte, 107 tenían el primer periodo desfasado; 48 cortos
 * (los clientes pusieron $3.519.639 de más) y 59 largos (los prestamistas
 * regalaron $3.400.613).
 *
 * La regla: el primer corte que caiga **después** de entregar el dinero. Si está
 * demasiado cerca —menos de medio periodo— se pasa al siguiente, porque una
 * cuota completa a los tres días de recibir la plata no es un cobro, es un susto.
 *
 * ⚠ No sustituye a `fechaDePeriodo`: se usa SOLO al crear, y el resultado queda
 * guardado en las filas de la cuota. Los préstamos que ya existen siguen leyendo
 * su calendario de siempre y no se les mueve una fecha.
 */
export function primerCobroMensual(fechaInicio, diaAncla, diasMinimos = 15) {
  const base = new Date(fechaInicio)
  for (let salto = 0; salto <= 2; salto++) {
    const cand = sumarMeses(base, salto, diaAncla)
    if (Math.round((cand - base) / 86400000) >= diasMinimos) return cand
  }
  return sumarMeses(base, 1, diaAncla)
}

/**
 * La fecha del cobro número `n`.
 *
 * Era un cierre dentro de `calcularPrestamo`, así que solo la podía usar quien
 * estuviera CREANDO un préstamo. La tabla derivada necesita las mismas fechas
 * para un préstamo que ya existe, y la alternativa era copiar la regla — la
 * duodécima réplica de una regla de calendario en un proyecto que ya tiene una
 * nota titulada «un solo calendario».
 *
 * Toda la aritmética va en UTC a propósito: producción corre en UTC y el
 * desarrollo en Bogotá, así que un error con métodos locales es invisible aquí
 * y real allí.
 */
export function fechaDePeriodo(n, { fechaInicio, freq, diasPeriodo, diaCobroMes, diaCobroMes2, primerCobro } = {}) {
  // Si el préstamo tiene guardado su primer cobro, ese manda y los demás salen
  // de él mes a mes. Es el único punto donde se decide, y los préstamos que ya
  // existen lo tienen en null: para ellos esta rama no se toca y el calendario
  // sigue siendo exactamente el de siempre.
  if (freq === 'mensual' && primerCobro) {
    const base = new Date(primerCobro)
    if (n <= 1) return base
    return sumarMeses(base, n - 1, Number.isInteger(diaCobroMes) && diaCobroMes >= 1 ? diaCobroMes : null)
  }
  // Mensual: SIEMPRE calendario de meses. Sin ancla explícita el ancla es el día
  // del mes de la fechaInicio. Antes, sin ancla, caía al +30 días y las fechas
  // se corrían mes a mes.
  if (freq === 'mensual') {
    return sumarMeses(fechaInicio, n, Number.isInteger(diaCobroMes) && diaCobroMes >= 1 ? diaCobroMes : null)
  }
  /* ⚠ BASTA CON UNO DE LOS DOS DÍAS, VENGA EN EL CAMPO QUE VENGA.
   *
   * Antes se exigía `diaCobroMes`. Si el prestamista rellenaba solo «Segundo
   * cobro» —cosa que la pantalla permite— quedaba `diaCobroMes: null` y
   * `diaCobroMes2: 15`, y esta rama NO se activaba: el préstamo volvía al
   * calendario de «entrega + 15 días» y le asignaba otra fecha.
   *
   * Es exactamente lo que reportó el prestamista el 28 ago 2026: «yo le digo al
   * sistema la primer cuota es tal día y él asigna otra». Medido: 5 préstamos
   * vivos en 2 negocios guardados con esa forma.
   *
   * Las fechas se derivan al leer, así que arreglar esto arregla también los
   * que ya están guardados así. */
  const anclas = [diaCobroMes, diaCobroMes2]
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 31)
  if (anclas.length > 0 && freq === 'quincenal') {
    anclas.sort((a, b) => a - b)
    const base = new Date(fechaInicio)
    let count = 0
    let cursor = new Date(base)
    while (count < n) {
      cursor.setUTCDate(cursor.getUTCDate() + 1)
      const ultimoDiaMes = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate()
      for (const ancla of anclas) {
        if (cursor.getUTCDate() === Math.min(ancla, ultimoDiaMes)) {
          count++
          if (count === n) return new Date(cursor)
        }
      }
    }
    return cursor
  }
  const f = new Date(fechaInicio)
  f.setUTCDate(f.getUTCDate() + n * (diasPeriodo || 1))
  return f
}

/* ══ UN PERIODO MÁS ADELANTE ═════════════════════════════════════════════════
 *
 * «Yo tengo clientes que en la quincena no me pueden dar la cuota, pero me dan
 *  el interés. Lo que hago es recibir el interés hoy y la cuota queda para la
 *  próxima quincena, pero sigue siendo igual.» — un prestamista, 16 ago 2026.
 *
 * Cobrar solo el interés YA hacía lo suyo —la cuota no baja y la deuda sube—
 * pero mover la fecha era un segundo viaje por otra pantalla. Esto es lo que
 * permite ofrecerlo en el mismo gesto.
 *
 * ⚠ MENSUAL NO ES «+30 DÍAS», es el mismo día del mes. Es la quinta función de
 *   esta app que calcula una fecha de cobro y por eso vive AQUÍ, con las otras
 *   cuatro: la última vez que alguien sumó 30 días por su cuenta, un préstamo
 *   del día 1 acabó cobrándose el 27 de febrero.
 *
 * @param {Date|string} fecha        la fecha de cobro que se aplaza
 * @param {string} frecuencia        diario | semanal | quincenal | mensual
 * @param {number|null} diaCobroMes  día de corte, si el préstamo tiene uno
 */
export function siguientePeriodo(fecha, frecuencia = 'diario', diaCobroMes = null) {
  const base = new Date(fecha)
  if (isNaN(base.getTime())) return null
  if (frecuencia === 'mensual') {
    return sumarMeses(base, 1, Number.isInteger(diaCobroMes) ? diaCobroMes : null)
  }
  const salto = new Date(base)
  salto.setUTCDate(salto.getUTCDate() + obtenerDiasPorPeriodo(frecuencia))
  return salto
}
