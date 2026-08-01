// app/api/caja/cierre-auto/route.js - Cierre automático de caja (cron)

import { prisma } from '@/lib/prisma'
import { getUtcOffset, getLocalDayRange } from '@/lib/i18n'
import { esperadoDeCartera, SELECT_PRESTAMO } from '@/lib/dinero/esperado'

const CRON_SECRET = process.env.CRON_SECRET

/**
 * El esperado del día del cobrador, para la FECHA que se cierra.
 *
 * ── QUE HABIA AQUI ────────────────────────────────────────────────────────
 *
 * Una sexta version propia de «cuanto tocaba cobrar», con cinco defectos que
 * se sumaban, y este cron es el que crea la mayoria de los cierres: de los
 * 1.130 con `totalEsperado = 0` de la plataforma, 689 salieron de aqui.
 *
 *   · `findFirst` de UNA ruta — un cobrador con dos rutas perdia la segunda,
 *     y si no tenia ninguna activa devolvia 0 y se acabo (197 filas asi).
 *   · Sumaba TODAS las cuotas activas sin preguntar si el ciclo tocaba ese
 *     dia. En una cartera semanal eso infla la meta por siete.
 *   · `estado: 'activo'` sin `esClavo: false`: contaba como meta lo que ya se
 *     dio por perdido.
 *   · `cuotaDiaria` en vez de la cuota del periodo — en Decreciente esa es la
 *     mas alta de todas y en Globo es solo el interes.
 *   · Ignoraba los festivos, que el resto de la app si descuenta.
 *
 * Ahora pregunta a `lib/dinero/esperado.js`, que es la misma respuesta que dan
 * la caja, el cuadre y la ficha de ruta. Y la fecha ya no es decorativa: este
 * cron corre pasada la medianoche para cerrar el dia ANTERIOR, y hasta ahora
 * recibia la respuesta de HOY porque la funcion del nucleo estaba cableada a
 * `inicioDiaColombia()` sin argumento.
 */
async function calcularEsperado(organizationId, cobradorId, fechaCierre) {
  const [clientes, org, festivos] = await Promise.all([
    // Se parte de CLIENTES y no de rutas. Aqui el filtro por ruta es correcto
    // —un cliente sin ruta no es de ningun cobrador— pero asi no se pierde al
    // cobrador que tiene mas de una.
    prisma.cliente.findMany({
      where: {
        organizationId,
        estado: { notIn: ['eliminado'] },
        ruta: { cobradorId, activo: true },
      },
      select: {
        diasSinCobro: true,
        ruta: { select: { diasSinCobro: true } },
        prestamos: {
          where: { estado: 'activo', esClavo: false },
          select: SELECT_PRESTAMO,
        },
      },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { diasSinCobro: true },
    }),
    prisma.festivo.findMany({ where: { organizationId }, select: { fecha: true } }),
  ])

  return esperadoDeCartera({ clientes, org, festivos }, fechaCierre).esperado
}

// Suma recaudo real del dia (excluye recargos/descuentos).
async function calcularRecogido(organizationId, cobradorId, fechaInicio, fechaFin) {
  const pagos = await prisma.pago.aggregate({
    where: {
      organizationId,
      cobradorId,
      fechaPago: { gte: fechaInicio, lte: fechaFin },
      tipo: { notIn: ['recargo', 'descuento'] },
      prestamo: { estado: { not: 'cancelado' } },
    },
    _sum: { montoPagado: true },
  })
  return pagos._sum?.montoPagado || 0
}

async function calcularDesembolsadoDia(organizationId, cobradorId, fechaInicio, fechaFin) {
  const [prestamosRuta, movimientosCreador, actividadesCreador] = await Promise.all([
    prisma.prestamo.findMany({
      where: {
        organizationId,
        createdAt: { gte: fechaInicio, lte: fechaFin },
        estado: { not: 'cancelado' },
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
        createdAt: { gte: fechaInicio, lte: fechaFin },
        estado: { not: 'cancelado' },
      },
      select: { id: true, montoPrestado: true },
    })
    : []

  const referenciasMovimiento = movimientosCreador
    .map((mov) => mov.referenciaId)
    .filter((id) => !!id)

  const prestamosReferenciados = referenciasMovimiento.length
    ? await prisma.prestamo.findMany({
      where: {
        organizationId,
        id: { in: referenciasMovimiento },
        createdAt: { gte: fechaInicio, lte: fechaFin },
        estado: { not: 'cancelado' },
      },
      select: { id: true },
    })
    : []

  const referenciasValidas = new Set(prestamosReferenciados.map((p) => p.id))

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
      continue
    }
    if (!referenciasValidas.has(mov.referenciaId)) continue
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
    const colombiaNow = new Date(now.getTime() - Math.abs(getUtcOffset('co')) * 60 * 60 * 1000)
    
    // El cierre es del día anterior. La fecha se guarda con el MISMO criterio que
    // usa el resto de la app para leer un dia (getLocalDayRange = 05:00Z para
    // Colombia). Antes se usaba setHours(0,0,0,0), que en un servidor en UTC daba
    // 00:00Z: el cierre quedaba guardado en la ventana del DIA ANTERIOR y ninguna
    // pantalla lo encontraba en su fecha.
    const ayer = new Date(colombiaNow)
    ayer.setDate(ayer.getDate() - 1)
    const fechaAyerStr = ayer.toISOString().slice(0, 10)
    const { inicio: fechaCierre, fin: fechaCierreFin } = getLocalDayRange(fechaAyerStr, 'co')

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

        // Calcular esperado (respeta diasSinCobro en la fecha del cierre)
        const totalEsperado = await calcularEsperado(org.id, cobrador.id, fechaCierre)

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
        // Si el cobrador olvido cerrar, tomar el recaudo real del dia (no asumir 0).
        const totalRecogido = await calcularRecogido(org.id, cobrador.id, fechaCierre, fechaCierreFin)
        const saldoOperativo = totalRecogido - totalGastos
        const saldoRealCaja = saldoOperativo - totalDesembolsado
        const diferencia = totalRecogido - totalEsperado

        const cierre = await prisma.cierreCaja.create({
          data: {
            organizationId: org.id,
            cobradorId: cobrador.id,
            fecha: fechaCierre,
            totalEsperado: Math.round(totalEsperado),
            totalRecogido: Math.round(totalRecogido),
            totalGastos: Math.round(totalGastos),
            totalDesembolsado: Math.round(totalDesembolsado),
            saldoOperativo: Math.round(saldoOperativo),
            saldoRealCaja: Math.round(saldoRealCaja),
            diferencia: Math.round(diferencia),
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
  const colombiaNow = new Date(now.getTime() - Math.abs(getUtcOffset('co')) * 60 * 60 * 1000)
  return Response.json({
    serverTime: now.toISOString(),
    colombiaTime: colombiaNow.toISOString(),
    colombiaHour: colombiaNow.getHours(),
    colombiaMinute: colombiaNow.getMinutes(),
  })
}
