// app/api/lineas-credito/route.js

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularSaldoLinea } from '@/lib/linea-credito'

// ─── Campos minimos del cliente para listados ────────────────────
const CLIENTE_SELECT = {
  id: true,
  nombre: true,
  cedula: true,
  fotoUrl: true,
  rutaId: true,
}

// ─── Include comun para lineas con sus relaciones ────────────────
function buildInclude() {
  return {
    cliente: { select: CLIENTE_SELECT },
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
        montoTotal: true,
        montoAInteres: true,
        montoACapital: true,
        metodoPago: true,
        cobradorId: true,
        nota: true,
        createdAt: true,
      },
    },
    // Sin los cortes, calcularInteresAcumulado recalcula el interes desde el
    // inicio y resta todo lo pagado -> la lista mostraba un saldo distinto al
    // del detalle (que si incluye cortes). Deben coincidir.
    cortesLinea: {
      select: {
        id: true,
        fechaCorte: true,
        interesesGenerados: true,
        saldoNuevo: true,
      },
    },
  }
}

// Adjunta los calculos derivados a cada linea sin mutar el objeto original
function adjuntarSaldo(linea) {
  const saldo = calcularSaldoLinea(linea)
  return { ...linea, ...saldo }
}

// ─── GET /api/lineas-credito ─────────────────────────────────────
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { organizationId, rol } = session.user
    const { searchParams } = new URL(request.url)

    if (rol === 'cobrador') {
      return Response.json({ error: 'No autorizado' }, { status: 403 })
    }

    const clienteId = searchParams.get('clienteId')?.trim() || undefined
    const estado    = searchParams.get('estado')?.trim()    || undefined
    const buscar    = searchParams.get('buscar')?.trim()    || undefined

    const filtroBuscar = buscar
      ? {
          cliente: {
            OR: [
              { nombre: { contains: buscar } },
              { cedula: { contains: buscar } },
            ],
          },
        }
      : {}

    const filtroEstado   = estado    ? { estado }    : {}
    const filtroCliente  = clienteId ? { clienteId } : {}

    const where = {
      organizationId,
      ...filtroEstado,
      ...filtroCliente,
      ...filtroBuscar,
    }

    const lineas = await prisma.lineaCredito.findMany({
      where,
      include: buildInclude(),
      orderBy: { createdAt: 'desc' },
    })

    const data = lineas.map(adjuntarSaldo)

    return Response.json(data)
  } catch (err) {
    console.error('[GET /api/lineas-credito]', err)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ─── POST /api/lineas-credito ────────────────────────────────────
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { organizationId, rol, id: userId } = session.user

    // Solo owner o superadmin pueden crear lineas
    if (rol === 'cobrador') {
      return Response.json({ error: 'Sin permiso para crear líneas de crédito' }, { status: 403 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Cuerpo de solicitud inválido' }, { status: 400 })
    }

    const {
      clienteId,
      cupoMaximo,
      tasaInteres,
      modoInteres   = 'fijo_mensual',
      diaCorte      = 30,
      pagoMinimoPct = 0,
      notas,
    } = body

    // ── Validacion de campos requeridos ──
    if (!clienteId || typeof clienteId !== 'string') {
      return Response.json({ error: 'clienteId es requerido' }, { status: 400 })
    }
    if (typeof cupoMaximo !== 'number' || cupoMaximo <= 0) {
      return Response.json({ error: 'cupoMaximo debe ser un número mayor a 0' }, { status: 400 })
    }
    if (typeof tasaInteres !== 'number' || tasaInteres <= 0) {
      return Response.json({ error: 'tasaInteres debe ser un número mayor a 0' }, { status: 400 })
    }

    // ── Verificar que el cliente pertenece a la organizacion ──
    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId },
      select: { id: true, organizationId: true },
    })

    if (!cliente || cliente.organizationId !== organizationId) {
      return Response.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    const linea = await prisma.lineaCredito.create({
      data: {
        clienteId,
        organizationId,
        cupoMaximo,
        tasaInteres,
        modoInteres,
        diaCorte,
        pagoMinimoPct,
        notas: notas ?? null,
        creadoPorId: userId,
        estado: 'activa',
      },
      include: buildInclude(),
    })

    return Response.json(adjuntarSaldo(linea), { status: 201 })
  } catch (err) {
    console.error('[POST /api/lineas-credito]', err)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
