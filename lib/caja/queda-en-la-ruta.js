/* ══ «LE QUEDA EN LA RUTA», DICHO CON SUS SUMANDOS (DETALLES-CAJA #30) ══════
 *
 * La caja del cobrador vista por la dueña da dos cifras encadenadas: «Tiene que
 * entregar» (los billetes) y «Le queda en la ruta» (el capital de la ruta,
 * contando lo que está en el banco). La frase de debajo era siempre «Lo de
 * entregar más los $X que entraron a la cuenta», aunque la diferencia fuera
 * también la base que se queda, un gasto sin aprobar o una corrección: una
 * explicación que no daba la cifra de encima.
 *
 * El servidor manda los sumandos (`explicacionQuedaEnLaRuta`, en
 * app/api/caja/cobrador/[id]/route.js) y suman EXACTO la cifra. Aquí solo se
 * escriben. Pura, para poder probarla.
 */

const ROTULOS = {
  base: 'la base de la ruta, que se queda con él',
  cuenta: 'lo que entró a la cuenta (no lo trae en billetes)',
  prestadoDigital: 'lo que prestó por transferencia',
  gastosPendientes: 'los gastos sin aprobar (ya salieron del fajo, todavía no de la ruta)',
  duenoSinEfectivo: 'lo que metiste o sacaste por transferencia',
  correccionesDeLibro: 'las correcciones del libro',
  otros: 'otros movimientos de la ruta',
}

/**
 * @param {Array<{ id: string, monto: number }>} sumandos  el primero es «entregar»
 * @param {(n: number) => string} formatear
 * @returns {string} «Lo de entregar ($49.700) más lo que entró a la cuenta ($14.200).»
 */
export function fraseDeLoQueQueda(sumandos = [], formatear = String) {
  const lista = Array.isArray(sumandos) ? sumandos : []
  const entregar = lista.find((t) => t.id === 'entregar')
  const resto = lista.filter((t) => t.id !== 'entregar' && Number(t.monto) !== 0)
  if (!entregar || resto.length === 0) return ''
  const m = Math.round(Number(entregar.monto) || 0)
  const inicio = m >= 0
    ? `Lo de entregar (${formatear(m)})`
    : `Lo que hay que reponerle (−${formatear(-m)})`
  const partes = resto.map((t) => {
    const v = Math.round(Number(t.monto) || 0)
    return `${v >= 0 ? 'más' : 'menos'} ${ROTULOS[t.id] ?? ROTULOS.otros} (${formatear(Math.abs(v))})`
  })
  return `${inicio} ${partes.join(' ')}.`
}
