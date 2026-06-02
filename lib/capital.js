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
      rutaId: true,
      ajusteArranqueRuta: true,
    },
  })

  let saldo = 0
  // Acumulador de saldo por ruta (sub-bolsa denormalizada).
  const saldoPorRuta = new Map()

  for (const mov of movimientos) {
    const esIngreso = esIngresoMovimiento(mov)

    // Saldo global: los ajustes de "arranque de ruta" NO afectan el global
    // (solo corrigen la sub-bolsa de la ruta para reflejar prestamos ya hechos).
    if (!mov.ajusteArranqueRuta) {
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

    // Saldo por ruta: TODOS los movimientos con rutaId cuentan. El ajuste de
    // arranque SIEMPRE es egreso de la sub-bolsa (descuenta prestamos ya hechos);
    // su direccion NO se puede inferir de los saldos globales porque esos quedan
    // iguales (no toca el global), por eso se fuerza aqui.
    if (mov.rutaId) {
      const prev = saldoPorRuta.get(mov.rutaId) || 0
      const ingresoRuta = mov.ajusteArranqueRuta ? false : esIngreso
      saldoPorRuta.set(mov.rutaId, ingresoRuta ? prev + mov.monto : prev - mov.monto)
    }
  }

  const capitalActualizado = await tx.capital.update({
    where: { id: capital.id },
    data: { saldo },
  })

  // Persistir saldoCapital de cada ruta (las que tienen movimientos quedan con
  // su acumulado; las que no, en 0).
  const rutas = await tx.ruta.findMany({
    where: { organizationId },
    select: { id: true, saldoCapital: true },
  })
  for (const r of rutas) {
    const nuevoSaldo = Math.round((saldoPorRuta.get(r.id) || 0))
    if (Math.round(r.saldoCapital || 0) !== nuevoSaldo) {
      await tx.ruta.update({ where: { id: r.id }, data: { saldoCapital: nuevoSaldo } })
    }
  }

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
  rutaId,    // opcional: ruta a la que pertenece el movimiento (sub-bolsa)
  ajusteArranqueRuta = false, // si true: solo afecta la sub-bolsa de la ruta, NO el saldo global
  direccion, // 'ingreso' | 'egreso' — opcional, para forzar dirección (ej. reversos con tipo 'ajuste')
}) {
  const capital = await getOrCreateCapitalLocked(tx, organizationId)

  const esIngreso = direccion
    ? direccion === 'ingreso'
    : ['capital_inicial', 'inyeccion', 'recaudo'].includes(tipo)
  const saldoAnterior = capital.saldo
  // El ajuste de arranque de ruta NO mueve el saldo global.
  const saldoNuevo = ajusteArranqueRuta
    ? saldoAnterior
    : (esIngreso ? saldoAnterior + monto : saldoAnterior - monto)

  // En modo estricto, rechazar egresos que dejen el capital negativo.
  // Reversos por tipo 'ajuste' y ajustes de arranque de ruta siempre se permiten.
  if (!esIngreso && saldoNuevo < 0 && tipo !== 'ajuste' && !ajusteArranqueRuta) {
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
      rutaId: rutaId || null,
      ajusteArranqueRuta,
      creadoPorId,
    },
  })

  await tx.capital.update({
    where: { id: capital.id },
    data: { saldo: saldoNuevo },
  })

  // Sub-bolsa por ruta: ajustar saldoCapital denormalizado de la ruta.
  if (rutaId) {
    await tx.ruta.update({
      where: { id: rutaId },
      data: { saldoCapital: { [esIngreso ? 'increment' : 'decrement']: monto } },
    }).catch(() => {}) // si la ruta no existe, no romper el flujo principal
  }
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
  rutaId,    // opcional: inyeccion/retiro dirigido a una ruta
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
      rutaId: rutaId || null,
      creadoPorId,
      ...(createdAt ? { createdAt } : {}),
    },
  })

  let capitalActualizado = await tx.capital.update({
    where: { id: capital.id },
    data: { saldo: saldoNuevo },
  })

  // Sub-bolsa por ruta
  if (rutaId) {
    await tx.ruta.update({
      where: { id: rutaId },
      data: { saldoCapital: { [esIngreso ? 'increment' : 'decrement']: monto } },
    }).catch(() => {})
  }

  if (createdAt) {
    capitalActualizado = await recalcularSaldosCapital(tx, { organizationId })
  }

  return {
    movimiento,
    capital: capitalActualizado,
    direccion: esIngreso ? 'ingreso' : 'egreso',
  }
}

/**
 * Devuelve el desglose de capital por ruta de una organizacion.
 * - saldoCapital: sub-bolsa denormalizada de la ruta (Ruta.saldoCapital)
 * - inyectado/prestado/recaudado/retirado/gastos: agregados de MovimientoCapital
 *   con ese rutaId (opcionalmente en un rango de fechas).
 *
 * @param {object} prismaClient - prisma o tx
 * @param {string} organizationId
 * @param {object} [opts] - { desde, hasta } (Date) opcional
 */
export async function getSaldosPorRuta(prismaClient, organizationId, opts = {}) {
  const { desde, hasta } = opts

  const rutas = await prismaClient.ruta.findMany({
    where: { organizationId },
    select: { id: true, nombre: true, activo: true, saldoCapital: true, cobrador: { select: { id: true, nombre: true } } },
    orderBy: { nombre: 'asc' },
  })

  const whereMov = {
    organizationId,
    rutaId: { not: null },
    ...((desde || hasta) && { createdAt: { ...(desde && { gte: desde }), ...(hasta && { lt: hasta }) } }),
  }

  // Agrupar por ruta + tipo + flag de arranque (para separar el ajuste de
  // arranque de los ajustes manuales normales).
  const movs = await prismaClient.movimientoCapital.groupBy({
    by: ['rutaId', 'tipo', 'ajusteArranqueRuta'],
    where: whereMov,
    _sum: { monto: true },
  })

  // Indexar agregados por ruta
  const porRuta = new Map()
  for (const r of rutas) {
    porRuta.set(r.id, {
      rutaId: r.id,
      nombre: r.nombre,
      activo: r.activo,
      cobrador: r.cobrador?.nombre || null,
      saldoCapital: Math.round(r.saldoCapital || 0),
      inyectado: 0, prestado: 0, recaudado: 0, retirado: 0, gastos: 0,
      arranqueAbsorbido: 0, // prestamos previos descontados al activar capital por ruta
    })
  }
  for (const m of movs) {
    const acc = porRuta.get(m.rutaId)
    if (!acc) continue
    const v = Math.round(m._sum?.monto || 0)
    if (m.ajusteArranqueRuta) { acc.arranqueAbsorbido += v; continue }
    if (m.tipo === 'inyeccion' || m.tipo === 'capital_inicial') acc.inyectado += v
    else if (m.tipo === 'desembolso') acc.prestado += v
    else if (m.tipo === 'recaudo') acc.recaudado += v
    else if (m.tipo === 'retiro') acc.retirado += v
    else if (m.tipo === 'gasto') acc.gastos += v
  }

  return Array.from(porRuta.values())
}
