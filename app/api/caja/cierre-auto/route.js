// app/api/caja/cierre-auto/route.js - Cierre automático de caja (cron)

import { prisma } from '@/lib/prisma'

const CRON_SECRET = process.env.CRON_SECRET

// Calcula el total esperado del día para un cobrador
async function calcularEsperado(organizationId, cobradorId) {
  const ruta = await prisma.ruta.findFirst({
    where: { organizationId, cobradorId, activo: true },
    select: {
      clientes: {
        select: {
          prestamos: {
            where: { estado: 'activo' },
            select: { cuotaDiaria: true },
          },
        },
      },
    },
  })

  if (!ruta) return 0
  return ruta.clientes.reduce(
    (total, c) => total + c.prestamos.reduce((a, p) => a + p.cuotaDiaria, 0), 0
  )
}

async function calcularDesembolsadoDia(organizationId, cobradorId, fechaInicio, fechaFin) {
  const [prestamosRuta, movimientosCreador, actividadesCreador] = await Promise.all([
    prisma.prestamo.findMany({
      where: {
        organizationId,
        createdAt: { gte: fechaInicio, lte: fechaFin },
        cliente: { ruta: { cobradorId } },
      },
      select: { id: true, montoPrestado: true },
    }),
    prisma.movimientoCapital.findMany({
      where: {
        organizationId,
        tipo: 'desembolso',
        createdAt: { gte: fechaInicio, lte: fechaFin },
        creadoPorId: cobradorId,
        referenciaTipo: 'prestamo',
      },
      select: { referenciaId: true, monto: true },
    }),
    prisma.actividadLog.findMany({
      where: {
        organizationId,
        userId: cobradorId,
        accion: 'crear_prestamo',
        createdAt: { gte: fechaInicio, lte: fechaFin },
      },
      select: { entidadId: true },
    }),
  ])

  const prestamoIdsActividad = actividadesCreador
    .map((a) => a.entidadId)
    .filter((id) => !!id)

  const prestamosActividad = prestamoIdsActividad.length
    ? await prisma.prestamo.findMany({
      where: {
        organizationId,
        id: { in: prestamoIdsActividad },
      },
      select: { id: true, montoPrestado: true },
    })
    : []

  const idsContabilizados = new Set(prestamosRuta.map((p) => p.id))
  let total = prestamosRuta.reduce((acc, p) => acc + p.montoPrestado, 0)

  for (const p of prestamosActividad) {
    if (!idsContabilizados.has(p.id)) {
      total += p.montoPrestado
      idsContabilizados.add(p.id)
    }
  }

  for (const mov of movimientosCreador) {
    if (!mov.referenciaId) {
      total += mov.monto
      continue
    }
    if (!idsContabilizados.has(mov.referenciaId)) {
      total += mov.monto
      idsContabilizados.add(mov.referenciaId)
    }
  }

  return total
}

// Obtiene todos los cierres del día para una organización
async function getCierresDelDia(organizationId, fecha) {
  const inicioDia = new Date(fecha)
  inicioDia.setHours(0, 0, 0, 0)
  const finDia = new Date(fecha)
  finDia.setHours(23, 59, 59, 999)

  return prisma.cierreCaja.findMany({
    where: {
      organizationId,
      fecha: { gte: inicioDia, lte: finDia },
    },
    select: { cobradorId: true },
  })
}

// POST - Ejecuta cierre automático de caja para todas las organizaciones
// Llamar con: curl -X POST -H "x-cron-secret: $CRON_SECRET" https://app.control-finanzas.com/api/caja/cierre-auto
export async function POST(request) {
  const secret = request.headers.get('x-cron-secret')
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    // Obtener la fecha de ayer en Colombia (UTC-5)
    // Si son las 5:00 AM UTC, en Colombia son las 12:00 AM (medianoche)
    const now = new Date()
    const colombiaNow = new Date(now.getTime() - 5 * 60 * 60 * 1000)
    
    // El cierre es del día anterior
    const fechaCierre = new Date(colombiaNow)
    fechaCierre.setDate(fechaCierre.getDate() - 1)
    fechaCierre.setHours(0, 0, 0, 0)

    const fechaCierreFin = new Date(fechaCierre)
    fechaCierreFin.setHours(23, 59, 59, 999)

    // Obtener todas las organizaciones activas
    const organizaciones = await prisma.organization.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
    })

    const resultados = []

    for (const org of organizaciones) {
      // Obtener cobradores de esta organización
      const cobradores = await prisma.user.findMany({
        where: { organizationId: org.id, rol: 'cobrador', activo: true },
        select: { id: true, nombre: true },
      })

      for (const cobrador of cobradores) {
        // Verificar si ya existe un cierre para ayer
        const cierreExistente = await prisma.cierreCaja.findFirst({
          where: {
            organizationId: org.id,
            cobradorId: cobrador.id,
            fecha: { gte: fechaCierre, lte: fechaCierreFin },
          },
        })

        if (cierreExistente) {
          resultados.push({
            organization: org.nombre,
            cobrador: cobrador.nombre,
            status: 'ya_existe',
            fecha: fechaCierre.toISOString(),
          })
          continue
        }

        // Calcular esperado
        const totalEsperado = await calcularEsperado(org.id, cobrador.id)

        // Obtener gastos aprobados del día para este cobrador
        const gastosDia = await prisma.gastoMenor.aggregate({
          where: {
            organizationId: org.id,
            cobradorId: cobrador.id,
            estado: 'aprobado',
            fecha: { gte: fechaCierre, lte: fechaCierreFin },
          },
          _sum: { monto: true },
        })

        const totalGastos = gastosDia._sum?.monto || 0
        const totalDesembolsado = await calcularDesembolsadoDia(org.id, cobrador.id, fechaCierre, fechaCierreFin)
        const saldoOperativo = -totalGastos
        const saldoRealCaja = saldoOperativo - totalDesembolsado

        // Crear cierre automático (con totalRecogido = 0 si no hubo)
        const cierre = await prisma.cierreCaja.create({
          data: {
            organizationId: org.id,
            cobradorId: cobrador.id,
            fecha: fechaCierre,
            totalEsperado: Math.round(totalEsperado),
            totalRecogido: 0,
            totalGastos: Math.round(totalGastos),
            totalDesembolsado: Math.round(totalDesembolsado),
            saldoOperativo: Math.round(saldoOperativo),
            saldoRealCaja: Math.round(saldoRealCaja),
            diferencia: Math.round(-totalEsperado), // Negativo = no se registró
          },
        })

        resultados.push({
          organization: org.nombre,
          cobrador: cobrador.nombre,
          status: 'creado',
          cierre,
        })
      }
    }

    return Response.json({
      success: true,
      message: `Cierre automático completado`,
      fechaCierre: fechaCierre.toISOString(),
      resultados,
    })
  } catch (error) {
    console.error('Error en cierre automático:', error)
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 })
  }
}

// GET - Endpoint de verificación (solo superadmin)
export async function GET() {
  const { getServerSession } = await import('next-auth')
  const { authOptions } = await import('@/lib/auth')
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const now = new Date()
  const colombiaNow = new Date(now.getTime() - 5 * 60 * 60 * 1000)
  return Response.json({
    serverTime: now.toISOString(),
    colombiaTime: colombiaNow.toISOString(),
    colombiaHour: colombiaNow.getHours(),
    colombiaMinute: colombiaNow.getMinutes(),
  })
}
