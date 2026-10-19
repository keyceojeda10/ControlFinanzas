// app/api/capital/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { registrarMovimientoManualCapital, registrarMovimientoCapital, getSaldosPorRuta, asegurarCapital } from '@/lib/capital'
import { calcularSaldoPendiente } from '@/lib/calculos'
import { empezarCapitalPropio } from '@/lib/rutas/traslado'
import { ultimasPuestasEnCero } from '@/lib/rutas/capital-propio'
import { DESCRIPCION_UNION } from '@/lib/rutas/fusionar'

// GET — obtener saldo actual y config (capitalEstricto)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede ver el capital' }, { status: 403 })
  }

  const [capital, org, porRuta] = await Promise.all([
    prisma.capital.findUnique({
      where: { organizationId: session.user.organizationId },
    }),
    prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { capitalEstricto: true },
    }),
    getSaldosPorRuta(prisma, session.user.organizationId),
  ])

  return Response.json({
    capital,
    porRuta,
    config: { capitalEstricto: !!org?.capitalEstricto },
  })
}

// PATCH — actualizar configuración del capital (toggle modo estricto)
export async function PATCH(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede cambiar la configuración' }, { status: 403 })
  }

  const body = await request.json()
  const { capitalEstricto } = body
  if (typeof capitalEstricto !== 'boolean') {
    return Response.json({ error: 'capitalEstricto debe ser booleano' }, { status: 400 })
  }

  const org = await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: { capitalEstricto },
    select: { capitalEstricto: true },
  })

  logActividad({
    session,
    accion: 'configurar_capital',
    entidadTipo: 'capital',
    detalle: `Modo capital estricto ${capitalEstricto ? 'activado' : 'desactivado'}`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })

  return Response.json({ config: { capitalEstricto: org.capitalEstricto } })
}

// POST — registrar movimiento manual (capital_inicial, inyeccion, retiro, ajuste)
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede gestionar el capital' }, { status: 403 })
  }

  const { organizationId, id: userId } = session.user
  const body = await request.json()
  const { tipo, monto, descripcion, rutaId, absorberActivos, metodoPago, metodoPagoId } = body
  const direccion = body?.direccion === 'ingreso' ? 'ingreso' : 'egreso'
  // Cuenta por la que entra/sale el dinero (desglose por cuenta). Solo tiene
  // sentido para inyeccion/retiro (movimiento real de caja). El capital_inicial
  // es un saldo base de arranque, no un flujo por cuenta -> se deja sin cuenta.
  const cuentaMov = (tipo === 'inyeccion' || tipo === 'retiro')
    ? (metodoPago === 'transferencia' ? 'transferencia' : 'efectivo')
    : null
  const cuentaMovId = cuentaMov === 'transferencia' ? (metodoPagoId || null) : null

  const tiposPermitidos = ['capital_inicial', 'inyeccion', 'retiro', 'ajuste']
  if (!tiposPermitidos.includes(tipo)) {
    return Response.json({ error: 'Tipo de movimiento no válido' }, { status: 400 })
  }
  if (!monto || Number(monto) <= 0) {
    return Response.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 })
  }

  // Si viene rutaId, validar que la ruta pertenezca a la organizacion
  let rutaIdValida = null
  let rutaDestino = null
  if (rutaId) {
    /* Solo rutas activas: una archivada (unida con otra) no la enseña ninguna
       caja, y la plata que entrara ahí no la vería nadie. */
    rutaDestino = await prisma.ruta.findFirst({
      where: { id: rutaId, organizationId, activo: true },
      select: { id: true, nombre: true, capitalHabilitado: true },
    })
    if (!rutaDestino) return Response.json({ error: 'Ruta no válida' }, { status: 400 })
    rutaIdValida = rutaDestino.id
  }
  /* ⚠ A UNA RUTA SIN CAPITAL PROPIO SOLO SE LE METE PLATA (DETALLES-RUTAS #10).
     Sacar o cuadrar movería la cuenta interna de sus préstamos, que no es plata
     de la ruta; la pantalla ya no lo ofrece y el servidor tampoco lo acepta. */
  const empiezaSuCapital = !!rutaDestino && !rutaDestino.capitalHabilitado
  if (empiezaSuCapital && tipo !== 'inyeccion' && tipo !== 'capital_inicial') {
    return Response.json({ error: `${rutaDestino.nombre} todavía no lleva capital propio: primero métele plata.` }, { status: 400 })
  }

  const montoNum = Number(monto)

  // "Absorber activos": solo aplica al INYECTAR a una ruta. Calcula el saldo
  // pendiente de los prestamos activos de esa ruta para descontarlo de la
  // sub-bolsa (sin tocar el saldo global). Se calcula ANTES de la transaccion.
  let saldoPendienteRuta = 0
  if (absorberActivos && rutaIdValida && tipo === 'inyeccion') {
    /* Si la ruta empieza hoy su capital, lo de antes no cuenta: sus reservas
       se hicieron sobre la cuenta interna, que se pone en cero (#10). Si ya lo
       llevaba, solo cuenta lo que pasó desde que empezó (`ultimasPuestasEnCero`). */
    const desde = empiezaSuCapital ? null : (await ultimasPuestasEnCero(prisma, organizationId, [rutaIdValida])).get(rutaIdValida) ?? null
    // Guard de idempotencia: solo se puede absorber UNA vez por ruta. Si ya
    // existe un ajuste de arranque para esta ruta, no volver a descontar
    // (evita descontar los prestamos previos multiples veces).
    /* ⚠ TAMBIÉN SI LO ABSORBIÓ UNA RUTA QUE SE UNIÓ CON ESTA. Su bolsa llegó
       con esos préstamos ya descontados, y absorberlos otra vez los restaría
       dos veces (lib/rutas/fusionar.js). */
    // Solo las uniones: el traslado de un cliente también lleva `referenciaTipo: 'ruta'`.
    const unidas = empiezaSuCapital ? [] : await prisma.movimientoCapital.findMany({
      where: { organizationId, tipo: 'ajuste', referenciaTipo: 'ruta', referenciaId: rutaIdValida, descripcion: { startsWith: `${DESCRIPCION_UNION}: pasa a` } },
      select: { rutaId: true },
    })
    const yaAbsorbido = empiezaSuCapital ? null : await prisma.movimientoCapital.findFirst({
      where: {
        organizationId,
        rutaId: { in: [rutaIdValida, ...unidas.map((u) => u.rutaId).filter(Boolean)] },
        ajusteArranqueRuta: true,
        // El capital con que nació la ruta no es un descuento de préstamos (#3).
        tipo: { notIn: ['inyeccion', 'capital_inicial'] },
        ...(desde && { createdAt: { gt: desde } }),
      },
      select: { id: true },
    })
    if (!yaAbsorbido) {
      const prestamosRuta = await prisma.prestamo.findMany({
        where: {
          organizationId,
          estado: 'activo',
          cliente: { rutaId: rutaIdValida },
        },
        include: { pagos: { select: { montoPagado: true, tipo: true } } },
      })
      saldoPendienteRuta = Math.round(
        prestamosRuta.reduce((acc, p) => acc + calcularSaldoPendiente(p), 0)
      )
    }
  }

  // La fila del capital antes de la transacción: dentro, dos a la vez se traban (`asegurarCapital`).
  await asegurarCapital(prisma, organizationId)
  const resultado = await prisma.$transaction(async (tx) => {
    /* La ruta que empieza su capital arranca en CERO, no en la cuenta interna
       de sus préstamos: meterle $500.000 a Ruta Centro la dejaba en −$149.933
       (DETALLES-RUTAS #10, el mismo fallo que el #39 al unir). El saldo se lee
       DENTRO de la transacción, después del candado del capital. */
    if (empiezaSuCapital) {
      await tx.$queryRaw`SELECT id FROM Capital WHERE organizationId = ${organizationId} FOR UPDATE`
      const ahora = await tx.ruta.findUnique({ where: { id: rutaIdValida }, select: { id: true, nombre: true, saldoCapital: true, capitalHabilitado: true } })
      if (!ahora.capitalHabilitado) await empezarCapitalPropio(tx, { organizationId, ruta: ahora, usuarioId: userId })
    }
    const r = await registrarMovimientoManualCapital(tx, {
      organizationId,
      tipo,
      monto: montoNum,
      descripcion,
      creadoPorId: userId,
      rutaId: rutaIdValida,
      direccion: tipo === 'ajuste' ? direccion : undefined,
      // Si el movimiento es para una ruta específica (inyeccion/retiro de sub-bolsa),
      // permitir saldo global negativo: el dinero viene/va de la ruta, no del pool global.
      permitirNegativo: !!rutaIdValida,
      metodoPago: cuentaMov,
      metodoPagoId: cuentaMovId,
    })

    // Ajuste de arranque: descuenta de la SUB-BOLSA de la ruta los prestamos
    // ya activos, sin mover el saldo global (ese ya es correcto historicamente).
    if (rutaIdValida && (tipo === 'inyeccion' || tipo === 'capital_inicial')) {
      await tx.ruta.update({ where: { id: rutaIdValida }, data: { capitalHabilitado: true } }).catch(() => {})
    }

    if (saldoPendienteRuta > 0) {
      await registrarMovimientoCapital(tx, {
        organizationId,
        tipo: 'ajuste',
        monto: saldoPendienteRuta,
        descripcion: `Ajuste de arranque: préstamos activos ya en la ruta`,
        rutaId: rutaIdValida,
        ajusteArranqueRuta: true,
        direccion: 'egreso',
        creadoPorId: userId,
      })
    }
    return r
  }, { timeout: 30000 })

  logActividad({
    session,
    accion: 'movimiento_capital',
    entidadTipo: 'capital',
    entidadId: resultado.movimiento.id,
    detalle: `${tipo} ${resultado.direccion === 'ingreso' ? 'entrada' : 'salida'} $${montoNum.toLocaleString('es-CO')}${descripcion ? ` - ${descripcion}` : ''}`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })

  return Response.json({
    capital: resultado.capital,
    movimiento: resultado.movimiento,
    direccion: resultado.direccion,
  }, { status: 201 })
}
