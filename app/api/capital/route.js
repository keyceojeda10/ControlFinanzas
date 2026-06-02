// app/api/capital/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { registrarMovimientoManualCapital, registrarMovimientoCapital, getSaldosPorRuta } from '@/lib/capital'
import { calcularSaldoPendiente } from '@/lib/calculos'

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
  const { tipo, monto, descripcion, rutaId, absorberActivos } = body
  const direccion = body?.direccion === 'ingreso' ? 'ingreso' : 'egreso'

  const tiposPermitidos = ['capital_inicial', 'inyeccion', 'retiro', 'ajuste']
  if (!tiposPermitidos.includes(tipo)) {
    return Response.json({ error: 'Tipo de movimiento no válido' }, { status: 400 })
  }
  if (!monto || Number(monto) <= 0) {
    return Response.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 })
  }

  // Si viene rutaId, validar que la ruta pertenezca a la organizacion
  let rutaIdValida = null
  if (rutaId) {
    const ruta = await prisma.ruta.findFirst({
      where: { id: rutaId, organizationId },
      select: { id: true },
    })
    if (!ruta) return Response.json({ error: 'Ruta no válida' }, { status: 400 })
    rutaIdValida = ruta.id
  }

  const montoNum = Number(monto)

  // "Absorber activos": solo aplica al INYECTAR a una ruta. Calcula el saldo
  // pendiente de los prestamos activos de esa ruta para descontarlo de la
  // sub-bolsa (sin tocar el saldo global). Se calcula ANTES de la transaccion.
  let saldoPendienteRuta = 0
  if (absorberActivos && rutaIdValida && tipo === 'inyeccion') {
    // Guard de idempotencia: solo se puede absorber UNA vez por ruta. Si ya
    // existe un ajuste de arranque para esta ruta, no volver a descontar
    // (evita descontar los prestamos previos multiples veces).
    const yaAbsorbido = await prisma.movimientoCapital.findFirst({
      where: { organizationId, rutaId: rutaIdValida, ajusteArranqueRuta: true },
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

  const resultado = await prisma.$transaction(async (tx) => {
    const r = await registrarMovimientoManualCapital(tx, {
      organizationId,
      tipo,
      monto: montoNum,
      descripcion,
      creadoPorId: userId,
      rutaId: rutaIdValida,
      direccion: tipo === 'ajuste' ? direccion : undefined,
      permitirNegativo: false,
    })

    // Ajuste de arranque: descuenta de la SUB-BOLSA de la ruta los prestamos
    // ya activos, sin mover el saldo global (ese ya es correcto historicamente).
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
  })

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
