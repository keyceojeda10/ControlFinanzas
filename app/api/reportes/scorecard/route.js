// app/api/reportes/scorecard/route.js
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { calcularDiasMora } from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import { getUtcOffset } from '@/lib/i18n'
import { exigeNivelReportes } from '@/lib/plan-servidor'

export const dynamic = 'force-dynamic'

const TIPOS_AJUSTE = ['recargo', 'descuento']
const DAY_MS = 24 * 60 * 60 * 1000

function inicioDiaOffset(valor, offsetHoras) {
  const absOffset = Math.abs(offsetHoras)
  const ms = absOffset * 60 * 60 * 1000
  const fecha = valor instanceof Date ? valor : new Date(valor)
  const local = new Date(fecha.getTime() - ms)
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), absOffset, 0, 0, 0))
}

function toLocalDateStr(fecha, offsetHoras) {
  const ms = Math.abs(offsetHoras) * 60 * 60 * 1000
  const d = new Date(new Date(fecha).getTime() - ms)
  return d.toISOString().slice(0, 10)
}

function normalizarScore(valor, max = 100) {
  return Math.max(0, Math.min(100, valor))
}

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }
    if (session.user.rol !== 'owner') {
      return NextResponse.json({ success: false, error: 'Solo el administrador puede ver el scorecard' }, { status: 403 })
    }
    /* ⚠ ESTE ENDPOINT NO TENIA NINGUNA BARRERA DE PLAN, y por aqui se colaba
     * a plan Inicial —322 de los 431 negocios— algo que la tabla de planes
     * marca de Basico en adelante (`reportesNivel`, en lib/planes.js). No era
     * una decision: era un olvido, y llevaba abierto desde el primer dia.
     *
     * La pantalla que llama aqui enseña <PlanGate/> al ver `motivo: 'plan'`.
     * Sin eso decia «revisa tu conexion», que le echa la culpa al internet
     * del cliente por algo que es de su plan. */
    const veto = await exigeNivelReportes(session, 1)
    if (veto) return veto


    const orgId = session.user.organizationId
    if (!orgId) {
      return NextResponse.json({ success: false, error: 'Organización no encontrada' }, { status: 400 })
    }

    const country = session.user.country ?? 'co'
    const offset = getUtcOffset(country)

    const hasta = inicioDiaOffset(new Date(), offset)
    const desde = new Date(hasta.getTime() - 29 * DAY_MS)

    const [cobradores, org, festivos] = await Promise.all([
      prisma.user.findMany({
        where: { organizationId: orgId, rol: 'cobrador', activo: true },
        select: {
          id: true,
          nombre: true,
          avatarId: true,
          rutas: {
            where: { activo: true },
            select: { id: true, nombre: true, diasSinCobro: true },
          },
        },
      }),
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { diasSinCobro: true },
      }),
      prisma.festivo.findMany({
        where: { organizationId: orgId },
        select: { fecha: true },
      }),
    ])

    if (!cobradores.length) {
      return NextResponse.json({
        cobradores: [],
        periodo: { desde: toLocalDateStr(desde, offset), hasta: toLocalDateStr(hasta, offset) },
      })
    }

    const rutaIds = cobradores.flatMap((c) => c.rutas.map((r) => r.id))

    const [cierres, pagos, clientesRutas] = await Promise.all([
      prisma.cierreCaja.findMany({
        where: { organizationId: orgId, cobradorId: { in: cobradores.map((c) => c.id) }, fecha: { gte: desde, lte: hasta } },
        select: {
          cobradorId: true,
          totalEsperado: true,
          totalRecogido: true,
          efectivoRecibido: true,
          diferenciaRecibido: true,
        },
      }),
      prisma.pago.findMany({
        where: {
          organizationId: orgId,
          cobradorId: { in: cobradores.map((c) => c.id) },
          fechaPago: { gte: desde, lte: hasta },
          tipo: { notIn: TIPOS_AJUSTE },
          prestamo: { estado: { not: 'cancelado' } },
        },
        select: {
          cobradorId: true,
          montoPagado: true,
          fechaPago: true,
          createdAt: true,
          latitud: true,
          longitud: true,
          fotoUrl: true,
        },
      }),
      rutaIds.length
        ? prisma.cliente.findMany({
            where: { organizationId: orgId, rutaId: { in: rutaIds }, estado: { not: 'eliminado' } },
            select: {
              rutaId: true,
              diasSinCobro: true,
              estado: true,
              prestamos: {
                where: { estado: 'activo', esClavo: false },
                select: {
                  estado: true,
                  clienteId: true,
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
          })
        : [],
    ])

    const clientesPorRuta = new Map()
    for (const cliente of clientesRutas) {
      if (!cliente.rutaId) continue
      if (!clientesPorRuta.has(cliente.rutaId)) clientesPorRuta.set(cliente.rutaId, [])
      clientesPorRuta.get(cliente.rutaId).push(cliente)
    }

    const cierresPorCobrador = new Map()
    for (const c of cierres) {
      if (!cierresPorCobrador.has(c.cobradorId)) cierresPorCobrador.set(c.cobradorId, [])
      cierresPorCobrador.get(c.cobradorId).push(c)
    }

    const pagosPorCobrador = new Map()
    for (const p of pagos) {
      if (!p.cobradorId) continue
      if (!pagosPorCobrador.has(p.cobradorId)) pagosPorCobrador.set(p.cobradorId, [])
      pagosPorCobrador.get(p.cobradorId).push(p)
    }

    const resultados = cobradores.map((cobrador) => {
      const misCierres = cierresPorCobrador.get(cobrador.id) ?? []
      const misPagos = pagosPorCobrador.get(cobrador.id) ?? []

      const totalEsperado = misCierres.reduce((a, c) => a + (c.totalEsperado || 0), 0)
      const totalRecaudado = misCierres.reduce((a, c) => a + (c.totalRecogido || 0), 0)
      const diasTrabajados = misCierres.length
      const eficiencia = totalEsperado > 0 ? Math.round((totalRecaudado / totalEsperado) * 1000) / 10 : 0

      const totalPagos = misPagos.length

      let clientesActivos = 0
      let clientesMora = 0
      for (const ruta of cobrador.rutas) {
        const clientesDeRuta = clientesPorRuta.get(ruta.id) ?? []
        for (const cliente of clientesDeRuta) {
          if (cliente.estado !== 'activo') continue
          if (!cliente.prestamos.length) continue
          clientesActivos++
          const diasExcluidos = obtenerDiasSinCobro(cliente, ruta, org)
          const enMora = cliente.prestamos.some((p) => calcularDiasMora(p, diasExcluidos, festivos) > 0)
          if (enMora) clientesMora++
        }
      }
      const tasaMora = clientesActivos > 0 ? Math.round((clientesMora / clientesActivos) * 1000) / 10 : 0

      const diasConPago = new Map()
      for (const p of misPagos) {
        const dia = toLocalDateStr(p.fechaPago, offset)
        const createdMs = new Date(p.createdAt).getTime()
        if (!diasConPago.has(dia) || createdMs < diasConPago.get(dia)) {
          diasConPago.set(dia, createdMs)
        }
      }
      let puntualidad = null
      if (diasConPago.size > 0) {
        const horasMinutos = [...diasConPago.values()].map((ms) => {
          const local = new Date(ms - Math.abs(offset) * 60 * 60 * 1000)
          return local.getUTCHours() * 60 + local.getUTCMinutes()
        })
        const promedioMin = Math.round(horasMinutos.reduce((a, b) => a + b, 0) / horasMinutos.length)
        const hh = String(Math.floor(promedioMin / 60)).padStart(2, '0')
        const mm = String(promedioMin % 60).padStart(2, '0')
        puntualidad = `${hh}:${mm}`
      }

      const cierresConCuadre = misCierres.filter((c) => c.efectivoRecibido != null)
      const faltantePromedio = cierresConCuadre.length
        ? Math.round(
            cierresConCuadre.reduce((a, c) => a + Math.abs(c.diferenciaRecibido ?? 0), 0) / cierresConCuadre.length
          )
        : 0

      const pagosConGps = totalPagos > 0
        ? Math.round((misPagos.filter((p) => p.latitud != null && p.longitud != null).length / totalPagos) * 1000) / 10
        : 0
      const pagosConFoto = totalPagos > 0
        ? Math.round((misPagos.filter((p) => !!p.fotoUrl).length / totalPagos) * 1000) / 10
        : 0

      const scoreEficiencia = normalizarScore(eficiencia)
      const scoreDias = normalizarScore((diasTrabajados / 26) * 100)
      const scoreMora = normalizarScore(100 - tasaMora)
      const scoreGps = normalizarScore(pagosConGps)
      const scoreCuadre = normalizarScore(100 - (faltantePromedio / 50000) * 100)

      const score = Math.round(
        scoreEficiencia * 0.4 +
        scoreDias * 0.2 +
        scoreMora * 0.2 +
        scoreGps * 0.1 +
        scoreCuadre * 0.1
      )

      return {
        id: cobrador.id,
        nombre: cobrador.nombre,
        avatarId: cobrador.avatarId,
        rutas: cobrador.rutas.map((r) => r.nombre),
        score: normalizarScore(score),
        metrics: {
          eficiencia,
          diasTrabajados,
          totalRecaudado,
          totalPagos,
          clientesActivos,
          clientesMora,
          tasaMora,
          puntualidad,
          faltantePromedio,
          pagosConGps,
          pagosConFoto,
        },
      }
    })

    resultados.sort((a, b) => b.score - a.score)
    resultados.forEach((r, i) => { r.rank = i + 1 })

    return NextResponse.json({
      cobradores: resultados,
      periodo: { desde: toLocalDateStr(desde, offset), hasta: toLocalDateStr(hasta, offset) },
    })
  } catch (error) {
    console.error('[reportes/scorecard] error:', error)
    return NextResponse.json({ error: 'Error al generar el scorecard' }, { status: 500 })
  }
}
