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
export function fechaDePeriodo(n, { fechaInicio, freq, diasPeriodo, diaCobroMes, diaCobroMes2 } = {}) {
  // Mensual: SIEMPRE calendario de meses. Sin ancla explícita el ancla es el día
  // del mes de la fechaInicio. Antes, sin ancla, caía al +30 días y las fechas
  // se corrían mes a mes.
  if (freq === 'mensual') {
    return sumarMeses(fechaInicio, n, Number.isInteger(diaCobroMes) && diaCobroMes >= 1 ? diaCobroMes : null)
  }
  if (Number.isInteger(diaCobroMes) && diaCobroMes >= 1 && freq === 'quincenal') {
    const anclas = [diaCobroMes]
    if (Number.isInteger(diaCobroMes2) && diaCobroMes2 >= 1) anclas.push(diaCobroMes2)
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
