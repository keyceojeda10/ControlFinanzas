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

async function getOrCreateCapitalLocked(tx, organizationId) {
  // Bloqueo pesimista de fila: evita que dos transacciones concurrentes lean el mismo
  // saldo y escriban saldos derivados distintos (race condition de capital).
  const rows = await tx.$queryRaw`
    SELECT id, saldo FROM Capital WHERE organizationId = ${organizationId} FOR UPDATE
  `
  if (Array.isArray(rows) && rows.length > 0) {
    return { id: rows[0].id, saldo: Number(rows[0].saldo) }
  }
  const creado = await tx.capital.create({ data: { organizationId, saldo: 0 } })
  return { id: creado.id, saldo: Number(creado.saldo) }
}

function esIngresoMovimiento(mov) {
  if (mov.tipo === 'ajuste') {
    return mov.saldoNuevo >= mov.saldoAnterior
  }
  if (['capital_inicial', 'inyeccion', 'recaudo'].includes(mov.tipo)) return true
  if (['retiro', 'desembolso', 'gasto'].includes(mov.tipo)) return false
  return mov.saldoNuevo >= mov.saldoAnterior
}

export async function recalcularSaldosCapital(tx, { organizationId }) {
  const capital = await getOrCreateCapital(tx, organizationId)

  const movimientos = await tx.movimientoCapital.findMany({
    where: { organizationId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      tipo: true,
      monto: true,
      saldoAnterior: true,
      saldoNuevo: true,
    },
  })

  let saldo = 0

  for (const mov of movimientos) {
    const esIngreso = esIngresoMovimiento(mov)
    const saldoAnterior = saldo
    const saldoNuevo = esIngreso ? saldoAnterior + mov.monto : saldoAnterior - mov.monto

    if (mov.saldoAnterior !== saldoAnterior || mov.saldoNuevo !== saldoNuevo) {
      await tx.movimientoCapital.update({
        where: { id: mov.id },
        data: { saldoAnterior, saldoNuevo },
      })
    }

    saldo = saldoNuevo
  }

  const capitalActualizado = await tx.capital.update({
    where: { id: capital.id },
    data: { saldo },
  })

  return capitalActualizado
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
  const capital = await getOrCreateCapitalLocked(tx, organizationId)

  const esIngreso = direccion
    ? direccion === 'ingreso'
    : ['capital_inicial', 'inyeccion', 'recaudo'].includes(tipo)
  const saldoAnterior = capital.saldo
  const saldoNuevo = esIngreso ? saldoAnterior + monto : saldoAnterior - monto

  // En modo estricto, rechazar egresos que dejen el capital negativo.
  // Reversos por tipo 'ajuste' siempre se permiten (son correctivos).
  if (!esIngreso && saldoNuevo < 0 && tipo !== 'ajuste') {
    const org = await tx.organization.findUnique({
      where: { id: organizationId },
      select: { capitalEstricto: true },
    })
    if (org?.capitalEstricto) {
      throw new Error('CAPITAL_INSUFICIENTE')
    }
  }

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
  createdAt,
  permitirNegativo = false,
}) {
  const tiposPermitidos = ['capital_inicial', 'inyeccion', 'retiro', 'ajuste']
  if (!tiposPermitidos.includes(tipo)) {
    throw new Error('Tipo de movimiento manual no válido')
  }
  if (!Number.isFinite(monto) || monto <= 0) {
    throw new Error('El monto debe ser mayor a 0')
  }

  const capital = await getOrCreateCapitalLocked(tx, organizationId)

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
      ...(createdAt ? { createdAt } : {}),
    },
  })

  let capitalActualizado = await tx.capital.update({
    where: { id: capital.id },
    data: { saldo: saldoNuevo },
  })

  if (createdAt) {
    capitalActualizado = await recalcularSaldosCapital(tx, { organizationId })
  }

  return {
    movimiento,
    capital: capitalActualizado,
    direccion: esIngreso ? 'ingreso' : 'egreso',
  }
}
