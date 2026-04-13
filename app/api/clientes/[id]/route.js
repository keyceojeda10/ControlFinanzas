// app/api/clientes/[id]/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { calcularDiasMora, calcularSaldoPendiente, calcularPorcentajePagado, calcularProximoCobro } from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import { logActividad } from '@/lib/activity-log'
import { geocodeAddress }   from '@/lib/geocoding'
import { validarDiasSinCobro } from '@/lib/dias-sin-cobro'

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
      ruta: { select: { id: true, nombre: true, diasSinCobro: true } },
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

  // Resolver días sin cobro
  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { diasSinCobro: true },
  })
  const diasExcluidos = obtenerDiasSinCobro(cliente, cliente.ruta, org)

  // Enriquecer préstamos con cálculos
  const prestamosEnriquecidos = cliente.prestamos.map((p) => ({
    ...p,
    diasMora:            calcularDiasMora(p, diasExcluidos),
    saldoPendiente:      calcularSaldoPendiente(p),
    porcentajePagado:    calcularPorcentajePagado(p),
    proximoCobro:        calcularProximoCobro(p, diasExcluidos),
  }))

  return Response.json({ ...cliente, prestamos: prestamosEnriquecidos })
}

// ─── PATCH /api/clientes/[id] ───────────────────────────────────
export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  // Verificar permisos: owner siempre puede, cobrador solo si tiene permiso
  if (session.user.rol !== 'owner') {
    if (session.user.rol === 'cobrador') {
      const cobrador = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { puedeEditarClientes: true },
      })
      if (!cobrador?.puedeEditarClientes) {
        return Response.json({ error: 'No tienes permiso para editar clientes' }, { status: 403 })
      }
    } else {
      return Response.json({ error: 'No autorizado' }, { status: 403 })
    }
  }

  const { id } = await params
  const clienteBase = await obtenerCliente(id, session)
  if (!clienteBase) {
    return Response.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  const body = await request.json()

  // Acción especial: inactivar / activar
  if (body.accion === 'inactivar' || body.accion === 'activar') {
    if (session.user.rol !== 'owner') {
      return Response.json({ error: 'Solo el administrador puede cambiar el estado' }, { status: 403 })
    }
    const { id: cid } = await params
    const cl = await obtenerCliente(cid, session)
    if (!cl) return Response.json({ error: 'Cliente no encontrado' }, { status: 404 })

    const nuevoEstado = body.accion === 'inactivar' ? 'inactivo' : 'activo'
    const actualizado = await prisma.cliente.update({
      where: { id: cid },
      data: { estado: nuevoEstado },
    })
    return Response.json(actualizado)
  }

  const { nombre, cedula, telefono, direccion, referencia, notas, fotoUrl, rutaId, latitud, longitud, diasSinCobro, grupoCobroId } = body

  // Validar días sin cobro
  let diasSinCobroVal
  try {
    diasSinCobroVal = diasSinCobro !== undefined ? validarDiasSinCobro(diasSinCobro) : undefined
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }

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

  // Resolver coordenadas
  let lat = latitud !== undefined ? latitud : undefined
  let lng = longitud !== undefined ? longitud : undefined

  // Si se envía grupoCobroId, validar que pertenece a la organización
  if (grupoCobroId !== undefined && grupoCobroId !== null && grupoCobroId !== '') {
    const grupo = await prisma.grupoCobro.findFirst({
      where: { id: grupoCobroId, organizationId: session.user.organizationId },
      select: { id: true },
    })
    if (!grupo) {
      return Response.json({ error: 'Grupo de cobro no válido' }, { status: 400 })
    }
  }

  // Si se cambió dirección pero no se enviaron coords, geocodificar
  if (lat === undefined && lng === undefined && direccion !== undefined && direccion?.trim()) {
    const geo = await geocodeAddress(direccion.trim())
    if (geo) { lat = geo.lat; lng = geo.lng }
  }

  const actualizado = await prisma.cliente.update({
    where: { id },
    data: {
      ...(nombre     && { nombre:     nombre.trim()     }),
      ...(cedula     && { cedula:     cedula.trim()     }),
      ...(telefono   && { telefono:   telefono.trim()   }),
      ...(direccion  !== undefined && { direccion:  direccion?.trim()  || null }),
      ...(referencia !== undefined && { referencia: referencia?.trim() || null }),
      ...(notas      !== undefined && { notas:      notas?.trim()      || null }),
      ...(fotoUrl    !== undefined && { fotoUrl:    fotoUrl?.trim() && /^https?:\/\/.+/i.test(fotoUrl.trim()) ? fotoUrl.trim() : null }),
      ...(rutaId        !== undefined && { rutaId:        rutaId        || null }),
      ...(grupoCobroId !== undefined && { grupoCobroId: grupoCobroId || null }),
      ...(lat          !== undefined && { latitud:    lat }),
      ...(lng          !== undefined && { longitud:   lng }),
      ...(diasSinCobroVal !== undefined && { diasSinCobro: diasSinCobroVal }),
    },
  })

  logActividad({ session, accion: 'editar_cliente', entidadTipo: 'cliente', entidadId: id, detalle: `Cliente ${actualizado.nombre} editado`, ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() })
  return Response.json(actualizado)
}

// ─── DELETE /api/clientes/[id] ────────────────────────────────────
// Soft delete: marca como eliminado. Solo owner.
// Si tiene préstamos, devuelve la lista para que el usuario decida (trasladar o eliminar).
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede eliminar clientes' }, { status: 403 })
  }

  const { id } = await params

  const cliente = await prisma.cliente.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      prestamos: {
        select: { id: true, montoPrestado: true, totalAPagar: true, estado: true, pagos: { select: { montoPagado: true, tipo: true } } },
      },
    },
  })

  if (!cliente) {
    return Response.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  // Verificar si tiene préstamos
  if (cliente.prestamos.length > 0) {
    const prestamosInfo = cliente.prestamos.map(p => {
      const totalPagado = p.pagos.filter(pago => !['recargo', 'descuento'].includes(pago.tipo)).reduce((sum, pago) => sum + pago.montoPagado, 0)
      return {
        id: p.id,
        montoPrestado: p.montoPrestado,
        totalAPagar: p.totalAPagar,
        totalPagado,
        saldoPendiente: p.totalAPagar - totalPagado,
        estado: p.estado,
      }
    })

    return Response.json({
      error: 'tiene_prestamos',
      message: 'Este cliente tiene préstamos asignados',
      prestamos: prestamosInfo,
    }, { status: 409 })
  }

  // Sin préstamos: soft delete
  await prisma.cliente.update({
    where: { id },
    data: { estado: 'eliminado', eliminadoEn: new Date(), rutaId: null },
  })

  logActividad({ session, accion: 'eliminar_cliente', entidadTipo: 'cliente', entidadId: id, detalle: `Cliente ${cliente.nombre} eliminado`, ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() })
  return Response.json({ ok: true, message: 'Cliente eliminado' })
}

// ─── PATCH /api/clientes/[id]/inactivar ───────────────────────────
// Se maneja desde el mismo PATCH con body { accion: 'inactivar' | 'activar' }
// (ver lógica en PATCH arriba - se agrega soporte)
