#!/usr/bin/env node

/**
 * LA FOTO DEL DINERO — auditoria de SOLO LECTURA.
 *
 * ── POR QUE EXISTE ────────────────────────────────────────────────────────
 *
 * Vamos a cambiar formulas que llevan años entregando cifras a 397 negocios
 * reales. La unica manera de desplegar eso sin adivinar es poder decir «este
 * cambio movio exactamente esta cantidad, en estas organizaciones». Para eso
 * hace falta el ANTES.
 *
 * Este script no arregla nada y no escribe una sola fila. Mide.
 *
 * ── QUE MIDE, Y POR QUE CADA COSA ─────────────────────────────────────────
 *
 * 1. CAPITAL EN LA CALLE por las tres convenciones que hoy conviven en el
 *    codigo bajo el MISMO rotulo. Es la cifra con la que el prestamista decide
 *    si puede prestar mas.
 * 2. EFECTIVO FANTASMA: descuentos e intereses perdonados que se asientan como
 *    egreso de capital. Nunca fue plata que salio de la caja, pero baja el
 *    efectivo disponible, y es acumulativo e irreversible.
 * 3. RENOVACIONES: cuanto infla el «prestado» sumar `montoPrestado` crudo en
 *    vez del efectivo que de verdad salio.
 * 4. DAÑOS: filas que ya estan mal y hay que reparar o dejar de generar.
 * 5. CARTERA POR MODO: a cuantos prestamos y cuanta plata afecta cada arreglo.
 * 6. IDENTIDADES que deberian cumplirse siempre y no se comprueban en ningun
 *    sitio.
 *
 * ── QUE NO MIDE, A PROPOSITO ──────────────────────────────────────────────
 *
 * El «esperado del dia» (que hoy tiene CINCO definiciones distintas) NO entra
 * en esta version. Calcularlo bien exige el calendario completo —festivos,
 * dias sin cobro de organizacion, ruta, cliente y prestamo— y meter aqui una
 * sexta version aproximada seria exactamente el problema que venimos a
 * arreglar. Va en la fase de la caja, con la funcion unica.
 *
 * ── USO ───────────────────────────────────────────────────────────────────
 *
 *   node scripts/auditar-dinero.cjs                        # foto completa
 *   node scripts/auditar-dinero.cjs --salida=base.json     # y la guarda
 *   node scripts/auditar-dinero.cjs --diff=base.json       # contra una foto
 *   node scripts/auditar-dinero.cjs --org=org_xxx          # una sola
 *   node scripts/auditar-dinero.cjs --top=20               # top del informe
 */

require('dotenv').config({ path: '.env.local' })
require('dotenv').config()

const fs = require('fs')
const path = require('path')
const { crearPrisma } = require('../lib/prisma-cjs.cjs')

const prisma = crearPrisma()

// Los modos que el codigo trata como «tiene tabla de amortizacion»
// (lib/calculos.js:77). Cualquier fila de CuotaAmortizacion en un prestamo
// que NO este aqui es una fila que nadie lee.
const MODOS_CON_TABLA = ['lineal', 'lineal_dinamico', 'solo_interes', 'saldo']

// Los modos que el sistema reconoce hoy, en alguna parte. La lista esta
// replicada a mano en 11 sitios del repo con contenidos distintos; esta copia
// existe solo para detectar filas con un modo que no esta en ninguna.
const MODOS_CONOCIDOS = [
  'fijo', 'unico', 'saldo', 'manual', 'lineal', 'lineal_dinamico',
  'solo_interes', 'proporcional',
]

const PAGINA = 2000

// ────────────────────────────────────────────────────────────────────────────
// Argumentos
// ────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = { org: null, salida: null, diff: null, top: 10, json: false }
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') { opts.help = true; continue }
    if (arg === '--json') { opts.json = true; continue }
    if (arg.startsWith('--org=')) { opts.org = arg.slice(6).trim(); continue }
    if (arg.startsWith('--salida=')) { opts.salida = arg.slice(9).trim(); continue }
    if (arg.startsWith('--diff=')) { opts.diff = arg.slice(7).trim(); continue }
    if (arg.startsWith('--top=')) { opts.top = Number(arg.slice(6)) || 10; continue }
    throw new Error(`Parametro no soportado: ${arg}`)
  }
  return opts
}

// ────────────────────────────────────────────────────────────────────────────
// Las tres convenciones de «capital en la calle»
// ────────────────────────────────────────────────────────────────────────────

/**
 * CASCADA — lo que hace hoy `calcularCapitalRestante` (lib/calculos.js:263).
 * Se cobra TODO el interes primero: hasta que no entren los $100.000 de
 * interes, el capital no baja un peso. Los abonos explicitos a capital sí
 * bajan el capital directo, fuera de la cascada.
 */
function capitalCascada(p, abonoCapital) {
  const monto = Number(p.montoPrestado) || 0
  const total = Number(p.totalAPagar) || 0
  const pagadoTotal = Number(p.totalPagado) || 0
  const interesTotal = Math.max(0, total - monto)

  const abonos = Math.min(abonoCapital || 0, monto)
  const enCascada = Math.max(0, pagadoTotal - abonos)
  const capitalPagado = Math.max(0, enCascada - interesTotal)
  return Math.max(0, monto - abonos - capitalPagado)
}

/**
 * PROPORCIONAL — lo que dice `desglosarPago` (lib/calculos.js:2044), que esta
 * en el mismo archivo y NO LA USA NADIE. Cada peso que entra lleva su parte:
 * si de $600.000 a pagar $100.000 son interes, 1/6 de cada pago es ganancia.
 */
function capitalProporcional(p) {
  const monto = Number(p.montoPrestado) || 0
  const total = Number(p.totalAPagar) || 0
  const pagadoTotal = Number(p.totalPagado) || 0
  if (total <= 0) return Math.max(0, monto - pagadoTotal)
  const capitalDevuelto = pagadoTotal * (monto / total)
  return Math.max(0, monto - capitalDevuelto)
}

/**
 * LA VIEJA — `Σ montoPrestado`, sin descontar nada de lo ya cobrado. Sigue
 * viva en capital/resumen:207, analiticas:283 y reporte-pdf:171, estos dos
 * ultimos como DENOMINADOR del ROI.
 */
function capitalMontoPrestado(p) {
  return Number(p.montoPrestado) || 0
}

// ────────────────────────────────────────────────────────────────────────────
// Acumulador por organizacion
// ────────────────────────────────────────────────────────────────────────────

function organizacionVacia(id, nombre) {
  return {
    organizationId: id,
    nombre,
    prestamos: { total: 0, activos: 0, activosNoClavo: 0, clavos: 0 },
    capitalEnLaCalle: { cascada: 0, proporcional: 0, montoPrestado: 0 },
    cartera: { totalAPagar: 0, totalPagado: 0, porCobrar: 0 },
    porModo: {},
    renovaciones: { cantidad: 0, valorNominal: 0, efectivoAsentado: 0, sinAsiento: 0 },
    efectivoFantasma: { cantidad: 0, monto: 0, noBajaronSaldo: 0 },
    danos: {
      cuotasDesincronizadas: 0,
      cuotasDesincronizadasMonto: 0,
      filasHuerfanas: 0,
      filasHuerfanasPrestamos: 0,
      modoDesconocido: 0,
      proporcionalLegacy: 0,
      proporcionalLegacyMonto: 0,
      tablaNoSumaTotal: 0,
      sinTablaDebiendoTenerla: 0,
    },
  }
}

function modoVacio() {
  return { cantidad: 0, activos: 0, montoPrestado: 0, totalAPagar: 0, totalPagado: 0 }
}

// ────────────────────────────────────────────────────────────────────────────
// La medicion
// ────────────────────────────────────────────────────────────────────────────

async function medir(opts) {
  const whereOrg = opts.org ? { id: opts.org } : {}

  const organizaciones = await prisma.organization.findMany({
    where: whereOrg,
    select: { id: true, nombre: true },
  })
  if (!organizaciones.length) {
    throw new Error(opts.org ? `No existe la organizacion ${opts.org}` : 'No hay organizaciones')
  }
  const idsOrg = new Set(organizaciones.map((o) => o.id))
  const acc = new Map(organizaciones.map((o) => [o.id, organizacionVacia(o.id, o.nombre)]))

  const wherePrestamo = opts.org ? { organizationId: opts.org } : {}

  // ── 1. Abonos explicitos a capital, por prestamo ──
  // Van fuera de la cascada (lib/calculos.js:275): el prestamista dijo
  // «esto es capital», y la formula lo respeta.
  const abonosCapital = new Map()
  {
    const filas = await prisma.pago.groupBy({
      by: ['prestamoId'],
      where: { tipo: 'capital', ...(opts.org ? { organizationId: opts.org } : {}) },
      _sum: { montoPagado: true },
    })
    for (const f of filas) abonosCapital.set(f.prestamoId, Number(f._sum.montoPagado) || 0)
  }

  // ── 2. Agregados de la tabla de amortizacion, por prestamo ──
  const tablaPorPrestamo = new Map()
  {
    let cursor = null
    for (;;) {
      const filas = await prisma.cuotaAmortizacion.groupBy({
        by: ['prestamoId'],
        _sum: { pagado: true, interesPagado: true, cuotaTotal: true, capital: true, interes: true },
        _count: { _all: true },
        orderBy: { prestamoId: 'asc' },
        take: PAGINA,
        ...(cursor ? { skip: 1, cursor: { prestamoId: cursor } } : {}),
      })
      if (!filas.length) break
      for (const f of filas) {
        tablaPorPrestamo.set(f.prestamoId, {
          filas: f._count._all,
          pagado: Number(f._sum.pagado) || 0,
          interesPagado: Number(f._sum.interesPagado) || 0,
          cuotaTotal: Number(f._sum.cuotaTotal) || 0,
          capital: Number(f._sum.capital) || 0,
          interes: Number(f._sum.interes) || 0,
        })
      }
      cursor = filas[filas.length - 1].prestamoId
      if (filas.length < PAGINA) break
    }
  }

  // ── 3. Desembolsos asentados en el libro, por prestamo ──
  // Para las renovaciones: el libro asienta solo la DIFERENCIA entregada
  // (renovar/route.js:263), pero la caja del dia suma `montoPrestado` entero.
  const desembolsoAsentado = new Map()
  {
    let saltar = 0
    for (;;) {
      const filas = await prisma.movimientoCapital.findMany({
        where: { tipo: 'desembolso', referenciaTipo: 'prestamo', ...(opts.org ? { organizationId: opts.org } : {}) },
        select: { referenciaId: true, monto: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
        take: PAGINA,
        skip: saltar,
      })
      if (!filas.length) break
      // El mas reciente gana, igual que hace calcularDesembolsadoDia.
      for (const f of filas) if (f.referenciaId) desembolsoAsentado.set(f.referenciaId, Number(f.monto) || 0)
      saltar += filas.length
      if (filas.length < PAGINA) break
    }
  }

  // ── 4. Efectivo fantasma: ajustes que vienen de un pago ──
  // Solo dos cosas asientan `ajuste` con referenciaTipo='pago': el descuento
  // (pagos/route.js:639) y el interes perdonado en la liquidacion (:655). Ni
  // uno ni otro es plata que salio de la caja, y los dos la bajan.
  {
    let saltar = 0
    for (;;) {
      const filas = await prisma.movimientoCapital.findMany({
        where: { tipo: 'ajuste', referenciaTipo: 'pago', ...(opts.org ? { organizationId: opts.org } : {}) },
        select: { organizationId: true, monto: true, saldoAnterior: true, saldoNuevo: true },
        orderBy: { id: 'asc' },
        take: PAGINA,
        skip: saltar,
      })
      if (!filas.length) break
      for (const f of filas) {
        const o = acc.get(f.organizationId)
        if (!o) continue
        o.efectivoFantasma.cantidad += 1
        o.efectivoFantasma.monto += Number(f.monto) || 0
        // Si el saldo NO bajo, el asiento no hizo daño: se cuenta aparte para
        // no exagerar la cifra que despues hay que devolverle al prestamista.
        if (Number(f.saldoNuevo) >= Number(f.saldoAnterior)) o.efectivoFantasma.noBajaronSaldo += 1
      }
      saltar += filas.length
      if (filas.length < PAGINA) break
    }
  }

  // ── 5. Una pasada por todos los prestamos ──
  {
    let cursor = null
    for (;;) {
      const prestamos = await prisma.prestamo.findMany({
        where: wherePrestamo,
        select: {
          id: true, organizationId: true, montoPrestado: true, totalAPagar: true,
          totalPagado: true, modoInteres: true, estado: true, esClavo: true,
          renovadoDeId: true,
        },
        orderBy: { id: 'asc' },
        take: PAGINA,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      })
      if (!prestamos.length) break

      for (const p of prestamos) {
        if (!idsOrg.has(p.organizationId)) continue
        const o = acc.get(p.organizationId)
        const modo = p.modoInteres || 'fijo'
        const activo = p.estado === 'activo'
        const tabla = tablaPorPrestamo.get(p.id)

        o.prestamos.total += 1
        if (activo) o.prestamos.activos += 1
        if (p.esClavo) o.prestamos.clavos += 1

        if (!o.porModo[modo]) o.porModo[modo] = modoVacio()
        const m = o.porModo[modo]
        m.cantidad += 1
        if (activo) m.activos += 1
        m.montoPrestado += Number(p.montoPrestado) || 0
        m.totalAPagar += Number(p.totalAPagar) || 0
        m.totalPagado += Number(p.totalPagado) || 0

        // El capital en la calle es de los prestamos VIVOS y no clavo: un
        // clavo se lleva en contabilidad aparte, no es plata que esperas.
        if (activo && !p.esClavo) {
          o.prestamos.activosNoClavo += 1
          o.capitalEnLaCalle.cascada += capitalCascada(p, abonosCapital.get(p.id))
          o.capitalEnLaCalle.proporcional += capitalProporcional(p)
          o.capitalEnLaCalle.montoPrestado += capitalMontoPrestado(p)
          o.cartera.totalAPagar += Number(p.totalAPagar) || 0
          o.cartera.totalPagado += Number(p.totalPagado) || 0
          o.cartera.porCobrar += Math.max(0, (Number(p.totalAPagar) || 0) - (Number(p.totalPagado) || 0))
        }

        if (p.renovadoDeId) {
          const asentado = desembolsoAsentado.get(p.id)
          o.renovaciones.cantidad += 1
          o.renovaciones.valorNominal += Number(p.montoPrestado) || 0
          if (asentado == null) o.renovaciones.sinAsiento += 1
          else o.renovaciones.efectivoAsentado += asentado
        }

        // ── Daños ──
        if (!MODOS_CONOCIDOS.includes(modo)) o.danos.modoDesconocido += 1
        if (modo === 'proporcional') {
          o.danos.proporcionalLegacy += 1
          o.danos.proporcionalLegacyMonto += Number(p.montoPrestado) || 0
        }
        if (tabla && !MODOS_CON_TABLA.includes(modo)) {
          // Filas que existen en la base y que NINGUNA funcion lee: ni mora,
          // ni saldo, ni liquidacion, ni el desglose de interes.
          o.danos.filasHuerfanas += tabla.filas
          o.danos.filasHuerfanasPrestamos += 1
        }
        if (!tabla && MODOS_CON_TABLA.includes(modo)) {
          // Al reves: el modo dice que la fuente de verdad es la tabla, y no
          // hay tabla. Todo lo que consulte a este prestamo cae al camino
          // aproximado sin avisar.
          o.danos.sinTablaDebiendoTenerla += 1
        }
        if (tabla && MODOS_CON_TABLA.includes(modo)) {
          // Identidad 1: la tabla tiene que sumar el total pactado.
          const desvio = Math.abs(tabla.cuotaTotal - (Number(p.totalAPagar) || 0))
          if (desvio > 1) o.danos.tablaNoSumaTotal += 1
          // Identidad 2: lo aplicado en la tabla tiene que reconstruir lo
          // pagado. Se desincroniza al borrar o editar un pago, porque esas
          // dos vias nunca tocan CuotaAmortizacion.
          const enTabla = tabla.pagado + tabla.interesPagado
          const delta = Math.abs(enTabla - (Number(p.totalPagado) || 0))
          if (delta > 1) {
            o.danos.cuotasDesincronizadas += 1
            o.danos.cuotasDesincronizadasMonto += delta
          }
        }
      }

      cursor = prestamos[prestamos.length - 1].id
      if (prestamos.length < PAGINA) break
    }
  }

  // ── Redondeo y derivados ──
  const orgs = [...acc.values()].map((o) => {
    const c = o.capitalEnLaCalle
    return {
      ...o,
      capitalEnLaCalle: {
        cascada: Math.round(c.cascada),
        proporcional: Math.round(c.proporcional),
        montoPrestado: Math.round(c.montoPrestado),
        deltaCascadaVsProporcional: Math.round(c.cascada - c.proporcional),
        deltaViejaVsProporcional: Math.round(c.montoPrestado - c.proporcional),
      },
      cartera: {
        totalAPagar: Math.round(o.cartera.totalAPagar),
        totalPagado: Math.round(o.cartera.totalPagado),
        porCobrar: Math.round(o.cartera.porCobrar),
      },
      renovaciones: {
        ...o.renovaciones,
        valorNominal: Math.round(o.renovaciones.valorNominal),
        efectivoAsentado: Math.round(o.renovaciones.efectivoAsentado),
        inflado: Math.round(o.renovaciones.valorNominal - o.renovaciones.efectivoAsentado),
      },
      efectivoFantasma: { ...o.efectivoFantasma, monto: Math.round(o.efectivoFantasma.monto) },
      danos: {
        ...o.danos,
        cuotasDesincronizadasMonto: Math.round(o.danos.cuotasDesincronizadasMonto),
        proporcionalLegacyMonto: Math.round(o.danos.proporcionalLegacyMonto),
      },
      porModo: Object.fromEntries(Object.entries(o.porModo).map(([k, v]) => [k, {
        ...v,
        montoPrestado: Math.round(v.montoPrestado),
        totalAPagar: Math.round(v.totalAPagar),
        totalPagado: Math.round(v.totalPagado),
      }])),
    }
  })

  return { generadoEn: new Date().toISOString(), organizaciones: orgs, total: totalizar(orgs) }
}

function totalizar(orgs) {
  const t = {
    organizaciones: orgs.length,
    prestamos: { total: 0, activos: 0, activosNoClavo: 0, clavos: 0 },
    capitalEnLaCalle: { cascada: 0, proporcional: 0, montoPrestado: 0, deltaCascadaVsProporcional: 0, deltaViejaVsProporcional: 0 },
    cartera: { totalAPagar: 0, totalPagado: 0, porCobrar: 0 },
    renovaciones: { cantidad: 0, valorNominal: 0, efectivoAsentado: 0, sinAsiento: 0, inflado: 0 },
    efectivoFantasma: { cantidad: 0, monto: 0, noBajaronSaldo: 0 },
    danos: {},
    porModo: {},
  }
  for (const o of orgs) {
    for (const k of Object.keys(t.prestamos)) t.prestamos[k] += o.prestamos[k]
    for (const k of Object.keys(t.capitalEnLaCalle)) t.capitalEnLaCalle[k] += o.capitalEnLaCalle[k]
    for (const k of Object.keys(t.cartera)) t.cartera[k] += o.cartera[k]
    for (const k of Object.keys(t.renovaciones)) t.renovaciones[k] += o.renovaciones[k]
    for (const k of Object.keys(t.efectivoFantasma)) t.efectivoFantasma[k] += o.efectivoFantasma[k]
    for (const [k, v] of Object.entries(o.danos)) t.danos[k] = (t.danos[k] || 0) + v
    for (const [modo, v] of Object.entries(o.porModo)) {
      if (!t.porModo[modo]) t.porModo[modo] = modoVacio()
      for (const k of Object.keys(v)) t.porModo[modo][k] += v[k]
    }
  }
  return t
}

// ────────────────────────────────────────────────────────────────────────────
// Informe
// ────────────────────────────────────────────────────────────────────────────

const plata = (n) => `$${Math.round(n).toLocaleString('es-CO')}`
const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : '—')

function informe(foto, opts) {
  const t = foto.total
  const L = []
  L.push('')
  L.push('══ LA FOTO DEL DINERO ' + '═'.repeat(50))
  L.push(`   ${t.organizaciones} organizaciones · ${t.prestamos.total} prestamos · ${t.prestamos.activosNoClavo} activos no clavo`)
  L.push('')

  L.push('── 1 · CAPITAL EN LA CALLE, tres convenciones bajo el mismo rotulo ──')
  L.push(`   proporcional (cada peso lleva su parte) .... ${plata(t.capitalEnLaCalle.proporcional)}`)
  L.push(`   cascada (interes primero) .................. ${plata(t.capitalEnLaCalle.cascada)}   ${pct(t.capitalEnLaCalle.deltaCascadaVsProporcional, t.capitalEnLaCalle.proporcional)} mas`)
  L.push(`   Σ montoPrestado (la vieja, sin descontar) .. ${plata(t.capitalEnLaCalle.montoPrestado)}   ${pct(t.capitalEnLaCalle.deltaViejaVsProporcional, t.capitalEnLaCalle.proporcional)} mas`)
  L.push('')
  L.push(`   ► Lo que se corrige al unificar: ${plata(t.capitalEnLaCalle.deltaCascadaVsProporcional)}`)
  L.push(`   ► Y en las pantallas que aun usan la vieja: ${plata(t.capitalEnLaCalle.deltaViejaVsProporcional)}`)
  L.push('')

  L.push('── 2 · EFECTIVO FANTASMA (descuentos e interes perdonado) ──')
  L.push(`   asientos ................. ${t.efectivoFantasma.cantidad}`)
  L.push(`   plata restada de la caja . ${plata(t.efectivoFantasma.monto)}`)
  if (t.efectivoFantasma.noBajaronSaldo) {
    L.push(`   de esos, no bajaron saldo  ${t.efectivoFantasma.noBajaronSaldo}`)
  }
  L.push('   Ninguno de estos pesos salio nunca de la caja: bajan la cartera,')
  L.push('   no la bolsa. Y la resta es permanente.')
  L.push('')

  L.push('── 3 · RENOVACIONES: cuanto infla sumar montoPrestado crudo ──')
  L.push(`   renovaciones ............. ${t.renovaciones.cantidad}   (sin asiento en el libro: ${t.renovaciones.sinAsiento})`)
  L.push(`   valor nominal ............ ${plata(t.renovaciones.valorNominal)}`)
  L.push(`   efectivo de verdad ....... ${plata(t.renovaciones.efectivoAsentado)}`)
  L.push(`   ► inflado ................ ${plata(t.renovaciones.inflado)}`)
  L.push('')

  L.push('── 4 · DAÑOS (filas que ya estan mal) ──')
  const d = t.danos
  L.push(`   cuotas desincronizadas ....... ${d.cuotasDesincronizadas || 0} prestamos, ${plata(d.cuotasDesincronizadasMonto || 0)} de desvio`)
  L.push(`   filas huerfanas .............. ${d.filasHuerfanas || 0} filas en ${d.filasHuerfanasPrestamos || 0} prestamos (nadie las lee)`)
  L.push(`   sin tabla debiendo tenerla ... ${d.sinTablaDebiendoTenerla || 0}`)
  L.push(`   la tabla no suma el total .... ${d.tablaNoSumaTotal || 0}`)
  L.push(`   modo 'proporcional' legacy ... ${d.proporcionalLegacy || 0} prestamos, ${plata(d.proporcionalLegacyMonto || 0)}`)
  L.push(`   modo desconocido ............. ${d.modoDesconocido || 0}`)
  L.push('')

  L.push('── 5 · CARTERA POR MODO (a quien afecta cada arreglo) ──')
  const modos = Object.entries(t.porModo).sort((a, b) => b[1].montoPrestado - a[1].montoPrestado)
  const totalModo = modos.reduce((a, [, v]) => a + v.montoPrestado, 0)
  for (const [modo, v] of modos) {
    L.push(`   ${modo.padEnd(17)} ${String(v.activos).padStart(6)} activos · ${String(v.cantidad).padStart(6)} total · ${plata(v.montoPrestado).padStart(18)}  ${pct(v.montoPrestado, totalModo).padStart(6)}`)
  }
  L.push('')

  L.push(`── 6 · LAS ${opts.top} ORGANIZACIONES CON MAS DIFERENCIA ──`)
  const top = [...foto.organizaciones]
    .sort((a, b) => b.capitalEnLaCalle.deltaCascadaVsProporcional - a.capitalEnLaCalle.deltaCascadaVsProporcional)
    .slice(0, opts.top)
  for (const o of top) {
    const c = o.capitalEnLaCalle
    L.push(`   ${(o.nombre || o.organizationId).slice(0, 34).padEnd(34)} ${plata(c.deltaCascadaVsProporcional).padStart(16)}  (${pct(c.deltaCascadaVsProporcional, c.proporcional)} sobre ${plata(c.proporcional)})`)
  }
  L.push('')
  return L.join('\n')
}

function informeDiff(antes, ahora) {
  const mapa = new Map(antes.organizaciones.map((o) => [o.organizationId, o]))
  const L = []
  L.push('')
  L.push(`══ DIFF contra la foto de ${antes.generadoEn} ` + '═'.repeat(24))
  L.push('')

  const campos = [
    ['capitalEnLaCalle.proporcional', 'capital en la calle (proporcional)'],
    ['capitalEnLaCalle.cascada', 'capital en la calle (cascada)'],
    ['cartera.porCobrar', 'por cobrar'],
    ['efectivoFantasma.monto', 'efectivo fantasma'],
    ['renovaciones.inflado', 'renovaciones infladas'],
  ]
  const leer = (o, ruta) => ruta.split('.').reduce((a, k) => (a ? a[k] : undefined), o)

  L.push('   TOTAL')
  for (const [ruta, rotulo] of campos) {
    const a = leer(antes.total, ruta) || 0
    const b = leer(ahora.total, ruta) || 0
    const marca = a === b ? '  =' : (b > a ? ' ▲' : ' ▼')
    L.push(`   ${marca} ${rotulo.padEnd(36)} ${plata(a).padStart(18)} → ${plata(b).padStart(18)}  ${a === b ? '' : plata(b - a)}`)
  }
  L.push('')

  const cambiadas = []
  for (const o of ahora.organizaciones) {
    const prev = mapa.get(o.organizationId)
    if (!prev) { cambiadas.push({ o, nota: 'NUEVA' }); continue }
    for (const [ruta] of campos) {
      if ((leer(prev, ruta) || 0) !== (leer(o, ruta) || 0)) {
        cambiadas.push({ o, prev, ruta })
        break
      }
    }
  }
  L.push(`   ${cambiadas.length} organizaciones con alguna cifra distinta.`)
  if (cambiadas.length) {
    L.push('')
    L.push('   ⚠ CADA UNA DE ESTAS NECESITA EXPLICACION ESCRITA ANTES DE DESPLEGAR.')
  }
  L.push('')
  return L.join('\n')
}

// ────────────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0])
    return
  }

  const foto = await medir(opts)

  if (opts.json) {
    console.log(JSON.stringify(foto, null, 2))
  } else {
    console.log(informe(foto, opts))
    if (opts.diff) {
      const antes = JSON.parse(fs.readFileSync(opts.diff, 'utf8'))
      console.log(informeDiff(antes, foto))
    }
  }

  if (opts.salida) {
    const destino = path.resolve(opts.salida)
    fs.mkdirSync(path.dirname(destino), { recursive: true })
    fs.writeFileSync(destino, JSON.stringify(foto, null, 2))
    console.log(`→ ${destino}`)
  }
}

main()
  .catch((e) => { console.error('FALLO:', e.message); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
