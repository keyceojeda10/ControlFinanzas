// lib/tips/clienteTips.js — qué le dice Lucas al dueño sobre un cliente.
//
// ══ E05 · «UNA RECOMENDACIÓN SIN MONTO Y SIN BOTÓN ES UNA FRASE» ═══════════
//
// Esto devolvía una cadena suelta que se pintaba en un banner gris con una
// chispa y una ✕, indistinguible de un aviso del sistema. Decía cosas ciertas
// —«lleva 80% pagado, buen historial»— pero el dueño no podía hacer nada con
// ellas sin salir a buscar el tope, el historial y el botón de prestar.
//
// Ahora devuelve un OBJETO con lo que hace falta para decidir: el titular, el
// porqué, y —cuando aplica— el monto y la acción.
//
// ⚠ EL MONTO NO SE INVENTA. Es `montoMaximoPrestamo`, el tope que el propio
// dueño le puso a ese cliente: Lucas lo recuerda y le suma cómo ha pagado, no
// calcula una capacidad de crédito nueva. Una cifra inventada en la pantalla
// del dinero es peor que ninguna.

/**
 * @typedef {Object} Sugerencia
 * @property {'oferta'|'aviso'|'info'} tono   qué clase de mensaje es
 * @property {string} titular                 la frase grande
 * @property {string} [porque]                de dónde sale, en una línea
 * @property {string} [etiqueta]              «al día · 3er préstamo»
 * @property {number} [monto]                 solo en 'oferta': el tope del cliente
 */

/** «al día · 3er préstamo» — el estado en dos datos. */
function etiquetaDe(prestamosActivos, completados) {
  const mora = Math.max(0, ...prestamosActivos.map((p) => p?.diasMora ?? 0), 0)
  const estado = mora > 0 ? `${mora} ${mora === 1 ? 'día' : 'días'} de atraso` : 'al día'
  const numero = completados + prestamosActivos.length
  if (!numero) return estado
  const ordinal = numero === 1 ? '1er' : numero === 2 ? '2º' : `${numero}º`
  return `${estado} · ${ordinal} préstamo`
}

const pesos = (n) => `$${Math.round(n).toLocaleString('es-CO')}`

/**
 * @param {object} cliente
 * @param {Array} prestamosActivos
 * @param {{ completados?: number, incumplidos?: number }} historial
 * @returns {Sugerencia|null}
 */
export function generarTipCliente(cliente, prestamosActivos = [], historial = {}) {
  if (!cliente) return null

  const completados = Number(historial.completados ?? 0)
  const incumplidos = Number(historial.incumplidos ?? 0)
  const etiqueta = etiquetaDe(prestamosActivos, completados)
  const maxMora = Math.max(0, ...prestamosActivos.map((p) => p?.diasMora ?? 0), 0)
  const tope = Number(cliente?.montoMaximoPrestamo ?? 0)

  // ── LO QUE URGE VA PRIMERO ────────────────────────────────────────────────
  // Con mora, ofrecerle más plata sería una recomendación irresponsable.
  if (maxMora > 7) {
    return {
      tono: 'aviso',
      etiqueta,
      titular: `Lleva ${maxMora} días sin pagar.`,
      porque: 'Conviene llamarlo antes de que se acumule más.',
    }
  }

  if (prestamosActivos.length > 1) {
    const total = prestamosActivos.reduce((a, p) => a + (p?.saldoPendiente ?? 0), 0)
    return {
      tono: 'aviso',
      etiqueta,
      titular: `Ya tiene ${prestamosActivos.length} préstamos abiertos.`,
      porque: `Debe ${pesos(total)} en total. Mira si le alcanza antes de darle otro.`,
    }
  }

  // ── LA OFERTA: SOLO CON TOPE PUESTO E HISTORIAL LIMPIO ────────────────────
  //
  // Sin tope no hay cifra que ofrecer, y sin cifra el bloque no sirve para
  // decidir. Ahí se cae al mensaje informativo de abajo, que al menos dice cómo
  // ha pagado y sugiere poner el tope.
  const alDia = maxMora === 0
  const limpio = incumplidos === 0 && completados > 0

  if (tope > 0 && alDia && limpio) {
    const pct = prestamosActivos[0]?.porcentajePagado ?? 0
    const cuantos = completados === 1 ? 'el anterior' : `los ${completados} anteriores`
    const detalle = prestamosActivos.length === 0
      ? `Pagó completo${completados === 1 ? '' : 's'} ${cuantos}.`
      : `Pagó completo${completados === 1 ? '' : 's'} ${cuantos} y este va por el ${pct}%.`
    return {
      tono: 'oferta',
      etiqueta,
      monto: tope,
      titular: `Le puedes prestar hasta ${pesos(tope)}.`,
      porque: `Es el tope que le pusiste. ${detalle}`,
    }
  }

  // ── LO QUE SE SABE, SIN OFRECER NADA ──────────────────────────────────────
  if (prestamosActivos.length === 1) {
    const pct = prestamosActivos[0]?.porcentajePagado ?? 0
    if (pct >= 75) {
      return {
        tono: 'info',
        etiqueta,
        titular: `Ya va por el ${pct}% de su préstamo.`,
        porque: tope > 0
          ? 'Cuando termine, puedes ofrecerle otro.'
          : 'Ponle un tope si quieres que te sugiera un monto.',
      }
    }
    return null
  }

  if (prestamosActivos.length === 0 && cliente.estado !== 'eliminado' && completados > 0 && incumplidos === 0) {
    const cuantos = completados === 1 ? 'el anterior' : `los ${completados} anteriores`
    return {
      tono: 'info',
      etiqueta,
      titular: 'No tiene préstamos abiertos.',
      porque: tope > 0
        ? `Pagó completo${completados === 1 ? '' : 's'} ${cuantos}.`
        : `Pagó bien ${completados === 1 ? 'la vez anterior' : 'las veces anteriores'}. Ponle un tope y te sugiero un monto.`,
    }
  }

  return null
}
