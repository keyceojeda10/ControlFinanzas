// app/api/clientes/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { LIMITES_PLAN, calcularEstadoCliente } from '@/lib/calculos'
import { logActividad } from '@/lib/activity-log'
import { geocodeAddress }   from '@/lib/geocoding'
import { trackEvent } from '@/lib/analytics'

// ─── GET /api/clientes ──────────────────────────────────────────
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const buscar = searchParams.get('buscar')?.trim() ?? ''
  const page = searchParams.get('page') ? Number(searchParams.get('page')) : null
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 100)

  const { organizationId, rol, rutaId } = session.user

  // Cobrador → solo clientes de su ruta
  const filtroRuta = rol === 'cobrador' && rutaId
    ? { rutaId }
    : {}

  // Filtro de búsqueda por nombre, cédula, teléfono o referencia
  const filtroBuscar = buscar
    ? {
        OR: [
          { nombre:    { contains: buscar } },
          { cedula:    { contains: buscar } },
          { telefono:  { contains: buscar } },
          { referencia: { contains: buscar } },
        ],
      }
    : {}

  const whereClause = {
    organizationId,
    estado: { notIn: ['eliminado'] },
    ...filtroRuta,
    ...filtroBuscar,
  }

  const clientes = await prisma.cliente.findMany({
    where: whereClause,
    select: {
      id:         true,
      nombre:     true,
      cedula:     true,
      telefono:   true,
      referencia: true,
      estado:     true,
      rutaId:     true,
      prestamos: {
        where:  { estado: 'activo' },
        select: {
          id: true,
          estado: true,
          fechaInicio: true,
          cuotaDiaria: true,
          diasPlazo: true,
          frecuencia: true,
          pagos: { select: { montoPagado: true } },
        },
      },
    },
    orderBy: [{ ordenRuta: 'asc' }, { nombre: 'asc' }],
    ...(page != null && { take: limit, skip: (page - 1) * limit }),
  })

  // Recalcular estado real del cliente basado en sus préstamos activos
  const resultado = clientes.map((c) => ({
    id:               c.id,
    nombre:           c.nombre,
    cedula:           c.cedula,
    telefono:         c.telefono,
    referencia:       c.referencia,
    estado:           calcularEstadoCliente(c.prestamos),
    rutaId:           c.rutaId,
    prestamosActivos: c.prestamos.length,
  }))

  // If paginated, return object with total; otherwise array for backward compat
  if (page != null) {
    const total = await prisma.cliente.count({ where: whereClause })
    return Response.json({ clientes: resultado, total, page, totalPages: Math.ceil(total / limit) })
  }
  return Response.json(resultado)
}

// ─── POST /api/clientes ─────────────────────────────────────────
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  // Verificar permisos: owner siempre puede, cobrador solo si tiene permiso
  let autoRutaId = null
  if (session.user.rol !== 'owner') {
    if (session.user.rol === 'cobrador') {
      const cobrador = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { puedeCrearClientes: true },
      })
      if (!cobrador?.puedeCrearClientes) {
        return Response.json({ error: 'No tienes permiso para crear clientes' }, { status: 403 })
      }
      // Auto-asignar a la ruta del cobrador
      autoRutaId = session.user.rutaId || null
    } else {
      return Response.json({ error: 'No autorizado' }, { status: 403 })
    }
  }

  const { organizationId, plan } = session.user

  // Validar límite del plan
  const limite = LIMITES_PLAN[plan] ?? LIMITES_PLAN.basic
  if (isFinite(limite)) {
    const total = await prisma.cliente.count({ where: { organizationId, estado: { notIn: ['eliminado'] } } })
    if (total >= limite) {
      return Response.json(
        { error: `Tu plan ${plan} permite máximo ${limite} clientes. Considera actualizar.` },
        { status: 403 }
      )
    }
  }

  const body = await request.json()
  const { nombre, cedula, telefono, direccion, referencia, notas, fotoUrl, rutaId, latitud, longitud } = body

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

  // Resolver coordenadas: GPS directo > geocodificación de dirección
  let lat = latitud ?? null
  let lng = longitud ?? null
  if (lat == null && lng == null && direccion?.trim()) {
    const geo = await geocodeAddress(direccion.trim())
    if (geo) { lat = geo.lat; lng = geo.lng }
  }

  const cliente = await prisma.cliente.create({
    data: {
      organizationId,
      nombre:     nombre.trim(),
      cedula:     cedula.trim(),
      telefono:   telefono.trim(),
      direccion:  direccion?.trim()  || null,
      referencia: referencia?.trim()  || null,
      notas:      notas?.trim()      || null,
      fotoUrl:    fotoUrl?.trim() && /^https?:\/\/.+/i.test(fotoUrl.trim()) ? fotoUrl.trim() : null,
      rutaId:     rutaId || autoRutaId || null,
      latitud:    lat,
      longitud:   lng,
    },
  })

  logActividad({ session, accion: 'crear_cliente', entidadTipo: 'cliente', entidadId: cliente.id, detalle: `Cliente ${nombre.trim()} (${cedula.trim()})`, ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() })
  trackEvent({ organizationId, userId: session.user.id, evento: 'crear_cliente' })
  return Response.json(cliente, { status: 201 })
}
