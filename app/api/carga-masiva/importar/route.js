// app/api/carga-masiva/importar/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { calcularPrestamo } from '@/lib/calculos'
import { agruparPorCliente } from '@/lib/carga-masiva'
import { registrarMovimientoCapital } from '@/lib/capital'
import { logActividad }     from '@/lib/activity-log'
import { trackEvent }       from '@/lib/analytics'
import { LIMITES_PLAN }     from '@/lib/planes'

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (session.user.rol !== 'owner') {
      return Response.json({ error: 'Solo el administrador puede importar datos' }, { status: 403 })
    }

    const { organizationId, plan } = session.user
    const { filas, rutaId, crearRuta } = await request.json()

    if (!Array.isArray(filas) || filas.length === 0) {
      return Response.json({ error: 'No hay datos para importar' }, { status: 400 })
    }
    if (filas.length > 500) {
      return Response.json({ error: 'Máximo 500 filas por importación' }, { status: 400 })
    }

    // Agrupar por cédula (múltiples préstamos por cliente)
    // filas ya viene como array de { datos, calculado, ... } del frontend (post-validación)
    // Pero también soportamos filas planas si vienen directas
    const filasNormalizadas = filas.map((f, i) => ({
      indice: i,
      estado: 'valido',
      datos: f.datos || f,
      calculado: f.calculado || null,
    }))
    const grupos = agruparPorCliente(filasNormalizadas)

    // Verificar límite del plan
    const clientesActuales = await prisma.cliente.count({
      where: { organizationId, estado: { notIn: ['eliminado'] } },
    })
    const cedulasExistentesDB = await prisma.cliente.findMany({
      where: { organizationId, cedula: { in: [...grupos.keys()] } },
      select: { cedula: true, id: true },
    })
    const cedulaToId = new Map(cedulasExistentesDB.map(c => [c.cedula, c.id]))

    const clientesNuevos = [...grupos.keys()].filter(c => !cedulaToId.has(c)).length
    const limiteClientes = LIMITES_PLAN[plan] ?? 50
    if (clientesActuales + clientesNuevos > limiteClientes) {
      return Response.json({
        error: `Excede el límite de tu plan (${limiteClientes} clientes). Tienes ${clientesActuales}, intentas agregar ${clientesNuevos} nuevos.`,
      }, { status: 403 })
    }

    // Resolver ruta
    let rutaFinal = rutaId || null
    if (crearRuta && typeof crearRuta === 'string' && crearRuta.trim()) {
      const nuevaRuta = await prisma.ruta.create({
        data: { organizationId, nombre: crearRuta.trim() },
      })
      rutaFinal = nuevaRuta.id
    }

    // Importar por cliente (agrupado)
    let clientesCreados = 0
    let prestamosCreados = 0
    let pagosRegistrados = 0
    let montoDesembolsado = 0
    const errores = []

    for (const [cedula, grupo] of grupos) {
      try {
        await prisma.$transaction(async (tx) => {
          let clienteId = cedulaToId.get(cedula)

          if (clienteId) {
            // Actualizar datos del cliente existente
            await tx.cliente.update({
              where: { id: clienteId },
              data: {
                nombre: grupo.cliente.nombre,
                telefono: grupo.cliente.telefono || undefined,
                direccion: grupo.cliente.direccion || undefined,
                referencia: grupo.cliente.referencia || undefined,
                rutaId: rutaFinal || undefined,
                estado: 'activo',
              },
            })
          } else {
            const nuevoCliente = await tx.cliente.create({
              data: {
                organizationId,
                nombre: grupo.cliente.nombre,
                cedula: grupo.cliente.cedula,
                telefono: grupo.cliente.telefono || null,
                direccion: grupo.cliente.direccion || null,
                referencia: grupo.cliente.referencia || null,
                rutaId: rutaFinal,
                estado: 'activo',
              },
            })
            clienteId = nuevoCliente.id
            clientesCreados++
          }

          // Crear cada préstamo del cliente
          for (const p of grupo.prestamos) {
            const { totalAPagar, cuotaDiaria, fechaFin } = calcularPrestamo({
              montoPrestado: p.montoPrestado,
              tasaInteres: p.tasaInteres ?? 0,
              diasPlazo: p.diasPlazo,
              fechaInicio: p.fechaInicio,
              frecuencia: p.frecuencia || 'diario',
            })

            const prestamo = await tx.prestamo.create({
              data: {
                clienteId,
                organizationId,
                montoPrestado: p.montoPrestado,
                tasaInteres: p.tasaInteres ?? 0,
                totalAPagar,
                cuotaDiaria,
                frecuencia: p.frecuencia || 'diario',
                diasPlazo: p.diasPlazo,
                fechaInicio: new Date(p.fechaInicio),
                fechaFin,
              },
            })
            prestamosCreados++
            montoDesembolsado += p.montoPrestado

            await registrarMovimientoCapital(tx, {
              organizationId,
              tipo: 'desembolso',
              monto: p.montoPrestado,
              descripcion: `${p.tipo === 'mercancia' ? 'Mercancía' : 'Desembolso'} (carga masiva) - ${grupo.cliente.nombre}`,
              referenciaId: prestamo.id,
              referenciaTipo: 'prestamo',
              creadoPorId: session.user.id,
            })

            // Abono previo
            const abono = p.abonadoHasta || 0
            if (abono > 0 && abono <= totalAPagar) {
              await tx.pago.create({
                data: {
                  prestamoId: prestamo.id,
                  organizationId,
                  cobradorId: session.user.id,
                  montoPagado: abono,
                  tipo: 'completo',
                  fechaPago: new Date(p.fechaInicio),
                  nota: 'Abono previo (carga masiva)',
                },
              })
              pagosRegistrados++

              await registrarMovimientoCapital(tx, {
                organizationId,
                tipo: 'recaudo',
                monto: abono,
                descripcion: `Abono previo (carga masiva) - ${grupo.cliente.nombre}`,
                referenciaId: prestamo.id,
                referenciaTipo: 'prestamo',
                creadoPorId: session.user.id,
              })
            }
          }
        })
      } catch (err) {
        console.error(`[carga-masiva] Error cédula ${cedula}:`, err.message)
        errores.push({
          cedula,
          nombre: grupo.cliente.nombre,
          prestamos: grupo.prestamos.length,
          error: err.message,
        })
      }
    }

    logActividad({
      session,
      accion: 'carga_masiva',
      entidadTipo: 'cliente',
      detalle: `Carga masiva: ${clientesCreados} clientes, ${prestamosCreados} préstamos${rutaFinal ? ', ruta asignada' : ''}`,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })
    trackEvent({
      organizationId,
      userId: session.user.id,
      evento: 'carga_masiva',
      metadata: { clientesCreados, prestamosCreados, filas: filas.length },
    })

    return Response.json({
      resultado: {
        clientesCreados,
        prestamosCreados,
        pagosRegistrados,
        montoDesembolsado,
        errores,
        totalClientes: grupos.size,
        exitosos: grupos.size - errores.length,
        fallidos: errores.length,
        rutaAsignada: rutaFinal,
      },
    })
  } catch (err) {
    console.error('[POST /api/carga-masiva/importar]', err)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
