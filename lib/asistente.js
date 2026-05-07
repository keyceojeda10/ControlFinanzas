// lib/asistente.js — Constructor de contexto y helpers para el asistente Lucas
import { prisma } from '@/lib/prisma'
import { calcularDiasMora, calcularSaldoPendiente } from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import { getCachedContexto, setCachedContexto } from '@/lib/asistente-cache'

// ─── HELPERS ────────────────────────────────────────────────

function getColombiaDate() {
  return new Date(Date.now() - 5 * 60 * 60 * 1000)
}

// ─── BUILD CONTEXTO ─────────────────────────────────────────

export async function buildContexto(orgId) {
  const cached = getCachedContexto(orgId)
  if (cached) return cached

  const hoy = getColombiaDate()
  const y = hoy.getUTCFullYear()
  const m = hoy.getUTCMonth()
  const d = hoy.getUTCDate()

  const inicioDiaUTC  = new Date(Date.UTC(y, m, d, 5, 0, 0))
  const finDiaUTC     = new Date(Date.UTC(y, m, d + 1, 4, 59, 59))
  const inicioMes     = new Date(Date.UTC(y, m, 1, 5, 0, 0))
  const finMes        = new Date(Date.UTC(y, m + 1, 1, 4, 59, 59))
  const inicio7DiasUTC = new Date(Date.UTC(y, m, d - 6, 5, 0, 0))

  const [
    org,
    prestamosActivos,
    pagosHoy,
    pagosMes,
    cobradores,
    capitalRow,
    gastosMesAgg,
    pagos7d,
    clientesSinRuta,
    prestamosSinPagos,
    moraUrgente,
  ] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { nombre: true, plan: true, ciudad: true, diasSinCobro: true },
    }),

    prisma.prestamo.findMany({
      where: {
        organizationId: orgId,
        estado: 'activo',
        cliente: { estado: { notIn: ['eliminado', 'inactivo'] } },
      },
      select: {
        clienteId: true,
        montoPrestado: true,
        totalAPagar: true,
        cuotaDiaria: true,
        fechaInicio: true,
        diasPlazo: true,
        frecuencia: true,
        pagos: { select: { montoPagado: true, tipo: true } },
        cliente: {
          select: {
            id: true,
            diasSinCobro: true,
            ruta: { select: { diasSinCobro: true } },
          },
        },
      },
    }),

    prisma.pago.aggregate({
      where: {
        organizationId: orgId,
        fechaPago: { gte: inicioDiaUTC, lte: finDiaUTC },
        tipo: { notIn: ['recargo', 'descuento'] },
      },
      _sum: { montoPagado: true },
      _count: true,
    }),

    prisma.pago.aggregate({
      where: {
        organizationId: orgId,
        fechaPago: { gte: inicioMes, lte: finMes },
        tipo: { notIn: ['recargo', 'descuento'] },
      },
      _sum: { montoPagado: true },
      _count: true,
    }),

    prisma.user.findMany({
      where: { organizationId: orgId, rol: 'cobrador' },
      select: {
        id: true,
        nombre: true,
        rutas: { select: { id: true, nombre: true, clientes: { select: { id: true } } } },
      },
    }),

    prisma.capital.findFirst({
      where: { organizationId: orgId },
      select: { saldo: true },
    }),

    prisma.gastoMenor.aggregate({
      where: {
        organizationId: orgId,
        fecha: { gte: inicioMes, lte: finMes },
      },
      _sum: { monto: true },
    }),

    // Pagos 7 dias para tendencia
    prisma.pago.findMany({
      where: {
        organizationId: orgId,
        fechaPago: { gte: inicio7DiasUTC, lte: finDiaUTC },
        tipo: { notIn: ['recargo', 'descuento'] },
      },
      select: { montoPagado: true, fechaPago: true },
    }),

    prisma.cliente.count({
      where: {
        organizationId: orgId,
        rutaId: null,
        estado: { notIn: ['eliminado', 'inactivo'] },
        prestamos: { some: { estado: 'activo' } },
      },
    }),

    prisma.prestamo.count({
      where: {
        organizationId: orgId,
        estado: 'activo',
        cliente: { estado: { notIn: ['eliminado', 'inactivo'] } },
        OR: [
          { pagos: { none: {} } },
          { pagos: { every: { fechaPago: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } } },
        ],
      },
    }),

    // Top mora urgente con nombre del cliente
    prisma.prestamo.findMany({
      where: {
        organizationId: orgId,
        estado: 'activo',
        cliente: { estado: { notIn: ['eliminado', 'inactivo'] } },
      },
      select: {
        totalAPagar: true,
        diasPlazo: true,
        fechaInicio: true,
        frecuencia: true,
        cuotaDiaria: true,
        pagos: { select: { montoPagado: true, tipo: true, fechaPago: true } },
        cliente: {
          select: {
            nombre: true,
            diasSinCobro: true,
            ruta: { select: { diasSinCobro: true } },
          },
        },
      },
      orderBy: { fechaInicio: 'asc' },
    }),
  ])

  // ─── CALCULOS ────────────────────────────────────────────

  const clientesActivosSet = new Set()
  const clientesMoraSet = new Set()
  let carteraActiva = 0
  let saldoPorCobrar = 0
  let cuotaDiariaTotal = 0

  let interesesYaCobrados = 0
  let interesesPorCobrar = 0

  for (const p of prestamosActivos) {
    clientesActivosSet.add(p.clienteId)
    carteraActiva += p.totalAPagar ?? 0
    saldoPorCobrar += calcularSaldoPendiente(p)
    cuotaDiariaTotal += p.cuotaDiaria ?? 0
    const diasExcluidos = obtenerDiasSinCobro(p.cliente, p.cliente?.ruta, org)
    if (calcularDiasMora(p, diasExcluidos) > 0) clientesMoraSet.add(p.clienteId)

    const totalPagadoReal = (p.pagos ?? [])
      .filter(pago => !['recargo', 'descuento'].includes(pago.tipo))
      .reduce((acc, pago) => acc + (pago.montoPagado ?? 0), 0)

    const interesTotal = Math.max(0, (p.totalAPagar ?? 0) - (p.montoPrestado ?? 0))
    const interesYaCobrado = Math.max(0, totalPagadoReal - (p.montoPrestado ?? 0))
    const interesPendiente = Math.max(0, interesTotal - interesYaCobrado)

    interesesYaCobrados += interesYaCobrado
    interesesPorCobrar += interesPendiente
  }

  // Mora urgente: top 5 con mas dias mora
  const moraUrgenteLista = moraUrgente
    .map(p => {
      const diasExcluidos = obtenerDiasSinCobro(p.cliente, p.cliente?.ruta, org)
      const dias = calcularDiasMora(p, diasExcluidos)
      const saldo = calcularSaldoPendiente(p)
      return { nombre: p.cliente?.nombre ?? 'Cliente', diasMora: dias, saldo }
    })
    .filter(x => x.diasMora > 0)
    .sort((a, b) => b.diasMora - a.diasMora)
    .slice(0, 5)

  // Sparkline 7 dias
  const sparkline7d = Array(7).fill(0)
  for (const p of pagos7d) {
    const fechaCO = new Date(new Date(p.fechaPago).getTime() - 5 * 60 * 60 * 1000)
    const diaCO = Date.UTC(fechaCO.getUTCFullYear(), fechaCO.getUTCMonth(), fechaCO.getUTCDate())
    const hoyCO = Date.UTC(y, m, d)
    const diasAtras = Math.floor((hoyCO - diaCO) / (24 * 60 * 60 * 1000))
    if (diasAtras >= 0 && diasAtras < 7) sparkline7d[6 - diasAtras] += p.montoPagado
  }

  // Cobrador efficiency
  const cobradorData = cobradores.map(c => {
    const clientesCount = c.rutas.reduce((acc, r) => acc + r.clientes.length, 0)
    const rutaNombres = c.rutas.map(r => r.nombre).join(', ') || 'Sin ruta'
    return { nombre: c.nombre, ruta: rutaNombres, clientesCount }
  })

  const ctx = {
    org: { nombre: org?.nombre ?? 'Tu negocio', plan: org?.plan, ciudad: org?.ciudad },
    kpis: {
      clientesActivos: clientesActivosSet.size,
      clientesMora: clientesMoraSet.size,
      pctMora: clientesActivosSet.size > 0
        ? Math.round((clientesMoraSet.size / clientesActivosSet.size) * 100)
        : 0,
      carteraActiva,
      saldoPorCobrar,
      capitalDisponible: capitalRow?.saldo ?? 0,
      cobroHoy: pagosHoy._sum?.montoPagado ?? 0,
      cobrosHoyCount: pagosHoy._count ?? 0,
      cobroMes: pagosMes._sum?.montoPagado ?? 0,
      cuotaDiariaEsperada: cuotaDiariaTotal,
      gastosMes: gastosMesAgg?._sum?.monto ?? 0,
    },
    cobradores: cobradorData,
    moraUrgente: moraUrgenteLista,
    alertas: { clientesSinRuta, prestamosSinPagos },
    tendencia7d: sparkline7d,
    ganancias: {
      interesesYaCobrados,
      interesesPorCobrar,
      gananciaTotal: interesesYaCobrados + interesesPorCobrar,
      gananciaRealizada: interesesYaCobrados,
      gananciaProyectada: interesesPorCobrar,
    },
  }

  setCachedContexto(orgId, ctx)
  return ctx
}

// ─── SYSTEM PROMPT ──────────────────────────────────────────

export function buildSystemPrompt(ctx) {
  const { org, kpis, cobradores, moraUrgente, alertas, tendencia7d, ganancias } = ctx
  const fmt = (n) => `$${Math.round(n || 0).toLocaleString('es-CO')}`

  const tendenciaTexto = tendencia7d.map((v, i) => {
    const dias = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Hoy']
    return `${dias[i] || `D${i + 1}`}: ${fmt(v)}`
  }).join(', ')

  const mora = moraUrgente.length > 0
    ? moraUrgente.map(m => `  - ${m.nombre}: ${m.diasMora} dias mora, debe ${fmt(m.saldo)}`).join('\n')
    : '  (Ninguno urgente)'

  const cobradoresTexto = cobradores.length > 0
    ? cobradores.map(c => `  - ${c.nombre} (${c.ruta}): ${c.clientesCount} clientes`).join('\n')
    : '  (Sin cobradores registrados)'

  const alertasTexto = []
  if (alertas.clientesSinRuta > 0) alertasTexto.push(`${alertas.clientesSinRuta} clientes activos sin ruta asignada`)
  if (alertas.prestamosSinPagos > 0) alertasTexto.push(`${alertas.prestamosSinPagos} prestamos sin pagos hace +7 dias`)

  return `Eres Lucas, el asistente financiero de ${org.nombre} en Control Finanzas.
Eres un asesor de negocios de confianza para prestamistas informales en Colombia.

DATOS DE HOY (hora Colombia):
Ciudad: ${org.ciudad || 'Colombia'} | Plan: ${org.plan}

CARTERA:
- Clientes activos: ${kpis.clientesActivos} | En mora: ${kpis.clientesMora} (${kpis.pctMora}%)
- Cartera total: ${fmt(kpis.carteraActiva)} | Saldo por cobrar: ${fmt(kpis.saldoPorCobrar)}
- Capital en caja: ${fmt(kpis.capitalDisponible)}

COBROS:
- Hoy: ${fmt(kpis.cobroHoy)} (${kpis.cobrosHoyCount} cobros) | Meta diaria esperada: ${fmt(kpis.cuotaDiariaEsperada)}
- Este mes: ${fmt(kpis.cobroMes)} | Gastos del mes: ${fmt(kpis.gastosMes)}
- Tendencia 7 dias: ${tendenciaTexto}

GANANCIAS (solo intereses, prestamos activos):
- Ya cobradas: ${fmt(ganancias.interesesYaCobrados)} (intereses que ya entraron a tu bolsillo)
- Por cobrar: ${fmt(ganancias.interesesPorCobrar)} (intereses pendientes si todos pagan)
- Ganancia total esperada cartera activa: ${fmt(ganancias.gananciaTotal)}
Nota: "ganancia" = lo que cobras sobre el capital prestado (los intereses). No incluye prestamos ya completados historicos.

COBRADORES:
${cobradoresTexto}

MORA URGENTE (top 5):
${mora}

${alertasTexto.length > 0 ? `ALERTAS:\n${alertasTexto.map(a => `  - ${a}`).join('\n')}` : ''}

REGLAS:
- Responde SIEMPRE en espanol informal colombiano, como un asesor de confianza
- Se directo y practico. Usa cifras reales del contexto cuando respondas
- Maximo 3 parrafos por respuesta (usuarios en celular)
- No inventes datos que no esten en este contexto
- Si te preguntan algo fuera del negocio, redirige amablemente
- Los datos tienen hasta 5 minutos de retraso vs la BD en vivo
- Para recomendaciones, basa tu analisis en los numeros reales mostrados arriba
- Cuando pregunten "cuanto estoy ganando?" o "cuanto gano con mis prestamos?" explica que la ganancia son los intereses: lo ya cobrado mas lo que falta por cobrar si todos pagan. Da los tres numeros: ya cobrado, por cobrar, y total esperado`
}

// ─── DETECCION DE COMPLEJIDAD ────────────────────────────────

export function detectQueryComplexity(message) {
  const simplePattern = /cuánto|cuanto|cuál|cual|quién|quien|hoy|ayer|esta semana|total|saldo|cuántos|cuantos|cuántas|cuantas|recaudé|recaude|debo|debe|clientes/i
  return simplePattern.test(message) ? 'simple' : 'analysis'
}
