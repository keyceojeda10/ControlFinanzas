// lib/prisma-pago-helpers.js
// Helpers para mantener totalPagado y ultimoPagoAt denormalizados en Prestamo
// consistentes con la tabla Pago. Se invocan DENTRO de transacciones de Prisma
// (tx) despues de cualquier create/update/delete sobre pagos.

// Tipos que cuentan como "pago real" para el saldo del prestamo.
// recargo y descuento NO suman porque son ajustes contables, no abonos.
// liquidacion SI suma (es el pago de cierre anticipado, dinero que entro).
const TIPOS_PAGO_REAL = ['completo', 'parcial', 'capital', 'liquidacion', 'intereses']

/**
 * Recalcula totalPagado y ultimoPagoAt de un prestamo a partir de sus pagos
 * y actualiza el registro. Debe llamarse dentro de una transaccion (tx).
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx - cliente Prisma
 * @param {string} prestamoId - ID del prestamo a recalcular
 */
export async function refrescarTotalesPrestamo(tx, prestamoId) {
  if (!prestamoId) return
  const [agg, aggCapital] = await Promise.all([
    tx.pago.aggregate({
      where: { prestamoId, tipo: { in: TIPOS_PAGO_REAL } },
      _sum: { montoPagado: true },
      _max: { fechaPago: true },
    }),
    /* Los abonos A CAPITAL, aparte. Están DENTRO de `totalPagado` —son plata
       que entró— pero no pagan cuotas: bajan el saldo y la tabla se rehace más
       chica. Quien recorra la tabla tiene que poder restarlos, o el abono se
       reparte como meses de interés pagados por adelantado. Ver la nota de
       `abonadoCapital` en el esquema y `coberturaDeLaTabla`. */
    tx.pago.aggregate({
      where: { prestamoId, tipo: 'capital' },
      _sum: { montoPagado: true },
    }),
  ])
  await tx.prestamo.update({
    where: { id: prestamoId },
    data: {
      totalPagado: agg._sum.montoPagado ?? 0,
      abonadoCapital: aggCapital._sum.montoPagado ?? 0,
      ultimoPagoAt: agg._max.fechaPago ?? null,
      proximoCobroManual: null,
    },
  })
}
