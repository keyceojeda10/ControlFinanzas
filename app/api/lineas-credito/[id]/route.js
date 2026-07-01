// app/api/lineas-credito/[id]/route.js

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularSaldoLinea } from '@/lib/linea-credito'

// ─── Include completo para detalle de una linea ──────────────────
function buildIncludeDetalle() {
  return {
    cliente: true,
    desembolsos: {
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        monto: true,
        nota: true,
        registradoPorId: true,
        createdAt: true,
      },
    },
    pagosLinea: {
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        corteLineaId: true,
        montoTotal: true,
        montoAInteres: true,
        montoACapital: true,
        metodoPago: true,
        cobradorId: true,
        latitud: true,
        longitud: true,
        nota: true,
        createdAt: true,
      },
    },
    cortesLinea: {
      orderBy: { fechaCorte: 'desc' },
      select: {
        id: true,
        periodo: true,
        fechaCorte: true,
        saldoAnterior: true,
        totalDesembolsos: true,
        interesesGenerados: true,
        totalCargos: true,
        totalPagado: true,
        saldoNuevo: true,
        pagoMinimo: true,
        createdAt: true,
      },
    },
  }
}

// ─── GET /api/lineas-credito/[id] ────────────────────────────────
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const { organizationId } = session.user

    const linea = await prisma.lineaCredito.findUnique({
      where: { id },
      include: buildIncludeDetalle(),
    })

    if (!linea || linea.organizationId !== organizationId) {
      return Response.json({ error: 'Linea de credito no encontrada' }, { status: 404 })
    }

    const saldo = calcularSaldoLinea(linea)

    return Response.json({ ...linea, ...saldo })
  } catch (err) {
    console.error('[GET /api/lineas-credito/[id]]', err)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ─── Campos permitidos para actualizar ──────────────────────────
const CAMPOS_ACTUALIZABLES = [
  'cupoMaximo',
  'tasaInteres',
  'modoInteres',
  'diaCorte',
  'pagoMinimoPct',
  'estado',
  'notas',
]

const ESTADOS_VALIDOS = ['activa', 'congelada', 'cerrada']

// Transiciones de estado permitidas
const TRANSICIONES_ESTADO = {
  activa:    ['congelada', 'cerrada'],
  congelada: ['activa', 'cerrada'],
  cerrada:   [],
}

// ─── PATCH /api/lineas-credito/[id] ──────────────────────────────
export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { organizationId, rol } = session.user

    if (rol === 'cobrador') {
      return Response.json({ error: 'Sin permiso para modificar lineas de credito' }, { status: 403 })
    }

    const { id } = await params

    const lineaExistente = await prisma.lineaCredito.findUnique({
      where: { id },
      select: { id: true, organizationId: true, estado: true },
    })

    if (!lineaExistente || lineaExistente.organizationId !== organizationId) {
      return Response.json({ error: 'Linea de credito no encontrada' }, { status: 404 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Cuerpo de solicitud invalido' }, { status: 400 })
    }

    const data = {}

    for (const campo of CAMPOS_ACTUALIZABLES) {
      if (!(campo in body)) continue
      data[campo] = body[campo]
    }

    if (Object.keys(data).length === 0) {
      return Response.json({ error: 'No se proporcionaron campos para actualizar' }, { status: 400 })
    }

    if ('cupoMaximo' in data && (typeof data.cupoMaximo !== 'number' || data.cupoMaximo <= 0)) {
      return Response.json({ error: 'cupoMaximo debe ser un numero mayor a 0' }, { status: 400 })
    }
    if ('tasaInteres' in data && (typeof data.tasaInteres !== 'number' || data.tasaInteres <= 0)) {
      return Response.json({ error: 'tasaInteres debe ser un numero mayor a 0' }, { status: 400 })
    }
    if ('estado' in data && !ESTADOS_VALIDOS.includes(data.estado)) {
      return Response.json(
        { error: `estado debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}` },
        { status: 400 }
      )
    }

    // Validar transicion de estado
    if ('estado' in data) {
      const permitidas = TRANSICIONES_ESTADO[lineaExistente.estado] || []
      if (!permitidas.includes(data.estado)) {
        return Response.json(
          { error: `No se puede cambiar de "${lineaExistente.estado}" a "${data.estado}"` },
          { status: 400 }
        )
      }
    }

    // No permitir editar config si esta cerrada
    if (lineaExistente.estado === 'cerrada' && !('estado' in data)) {
      return Response.json({ error: 'No se puede modificar una linea cerrada' }, { status: 400 })
    }

    const lineaActualizada = await prisma.lineaCredito.update({
      where: { id },
      data,
      include: buildIncludeDetalle(),
    })

    const saldo = calcularSaldoLinea(lineaActualizada)

    return Response.json({ ...lineaActualizada, ...saldo })
  } catch (err) {
    console.error('[PATCH /api/lineas-credito/[id]]', err)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ─── DELETE /api/lineas-credito/[id] ─────────────────────────────
// Solo admin. Solo si no tiene movimientos (desembolsos, pagos, cortes).
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { organizationId, rol } = session.user

    if (rol === 'cobrador') {
      return Response.json({ error: 'Sin permiso para eliminar lineas de credito' }, { status: 403 })
    }

    const { id } = await params

    const linea = await prisma.lineaCredito.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        _count: { select: { desembolsos: true, pagosLinea: true, cortesLinea: true } },
      },
    })

    if (!linea || linea.organizationId !== organizationId) {
      return Response.json({ error: 'Linea de credito no encontrada' }, { status: 404 })
    }

    const totalMovimientos = linea._count.desembolsos + linea._count.pagosLinea + linea._count.cortesLinea
    if (totalMovimientos > 0) {
      return Response.json(
        { error: 'No se puede eliminar una linea con movimientos. Puedes cerrarla en su lugar.' },
        { status: 400 }
      )
    }

    await prisma.lineaCredito.delete({ where: { id } })

    return Response.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/lineas-credito/[id]]', err)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
