// app/api/reportes/scorecard/route.js
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { calcularDiasMora } from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import { getUtcOffset } from '@/lib/i18n'
import { exigeNivelReportes } from '@/lib/plan-servidor'
import { esperadoDelDia, selectPrestamoDelDia } from '@/lib/dinero/esperado'
import { SIN_ABONO_PREVIO } from '@/lib/dinero/abono-previo'

/* ══ EL RANKING SALE DE LOS COBROS, NO DE LOS CIERRES (DETALLES-COBRADORES #1, #2) ══
 *
 * «Recaudado», «Días trabajados» y «Eficiencia» se sacaban SOLO de los cierres
 * de caja: Andrés salía con «Recaudado $65.200 · 1 día trabajado · Eficiencia
 * 36,7 %» habiendo cobrado $831.467 en 7 días, porque cerró caja un solo día.
 * El que no cierra caja quedaba castigado en el 60 % del puntaje.
 *   · Recaudado: lo que él registró (sin ajustes ni abonos previos).
 *   · Días trabajados: los días con al menos un cobro suyo.
 *   · Eficiencia: de lo que tocaba cobrar cada día en sus rutas, cuánto se
 *     cobró, con tope en lo que tocaba ese día: una liquidación grande no tapa
 *     los días sin cobrar (en el negocio de la grabación daba 160 %). Hoy con
 *     la cuenta de todas las pantallas (`loDeHoyDelPrestamo`, DETALLES-RUTAS
 *     #70); los días pasados con el calendario, como la caja de un día pasado.
 * Y «Clientes con atraso 0» con Wilmer a 6 días: el `select` no traía lo que
 * lee `calcularDiasMora`. Ahora es la consulta compartida.
 */

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
    // ⚠ `hasta` es el ARRANQUE de hoy: con `lte: hasta` los cobros de hoy no
    // entraban. Los 30 días son de `desde` al final de hoy.
    const finHoy = new Date(hasta.getTime() + DAY_MS)

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

    const [cierres, pagos, clientesRutas, pagosDeLasRutas] = await Promise.all([
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
          fechaPago: { gte: desde, lt: finHoy },
          tipo: { notIn: TIPOS_AJUSTE },
          prestamo: { estado: { not: 'cancelado' } },
          AND: [SIN_ABONO_PREVIO],
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
                /* Los vivos, y los que se terminaron de pagar dentro de los 30
                   días: tocaba cobrarles hasta su último pago. */
                where: {
                  esClavo: false,
                  OR: [{ estado: 'activo' }, { estado: 'completado', ultimoPagoAt: { gte: desde } }],
                },
                select: { ...selectPrestamoDelDia(), clienteId: true, ultimoPagoAt: true },
              },
            },
          })
        : [],
      // Lo cobrado en sus rutas, lo registre quien lo registre: el numerador
      // de la eficiencia (lo que tocaba es de las rutas, no de quién cobró).
      rutaIds.length
        ? prisma.pago.findMany({
            where: {
              organizationId: orgId,
              fechaPago: { gte: desde, lt: finHoy },
              tipo: { notIn: TIPOS_AJUSTE },
              prestamo: { estado: { not: 'cancelado' }, cliente: { rutaId: { in: rutaIds } } },
              AND: [SIN_ABONO_PREVIO],
            },
            select: { montoPagado: true, fechaPago: true, prestamo: { select: { cliente: { select: { rutaId: true } } } } },
          })
        : [],
    ])

    const clientesPorRuta = new Map()
    for (const cliente of clientesRutas) {
      if (!cliente.rutaId) continue
      if (!clientesPorRuta.has(cliente.rutaId)) clientesPorRuta.set(cliente.rutaId, [])
      clientesPorRuta.get(cliente.rutaId).push(cliente)
    }

    /* Lo que tocaba cobrar en cada ruta, día por día de los 30. Un préstamo
       cuenta desde que empezó y, si ya se terminó, hasta su último pago. */
    const cobradoPorRutaDia = new Map()
    for (const g of pagosDeLasRutas) {
      const id = g.prestamo?.cliente?.rutaId
      if (!id) continue
      const k = `${id}|${toLocalDateStr(g.fechaPago, offset)}`
      cobradoPorRutaDia.set(k, (cobradoPorRutaDia.get(k) ?? 0) + (Number(g.montoPagado) || 0))
    }
    const esperadoPorRuta = new Map()
    const cubiertoPorRuta = new Map()
    for (const ruta of cobradores.flatMap((c) => c.rutas)) {
      const clientes = clientesPorRuta.get(ruta.id) ?? []
      let total = 0
      let cubierto = 0
      // Los días sin cobro de cada préstamo, una vez (no treinta).
      const prestamos = clientes.flatMap((c) => c.prestamos.map((p) => ({
        p,
        dias: obtenerDiasSinCobro(c, ruta, org, p),
        desdeMs: new Date(p.fechaInicio).getTime(),
        hastaMs: p.estado === 'activo' ? Infinity : (p.ultimoPagoAt ? new Date(p.ultimoPagoAt).getTime() : -Infinity),
      })))
      for (let t = desde.getTime(); t < finHoy.getTime(); t += DAY_MS) {
        const dia = new Date(t)
        const esHoy = t === hasta.getTime()
        let tocaba = 0
        for (const x of prestamos) {
          if (x.desdeMs >= t + DAY_MS || x.hastaMs < t) continue
          tocaba += esperadoDelDia(x.p, dia, x.dias, festivos, esHoy)
        }
        total += tocaba
        cubierto += Math.min(tocaba, cobradoPorRutaDia.get(`${ruta.id}|${toLocalDateStr(dia, offset)}`) ?? 0)
      }
      esperadoPorRuta.set(ruta.id, total)
      cubiertoPorRuta.set(ruta.id, cubierto)
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

      const totalRecaudado = Math.round(misPagos.reduce((a, p) => a + (Number(p.montoPagado) || 0), 0))
      const totalEsperado = Math.round(cobrador.rutas.reduce((a, r) => a + (esperadoPorRuta.get(r.id) ?? 0), 0))
      const cubiertoEnSusRutas = cobrador.rutas.reduce((a, r) => a + (cubiertoPorRuta.get(r.id) ?? 0), 0)
      const eficiencia = totalEsperado > 0 ? Math.round((cubiertoEnSusRutas / totalEsperado) * 1000) / 10 : 0

      const totalPagos = misPagos.length

      let clientesActivos = 0
      let clientesMora = 0
      for (const ruta of cobrador.rutas) {
        const clientesDeRuta = clientesPorRuta.get(ruta.id) ?? []
        for (const cliente of clientesDeRuta) {
          if (cliente.estado !== 'activo') continue
          const vivos = cliente.prestamos.filter((p) => p.estado === 'activo')
          if (!vivos.length) continue
          clientesActivos++
          const enMora = vivos.some((p) => calcularDiasMora(p, obtenerDiasSinCobro(cliente, ruta, org, p), festivos) > 0)
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
      // Días con al menos un cobro suyo.
      const diasTrabajados = diasConPago.size
      let puntualidad = null
      if (diasConPago.size > 0) {
        const horasMinutos = [...diasConPago.values()].map((ms) => {
          const local = new Date(ms - Math.abs(offset) * 60 * 60 * 1000)
          return local.getUTCHours() * 60 + local.getUTCMinutes()
        })
        const promedioMin = Math.round(horasMinutos.reduce((a, b) => a + b, 0) / horasMinutos.length)
        /* «02:04» no se entendía (DETALLES-COBRADORES #3): es la hora PROMEDIO
           de su primer cobro de cada día, en 12 horas como el resto de la app. */
        const h24 = Math.floor(promedioMin / 60)
        const mm = String(promedioMin % 60).padStart(2, '0')
        puntualidad = `${h24 % 12 === 0 ? 12 : h24 % 12}:${mm} ${h24 < 12 ? 'a. m.' : 'p. m.'}`
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
          totalEsperado,
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
