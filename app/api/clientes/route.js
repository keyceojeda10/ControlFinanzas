// app/api/clientes/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { LIMITES_PLAN, calcularEstadoCliente, calcularDiasMora, calcularSaldoPendiente, calcularPorcentajePagado, calcularProximoCobro, formatFechaCobroContextual } from '@/lib/calculos'
import { obtenerDiasSinCobro, validarDiasSinCobro } from '@/lib/dias-sin-cobro'
import { logActividad } from '@/lib/activity-log'
import { geocodeAddress }   from '@/lib/geocoding'
import { trackEvent } from '@/lib/analytics'
import { getUtcOffset, validateDocument, getDocumentConfig } from '@/lib/i18n'
import { bloquearSiSuscripcionVencida } from '@/lib/suscripcion'

// ─── GET /api/clientes ──────────────────────────────────────────
export async function GET(request) {
  try {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const buscar = searchParams.get('buscar')?.trim() ?? ''
  const grupo = searchParams.get('grupo')?.trim() ?? ''
  const rutaIdFiltro = searchParams.get('rutaId')?.trim() ?? ''
  const page = searchParams.get('page') ? Number(searchParams.get('page')) : null
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 100)

  const { organizationId, rol, rutaIds = [] } = session.user

  // Cobrador sin rutas asignadas no ve nada (previene fuga multi-tenant)
  if (rol === 'cobrador' && rutaIds.length === 0) {
    return Response.json(page != null ? { clientes: [], total: 0, page, totalPages: 0 } : [])
  }

  // Cobrador → clientes de sus rutas + clientes sin ruta que el cobrador creó.
  // Owner puede filtrar por ruta específica.
  const filtroRuta = rol === 'cobrador'
    ? { OR: [{ rutaId: { in: rutaIds } }, { rutaId: null, creadoPorId: session.user.id }] }
    : (rutaIdFiltro ? { rutaId: rutaIdFiltro } : {})

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

  const filtroGrupo = grupo
    ? (grupo === '_none' ? { grupoCobroId: null } : { grupoCobroId: grupo })
    : {}

  const condiciones = [
    { organizationId },
    { estado: { notIn: ['eliminado'] } },
  ]
  if (Object.keys(filtroRuta).length) condiciones.push(filtroRuta)
  if (Object.keys(filtroBuscar).length) condiciones.push(filtroBuscar)
  if (Object.keys(filtroGrupo).length) condiciones.push(filtroGrupo)

  const whereClause = { AND: condiciones }

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
      fotoUrl:    true,
      createdAt:  true,
      diasSinCobro: true,
      montoMaximoPrestamo: true,
      ruta:       { select: { id: true, nombre: true, diasSinCobro: true } },
      grupoCobro: { select: { id: true, nombre: true, color: true } },
      prestamos: {
        where:  { estado: 'activo' },
        select: {
          id: true,
          estado: true,
          fechaInicio: true,
          fechaFin: true,
          cuotaDiaria: true,
          diasPlazo: true,
          frecuencia: true,
          totalAPagar: true,
          montoPrestado: true,
          modoInteres: true,
          diaCobroMes: true,
          diaCobroSemana: true,
          createdAt: true,
          // Denormalizados: evitan iterar todos los pagos.
          totalPagado: true,
          ultimoPagoAt: true,
          cuotasAmortizacion: {
            select: { numeroPeriodo: true, cuotaTotal: true, interes: true, capital: true, pagado: true, interesPagado: true, fechaEsperada: true },
            orderBy: { numeroPeriodo: 'asc' },
          },
        },
      },
      lineasCredito: {
        where: { estado: 'activa' },
        select: { id: true },
      },
      ...(rol !== 'cobrador' && { creadoPor: { select: { id: true, nombre: true } } }),
    },
    orderBy: [{ ordenRuta: 'asc' }, { nombre: 'asc' }],
    ...(page != null && { take: limit, skip: (page - 1) * limit }),
  })

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { diasSinCobro: true },
  })

  // Inicio del dia hoy en hora Colombia para detectar pagoHoy
  const country = session.user.country ?? 'co'
  const hoyCO = new Date(Date.now() - Math.abs(getUtcOffset(country)) * 60 * 60 * 1000)
  const inicioHoyUTC = new Date(Date.UTC(hoyCO.getUTCFullYear(), hoyCO.getUTCMonth(), hoyCO.getUTCDate(), 5, 0, 0))

  // Cachear diasExcluidos por cliente (era N+1 antes).
  const diasExcluidosCache = new Map()
  const getDiasExcluidos = (cliente) => {
    if (!cliente?.id) return obtenerDiasSinCobro(cliente, cliente?.ruta, org)
    if (!diasExcluidosCache.has(cliente.id)) {
      diasExcluidosCache.set(cliente.id, obtenerDiasSinCobro(cliente, cliente?.ruta, org))
    }
    return diasExcluidosCache.get(cliente.id)
  }

  // Recalcular estado real del cliente y enriquecer con datos para la card.
  const resultado = clientes.map((c) => {
    const diasExcluidos = getDiasExcluidos(c)
    let saldoTotal = 0
    let totalAPagarSum = 0
    let diasMoraMax = 0
    let pagoHoy = false
    let proximoCobroMin = null

    for (const p of c.prestamos) {
      try { saldoTotal += calcularSaldoPendiente(p) } catch {}
      totalAPagarSum += (p.totalAPagar ?? 0)
      try {
        const dm = calcularDiasMora(p, diasExcluidos)
        if (dm > diasMoraMax) diasMoraMax = dm
      } catch {}
      // Pago hoy: ultimoPagoAt denormalizado evita iterar todos los pagos.
      if (!pagoHoy && p.ultimoPagoAt && new Date(p.ultimoPagoAt) >= inicioHoyUTC) {
        pagoHoy = true
      }
      // Proximo cobro: tomar el mas cercano de todos los prestamos activos
      try {
        const prox = calcularProximoCobro(p, diasExcluidos)
        if (prox && (!proximoCobroMin || prox < proximoCobroMin)) proximoCobroMin = prox
      } catch {}
    }

    const porcentajePagadoPromedio = totalAPagarSum > 0
      ? Math.round(((totalAPagarSum - saldoTotal) / totalAPagarSum) * 100)
      : 0

    return {
      id:               c.id,
      nombre:           c.nombre,
      cedula:           c.cedula,
      telefono:         c.telefono,
      referencia:       c.referencia,
      fotoUrl:          c.fotoUrl ?? null,
      estado:           calcularEstadoCliente(c.prestamos, diasExcluidos),
      rutaId:           c.rutaId,
      rutaNombre:       c.ruta?.nombre ?? null,
      grupoCobro:       c.grupoCobro ?? null,
      prestamosActivos: c.prestamos.length,
      lineasCreditoActivas: c.lineasCredito?.length ?? 0,
      creadoPor:        c.creadoPor ?? null,
      createdAt:        c.createdAt,
      // Actividad reciente del cliente: MAX(createdAt cliente, prestamos.createdAt).
      // Los pagos NO mueven la posicion — solo un prestamo nuevo (o cliente nuevo) sube.
      _actividadAt:     (() => {
        let max = new Date(c.createdAt).getTime()
        for (const p of c.prestamos) {
          const tc = p.createdAt ? new Date(p.createdAt).getTime() : 0
          if (tc > max) max = tc
        }
        return max
      })(),
      // Nuevos campos para card rediseñada
      saldoPendienteTotal:       saldoTotal,
      diasMoraMax,
      pagoHoy,
      porcentajePagadoPromedio,
      proximoCobroLabel: proximoCobroMin ? formatFechaCobroContextual(proximoCobroMin, diasMoraMax) : null,
    }
  })

  // Reordenar por actividad reciente del cliente. Tie-break: createdAt cliente desc.
  resultado.sort((a, b) => {
    if (a._actividadAt !== b._actividadAt) return b._actividadAt - a._actividadAt
    return new Date(b.createdAt) - new Date(a.createdAt)
  })
  for (const c of resultado) delete c._actividadAt

  // If paginated, return object with total; otherwise array for backward compat
  if (page != null) {
    const total = await prisma.cliente.count({ where: whereClause })
    return Response.json({ clientes: resultado, total, page, totalPages: Math.ceil(total / limit) })
  }
  return Response.json(resultado)
  } catch (err) {
    console.error('[GET /api/clientes]', err)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ─── POST /api/clientes ─────────────────────────────────────────
export async function POST(request) {
  try {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  const bloqueoSub = await bloquearSiSuscripcionVencida(session)
  if (bloqueoSub) return bloqueoSub
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
      autoRutaId = (session.user.rutaIds ?? [])[0] || session.user.rutaId || null
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
  const { nombre, cedula, telefono, direccion, referencia, notas, fotoUrl, rutaId, latitud, longitud, grupoCobroId, diasSinCobro, posicionEnRuta } = body

  let diasSinCobroVal
  try {
    diasSinCobroVal = diasSinCobro !== undefined ? validarDiasSinCobro(diasSinCobro) : undefined
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }

  // Validaciones básicas
  if (!nombre?.trim())   return Response.json({ error: 'El nombre es requerido' },  { status: 400 })
  if (!cedula?.trim())   return Response.json({ error: 'La cédula es requerida' },  { status: 400 })
  if (!telefono?.trim()) return Response.json({ error: 'El teléfono es requerido' }, { status: 400 })

  const country = session.user.country ?? 'co'
  const docConfig = getDocumentConfig(country)
  if (!validateDocument(cedula.trim(), country)) {
    return Response.json({ error: `${docConfig.label} no válido (ej: ${docConfig.placeholder})` }, { status: 400 })
  }

  // Verificar cédula única en la organización
  const existe = await prisma.cliente.findUnique({
    where: { organizationId_cedula: { organizationId, cedula: cedula.trim() } },
    select: { id: true, estado: true },
  })
  if (existe) {
    // Si el cliente fue eliminado (soft-delete), reactivarlo con los datos nuevos
    if (existe.estado === 'eliminado') {
      const reactivado = await prisma.cliente.update({
        where: { id: existe.id },
        data: {
          nombre:     nombre.trim(),
          telefono:   telefono.trim(),
          direccion:  direccion?.trim()  || null,
          referencia: referencia?.trim()  || null,
          notas:      notas?.trim()      || null,
          fotoUrl:    fotoUrl?.trim() && /^https?:\/\/.+/i.test(fotoUrl.trim()) ? fotoUrl.trim() : null,
          rutaId:     rutaId || null,
          grupoCobroId: grupoCobroId || null,
          estado:     'activo',
          eliminadoEn: null,
        },
      })
      logActividad({ session, accion: 'reactivar_cliente', entidadTipo: 'cliente', entidadId: reactivado.id, detalle: `Cliente reactivado ${nombre.trim()} (${cedula.trim()})`, ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() })
      trackEvent({ organizationId, userId: session.user.id, evento: 'reactivar_cliente' })
      return Response.json(reactivado, { status: 201 })
    }
    // Devolver existingId permite al sync offline mapear su tempId al cliente
    // que ya existía (p.ej. el mismo cobrador creó el cliente desde otra sesión).
    return Response.json(
      { error: 'Ya existe un cliente con esa cédula', existingId: existe.id },
      { status: 409 }
    )
  }

  // Si se envía rutaId, verificar que pertenece a la organización.
  // Para cobradores, ademas debe ser una de sus rutas asignadas.
  if (rutaId) {
    const ruta = await prisma.ruta.findFirst({
      where: { id: rutaId, organizationId },
    })
    if (!ruta) {
      return Response.json({ error: 'Ruta no válida' }, { status: 400 })
    }
    if (session.user.rol === 'cobrador' && !(session.user.rutaIds ?? []).includes(rutaId)) {
      return Response.json({ error: 'Solo puedes crear clientes en tus rutas asignadas' }, { status: 403 })
    }
  }

  // Si se envía grupoCobroId, verificar que pertenece a la organización
  if (grupoCobroId) {
    const grupo = await prisma.grupoCobro.findFirst({
      where: { id: grupoCobroId, organizationId },
      select: { id: true },
    })
    if (!grupo) {
      return Response.json({ error: 'Grupo de cobro no válido' }, { status: 400 })
    }
  }

  // Resolver coordenadas: GPS directo > geocodificación de dirección
  let lat = latitud ?? null
  let lng = longitud ?? null
  if (lat == null && lng == null && direccion?.trim()) {
    const geo = await geocodeAddress(direccion.trim())
    if (geo) { lat = geo.lat; lng = geo.lng }
  }

  const rutaFinal = rutaId || autoRutaId || null
  let ordenRutaFinal = null

  if (rutaFinal && posicionEnRuta) {
    // Calcular el ordenRuta según la posición solicitada
    await prisma.$transaction(async (tx) => {
      const clientesRuta = await tx.cliente.findMany({
        where: { rutaId: rutaFinal, organizationId },
        select: { id: true, ordenRuta: true },
        orderBy: { ordenRuta: 'asc' },
      })

      if (posicionEnRuta === 'inicio') {
        // Desplazar todos +1 y poner el nuevo en 0
        for (const c of clientesRuta) {
          await tx.cliente.update({
            where: { id: c.id },
            data: { ordenRuta: (c.ordenRuta ?? 0) + 1 },
          })
        }
        ordenRutaFinal = 0
      } else if (posicionEnRuta === 'final') {
        const max = clientesRuta.reduce((m, c) => Math.max(m, c.ordenRuta ?? 0), -1)
        ordenRutaFinal = max + 1
      } else {
        // posicionEnRuta es un clienteId → insertar después de ese cliente
        const idx = clientesRuta.findIndex(c => c.id === posicionEnRuta)
        if (idx >= 0) {
          const ordenDespuesDe = clientesRuta[idx].ordenRuta ?? 0
          // Desplazar los que están después
          for (const c of clientesRuta) {
            if ((c.ordenRuta ?? 0) > ordenDespuesDe) {
              await tx.cliente.update({
                where: { id: c.id },
                data: { ordenRuta: (c.ordenRuta ?? 0) + 1 },
              })
            }
          }
          ordenRutaFinal = ordenDespuesDe + 1
        } else {
          // Cliente referencia no encontrado, poner al final
          const max = clientesRuta.reduce((m, c) => Math.max(m, c.ordenRuta ?? 0), -1)
          ordenRutaFinal = max + 1
        }
      }
    })
  } else if (rutaFinal) {
    // Sin posición explícita: poner al final
    const maxOrden = await prisma.cliente.aggregate({
      where: { rutaId: rutaFinal, organizationId },
      _max: { ordenRuta: true },
    })
    ordenRutaFinal = (maxOrden._max.ordenRuta ?? -1) + 1
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
      rutaId:     rutaFinal,
      grupoCobroId: grupoCobroId || null,
      latitud:    lat,
      longitud:   lng,
      creadoPorId: session.user.id,
      ...(diasSinCobroVal !== undefined && { diasSinCobro: diasSinCobroVal }),
      ...(ordenRutaFinal != null && { ordenRuta: ordenRutaFinal }),
    },
  })

  if (session.user.rol === 'cobrador') {
    const owners = await prisma.user.findMany({
      where: { organizationId, rol: 'owner' },
      select: { id: true },
    })
    for (const o of owners) {
      await prisma.notificacion.create({
        data: {
          organizationId,
          userId: o.id,
          tipo: 'cliente_creado_por_cobrador',
          titulo: 'Nuevo cliente registrado',
          mensaje: `${session.user.name || 'Un cobrador'} registró al cliente ${nombre.trim()} (${cedula.trim()})`,
          datos: JSON.stringify({ clienteId: cliente.id, cobradorId: session.user.id, cobradorNombre: session.user.name }),
        },
      })
    }
  }

  logActividad({ session, accion: 'crear_cliente', entidadTipo: 'cliente', entidadId: cliente.id, detalle: `Cliente ${nombre.trim()} (${cedula.trim()})`, ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() })
  trackEvent({ organizationId, userId: session.user.id, evento: 'crear_cliente' })
  return Response.json(cliente, { status: 201 })
  } catch (err) {
    console.error('[POST /api/clientes]', err)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
