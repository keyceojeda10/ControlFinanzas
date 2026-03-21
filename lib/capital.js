// lib/capital.js — Helper para registrar movimientos de capital automáticamente

/**
 * Registra un movimiento de capital dentro de una transacción Prisma.
 * Si la organización no tiene Capital configurado, no hace nada (silencioso).
 *
 * @param {object} tx - Prisma transaction client
 * @param {object} params
 * @param {string} params.organizationId
 * @param {string} params.tipo - 'desembolso' | 'recaudo' | 'gasto'
 * @param {number} params.monto - Siempre positivo
 * @param {string} params.descripcion
 * @param {string} [params.referenciaId]
 * @param {string} [params.referenciaTipo] - 'prestamo' | 'pago' | 'gasto'
 * @param {string} [params.creadoPorId]
 */
export async function registrarMovimientoCapital(tx, {
  organizationId,
  tipo,
  monto,
  descripcion,
  referenciaId,
  referenciaTipo,
  creadoPorId,
}) {
  const capital = await tx.capital.findUnique({ where: { organizationId } })
  if (!capital) return // No configurado, skip silencioso

  const esIngreso = ['capital_inicial', 'inyeccion', 'recaudo'].includes(tipo)
  const saldoAnterior = capital.saldo
  const saldoNuevo = esIngreso ? saldoAnterior + monto : saldoAnterior - monto

  await tx.movimientoCapital.create({
    data: {
      capitalId: capital.id,
      organizationId,
      tipo,
      monto,
      saldoAnterior,
      saldoNuevo,
      descripcion,
      referenciaId,
      referenciaTipo,
      creadoPorId,
    },
  })

  await tx.capital.update({
    where: { id: capital.id },
    data: { saldo: saldoNuevo },
  })
}
