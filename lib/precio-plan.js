// lib/precio-plan.js — cuánto se le cobra a un negocio. La ÚNICA respuesta.
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Medido en producción el 12 sep 2026: de 50 planes pagados vigentes, 40
// pagaban el precio de lista y 10 no. Los 10 los había puesto alguien a mano, y
// nada en el panel lo decía. Mientras tanto el precio se calculaba en cuatro
// sitios y de tres formas:
//
//   · el checkout: lista × (1 − `descuento` %) — un campo que no usaba nadie
//   · el cron del cobro automático: «lo último que pagó», tal cual. Un precio
//     de amigo se repetía PARA SIEMPRE, y quien pagó un trimestre recibía el
//     cobro del trimestre entero cada mes
//   · «Reintentar» y el primer cobro: mezcla de las dos
//
// El dueño: «que en la plataforma de superadmin se pudiera gestionar y que
// avisara qué clientes tienen precio preferencial, y si es por algún tiempo
// limitado, para que el ajuste se haga automático al pasar el tiempo, o el
// valor que se le dio fue definitivo».
//
// ══ LAS REGLAS ═════════════════════════════════════════════════════════════
//
// 1. **El cobro de cada mes sale del precio, no del último pago.** Precio de
//    lista del plan, o el preferencial si el periodo que se paga EMPIEZA antes
//    de que el preferencial termine. Al terminar, el siguiente cobro ya va a
//    lista, sin que nadie toque nada.
//
// 2. **Un pago por debajo de la lista que nadie revisó no sube solo.** Si el
//    último pago no cuadra con ningún precio conocido y queda por debajo del que
//    más se le parece, el cobro es lo que pagó al mes (un trimestre, entre 3):
//    nunca se le cobra más a nadie sin que un admin lo decida. Y el panel lo
//    pone en «por revisar» hasta que se decida. Pagar de más no se revisa.
//
// 3. **Los descuentos no se suman.** Un trimestre o un año con precio
//    preferencial cuesta lo menor entre el preferencial mes a mes y la oferta
//    pública del periodo (−10 % trimestral, 2 meses gratis al año).
//
// Sin Prisma a propósito: la pantalla del plan y el panel la importan tal cual.

import { getPrecioPlan, getPrecioCobradorExtra, getPrecioRutaExtra, admiteAdicionales, PLANES_CONFIG } from '@/lib/planes'

/* ⚠ `semestral` NO SE OFRECE AL PÚBLICO: ni el checkout ni la pantalla del plan
   leen esta lista, solo el superadmin. Existe para asignar a mano un trato de
   6 meses —el primero, Inversiones Don Pacho el 21 sep 2026— y para que ese pago
   se reconozca como un precio conocido y no salga «por revisar». */
export const MESES_PERIODO = { mensual: 1, trimestral: 3, semestral: 6, anual: 12 }

/* Lo que extiende `activarPlanPagado` por cada periodo pagado. */
const DIAS_MES = 30
const DIA = 86400000

/* Un 1 % es redondeo, no otro precio: el trimestre de $105.300 apuntado a mano
   como $105.000 es el mismo trimestre (medido en el espejo el 12 sep 2026). */
const REDONDEO = 0.01

/** Los campos de `Organization` que hacen falta para cualquier cuenta de aquí. */
export const selectPrecio = {
  country: true,
  precioPreferencial: true,
  precioPreferencialPlan: true,
  precioPreferencialHasta: true,
  precioPreferencialNota: true,
  precioPagoRevisado: true,
  /* ⚠ Sin estos dos, `montoDelCobro` cobra el plan SIN sus adicionales y nada
     revienta: el cobrador sigue ahí y el mes sale más barato. */
  cobradoresAdicionales: true,
  rutasAdicionales: true,
}

/* ══ LOS ADICIONALES: COBRADORES Y RUTAS QUE SE PAGAN CON EL PLAN ═══════════
 *
 * El dueño, 24 sep 2026: «¿cómo haría una persona que quiere comprar el plan de
 * crecimiento pero añadirle un cobrador extra?». No había forma: el botón de
 * «Nuevo cobrador» cobraba UNA vez por MercadoPago (también en Colombia, que
 * paga por Wompi) y daba el cupo para siempre; la ruta ni botón tenía.
 *
 * Ahora van con el plan, al precio de lista del país y sin el descuento del
 * trimestre o del año:
 *   · cada cobro del plan los suma: el automático, el checkout y el pago a mano
 *   · agregarlos con el plan ya pagado cobra los días que faltan para renovar
 *     (`prorrateoAdicionales`); quitarlos es al instante y no se devuelve nada
 *   · solo en los planes que los admiten (`admiteAdicionales`), la misma regla
 *     que los cuenta en el cupo (`cuposDe` en lib/planes.js) */

/* Lo mínimo que Wompi deja cobrar: el plan `test` cuesta esto por eso. */
export const MINIMO_WOMPI = 1500

const entero = (n) => Math.max(0, Math.floor(Number(n) || 0))

/** Lo de UN mes de `cobradores` y `rutas` adicionales en `plan`. */
export function precioAdicionales({ cobradores = 0, rutas = 0 } = {}, plan, country = 'co') {
  if (!admiteAdicionales(plan)) return 0
  return entero(cobradores) * getPrecioCobradorExtra(country) + entero(rutas) * getPrecioRutaExtra(country)
}

/** Lo de UN mes de los adicionales que tiene el negocio. */
export function adicionalesMensual(org, plan) {
  return precioAdicionales(
    { cobradores: org?.cobradoresAdicionales, rutas: org?.rutasAdicionales },
    plan,
    org?.country ?? 'co',
  )
}

/**
 * Agregar adicionales con el plan pagado: se cobran los días que faltan para
 * `hasta` (el vencimiento), a 30 días el mes, redondeado a $100. Desde la
 * renovación van con el plan entero.
 *
 * @returns {{ dias: number, mensual: number, monto: number }} `monto` 0 si ya
 *   venció: entonces se agregan con la renovación, no aparte.
 */
export function prorrateoAdicionales(cuantos, plan, country, hasta, ahora = new Date()) {
  const mensual = precioAdicionales(cuantos, plan, country)
  /* Al día MÁS CERCANO, no hacia arriba: con 6 días y una hora hasta renovar,
     redondear hacia arriba cobraba 7 (medido en el espejo el 24 sep 2026). Un
     día como mínimo mientras quede algo. */
  const exactos = hasta ? (new Date(hasta).getTime() - new Date(ahora).getTime()) / DIA : 0
  const dias = exactos > 0 ? Math.max(1, Math.round(exactos)) : 0
  if (!(mensual > 0) || dias <= 0) return { dias, mensual, monto: 0 }
  const monto = Math.round((mensual * dias) / DIAS_MES / 100) * 100
  return { dias, mensual, monto: Math.max(MINIMO_WOMPI, monto) }
}

/** El precio público del periodo, sin preferencial. */
export function ofertaPublica(plan, periodo = 'mensual', country = 'co') {
  const lista = getPrecioPlan(plan, country)
  if (periodo === 'anual') return lista * 10
  if (periodo === 'trimestral') return Math.round(lista * 3 * 0.9)
  /* −15 %: entre el trimestre (−10 %) y el año (dos meses gratis, −16,7 %), así
     el año sigue siendo la mejor oferta. Básico: $300.900; el dueño le cobró
     $300.000 redondos, que cuadra por el 1 % de redondeo. */
  if (periodo === 'semestral') return Math.round(lista * 6 * 0.85)
  return lista
}

/**
 * Desde cuándo cuenta el periodo que se pagaría ahora. La misma regla que
 * `activarPlanPagado`: si la suscripción sigue activa, se extiende desde su
 * vencimiento; si no, desde ya.
 */
export function inicioDelPeriodo(ultima, ahora = new Date()) {
  const venc = ultima?.fechaVencimiento ? new Date(ultima.fechaVencimiento) : null
  return ultima?.estado === 'activa' && venc && venc > ahora ? venc : new Date(ahora)
}

/**
 * «YYYY-MM-DD» → el último milisegundo de ese día en Bogotá. El preferencial
 * «hasta el 30 de septiembre» incluye cualquier periodo que empiece ese día.
 */
export function finDelDiaBogota(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd ?? ''))
  if (!m) return null
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + 1, 5) - 1)
}

/** Date → «YYYY-MM-DD» del calendario de Bogotá (lo que un input date enseña). */
export function diaBogota(fecha) {
  if (!fecha) return ''
  return new Date(new Date(fecha).getTime() - 5 * 3600000).toISOString().slice(0, 10)
}

/**
 * ¿Aplica el preferencial a un periodo de `plan` que empieza en `inicio`?
 * Solo al plan para el que se dio: si sube de plan, paga la lista del nuevo.
 */
export function preferencialVigente(org, plan, inicio = new Date()) {
  if (!org || !(org.precioPreferencial > 0)) return false
  if (!org.precioPreferencialPlan || org.precioPreferencialPlan !== plan) return false
  if (!org.precioPreferencialHasta) return true
  return new Date(inicio).getTime() <= new Date(org.precioPreferencialHasta).getTime()
}

/**
 * El estado del preferencial para enseñarlo: 'ninguno' | 'definitivo' |
 * 'temporal' | 'terminado'.
 */
export function estadoPreferencial(org, ahora = new Date()) {
  if (!org || !(org.precioPreferencial > 0) || !org.precioPreferencialPlan) return 'ninguno'
  if (!org.precioPreferencialHasta) return 'definitivo'
  return new Date(org.precioPreferencialHasta) >= new Date(ahora) ? 'temporal' : 'terminado'
}

/** Lo de UN mes de `plan` que empieza en `inicio`. */
export function precioMensual(org, plan, inicio = new Date()) {
  const lista = getPrecioPlan(plan, org?.country ?? 'co')
  const preferencial = preferencialVigente(org, plan, inicio)
  return {
    monto: preferencial ? Math.min(org.precioPreferencial, lista) : lista,
    lista,
    preferencial,
    hasta: preferencial ? (org.precioPreferencialHasta ?? null) : null,
  }
}

/**
 * Lo que cuesta pagar `periodo` de `plan` empezando en `inicio`. Un trimestre
 * que cruza el final del preferencial paga cada mes a lo suyo.
 */
export function precioPeriodo(org, plan, periodo = 'mensual', inicio = new Date()) {
  const country = org?.country ?? 'co'
  const meses = MESES_PERIODO[periodo] ?? 1
  const lista = getPrecioPlan(plan, country)
  const oferta = ofertaPublica(plan, periodo, country)
  let suma = 0
  let mesesPreferencial = 0
  for (let i = 0; i < meses; i++) {
    const mes = precioMensual(org, plan, new Date(new Date(inicio).getTime() + i * DIAS_MES * DIA))
    suma += mes.monto
    if (mes.preferencial) mesesPreferencial++
  }
  const total = mesesPreferencial > 0 ? Math.min(suma, oferta) : oferta
  return { total, lista, oferta, meses, mesesPreferencial, ahorro: lista * meses - total }
}

/**
 * Lo que cobra un pago del plan hecho por el negocio (checkout de Wompi,
 * MercadoPago o a mano): el periodo del plan más sus adicionales por los meses
 * del periodo, sin descuento. `ahorro` es solo del plan.
 */
export function precioCheckout(org, plan, periodo = 'mensual', inicio = new Date()) {
  const p = precioPeriodo(org, plan, periodo, inicio)
  const adicionales = adicionalesMensual(org, plan) * p.meses
  return { ...p, adicionales, total: p.total + adicionales }
}

/**
 * Los precios que el sistema conoce para `plan`, con los meses que paga cada
 * uno: la lista de cualquier periodo y el preferencial (vigente o no) de
 * cualquier periodo.
 */
function preciosConocidos(org, plan, { conAdicionales = false } = {}) {
  const country = org?.country ?? 'co'
  const lista = getPrecioPlan(plan, country)
  const precios = []
  for (const [periodo, meses] of Object.entries(MESES_PERIODO)) {
    const oferta = ofertaPublica(plan, periodo, country)
    precios.push({ monto: oferta, meses })
    if (org?.precioPreferencial > 0 && org.precioPreferencialPlan === plan) {
      const pref = Math.min(org.precioPreferencial, lista)
      precios.push({ monto: Math.min(pref * meses, oferta), meses })
    }
  }
  /* Para el formulario del panel: el pago que apunta a mano puede traer el
     plan MÁS los adicionales de hoy ($98.000 es Crecimiento con un cobrador). */
  const adicionales = conAdicionales ? adicionalesMensual(org, plan) : 0
  if (adicionales > 0) {
    for (const p of [...precios]) precios.push({ monto: p.monto + adicionales * p.meses, meses: p.meses })
  }
  return precios
}

/** El precio conocido del PLAN al que más se parece `monto`: dice qué compró. */
function precioMasParecido(org, plan, monto) {
  return preciosConocidos(org, plan)
    .reduce((a, b) => (Math.abs(b.monto - monto) < Math.abs(a.monto - monto) ? b : a))
}

const cuadraCon = (precios, monto) => precios.some(p => Math.abs(p.monto - monto) <= Math.max(1, p.monto * REDONDEO))

/**
 * ¿`monto` es un precio que el sistema conoce para `plan`, salvo redondeo? Con
 * o sin los adicionales de hoy: es la pregunta del panel al apuntar un pago.
 */
export function pagoCuadra(org, plan, monto) {
  if (!(monto > 0) || !PLANES_CONFIG[plan]) return false
  return cuadraCon(preciosConocidos(org, plan, { conAdicionales: true }), monto)
}

/** Lo que un pago del plan pagó por el PLAN: sin sus adicionales. */
function planDelPago(pagada) {
  return pagada.montoCOP - Math.max(0, Math.min(pagada.montoAdicionales ?? 0, pagada.montoCOP))
}

/**
 * El último pago está POR DEBAJO del precio al que más se parece y nadie lo ha
 * revisado. Pagar de más no se revisa: el cobro siguiente ya sale a su precio,
 * que es menos de lo que pagó. En el espejo, 3 de los 8 «por revisar» eran eso
 * ($40.000 y $60.000, precios viejos de la lista): ruido que tapa a los de
 * verdad.
 *
 * ⚠ SE MIRA SOLO LO QUE PAGÓ POR EL PLAN (`montoAdicionales` aparte). Comparado
 * con los adicionales de HOY, quien pagó Crecimiento con dos cobradores
 * ($117.000) y luego compró un tercero parecía «por debajo» de $136.000, y el
 * cobro automático se quedaba en $117.000 cada mes (revisión del 24 sep 2026).
 */
export function precioPorRevisar(org, pagada) {
  if (!pagada || !(pagada.montoCOP > 0) || !PLANES_CONFIG[pagada.plan]) return false
  const delPlan = planDelPago(pagada)
  if (!(delPlan > 0)) return false
  const precios = preciosConocidos(org, pagada.plan)
  if (cuadraCon(precios, delPlan)) return false
  if (delPlan > precioMasParecido(org, pagada.plan, delPlan).monto) return false
  return org?.precioPagoRevisado !== pagada.montoCOP
}

/** Los campos de `Suscripcion` que necesita un «último pago» aquí. */
export const selectPago = { plan: true, estado: true, montoCOP: true, montoAdicionales: true, fechaVencimiento: true }

/**
 * Lo que un pago del plan lleva de adicionales, según la referencia que lo
 * cobró (`conAdicionales` de `leerReferencia`): lo que se guarda en
 * `Suscripcion.montoAdicionales`. Nunca más que el pago.
 */
export function montoAdicionalesDelPago(conAdicionales, plan, periodo, montoCOP, country = 'co') {
  if (!conAdicionales) return 0
  const meses = MESES_PERIODO[periodo] ?? 1
  return Math.max(0, Math.min(Number(montoCOP) || 0, precioAdicionales(conAdicionales, plan, country) * meses))
}

/**
 * El monto del próximo cobro automático (siempre UN mes: la referencia dice
 * `mensual`).
 *
 * @param {object} p
 * @param {object} p.org      con `selectPrecio`
 * @param {string} p.plan     el plan que se cobra
 * @param {object} [p.pagada] el último pago, con `selectPago`
 * @param {object} [p.ultima] la suscripción que se extendería `{estado, fechaVencimiento}`
 */
export function montoDelCobro({ org, plan, pagada = null, ultima = null, ahora = new Date() }) {
  const inicio = inicioDelPeriodo(ultima, ahora)
  const mes = precioMensual(org, plan, inicio)
  /* `monto` es lo que se cobra: el plan más sus adicionales de HOY. `montoPlan`
     es solo el plan, para enseñar el desglose. */
  const adicionales = adicionalesMensual(org, plan)
  const cobro = { ...mes, montoPlan: mes.monto, adicionales, monto: mes.monto + adicionales, inicio }
  if (!precioPorRevisar(org, pagada) || pagada.plan !== plan) return { ...cobro, porRevisar: false }
  /* Lo que pagó por el plan, al mes: $90.000 de un trimestre de Inicial son
     $30.000. Solo cuenta si baja el cobro; si no, no hay nada que decidir. Los
     adicionales van aparte y siempre a su precio. */
  const delPlan = planDelPago(pagada)
  const alMes = Math.round(delPlan / precioMasParecido(org, plan, delPlan).meses)
  const porRevisar = alMes < mes.monto
  const montoPlan = porRevisar ? alMes : mes.monto
  return { ...cobro, montoPlan, monto: montoPlan + adicionales, porRevisar }
}

/**
 * Los próximos `n` cobros mensuales a partir de `inicio`, para enseñar cuándo
 * cambia el precio. `org` puede ser un borrador del formulario.
 */
export function proximosCobros(org, plan, inicio, n = 4) {
  const base = new Date(inicio).getTime()
  return Array.from({ length: n }, (_, i) => {
    const fecha = new Date(base + i * DIAS_MES * DIA)
    return { fecha, ...precioMensual(org, plan, fecha) }
  })
}

/**
 * Hasta cuándo dura un preferencial de «los próximos `n` cobros»: el día en
 * que empieza el último de ellos.
 */
export function hastaPorCobros(inicio, n) {
  const cobros = Math.max(1, Math.floor(n))
  return diaBogota(new Date(new Date(inicio).getTime() + (cobros - 1) * DIAS_MES * DIA))
}

/** Lo que se le enseña al panel de un negocio: su precio y qué pasa después. */
export function resumenPrecio(org, { pagada = null, ultima = null, ahora = new Date() } = {}) {
  const estado = estadoPreferencial(org, ahora)
  const preferencial = estado === 'ninguno' ? null : {
    plan: org.precioPreferencialPlan,
    monto: org.precioPreferencial,
    hasta: org.precioPreferencialHasta ?? null,
    nota: org.precioPreferencialNota ?? null,
  }
  const plan = [pagada?.plan, org?.planOriginal, org?.plan].find(p => p && PLANES_CONFIG[p]) ?? null
  const ultimoPago = pagada ? { plan: pagada.plan, montoCOP: pagada.montoCOP } : null
  if (!plan) return { estado, preferencial, plan: null, porRevisar: false, ultimoPago, proximoCobro: null }
  const cobro = montoDelCobro({ org, plan, pagada, ultima, ahora })
  return {
    estado,
    preferencial,
    plan,
    porRevisar: cobro.porRevisar,
    ultimoPago,
    proximoCobro: {
      fecha: cobro.inicio,
      monto: cobro.monto,
      lista: cobro.lista,
      preferencial: cobro.preferencial,
      hasta: cobro.hasta,
      adicionales: cobro.adicionales,
      /* Pagando a mano no se mira el último pago: sale lo que cobra el checkout
         (`precioPeriodo` más los adicionales), la lista o el preferencial
         vigente. El inicio decía «a mano, $39.000» y debajo «$25.000 · paga a
         mano». */
      aMano: precioCheckout(org, plan, 'mensual', cobro.inicio).total,
    },
  }
}

/**
 * Lee y valida un precio preferencial de lo que manda el panel.
 *
 * `{ plan, precio, hasta: 'YYYY-MM-DD' | null, cobros: n | null, nota }`.
 * Sin `hasta` ni `cobros` es definitivo. `inicio` es cuándo empieza el próximo
 * periodo que se cobraría: una fecha anterior no le aplicaría a ninguno.
 *
 * @returns {{ data: object } | { error: string }}
 */
export function leerPreferencial(body, { inicio, country = 'co' }) {
  const plan = body?.plan
  if (!plan || !PLANES_CONFIG[plan]) return { error: 'Plan no válido' }
  const lista = getPrecioPlan(plan, country)
  const precio = parseInt(body.precio, 10)
  if (!(precio > 0)) return { error: 'Escribe el precio por mes' }
  if (precio >= lista) {
    return { error: `Eso no es un precio preferencial: la lista de ${PLANES_CONFIG[plan].nombre} es $${lista.toLocaleString('es-CO')}` }
  }

  let hasta = null
  const cobros = body.cobros == null || body.cobros === '' ? null : parseInt(body.cobros, 10)
  if (cobros != null) {
    if (!(cobros >= 1 && cobros <= 36)) return { error: 'Entre 1 y 36 cobros' }
    hasta = finDelDiaBogota(hastaPorCobros(inicio, cobros))
  } else if (body.hasta) {
    hasta = finDelDiaBogota(body.hasta)
    if (!hasta) return { error: 'Fecha no válida' }
    if (hasta < new Date(inicio)) {
      return { error: `Esa fecha es antes del próximo cobro (${diaBogota(inicio)}): el precio no le aplicaría a ninguno` }
    }
  }

  const nota = String(body.nota ?? '').trim().slice(0, 191) || null
  return {
    data: {
      precioPreferencial: precio,
      precioPreferencialPlan: plan,
      precioPreferencialHasta: hasta,
      precioPreferencialNota: nota,
    },
  }
}

/** Una línea para el historial del panel. */
export function describirPreferencial({ precioPreferencial, precioPreferencialPlan, precioPreferencialHasta, precioPreferencialNota }, country = 'co') {
  const lista = getPrecioPlan(precioPreferencialPlan, country)
  const nombre = PLANES_CONFIG[precioPreferencialPlan]?.nombre ?? precioPreferencialPlan
  const cuanto = `${nombre} a $${precioPreferencial.toLocaleString('es-CO')}/mes (lista $${lista.toLocaleString('es-CO')})`
  const hasta = precioPreferencialHasta ? `hasta el ${diaBogota(precioPreferencialHasta)}, después lista` : 'definitivo'
  return `${cuanto}, ${hasta}${precioPreferencialNota ? `. Nota: ${precioPreferencialNota}` : ''}`
}
