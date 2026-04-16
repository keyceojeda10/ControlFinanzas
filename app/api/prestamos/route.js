// app/api/prestamos/route.js

import { getServerSession }    from 'next-auth'
import { authOptions }         from '@/lib/auth'
import { prisma }              from '@/lib/prisma'
import {
  calcularPrestamo,
  calcularDiasMora,
  calcularSaldoPendiente,
  calcularPorcentajePagado,
  calcularProximoCobro,
  pagoHoy,
} from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import { registrarMovimientoCapital } from '@/lib/capital'
import { logActividad } from '@/lib/activity-log'
import { trackEvent } from '@/lib/analytics'

// ─── GET /api/prestamos ─────────────────────────────────────────
export async function GET(request) {
  try {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { organizationId, rol, rutaId } = session.user
  const { searchParams } = new URL(request.url)
  const clienteId = searchParams.get('clienteId')
  const estado    = searchParams.get('estado')
  const buscar    = searchParams.get('buscar')?.trim()
  const page      = searchParams.get('page') ? Number(searchParams.get('page')) : null
  const limit     = Math.min(Number(searchParams.get('limit')) || 50, 100)

  // Cobrador sin ruta asignada no ve nada (previene fuga de datos multi-tenant)
  if (rol === 'cobrador' && !rutaId) {
    return Response.json(page != null ? { prestamos: [], total: 0, page, totalPages: 0 } : [])
  }

  const where = {
    organizationId,
    ...(clienteId && { clienteId }),
    ...(estado    && { estado }),
    // Combinar filtros de cliente: búsqueda + restricción de ruta para cobrador
    ...((buscar || rol === 'cobrador') && {
      cliente: {
        ...(rol === 'cobrador' && { rutaId }),
        ...(buscar && {
          OR: [
            { nombre: { contains: buscar } },
            { cedula: { contains: buscar } },
          ],
        }),
      },
    }),
  }

  const prestamos = await prisma.prestamo.findMany({
    where,
    include: {
      cliente: { select: { id: true, nombre: true, cedula: true, rutaId: true, diasSinCobro: true, ruta: { select: { diasSinCobro: true } } } },
      pagos:   { select: { id: true, montoPagado: true, fechaPago: true, tipo: true } },
    },
    orderBy: { createdAt: 'desc' },
    ...(page != null && { take: limit, skip: (page - 1) * limit }),
  })

  // Config org para días sin cobro
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { diasSinCobro: true },
  })

  const resultado = prestamos.map((p) => {
    const diasExcluidos = obtenerDiasSinCobro(p.cliente, p.cliente?.ruta, org)
    return {
    id:               p.id,
    clienteId:        p.clienteId,
    cliente:          p.cliente,
    montoPrestado:    p.montoPrestado,
    totalAPagar:      p.totalAPagar,
    cuotaDiaria:      p.cuotaDiaria,
    frecuencia:       p.frecuencia,
    tasaInteres:      p.tasaInteres,
    diasPlazo:        p.diasPlazo,
    fechaInicio:      p.fechaInicio,
    fechaFin:         p.fechaFin,
    estado:           p.estado,
    totalPagado:      p.pagos.filter(x => !['recargo', 'descuento'].includes(x.tipo)).reduce((a, x) => a + x.montoPagado, 0),
    saldoPendiente:   calcularSaldoPendiente(p),
    porcentajePagado: calcularPorcentajePagado(p),
    diasMora:         calcularDiasMora(p, diasExcluidos),
    pagoHoy:          pagoHoy(p),
    proximoCobro:     calcularProximoCobro(p, diasExcluidos),
  }})

  // If paginated, return object with total; otherwise array for backward compat
  if (page != null) {
    const total = await prisma.prestamo.count({ where })
    return Response.json({ prestamos: resultado, total, page, totalPages: Math.ceil(total / limit) })
  }
  return Response.json(resultado)
  } catch (err) {
    console.error('[GET /api/prestamos]', err)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ─── POST /api/prestamos ────────────────────────────────────────
export async function POST(request) {
  try {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  // Verificar permisos: owner siempre puede, cobrador solo si tiene permiso
  if (session.user.rol !== 'owner') {
    if (session.user.rol === 'cobrador') {
      const cobrador = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { puedeCrearPrestamos: true },
      })
      if (!cobrador?.puedeCrearPrestamos) {
        return Response.json({ error: 'No tienes permiso para crear préstamos' }, { status: 403 })
      }
    } else {
      return Response.json({ error: 'No autorizado' }, { status: 403 })
    }
  }

  const { organizationId, rol } = session.user
  const body = await request.json()
  const { clienteId, montoPrestado, tasaInteres, diasPlazo, fechaInicio, frecuencia, yaAbonado, cuotaManual } = body

  const freq = frecuencia || 'diario'
  const frecuenciasValidas = ['diario', 'semanal', 'quincenal', 'mensual']
  if (!frecuenciasValidas.includes(freq)) {
    return Response.json({ error: 'Frecuencia no válida' }, { status: 400 })
  }

  // Validaciones
  if (!clienteId)     return Response.json({ error: 'El cliente es requerido' },          { status: 400 })
  if (!montoPrestado) return Response.json({ error: 'El monto es requerido' },            { status: 400 })
  if (tasaInteres == null || tasaInteres === '') return Response.json({ error: 'La tasa de interés es requerida' }, { status: 400 })
  if (!diasPlazo)     return Response.json({ error: 'El plazo es requerido' },            { status: 400 })
  if (!fechaInicio)   return Response.json({ error: 'La fecha de inicio es requerida' },  { status: 400 })

  if (Number(montoPrestado) <= 0) return Response.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 })
  if (Number(tasaInteres)   < 0)  return Response.json({ error: 'La tasa no puede ser negativa' },  { status: 400 })
  if (Number(diasPlazo)     <= 0) return Response.json({ error: 'El plazo debe ser mayor a 0' }, { status: 400 })
  const abono = Number(yaAbonado) || 0
  if (abono < 0) return Response.json({ error: 'El abono no puede ser negativo' }, { status: 400 })

  // Verificar que el cliente pertenece a la organización
  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId, organizationId },
  })
  if (!cliente) return Response.json({ error: 'Cliente no encontrado' }, { status: 404 })

  // Evita desalineaciones de caja: el cobrador solo puede crear préstamos en su ruta activa.
  if (rol === 'cobrador') {
    const rutaActiva = await prisma.ruta.findFirst({
      where: { organizationId, cobradorId: session.user.id, activo: true },
      select: { id: true },
    })

    if (!rutaActiva) {
      return Response.json({ error: 'No tienes una ruta activa asignada' }, { status: 400 })
    }

    if (cliente.rutaId !== rutaActiva.id) {
      return Response.json({ error: 'Solo puedes crear préstamos para clientes de tu ruta activa' }, { status: 403 })
    }
  }

  // Calcular valores del préstamo (cuotaManual opcional sobreescribe la cuota calculada)
  const cuotaManualNum = Number(cuotaManual) || 0
  if (cuotaManualNum < 0) {
    return Response.json({ error: 'La cuota manual no puede ser negativa' }, { status: 400 })
  }
  const { totalAPagar, cuotaDiaria, fechaFin } = calcularPrestamo({
    montoPrestado, tasaInteres, diasPlazo, fechaInicio, frecuencia: freq,
    ...(cuotaManualNum > 0 && { cuotaManual: cuotaManualNum }),
  })

  // Validar abono vs total
  if (abono > totalAPagar) {
    return Response.json({ error: 'El abono no puede ser mayor al total a pagar' }, { status: 400 })
  }

  // Crear préstamo y actualizar estado del cliente en transacción
  const prestamo = await prisma.$transaction(async (tx) => {
    // Validar saldo de capital antes de desembolsar. Solo se valida si la org
    // ya tiene capital configurado; orgs nuevas sin capital no tienen gate.
    const capRow = await tx.$queryRaw`
      SELECT id, saldo FROM Capital WHERE organizationId = ${organizationId} FOR UPDATE
    `
    if (Array.isArray(capRow) && capRow.length > 0) {
      const saldoCap = Number(capRow[0].saldo || 0)
      const neto = Number(montoPrestado) - abono
      if (saldoCap < neto) {
        throw new Error('CAPITAL_INSUFICIENTE')
      }
    }

    const nuevo = await tx.prestamo.create({
      data: {
        clienteId,
        organizationId,
        montoPrestado: Number(montoPrestado),
        tasaInteres:   Number(tasaInteres),
        totalAPagar,
        cuotaDiaria,
        frecuencia:    freq,
        diasPlazo:     Number(diasPlazo),
        fechaInicio:   new Date(fechaInicio),
        fechaFin,
      },
    })

    // Actualizar estado del cliente a activo
    await tx.cliente.update({
      where: { id: clienteId },
      data:  { estado: 'activo' },
    })

    // Registrar desembolso en capital (si está configurado)
    await registrarMovimientoCapital(tx, {
      organizationId,
      tipo: 'desembolso',
      monto: Number(montoPrestado),
      descripcion: `Desembolso préstamo a ${cliente.nombre}`,
      referenciaId: nuevo.id,
      referenciaTipo: 'prestamo',
      creadoPorId: session.user.id,
    })

    // Si es préstamo en curso con abono previo, registrar pago inicial
    if (abono > 0) {
      await tx.pago.create({
        data: {
          prestamoId:     nuevo.id,
          organizationId,
          cobradorId:     session.user.id,
          montoPagado:    abono,
          tipo:           'completo',
          fechaPago:      new Date(fechaInicio),
          nota:           'Abono previo (préstamo en curso)',
        },
      })

      // Registrar recaudo en capital
      await registrarMovimientoCapital(tx, {
        organizationId,
        tipo: 'recaudo',
        monto: abono,
        descripcion: `Abono previo préstamo en curso - ${cliente.nombre}`,
        referenciaId: nuevo.id,
        referenciaTipo: 'prestamo',
        creadoPorId: session.user.id,
      })
    }

    return nuevo
  })

  logActividad({ session, accion: 'crear_prestamo', entidadTipo: 'prestamo', entidadId: prestamo.id, detalle: `Préstamo $${Number(montoPrestado).toLocaleString('es-CO')} a ${cliente.nombre}${abono > 0 ? ` (en curso, abono previo $${abono.toLocaleString('es-CO')})` : ''}`, ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() })
  trackEvent({ organizationId, userId: session.user.id, evento: 'crear_prestamo', metadata: { monto: Number(montoPrestado) } })
  return Response.json(prestamo, { status: 201 })
  } catch (err) {
    if (err?.message === 'CAPITAL_INSUFICIENTE') {
      return Response.json({
        error: 'Capital insuficiente para desembolsar este préstamo',
      }, { status: 400 })
    }
    console.error('[POST /api/prestamos]', err)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
