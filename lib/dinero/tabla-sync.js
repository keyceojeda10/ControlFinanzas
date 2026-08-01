// ═══════════════════════════════════════════════════════════════════════════
// LA TABLA DE AMORTIZACION, AL DIA CON LOS PAGOS QUE EXISTEN
//
// ── POR QUE ───────────────────────────────────────────────────────────────
//
// Registrar un pago SI actualizaba la tabla. Borrarlo NO. Y editarlo tampoco.
//
// El resultado es que en un prestamo con tabla —Decreciente, Globo, Sobre
// saldo— borrar un pago dejaba las cuotas marcadas como si el pago siguiera
// ahi. Para siempre: nada lo vuelve a tocar. La mora, el proximo cobro y el
// desglose de interes salen de esa tabla, asi que todos quedan mintiendo.
//
// Medido en produccion el 1 ago 2026:
//
//     reversos de pago anulado, por mes
//     abril  17 · mayo 23 · junio 127 · JULIO 258
//
// Borrar pagos paso de raro a ser ocho al dia, y cada uno sobre un prestamo
// con tabla deja una fila mal. Los prestamos desincronizados que hay son todos
// de julio: el daño esta vivo y acelerando.
//
// ── LA IDEA ───────────────────────────────────────────────────────────────
//
// `regenerarTablaAmortizacion` no aplica un pago: RECALCULA la tabla entera a
// partir de los pagos que existen ahora mismo. Es idempotente. Asi que la
// misma llamada sirve para registrar, para borrar y para editar — no hacen
// falta una funcion de «aplicar» y otra de «revertir» que haya que mantener
// simetricas a mano, que es donde se rompen siempre.
//
// Se llama DESPUES de tocar los pagos y DESPUES de refrescar los totales.
// ═══════════════════════════════════════════════════════════════════════════

import {
  tieneTablaAmortizacion,
  regenerarTablaAmortizacion,
  regenerarTablaAmortizacionDinamica,
} from '@/lib/calculos'

/**
 * ¿Se puede regenerar la tabla de este prestamo sin romper nada?
 *
 * ⚠ NO SIEMPRE, y casi meto un fallo peor que el que venia a arreglar.
 *
 * `regenerarTablaAmortizacion` reparte en cascada SOLO los pagos `completo` y
 * `parcial` (lib/calculos.js:1390). Una LIQUIDACION no entra en esa cuenta: al
 * cerrar anticipado se marcan todas las filas como pagadas de una vez, porque
 * el cliente ya no debe nada.
 *
 * Asi que regenerar sobre un prestamo liquidado DESMARCARIA esas filas y lo
 * dejaria pareciendo que aun debe. Se sale sin tocar nada: el marcado de la
 * liquidacion es la verdad.
 *
 * Si lo que se borro FUE la liquidacion, entonces ya no queda ninguna en la
 * lista y si se regenera — que es justo lo que hace falta.
 *
 * Es pura para poder probarla: la decision de «tocar o no tocar» es lo
 * delicado, no la escritura.
 */
export function sePuedeRegenerar(prestamo) {
  if (!prestamo || !tieneTablaAmortizacion(prestamo)) return false
  const hayLiquidacion = (prestamo.pagos ?? []).some((p) => p.tipo === 'liquidacion')
  return !hayLiquidacion
}

/**
 * Deja la tabla del prestamo coherente con sus pagos actuales.
 *
 * @param tx          la transaccion de Prisma (obligatoria: esto NUNCA debe
 *                    quedar a medias respecto del pago que lo motivo)
 * @param prestamoId
 * @returns {{ tocada: boolean, filas: number, motivo?: string }}
 */
export async function sincronizarTabla(tx, prestamoId) {
  const prestamo = await tx.prestamo.findUnique({
    where: { id: prestamoId },
    include: {
      pagos: { select: { id: true, montoPagado: true, fechaPago: true, tipo: true } },
      cuotasAmortizacion: { orderBy: { numeroPeriodo: 'asc' } },
    },
  })

  if (!prestamo || !tieneTablaAmortizacion(prestamo)) return { tocada: false, filas: 0, motivo: 'sin tabla' }
  if (!sePuedeRegenerar(prestamo)) return { tocada: false, filas: 0, motivo: 'liquidado' }

  // Decreciente dinamico: ademas de repartir lo pagado, RECALCULA las cuotas
  // futuras sobre el capital real restante, asi que devuelve tambien el
  // totalAPagar nuevo.
  if (prestamo.modoInteres === 'lineal_dinamico') {
    const { actualizaciones, totalAPagar } = regenerarTablaAmortizacionDinamica(prestamo)
    for (const fila of actualizaciones) {
      await tx.cuotaAmortizacion.update({
        where: { prestamoId_numeroPeriodo: { prestamoId, numeroPeriodo: fila.numeroPeriodo } },
        data: {
          pagado: fila.pagado,
          ...(fila.capital !== undefined ? {
            capital: fila.capital,
            interes: fila.interes,
            cuotaTotal: fila.cuotaTotal,
            saldoRestante: fila.saldoRestante,
          } : {}),
        },
      })
    }
    if (totalAPagar != null && Math.abs(totalAPagar - prestamo.totalAPagar) > 1) {
      await tx.prestamo.update({ where: { id: prestamoId }, data: { totalAPagar } })
    }
    return { tocada: true, filas: actualizaciones.length }
  }

  const actualizaciones = regenerarTablaAmortizacion(prestamo)
  for (const fila of actualizaciones) {
    await tx.cuotaAmortizacion.update({
      where: { prestamoId_numeroPeriodo: { prestamoId, numeroPeriodo: fila.numeroPeriodo } },
      data: { pagado: fila.pagado },
    })
  }
  return { tocada: true, filas: actualizaciones.length }
}
