/* ══ QUITAR UNA RENOVACIÓN SIN QUE EL SALDO VIEJO SE EVAPORE ═════════════════
 *
 * Reportado por el dueño de PRESTA MIL, 14 ago 2026:
 *
 *   «Un cliente que tiene un saldo de 50 mil y va y lo renueva, pero ese cliente
 *    no tocaba renovarlo. Entonces nosotros le quitamos el préstamo... pero ese
 *    cliente tenía un saldo, y el saldo se desaparece. La idea es que si el
 *    cobrador se equivoca renovando una cartulina que no es, uno le pueda quitar
 *    el préstamo pero el saldo viejo siga quedando, porque es un saldo que
 *    todavía toca cobrarlo.»
 *
 * Tenía razón, y el hueco estaba en dos sitios a la vez.
 *
 * ── Por qué desaparecía ─────────────────────────────────────────────────────
 *
 * Renovar no registra un pago (sería un «abono falso» que inflaría el recaudo
 * del día). Lo que hace es PISAR `totalAPagar` del préstamo viejo con lo que ya
 * se había pagado, para que su saldo quede en cero:
 *
 *     totalAPagar = totalPagado   →   saldo = 0   →   estado = completado
 *
 * El número original no se guardaba en ninguna parte. Al borrar la renovación,
 * el préstamo nuevo se iba y el viejo se quedaba en cero para siempre: la deuda
 * dejaba de existir aunque el cliente siguiera debiéndola. Por eso ahora renovar
 * guarda el total anterior en `totalAPagarPrevio`, y esto lo devuelve.
 *
 * ── Medido contra producción (14 ago 2026, solo lectura) ────────────────────
 *
 *   · 985 renovaciones vivas en 22 negocios.
 *   · 26 renovaciones BORRADAS  →  $21.435.900 de saldo evaporado.
 *   · 14 renovaciones CANCELADAS →  $1.619.000 más, y los 14 préstamos viejos
 *     confirmados en saldo cero.
 *   · 40 casos en 10 negocios distintos. No era un cliente con un problema.
 *
 * ⚠ Y la caja quedaba inflada por el mismo importe. Renovar solo saca de capital
 *   la DIFERENCIA entregada en mano (monto nuevo − saldo absorbido), pero borrar
 *   devolvía `montoPrestado` entero. Renovar un saldo de $50.000 en un préstamo
 *   de $200.000 y luego borrarlo metía $50.000 en la caja que nunca salieron de
 *   ella. Por eso el reverso lee el movimiento real y no adivina — el mismo
 *   criterio que ya usa `lib/dinero/desembolsado.js`.
 *
 * ⚠ NO se puede hacer con una relación de Prisma: `renovadoDeId` es un campo
 *   suelto (ver el comentario de `lib/dinero/desembolsado.js`), así que el
 *   préstamo viejo hay que buscarlo a mano.
 */

import { formatMoney } from '@/lib/i18n'

/**
 * Devuelve al préstamo viejo el saldo que la renovación le absorbió.
 *
 * Se llama DENTRO de la transacción que quita la renovación (borrar o cancelar),
 * antes de que el préstamo nuevo desaparezca.
 *
 * @param {object} tx     cliente Prisma de la transacción
 * @param {object} nuevo  el préstamo que se está quitando ({ id, renovadoDeId, organizationId })
 * @returns {Promise<null|{id, totalAPagar, devuelto}>} el viejo revivido, o null si no aplica
 */
export async function revivirPrestamoRenovado(tx, nuevo) {
  if (!nuevo?.renovadoDeId) return null

  const viejo = await tx.prestamo.findFirst({
    where: { id: nuevo.renovadoDeId, organizationId: nuevo.organizationId },
    select: { id: true, estado: true, totalAPagar: true, totalAPagarPrevio: true },
  })
  if (!viejo) return null

  /* Sin total previo no hay nada que devolver, y son DOS casos distintos:
     · Una renovación anterior a este arreglo (los 40 casos medidos). No se puede
       reconstruir desde aquí: el número ya se perdió. Se repara aparte.
     · Una renovación sobre una cartulina que ya estaba en cero. Ahí el saldo
       nunca se pisó y el viejo debe quedarse completado, no revivir con deuda
       imaginaria.
     En los dos, tocar el estado sería peor que no tocarlo. */
  if (viejo.totalAPagarPrevio == null) return null

  await tx.prestamo.update({
    where: { id: viejo.id },
    data: {
      totalAPagar: viejo.totalAPagarPrevio,
      estado: 'activo',
      totalAPagarPrevio: null,
    },
  })

  return {
    id: viejo.id,
    totalAPagar: viejo.totalAPagarPrevio,
    devuelto: Math.round(viejo.totalAPagarPrevio - viejo.totalAPagar),
  }
}

/**
 * Lo que de verdad salió de la caja por este préstamo.
 *
 * Para un préstamo normal es su monto. Para una renovación es solo la diferencia
 * entregada en mano, que es lo único que registró `registrarMovimientoCapital`.
 * Devolver el monto entero inflaba el capital por el saldo absorbido.
 *
 * @param {object} tx
 * @param {object} p  { id, organizationId, montoPrestado }
 * @returns {Promise<number>}
 */
export async function efectivoQueSalio(tx, p) {
  const mov = await tx.movimientoCapital.findFirst({
    where: {
      organizationId: p.organizationId,
      referenciaId: p.id,
      referenciaTipo: 'prestamo',
      tipo: 'desembolso',
    },
    select: { monto: true },
  })
  // Sin movimiento (préstamos viejos, antes del ledger) se cae al monto, que es
  // lo que hacía toda la app antes. Para un préstamo nuevo los dos coinciden.
  return mov ? Number(mov.monto) : Number(p.montoPrestado || 0)
}

/**
 * Qué se le advierte a quien va a borrar un préstamo.
 *
 * Borrar una renovación no es solo borrarla: el préstamo anterior vuelve con el
 * saldo que esta le absorbió. Callárselo era el mismo fallo al revés — el saldo
 * cambiaba sin que nadie lo dijera.
 *
 * @param {Array} prestamos  los del cliente, tal como los devuelve /api/clientes/[id]
 * @param {string} id        el que se va a borrar
 */
export function mensajeBorrarPrestamo(prestamos, id) {
  const base = '¿Eliminar este préstamo y todos sus pagos? Esta acción no se puede deshacer.'
  const p = (prestamos || []).find((x) => x.id === id)
  if (!p?.renovadoDeId) return base

  const anterior = (prestamos || []).find((x) => x.id === p.renovadoDeId)
  // Sin total previo la renovación es anterior a este arreglo: el saldo viejo ya
  // no está guardado en ninguna parte y no puede volver solo. Se dice.
  if (anterior?.totalAPagarPrevio == null) {
    return `${base}\n\nEste préstamo es una renovación hecha antes de la última actualización: el saldo del préstamo anterior no volverá solo. Escríbenos si necesitas recuperarlo.`
  }

  const vuelve = Math.round(anterior.totalAPagarPrevio - anterior.totalAPagar)
  return `${base}\n\nEs una renovación: al eliminarla vuelve el préstamo anterior con su saldo de ${formatMoney(vuelve)}, que sigue por cobrar.`
}

/* ══ LO QUE LA CAJA YA RECUPERÓ DE ESTE PRÉSTAMO ═════════════════════════════
 *
 * Cancelar y ELIMINAR se pisaban, y el resultado era plata que desaparecía de
 * la caja. Encontrado el 16 ago 2026 probando el arreglo de Crediya de punta a
 * punta, no leyendo el código:
 *
 *   desembolso  −$2.119.000
 *   cobro       +$1.000.001
 *   cancelar    +$1.118.999   (devuelve lo NO recuperado: salió − cobrado)  → neto 0 ✓
 *   eliminar    −$1.000.001   (revierte el cobro, y del desembolso no toca
 *                              nada «porque ya se reversó al cancelar»)     → neto −$1.000.001 ✗
 *
 * El borrado daba por hecho que cancelar había devuelto TODO. Era cierto hasta
 * el 15 de agosto, cuando se quitó la opción «devolver todo» —que era la que
 * inflaba la caja $22M—. Arreglada una, quedó rota la otra.
 *
 * La salida no es otra bandera: es preguntarle al libro cuánto volvió ya. Con
 * eso las tres situaciones salen solas y no hay que acordarse de ninguna:
 *
 *   · préstamo vivo          → ya devuelto 0        → se devuelve todo lo que salió
 *   · cancelado devolviendo el resto → ya devuelto salió − cobrado → se devuelve el cobro
 *   · cancelado a la vieja usanza    → ya devuelto salió           → no se devuelve nada
 *
 * @returns {Promise<number>} lo que ya volvió a la caja por este préstamo
 */
export async function capitalYaDevuelto(tx, p) {
  /* ⚠ `referenciaTipo` NO ES SIEMPRE 'prestamo': la cancelación le escribe
     dentro el MODO con el que se devolvió —
     `prestamo_cancelado_devolver_restante`—. Con la igualdad exacta el
     movimiento de la cancelación no se veía, `yaDevuelto` daba 0 y el borrado
     devolvía el desembolso ENTERO: medido en el espejo, la caja subía
     $1.118.999 en vez de quedarse igual. Lo cazó la misma prueba de punta a
     punta, ya con el arreglo puesto.

     Se filtra por prefijo, y se dejan fuera los de `pago` a propósito: el
     reverso de un descuento también es un `ajuste` de entrada y no es capital
     que vuelva del desembolso. */
  const movs = await tx.movimientoCapital.findMany({
    where: {
      organizationId: p.organizationId,
      referenciaId: p.id,
      referenciaTipo: { startsWith: 'prestamo' },
      tipo: 'ajuste',
    },
    select: { monto: true, saldoAnterior: true, saldoNuevo: true },
  })
  // La dirección no es una columna: se lee de si el saldo subió o bajó.
  return movs
    .filter((m) => Number(m.saldoNuevo) > Number(m.saldoAnterior))
    .reduce((acc, m) => acc + Number(m.monto || 0), 0)
}
