// app/api/clientes/[id]/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { calcularDiasMora, calcularSaldoPendiente, calcularPorcentajePagado } from '@/lib/calculos'

// Helper: verificar que el cliente pertenece a la organización (y a la ruta del cobrador)
async function obtenerCliente(id, session) {
  const cliente = await prisma.cliente.findFirst({
    where: { id, organizationId: session.user.organizationId },
  })
  if (!cliente) return null
  // Cobrador: solo puede ver clientes de su ruta
  if (session.user.rol === 'cobrador' && cliente.rutaId !== session.user.rutaId) return null
  return cliente
}

// ─── GET /api/clientes/[id] ─────────────────────────────────────
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params

  const clienteBase = await obtenerCliente(id, session)
  if (!clienteBase) {
    return Response.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  // Obtener cliente completo con préstamos y pagos
  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: {
      ruta: { select: { id: true, nombre: true } },
      prestamos: {
        orderBy: { createdAt: 'desc' },
        include: {
          pagos: {
            orderBy: { fechaPago: 'desc' },
            select: { id: true, montoPagado: true, fechaPago: true, tipo: true, nota: true },
          },
        },
      },
    },
  })

  // Enriquecer préstamos con cálculos
  const prestamosEnriquecidos = cliente.prestamos.map((p) => ({
    ...p,
    diasMora:            calcularDiasMora(p),
    saldoPendiente:      calcularSaldoPendiente(p),
    porcentajePagado:    calcularPorcentajePagado(p),
  }))

  return Response.json({ ...cliente, prestamos: prestamosEnriquecidos })
}

// ─── PATCH /api/clientes/[id] ───────────────────────────────────
export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo los owners pueden editar clientes' }, { status: 403 })
  }

  const { id } = await params
  const clienteBase = await obtenerCliente(id, session)
  if (!clienteBase) {
    return Response.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  const body = await request.json()
  const { nombre, cedula, telefono, direccion, fotoUrl, rutaId } = body

  // Si cambia la cédula, verificar que no exista otra igual
  if (cedula && cedula.trim() !== clienteBase.cedula) {
    if (!/^\d{6,12}$/.test(cedula.trim())) {
      return Response.json({ error: 'La cédula debe tener entre 6 y 12 dígitos numéricos' }, { status: 400 })
    }
    const existe = await prisma.cliente.findUnique({
      where: {
        organizationId_cedula: {
          organizationId: session.user.organizationId,
          cedula: cedula.trim(),
        },
      },
    })
    if (existe && existe.id !== id) {
      return Response.json({ error: 'Ya existe un cliente con esa cédula' }, { status: 409 })
    }
  }

  const actualizado = await prisma.cliente.update({
    where: { id },
    data: {
      ...(nombre    && { nombre:    nombre.trim()    }),
      ...(cedula    && { cedula:    cedula.trim()    }),
      ...(telefono  && { telefono:  telefono.trim()  }),
      ...(direccion !== undefined && { direccion: direccion?.trim() || null }),
      ...(fotoUrl   !== undefined && { fotoUrl:   fotoUrl?.trim()   || null }),
      ...(rutaId    !== undefined && { rutaId:    rutaId            || null }),
    },
  })

  return Response.json(actualizado)
}
