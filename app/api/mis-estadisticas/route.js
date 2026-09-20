// app/api/mis-estadisticas/route.js — Estadísticas propias del cobrador
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { getUtcOffset } from '@/lib/i18n'
import { calcularDiasMora, tienePeriodoEsperadoHoy } from '@/lib/calculos'
import { obtenerDiasSinCobro, esHoySinCobro, esHoyFestivo } from '@/lib/dias-sin-cobro'

export const dynamic = 'force-dynamic'

function inicioHoyUTC(country = 'co') {
  const offsetMs = Math.abs(getUtcOffset(country)) * 60 * 60 * 1000
  const absOffset = Math.abs(getUtcOffset(country))
  const pad = (n) => String(n).padStart(2, '0')
  const offsetStr = `-${pad(absOffset)}:00`
  const now = new Date(Date.now() - offsetMs)
  const yyyy = now.getUTCFullYear()
  const mm   = pad(now.getUTCMonth() + 1)
  const dd   = pad(now.getUTCDate())
  return new Date(`${yyyy}-${mm}-${dd}T00:00:00${offsetStr}`)
}

function inicio7DiasUTC(country = 'co') {
  const offsetMs = Math.abs(getUtcOffset(country)) * 60 * 60 * 1000
  const absOffset = Math.abs(getUtcOffset(country))
  const pad = (n) => String(n).padStart(2, '0')
  const offsetStr = `-${pad(absOffset)}:00`
  const d = new Date(Date.now() - offsetMs)
  d.setUTCDate(d.getUTCDate() - 6)
  const yyyy = d.getUTCFullYear()
  const mm   = pad(d.getUTCMonth() + 1)
  const dd   = pad(d.getUTCDate())
  return new Date(`${yyyy}-${mm}-${dd}T00:00:00${offsetStr}`)
}

function toLocalDateStr(date, country = 'co') {
  const d = new Date(date.getTime() - Math.abs(getUtcOffset(country)) * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'cobrador') return NextResponse.json({ error: 'Solo cobradores' }, { status: 403 })

  const orgId   = session.user.organizationId
  const userId  = session.user.id
  const country = session.user.country ?? 'co'
  const hoy     = inicioHoyUTC(country)
  const hace7   = inicio7DiasUTC(country)

  const [pagosSemana, pagosHoy, ruta, clientesRuta, festivos, org] = await Promise.all([
    prisma.pago.findMany({
      where: {
        organizationId: orgId,
        cobradorId: userId,
        fechaPago: { gte: hace7 },
        tipo: { notIn: ['recargo', 'descuento'] },
        prestamo: { estado: { not: 'cancelado' } },
      },
      select: { montoPagado: true, fechaPago: true },
    }),
    prisma.pago.findMany({
      where: {
        organizationId: orgId,
        cobradorId: userId,
        fechaPago: { gte: hoy },
        tipo: { notIn: ['recargo', 'descuento'] },
        prestamo: { estado: { not: 'cancelado' } },
      },
      select: { montoPagado: true },
    }),
    prisma.ruta.findFirst({
      where: { organizationId: orgId, cobradorId: userId },
      select: {
        nombre: true,
        _count: { select: { clientes: { where: { estado: { notIn: ['eliminado', 'inactivo'] } } } } },
        // (Aquí se traían los clientes con su PRIMER préstamo para la «meta» vieja.
        //  Ya no se usa: la cifra sale de `clientesRuta`, con la regla del inicio.)
      },
    }),
    // Clientes en mora: NO existe un campo `enMora` en Cliente; la mora se calcula
    // en memoria desde los préstamos activos (igual que dashboard/resumen y rutas/[id]).
    prisma.cliente.findMany({
      where: {
        organizationId: orgId,
        ruta: { cobradorId: userId },
        /* ⚠ NO `estado: 'activo'`. Un cliente atrasado tiene `estado: 'mora'`, así que
           con ese filtro LOS QUE ESTÁN EN MORA NO ENTRABAN EN LA LISTA DE MORA: la
           ruta tenía cuatro atrasados y esta pantalla enseñaba uno. Y sus cuotas
           tampoco contaban en lo que toca cobrar hoy ($470.000 donde eran
           $520.000). Cazado el 19 sep 2026. Mismo criterio que el inicio. */
        estado: { notIn: ['eliminado', 'inactivo'] },
      },
      select: {
        nombre: true,
        diasSinCobro: true,
        ruta: { select: { diasSinCobro: true } },
        prestamos: {
          where: { estado: 'activo', esClavo: false },
          select: {
            // Todo lo que lee `tienePeriodoEsperadoHoy`: un campo que falta no
            // da error, decide mal en silencio. Lo vigila
            // `toca-cobrar-hoy-una-sola-cifra.test.js`.
            id: true,
            modoInteres: true,
            sinPlazo: true,
            diasSinCobro: true,
            // Lo mismo que pide la ficha de la ruta, o las dos pantallas miden la
            // mora del mismo cliente con información distinta.
            montoPrestado: true,
            fechaFin: true,
            capitalExtra: true,
            interesAdelantado: true,
            ultimoPagoAt: true,
            pagos: { select: { montoPagado: true, tipo: true, fechaPago: true } },
            devengos: { select: { periodo: true, interes: true } },
            cuotasAmortizacion: {
              orderBy: { numeroPeriodo: 'asc' },
              select: { numeroPeriodo: true, cuotaTotal: true, interes: true, pagado: true, interesPagado: true, fechaEsperada: true },
            },
            estado: true,
            cuotaDiaria: true,
            totalAPagar: true,
            totalPagado: true, abonadoCapital: true,
            fechaInicio: true,
            frecuencia: true,
            diasPlazo: true,
            diaCobroSemana: true,
            diaCobroMes: true,
            primerCobro: true,
            diaCobroMes2: true,
            proximoCobroManual: true,
          },
        },
      },
    }),
    prisma.festivo.findMany({
      where: { organizationId: orgId },
      select: { fecha: true },
    }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { diasSinCobro: true } }),
  ])

  // Calcular días de mora por cliente (máximo entre sus préstamos activos) y quedarnos
  // con los que tienen mora > 0, ordenados desc, top 10.
  const clientesMora = clientesRuta
    .map((c) => {
      // Con los días sin cobro de verdad (préstamo → cliente → ruta → negocio): con
      // `[]` un domingo contaba como día de atraso y esta pantalla decía un día más
      // que la ficha del mismo cliente.
      const diasMora = c.prestamos.reduce((max, p) => Math.max(max, calcularDiasMora(p, obtenerDiasSinCobro(c, c.ruta, org, p), festivos)), 0)
      return { nombre: c.nombre, diasMora }
    })
    .filter((c) => c.diasMora > 0)
    .sort((a, b) => b.diasMora - a.diasMora)
    .slice(0, 10)

  const recaudadoHoy = pagosHoy.reduce((s, p) => s + Number(p.montoPagado), 0)

  /* ⚠ LA «META» ERA LA CUOTA DE TODOS LOS CLIENTES DE LA RUTA —toque hoy o no—,
     contando solo el PRIMER préstamo de cada uno (`take: 1`), incluidos los
     perdidos, y de UNA sola ruta aunque el cobrador lleve varias. El 19 sep 2026
     esta pantalla le decía a un cobrador «Meta $815.067» mientras su inicio decía
     «de $520.000 que toca cobrar». Ahora es la MISMA regla que el inicio, Rutas y
     Cobros de hoy: lo que el calendario dice que toca cobrar hoy. */
  const metaHoy = Math.round(clientesRuta.reduce((suma, c) => {
    for (const p of c.prestamos) {
      const dias = obtenerDiasSinCobro(c, c.ruta, org, p)
      const sinCobro = esHoySinCobro(dias) || esHoyFestivo(festivos)
      if (tienePeriodoEsperadoHoy(p, sinCobro, dias, festivos)) suma += Number(p.cuotaDiaria) || 0
    }
    return suma
  }, 0))

  const pctMeta = metaHoy > 0 ? Math.round((recaudadoHoy / metaHoy) * 100) : 100

  // Agrupar pagos semana por fecha Colombia
  const mapaFechas = {}
  for (const p of pagosSemana) {
    const fecha = toLocalDateStr(new Date(p.fechaPago))
    mapaFechas[fecha] = (mapaFechas[fecha] ?? 0) + Number(p.montoPagado)
  }

  // Construir array de 7 días (incluyendo días sin pagos)
  const semana = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - Math.abs(getUtcOffset(country)) * 60 * 60 * 1000)
    d.setUTCDate(d.getUTCDate() - i)
    const fecha = d.toISOString().slice(0, 10)
    semana.push({ fecha, total: mapaFechas[fecha] ?? 0 })
  }

  return NextResponse.json({
    success: true,
    data: {
      recaudadoHoy,
      metaHoy,
      pctMeta,
      semana,
      rutaNombre: ruta?.nombre ?? null,
      totalClientesActivos: ruta?._count?.clientes ?? 0,
      clientesMora: clientesMora.map((c) => ({
        nombre: c.nombre,
        diasMora: c.diasMora,
      })),
    },
  })
}
