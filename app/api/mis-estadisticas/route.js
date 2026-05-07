// app/api/mis-estadisticas/route.js — Estadísticas propias del cobrador
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const CO_OFFSET = 5 * 60 * 60 * 1000 // UTC-5

function inicioHoyUTC() {
  const now = new Date(Date.now() - CO_OFFSET)
  const yyyy = now.getUTCFullYear()
  const mm   = String(now.getUTCMonth() + 1).padStart(2, '0')
  const dd   = String(now.getUTCDate()).padStart(2, '0')
  return new Date(`${yyyy}-${mm}-${dd}T00:00:00-05:00`)
}

function inicio7DiasUTC() {
  const d = new Date(Date.now() - CO_OFFSET)
  d.setUTCDate(d.getUTCDate() - 6)
  const yyyy = d.getUTCFullYear()
  const mm   = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd   = String(d.getUTCDate()).padStart(2, '0')
  return new Date(`${yyyy}-${mm}-${dd}T00:00:00-05:00`)
}

function toColombiaDateStr(date) {
  const d = new Date(date.getTime() - CO_OFFSET)
  return d.toISOString().slice(0, 10)
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'cobrador') return NextResponse.json({ error: 'Solo cobradores' }, { status: 403 })

  const orgId  = session.user.organizationId
  const userId = session.user.id
  const hoy    = inicioHoyUTC()
  const hace7  = inicio7DiasUTC()

  const [pagosSemana, pagosHoy, ruta, clientesMora] = await Promise.all([
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
    prisma.cliente.findMany({
      where: {
        organizationId: orgId,
        ruta: { cobradorId: userId },
        enMora: true,
      },
      select: { nombre: true, diasSinCobro: true },
      orderBy: { diasSinCobro: 'desc' },
      take: 10,
    }),
  ])

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
    const fecha = toColombiaDateStr(new Date(p.fechaPago))
    mapaFechas[fecha] = (mapaFechas[fecha] ?? 0) + Number(p.montoPagado)
  }

  // Construir array de 7 días (incluyendo días sin pagos)
  const semana = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - CO_OFFSET)
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
        diasSinCobro: c.diasSinCobro ?? 0,
      })),
    },
  })
}
