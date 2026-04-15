// lib/capital.js — Helpers para registrar movimientos de capital

async function getOrCreateCapital(tx, organizationId) {
  let capital = await tx.capital.findUnique({ where: { organizationId } })
  if (!capital) {
    capital = await tx.capital.create({
      data: { organizationId, saldo: 0 },
    })
  }
  return capital
}

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
  direccion, // 'ingreso' | 'egreso' — opcional, para forzar dirección (ej. reversos con tipo 'ajuste')
}) {
  const capital = await getOrCreateCapital(tx, organizationId)

  const esIngreso = direccion
    ? direccion === 'ingreso'
    : ['capital_inicial', 'inyeccion', 'recaudo'].includes(tipo)
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

/**
 * Registra un movimiento MANUAL de capital.
 *
 * Tipos permitidos: capital_inicial, inyeccion, retiro, ajuste.
 * Para ajuste, se requiere dirección explícita (ingreso/egreso).
 */
export async function registrarMovimientoManualCapital(tx, {
  organizationId,
  tipo,
  monto,
  descripcion,
  creadoPorId,
  referenciaId,
  referenciaTipo,
  direccion,
  permitirNegativo = false,
}) {
  const tiposPermitidos = ['capital_inicial', 'inyeccion', 'retiro', 'ajuste']
  if (!tiposPermitidos.includes(tipo)) {
    throw new Error('Tipo de movimiento manual no válido')
  }
  if (!Number.isFinite(monto) || monto <= 0) {
    throw new Error('El monto debe ser mayor a 0')
  }

  const capital = await getOrCreateCapital(tx, organizationId)

  const dirAjuste = direccion === 'egreso' ? 'egreso' : 'ingreso'
  const esIngreso = tipo === 'ajuste'
    ? dirAjuste === 'ingreso'
    : ['capital_inicial', 'inyeccion'].includes(tipo)

  const saldoAnterior = capital.saldo
  const saldoNuevo = esIngreso ? saldoAnterior + monto : saldoAnterior - monto

  if (!permitirNegativo && saldoNuevo < 0) {
    throw new Error('Saldo insuficiente para registrar este movimiento')
  }

  const movimiento = await tx.movimientoCapital.create({
    data: {
      capitalId: capital.id,
      organizationId,
      tipo,
      monto,
      saldoAnterior,
      saldoNuevo,
      descripcion: descripcion?.trim() || null,
      referenciaId,
      referenciaTipo,
      creadoPorId,
    },
  })

  const capitalActualizado = await tx.capital.update({
    where: { id: capital.id },
    data: { saldo: saldoNuevo },
  })

  return {
    movimiento,
    capital: capitalActualizado,
    direccion: esIngreso ? 'ingreso' : 'egreso',
  }
}
