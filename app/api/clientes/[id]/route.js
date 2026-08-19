// app/api/clientes/[id]/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { calcularDiasMora, calcularSaldoPendiente, calcularPorcentajePagado, calcularProximoCobro, calcularEstadoCliente } from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import { logActividad } from '@/lib/activity-log'
import { geocodeAddress }   from '@/lib/geocoding'
import { validarDiasSinCobro } from '@/lib/dias-sin-cobro'
import { getCachedMutation, setCachedMutation, buildMutationKey } from '@/lib/mutation-idempotency'
import { validateDocument, getDocumentConfig } from '@/lib/i18n'

// Helper: verificar que el cliente pertenece a la organización (y a la ruta del cobrador)
async function obtenerCliente(id, session) {
  const cliente = await prisma.cliente.findFirst({
    where: { id, organizationId: session.user.organizationId },
  })
  if (!cliente) return null
  if (session.user.rol === 'cobrador') {
    const enSusRutas = (session.user.rutaIds ?? []).includes(cliente.rutaId)
    const loCreoEl = cliente.creadoPorId === session.user.id
    if (!enSusRutas && !loCreoEl) return null
  }
  return cliente
}

// ─── GET /api/clientes/[id] ─────────────────────────────────────
export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params

  try {
    const clienteBase = await obtenerCliente(id, session)
    if (!clienteBase) {
      return Response.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    // Obtener cliente completo con préstamos y pagos
    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: {
        ruta: { select: { id: true, nombre: true, diasSinCobro: true } },
        creadoPor: { select: { id: true, nombre: true } },
        prestamos: {
          orderBy: { createdAt: 'desc' },
          include: {
            /* ⚠ SIN ESTO UN PRÉSTAMO ABIERTO SALE «AL DÍA» SIEMPRE: su mora es el
               interés devengado sin pagar, y un campo que no se pide vale `undefined`
               —no da error, decide en silencio—. Ver lib/dinero/devengar.js. */
            devengos: { select: { periodo: true, interes: true } },
            cuotasAmortizacion: {
              orderBy: { numeroPeriodo: 'asc' },
              select: { numeroPeriodo: true, capital: true, interes: true, cuotaTotal: true, saldoRestante: true, pagado: true, interesPagado: true, fechaEsperada: true },
            },
            pagos: {
              orderBy: { fechaPago: 'desc' },
              select: { id: true, montoPagado: true, fechaPago: true, tipo: true, nota: true },
            },
          },
        },
        lineasCredito: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            cupoMaximo: true,
            tasaInteres: true,
            modoInteres: true,
            diaCorte: true,
            estado: true,
            createdAt: true,
            desembolsos: { select: { monto: true } },
            pagosLinea: { select: { montoACapital: true } },
          },
        },
      },
    })

    // Resolver días sin cobro y festivos
    const [org, festivos] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: session.user.organizationId },
        select: { diasSinCobro: true },
      }),
      prisma.festivo.findMany({
        where: { organizationId: session.user.organizationId },
        select: { fecha: true },
      }),
    ])

    // Enriquecer préstamos con cálculos. Si alguno falla, devolver el prestamo
    // sin enriquecer en lugar de tirar 500 (para que el cliente no se quede
    // sin poder abrir la pagina por un edge case en un solo prestamo).
    const prestamosEnriquecidos = cliente.prestamos.map((p) => {
      try {
        // diasSinCobro se resuelve por préstamo (máxima prioridad en jerarquía)
        const diasExcluidos = obtenerDiasSinCobro(cliente, cliente.ruta, org, p)
        return {
          ...p,
          diasMora:            calcularDiasMora(p, diasExcluidos, festivos),
          saldoPendiente:      calcularSaldoPendiente(p),
          porcentajePagado:    calcularPorcentajePagado(p),
          proximoCobro:        calcularProximoCobro(p, diasExcluidos, festivos),
        }
      } catch (err) {
        console.error(`[GET /api/clientes/${id}] error enriqueciendo prestamo ${p.id}:`, err)
        return {
          ...p,
          diasMora:         0,
          saldoPendiente:   p.totalAPagar ?? 0,
          porcentajePagado: 0,
          proximoCobro:     null,
          _enriqueceError:  true,
        }
      }
    })

    const lineasEnriquecidas = (cliente.lineasCredito || []).map(lc => {
      const totalDesembolsado = (lc.desembolsos || []).reduce((s, d) => s + d.monto, 0)
      const totalPagadoCapital = (lc.pagosLinea || []).reduce((s, p) => s + p.montoACapital, 0)
      const capitalUsado = totalDesembolsado - totalPagadoCapital
      const cupoDisponible = Math.max(0, lc.cupoMaximo - capitalUsado)
      return { ...lc, capitalUsado, cupoDisponible, desembolsos: undefined, pagosLinea: undefined }
    })

    // Para calcularEstadoCliente usamos diasExcluidos a nivel cliente (sin prestamo)
    const diasExcluidos = obtenerDiasSinCobro(cliente, cliente.ruta, org)
    let estadoCalculado
    try {
      estadoCalculado = calcularEstadoCliente(cliente.prestamos, diasExcluidos, festivos)
    } catch (err) {
      console.error(`[GET /api/clientes/${id}] error calculando estado:`, err)
      estadoCalculado = cliente.estado || 'activo'
    }

    return Response.json({ ...cliente, estado: estadoCalculado, prestamos: prestamosEnriquecidos, lineasCredito: lineasEnriquecidas })
  } catch (err) {
    console.error(`[GET /api/clientes/${id}] error fatal:`, err)
    return Response.json({ error: 'Error interno al cargar el cliente', detalle: err?.message }, { status: 500 })
  }
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

  // Idempotencia: si viene X-Mutation-Id y ya procesamos esta mutacion, devolver cache
  const mutationId = request.headers.get('x-mutation-id')
  const idempKey = mutationId ? buildMutationKey(session, mutationId, id) : null
  if (idempKey) {
    const cached = getCachedMutation(idempKey)
    if (cached) return Response.json(cached)
  }

  const clienteBase = await obtenerCliente(id, session)
  if (!clienteBase) {
    return Response.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  // Deteccion de conflicto por timestamp (mutaciones offline).
  const ifUnmodifiedSince = request.headers.get('x-if-unmodified-since')
  if (ifUnmodifiedSince && clienteBase.updatedAt) {
    const baseMs = Date.parse(ifUnmodifiedSince)
    const actualMs = new Date(clienteBase.updatedAt).getTime()
    if (!isNaN(baseMs) && actualMs > baseMs + 1000) {
      return Response.json({ error: 'Conflicto: el registro fue modificado en el servidor.' }, { status: 412 })
    }
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

    // Inactivar con préstamos ACTIVOS dejaba el capital "fantasma" (el préstamo seguía
    // vivo pero el cliente fuera de los conteos). Bloquear igual que el DELETE: el usuario
    // debe eliminar o trasladar los préstamos primero (eliminar devuelve el capital).
    if (nuevoEstado === 'inactivo') {
      const prestamosActivos = await prisma.prestamo.findMany({
        where: { clienteId: cid, estado: 'activo' },
        select: { id: true, montoPrestado: true, totalAPagar: true, pagos: { select: { montoPagado: true, tipo: true } } },
      })
      if (prestamosActivos.length > 0) {
        const prestamosInfo = prestamosActivos.map((p) => {
          const totalPagado = p.pagos.filter((pg) => !['recargo', 'descuento'].includes(pg.tipo)).reduce((s, pg) => s + pg.montoPagado, 0)
          return {
            id: p.id,
            montoPrestado: p.montoPrestado,
            totalAPagar: p.totalAPagar,
            totalPagado,
            saldoPendiente: p.totalAPagar - totalPagado,
            estado: 'activo',
          }
        })
        return Response.json({
          error: 'tiene_prestamos',
          message: 'Este cliente tiene préstamos activos. Elimínalos o trasládalos antes de inactivarlo.',
          prestamos: prestamosInfo,
        }, { status: 409 })
      }
    }

    const actualizado = await prisma.cliente.update({
      where: { id: cid },
      data: { estado: nuevoEstado },
    })
    return Response.json(actualizado)
  }

  const { nombre, cedula, telefono, direccion, referencia, notas, fotoUrl, rutaId, latitud, longitud, diasSinCobro, montoMaximoPrestamo, camposRecibo } = body

  if (montoMaximoPrestamo !== undefined) {
    if (session.user.rol !== 'owner') {
      return Response.json({ error: 'Solo el administrador puede modificar el tope de prestamo' }, { status: 403 })
    }
    const tope = Number(montoMaximoPrestamo)
    if (montoMaximoPrestamo !== null && montoMaximoPrestamo !== '' && (!Number.isFinite(tope) || tope < 0)) {
      return Response.json({ error: 'El tope de prestamo no puede ser negativo' }, { status: 400 })
    }
  }

  // Validar días sin cobro
  let diasSinCobroVal
  try {
    diasSinCobroVal = diasSinCobro !== undefined ? validarDiasSinCobro(diasSinCobro) : undefined
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }

  // Si cambia la cédula, verificar que no exista otra igual
  //
  // ⚠ EL MARCADOR «SIN-…» NO ES UNA CÉDULA Y NO SE VALIDA COMO TAL.
  //
  // Cuando un cliente se crea sin documento —que ahora es lo normal: solo el
  // nombre es obligatorio— se le guarda un marcador `SIN-m3k9x2ab` para que la
  // clave única de la organización siga funcionando. Al crear, el POST ya lo
  // sabía (`esSinCedula`, en `app/api/clientes/route.js`). Aquí no.
  //
  // Resultado: EDITAR a uno de esos clientes era imposible. El formulario
  // manda otro marcador, este bloque lo ve distinto del guardado, se lo pasa a
  // `validateDocument`, y devuelve «Cédula no válido (ej: 1023456789)» —un
  // error sobre un campo que la pantalla de edición NI SIQUIERA MUESTRA, así
  // que quien lo recibe no tiene nada que corregir: cambia la dirección, pulsa
  // guardar y le sale un problema de cédula—.
  //
  // Medido contra producción: **1.574 de 6.012 clientes vivos (26%) en 86
  // negocios** no se podían editar. No es un caso raro; es una cuarta parte de
  // la cartera.
  const esSinCedula = !!cedula && cedula.trim().startsWith('SIN-')
  if (cedula && !esSinCedula && cedula.trim() !== clienteBase.cedula) {
    const country = session.user.country ?? 'co'
    const docConfig = getDocumentConfig(country)
    if (!validateDocument(cedula.trim(), country)) {
      return Response.json({ error: `${docConfig.label} no válido (ej: ${docConfig.placeholder})` }, { status: 400 })
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

  // Validar cambios de ruta: owner puede reasignar (si existe en su org);
  // cobrador con permiso puede editar campos del cliente, pero no cambiar su ruta.
  if (rutaId !== undefined) {
    if (session.user.rol !== 'owner' && rutaId !== clienteBase.rutaId) {
      return Response.json({ error: 'Solo el administrador puede cambiar la ruta' }, { status: 403 })
    }

    if (session.user.rol === 'owner' && rutaId) {
      const rutaValida = await prisma.ruta.findFirst({
        where: { id: rutaId, organizationId: session.user.organizationId },
        select: { id: true },
      })
      if (!rutaValida) {
        return Response.json({ error: 'Ruta no válida' }, { status: 400 })
      }
    }
  }

  // Si se cambió dirección pero no se enviaron coords, geocodificar
  if (lat === undefined && lng === undefined && direccion !== undefined && direccion?.trim()) {
    const geo = await geocodeAddress(direccion.trim())
    if (geo) { lat = geo.lat; lng = geo.lng }
  }

  /* Y el marcador tampoco SE REESCRIBE. El formulario acuña uno nuevo en cada
     guardado, así que la «cédula» del cliente cambiaba sola cada vez que se le
     tocaba la dirección. Se queda el que ya tenía: es una llave interna, no un
     dato del cliente, y nada gana con rotar.
     (El formulario también deja de acuñarlo, pero la PWA sirve el paquete
      viejo hasta que refresque: esta es la mitad que lo corta hoy.) */
  const conservaMarcador = esSinCedula && clienteBase.cedula?.startsWith('SIN-')

  const actualizado = await prisma.cliente.update({
    where: { id },
    data: {
      ...(nombre     && { nombre:     nombre.trim()     }),
      ...(cedula && !conservaMarcador && { cedula: cedula.trim() }),
      ...(telefono   && { telefono:   telefono.trim()   }),
      ...(direccion  !== undefined && { direccion:  direccion?.trim()  || null }),
      ...(referencia !== undefined && { referencia: referencia?.trim() || null }),
      ...(notas      !== undefined && { notas:      notas?.trim()      || null }),
      ...(fotoUrl    !== undefined && { fotoUrl:    fotoUrl?.trim() && /^https?:\/\/.+/i.test(fotoUrl.trim()) ? fotoUrl.trim() : null }),
      ...(rutaId        !== undefined && { rutaId:        rutaId        || null }),
      ...(lat          !== undefined && { latitud:    lat }),
      ...(lng          !== undefined && { longitud:   lng }),
      ...(diasSinCobroVal !== undefined && { diasSinCobro: diasSinCobroVal }),
      ...(montoMaximoPrestamo !== undefined && session.user.rol === 'owner' && {
        montoMaximoPrestamo: (!montoMaximoPrestamo && montoMaximoPrestamo !== 0) ? null : Number(montoMaximoPrestamo) || null,
      }),
      ...(camposRecibo !== undefined && {
        camposRecibo: Array.isArray(camposRecibo) ? camposRecibo.slice(0, 10) : null,
      }),
    },
  })

  logActividad({ session, accion: 'editar_cliente', entidadTipo: 'cliente', entidadId: id, detalle: `Cliente ${actualizado.nombre} editado`, ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() })
  if (idempKey) setCachedMutation(idempKey, actualizado)
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
        // Solo los ACTIVOS bloquean el borrado (los completados/cancelados no descuadran).
        where: { estado: 'activo' },
        select: { id: true, montoPrestado: true, totalAPagar: true, estado: true, pagos: { select: { montoPagado: true, tipo: true } } },
      },
    },
  })

  if (!cliente) {
    return Response.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  // Verificar si tiene préstamos activos
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
