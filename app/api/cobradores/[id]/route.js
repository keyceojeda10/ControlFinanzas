// app/api/cobradores/[id]/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import bcrypt               from 'bcryptjs'
import { calcularEstadoCliente } from '@/lib/calculos'

// Funciones de fecha en timezone Colombia (UTC-5)
const getColombiaDate = () => new Date(Date.now() - 5 * 60 * 60 * 1000)
const hoy = () => { const d = getColombiaDate(); d.setHours(0,0,0,0); return d }
const manana = () => { const d = getColombiaDate(); d.setDate(d.getDate()+1); d.setHours(0,0,0,0); return d }

// ─── GET /api/cobradores/[id] ───────────────────────────────────
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede ver detalles de cobradores' }, { status: 403 })
  }

  const { id } = await params
  const cobrador = await prisma.user.findFirst({
    where: { id, organizationId: session.user.organizationId, rol: 'cobrador' },
    include: {
      rutas: {
        where:  { activo: true },
        include: {
          clientes: {
            select: {
              id: true,
              nombre: true,
              estado: true,
              prestamos: {
                where: { estado: 'activo' },
                select: {
                  estado: true,
                  fechaInicio: true,
                  cuotaDiaria: true,
                  diasPlazo: true,
                  frecuencia: true,
                  pagos: { select: { montoPagado: true } },
                },
              },
            },
          },
        },
      },
      pagos: {
        where:  { fechaPago: { gte: hoy(), lt: manana() } },
        select: { montoPagado: true, prestamoId: true },
      },
    },
  })

  if (!cobrador) return Response.json({ error: 'Cobrador no encontrado' }, { status: 404 })

  // Recalcular estado real de cada cliente
  const ruta = cobrador.rutas[0] ?? null
  if (ruta) {
    ruta.clientes = ruta.clientes.map(c => ({
      id: c.id,
      nombre: c.nombre,
      estado: calcularEstadoCliente(c.prestamos),
    }))
  }

  return Response.json({
    id:           cobrador.id,
    nombre:       cobrador.nombre,
    email:        cobrador.email,
    activo:       cobrador.activo,
    permisos: {
      crearPrestamos: cobrador.puedeCrearPrestamos,
      crearClientes:  cobrador.puedeCrearClientes,
      editarClientes: cobrador.puedeEditarClientes,
    },
    ruta,
    recaudadoHoy: cobrador.pagos.reduce((a, p) => a + p.montoPagado, 0),
    pagosMes:     cobrador.pagos.length,
  })
}

// ─── PATCH /api/cobradores/[id] ─────────────────────────────────
export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede modificar cobradores' }, { status: 403 })
  }

  const { id } = await params
  const cobrador = await prisma.user.findFirst({
    where: { id, organizationId: session.user.organizationId, rol: 'cobrador' },
  })
  if (!cobrador) return Response.json({ error: 'Cobrador no encontrado' }, { status: 404 })

  const body = await request.json()
  const data = {}

  // Nombre
  if (body.nombre !== undefined) {
    const nombre = body.nombre.trim()
    if (!nombre) return Response.json({ error: 'El nombre no puede estar vacío' }, { status: 400 })
    data.nombre = nombre
  }

  // Email
  if (body.email !== undefined) {
    const email = body.email.trim().toLowerCase()
    if (!email) return Response.json({ error: 'El correo no puede estar vacío' }, { status: 400 })
    // Verificar unicidad global (excluyendo al propio cobrador)
    const existe = await prisma.user.findFirst({ where: { email, id: { not: id } } })
    if (existe) {
      return Response.json({ error: 'Este correo ya está registrado por otro usuario' }, { status: 409 })
    }
    data.email = email
  }

  // Password
  if (body.password !== undefined && body.password !== '') {
    if (body.password.length < 8) {
      return Response.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
    }
    data.password = await bcrypt.hash(body.password, 10)
  }

  // Activo
  if (body.activo !== undefined) {
    data.activo = Boolean(body.activo)
  }

  // Permisos
  if (body.permisos !== undefined) {
    const p = body.permisos
    if (p.crearPrestamos !== undefined) data.puedeCrearPrestamos = Boolean(p.crearPrestamos)
    if (p.crearClientes  !== undefined) data.puedeCrearClientes  = Boolean(p.crearClientes)
    if (p.editarClientes !== undefined) data.puedeEditarClientes = Boolean(p.editarClientes)
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ error: 'No hay datos para actualizar' }, { status: 400 })
  }

  const actualizado = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, nombre: true, email: true, activo: true,
      puedeCrearPrestamos: true, puedeCrearClientes: true, puedeEditarClientes: true },
  })

  return Response.json(actualizado)
}

// ─── DELETE /api/cobradores/[id] ──────────────────────────────────
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede eliminar cobradores' }, { status: 403 })
  }

  const { id } = await params
  const { organizationId } = session.user

  const cobrador = await prisma.user.findFirst({
    where: { id, organizationId, rol: 'cobrador' },
    include: {
      rutas: { select: { id: true } },
      _count: { select: { pagos: true } },
    },
  })
  if (!cobrador) return Response.json({ error: 'Cobrador no encontrado' }, { status: 404 })

  // Si tiene pagos registrados, solo desactivar (no borrar datos históricos)
  if (cobrador._count.pagos > 0) {
    await prisma.ruta.updateMany({
      where: { cobradorId: id, organizationId },
      data: { cobradorId: null },
    })
    await prisma.user.update({
      where: { id },
      data: { activo: false },
    })
    return Response.json({ eliminado: false, desactivado: true, mensaje: 'Cobrador desactivado (tiene historial de pagos)' })
  }

  // Sin historial: desasignar rutas y eliminar
  await prisma.ruta.updateMany({
    where: { cobradorId: id, organizationId },
    data: { cobradorId: null },
  })
  await prisma.user.delete({ where: { id } })

  return Response.json({ eliminado: true })
}
