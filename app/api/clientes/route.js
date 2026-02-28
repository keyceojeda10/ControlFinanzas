// app/api/clientes/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { LIMITES_PLAN }     from '@/lib/calculos'

// ─── GET /api/clientes ──────────────────────────────────────────
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const buscar = searchParams.get('buscar')?.trim() ?? ''

  const { organizationId, rol, rutaId } = session.user

  // Cobrador → solo clientes de su ruta
  const filtroRuta = rol === 'cobrador' && rutaId
    ? { rutaId }
    : {}

  // Filtro de búsqueda por nombre o cédula
  const filtroBuscar = buscar
    ? {
        OR: [
          { nombre:  { contains: buscar, mode: 'insensitive' } },
          { cedula:  { contains: buscar, mode: 'insensitive' } },
          { telefono: { contains: buscar } },
        ],
      }
    : {}

  const clientes = await prisma.cliente.findMany({
    where: {
      organizationId,
      ...filtroRuta,
      ...filtroBuscar,
    },
    select: {
      id:       true,
      nombre:   true,
      cedula:   true,
      telefono: true,
      estado:   true,
      rutaId:   true,
      prestamos: {
        where:  { estado: 'activo' },
        select: { id: true },
      },
    },
    orderBy: { nombre: 'asc' },
  })

  // Añadir conteo de préstamos activos
  const resultado = clientes.map((c) => ({
    id:               c.id,
    nombre:           c.nombre,
    cedula:           c.cedula,
    telefono:         c.telefono,
    estado:           c.estado,
    rutaId:           c.rutaId,
    prestamosActivos: c.prestamos.length,
  }))

  return Response.json(resultado)
}

// ─── POST /api/clientes ─────────────────────────────────────────
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo los owners pueden crear clientes' }, { status: 403 })
  }

  const { organizationId, plan } = session.user

  // Validar límite del plan
  const limite = LIMITES_PLAN[plan] ?? LIMITES_PLAN.basic
  if (isFinite(limite)) {
    const total = await prisma.cliente.count({ where: { organizationId } })
    if (total >= limite) {
      return Response.json(
        { error: `Tu plan ${plan} permite máximo ${limite} clientes. Considera actualizar.` },
        { status: 403 }
      )
    }
  }

  const body = await request.json()
  const { nombre, cedula, telefono, direccion, fotoUrl, rutaId } = body

  // Validaciones básicas
  if (!nombre?.trim())   return Response.json({ error: 'El nombre es requerido' },  { status: 400 })
  if (!cedula?.trim())   return Response.json({ error: 'La cédula es requerida' },  { status: 400 })
  if (!telefono?.trim()) return Response.json({ error: 'El teléfono es requerido' }, { status: 400 })

  // Validar cédula: solo números, 6-12 dígitos
  if (!/^\d{6,12}$/.test(cedula.trim())) {
    return Response.json({ error: 'La cédula debe tener entre 6 y 12 dígitos numéricos' }, { status: 400 })
  }

  // Verificar cédula única en la organización
  const existe = await prisma.cliente.findUnique({
    where: { organizationId_cedula: { organizationId, cedula: cedula.trim() } },
  })
  if (existe) {
    return Response.json({ error: 'Ya existe un cliente con esa cédula' }, { status: 409 })
  }

  // Si se envía rutaId, verificar que pertenece a la organización
  if (rutaId) {
    const ruta = await prisma.ruta.findFirst({
      where: { id: rutaId, organizationId },
    })
    if (!ruta) {
      return Response.json({ error: 'Ruta no válida' }, { status: 400 })
    }
  }

  const cliente = await prisma.cliente.create({
    data: {
      organizationId,
      nombre:    nombre.trim(),
      cedula:    cedula.trim(),
      telefono:  telefono.trim(),
      direccion: direccion?.trim() || null,
      fotoUrl:   fotoUrl?.trim()   || null,
      rutaId:    rutaId            || null,
    },
  })

  return Response.json(cliente, { status: 201 })
}
