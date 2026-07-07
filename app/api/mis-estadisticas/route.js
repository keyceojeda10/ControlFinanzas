// app/api/mis-estadisticas/route.js — Estadísticas propias del cobrador
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { getUtcOffset } from '@/lib/i18n'
import { calcularDiasMora } from '@/lib/calculos'

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

  const [pagosSemana, pagosHoy, ruta, clientesRuta] = await Promise.all([
    prisma.pago.findMany({
      where: {
        organizationId: orgId,
        cobradorId: userId,
        fechaPago: { gte: hace7 },
        tipo: { notIn: ['recargo', 'descuento'] },
      },
      select: { montoPagado: true, fechaPago: true },
    }),
    prisma.pago.findMany({
      where: {
        organizationId: orgId,
        cobradorId: userId,
        fechaPago: { gte: hoy },
        tipo: { notIn: ['recargo', 'descuento'] },
      },
      select: { montoPagado: true },
    }),
    prisma.ruta.findFirst({
      where: { organizationId: orgId, cobradorId: userId },
      select: {
        nombre: true,
        _count: { select: { clientes: { where: { estado: 'activo' } } } },
        clientes: {
          where: { estado: 'activo' },
          select: {
            nombre: true,
            diasSinCobro: true,
            prestamos: {
              where: { estado: 'activo' },
              select: { cuotaDiaria: true },
              take: 1,
            },
          },
        },
      },
    }),
    // Clientes en mora: NO existe un campo `enMora` en Cliente; la mora se calcula
    // en memoria desde los préstamos activos (igual que dashboard/resumen y rutas/[id]).
    prisma.cliente.findMany({
      where: {
        organizationId: orgId,
        ruta: { cobradorId: userId },
        estado: 'activo',
      },
      select: {
        nombre: true,
        diasSinCobro: true,
        prestamos: {
          where: { estado: 'activo', esClavo: false },
          select: {
            estado: true,
            cuotaDiaria: true,
            totalAPagar: true,
            totalPagado: true,
            fechaInicio: true,
            frecuencia: true,
            diasPlazo: true,
            diaCobroSemana: true,
            diaCobroMes: true,
            diaCobroMes2: true,
            proximoCobroManual: true,
          },
        },
      },
    }),
  ])

  // Calcular días de mora por cliente (máximo entre sus préstamos activos) y quedarnos
  // con los que tienen mora > 0, ordenados desc, top 10.
  const clientesMora = clientesRuta
    .map((c) => {
      const diasMora = c.prestamos.reduce((max, p) => Math.max(max, calcularDiasMora(p)), 0)
      return { nombre: c.nombre, diasMora }
    })
    .filter((c) => c.diasMora > 0)
    .sort((a, b) => b.diasMora - a.diasMora)
    .slice(0, 10)

  const recaudadoHoy = pagosHoy.reduce((s, p) => s + Number(p.montoPagado), 0)

  // Meta diaria = suma de cuotas diarias de clientes activos en la ruta
  const metaHoy = ruta?.clientes.reduce((s, c) => {
    const cuota = c.prestamos[0]?.cuotaDiaria ?? 0
    return s + Number(cuota)
  }, 0) ?? 0

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
