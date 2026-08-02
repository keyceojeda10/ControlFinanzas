// ═══════════════════════════════════════════════════════════════════════════
// EL PANEL, POR PREGUNTAS
//
// ── POR QUE ───────────────────────────────────────────────────────────────
//
// El panel tenia 47 cifras de dinero y 9 porcentajes, y un control llamado
// literalmente «Ver más métricas / Mostrar solo lo esencial»: la propia app
// admitiendo que no sabe cuales importan. Ninguna estaba necesariamente mal
// calculada; el problema es que juntas no contestaban nada.
//
// Esto no es «los mismos KPI mejor pintados». Es la lista de preguntas que el
// dueño dijo que el panel tiene que contestar, y nada mas:
//
//   1. ¿Cuanto llevo hoy?            con el historial de la semana
//   2. ¿Cuanta plata tengo puesta?   sin intereses Y con intereses
//   3. ¿Cuanto puedo prestar?
//   4. ¿Cuanto estoy ganando?        en plata y en porcentaje
//   5. ¿Como van mis rutas?          solo si tiene cobradores
//   6. ¿Que me explica esto?
//
// **La diferencia entre «con intereses» y «sin intereses» ES la ganancia
// esperada.** Eso convierte dos cifras sueltas en una frase con sentido —tienes
// $X puestos y vas a recibir $Y— y cierra de paso la tarea F5, que llevaba
// meses pendiente por no tener donde ir.
//
// ── LO QUE ESTE ARCHIVO NO HACE ───────────────────────────────────────────
//
// No calcula dinero. Todas las cifras vienen ya resueltas de la API, con las
// definiciones de `lib/dinero/definiciones.js`. Aqui solo se AGRUPAN por la
// pregunta que contestan y se les pega su `id` del diccionario, para que al
// tocarlas se pueda abrir «¿de donde sale?».
//
// Las dos unicas restas que se hacen aqui son identidades, no formulas nuevas:
//
//     por ganar  = lo que falta cobrar − el capital que sigue afuera
//     ganancia   = interes cobrado − gastos aprobados
//
// y las dos estan fijadas por pruebas que las suman a mano.
// ═══════════════════════════════════════════════════════════════════════════

import { rotulo } from '@/lib/dinero/definiciones'

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const pct = (parte, total) => (total > 0 ? Math.round((parte / total) * 1000) / 10 : 0)

/**
 * @param data       respuesta de /api/dashboard/resumen
 * @param rutas      respuesta de /api/rutas (opcional; solo si tiene cobradores)
 */
export function adaptarPanelDinero(data, rutas = null) {
  if (!data) return null

  const prestamos = data.prestamos ?? {}
  const cobros = data.cobros ?? {}
  const finanzas = data.finanzas ?? {}
  const alertas = data.alertas ?? {}

  // ── 1 · ¿CUANTO LLEVO HOY? ────────────────────────────────────────────
  //
  // La meta es `esperadoHoy` —lo que el calendario pide HOY—, nunca la suma de
  // todas las cuotas de la cartera. En una cartera semanal el techo es siete
  // veces la meta, y de ahi salia que la pantalla dijera 48% y el consejo 9%.
  const cobrado = num(cobros.hoy)
  const meta = num(prestamos.esperadoHoy)
  const hoy = {
    cobrado,
    meta,
    // Sin meta no hay porcentaje que valga: un dia sin vencimientos con plata
    // cobrada no es «100% cumplido», es un dia sin meta. Se distingue con null.
    pct: meta > 0 ? Math.min(100, Math.round((cobrado / meta) * 100)) : null,
    pagos: num(cobros.cantidadHoy),
    clientes: num(prestamos.clientesConCobroHoy),
    // El historial de siete dias: «eso era lo que teniamos antes y funcionaba
    // bien». Se conserva tal cual llega.
    semana: Array.isArray(cobros.sparkline7d) ? cobros.sparkline7d : [],
    ids: { cobrado: 'recaudo', meta: 'esperado' },
  }

  // ── 2 · ¿CUANTA PLATA TENGO PUESTA? ───────────────────────────────────
  const miPlata = num(prestamos.capitalEnCalle)
  const conIntereses = num(prestamos.saldoPorCobrar)
  const puesto = {
    miPlata,
    conIntereses,
    // LA IDENTIDAD: lo que falta cobrar menos lo que es capital propio es,
    // exactamente, lo que falta por ganar. Nunca negativo.
    porGanar: Math.max(0, conIntereses - miPlata),
    ids: { miPlata: 'capitalEnCalle', conIntereses: 'porCobrar', porGanar: 'interesEnCartera' },
    rotulos: {
      miPlata: rotulo('capitalEnCalle'),
      conIntereses: rotulo('porCobrar'),
      porGanar: rotulo('interesEnCartera'),
    },
  }

  // ── 3 · ¿CUANTO PUEDO PRESTAR? ────────────────────────────────────────
  const disponible = {
    monto: num(finanzas.cajaDisponible),
    id: 'capitalDisponible',
    rotulo: rotulo('capitalDisponible'),
  }

  // ── 4 · ¿CUANTO ESTOY GANANDO? ────────────────────────────────────────
  //
  // ganancia = INTERES cobrado − gastos. NUNCA recaudado − gastos: la mayor
  // parte de lo que entra es capital propio volviendo, y recuperar tu plata no
  // es ganar. Con esa formula la cifra salia mas de cinco veces inflada.
  const interes = num(cobros.interesGanadoMes)
  const gastos = num(finanzas.gastosMes)
  const ganancia = interes - gastos
  const ganando = {
    ganancia,
    interes,
    gastos,
    // Sobre lo que tienes PUESTO, no sobre lo que prestaste alguna vez.
    pct: pct(ganancia, miPlata),
    ids: { ganancia: 'gananciaMes', interes: 'interesGanadoMes', gastos: 'gastosMes', pct: 'rentabilidadMes' },
    rotulos: {
      ganancia: rotulo('gananciaMes'),
      interes: rotulo('interesGanadoMes'),
      gastos: rotulo('gastosMes'),
      pct: rotulo('rentabilidadMes'),
    },
  }

  // ── 5 · ¿COMO VAN MIS RUTAS? ──────────────────────────────────────────
  //
  // Solo si tiene cobradores. A quien cobra solo, un desglose de una fila no le
  // dice nada y le ocupa media pantalla.
  const lista = Array.isArray(rutas) ? rutas : (rutas?.rutas ?? [])
  const conActividad = lista
    .filter((r) => num(r.esperadoHoy) > 0 || num(r.recaudadoHoy) > 0)
    .map((r) => ({
      id: r.id,
      nombre: r.nombre,
      cobrado: num(r.recaudadoHoy),
      meta: num(r.esperadoHoy),
      pct: num(r.esperadoHoy) > 0
        ? Math.min(100, Math.round((num(r.recaudadoHoy) / num(r.esperadoHoy)) * 100))
        : null,
    }))
    // La que peor va, primero: es a la que hay que llamar.
    .sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101))

  // ── LISTOS PARA RENOVAR ───────────────────────────────────────────────
  // Se queda arriba y visible: es de las que el dueño mira a diario.
  const renovar = {
    cantidad: num(alertas.listosParaRenovar),
    monto: num(alertas.renovarMonto),
    lista: Array.isArray(alertas.proximosACompletar) ? alertas.proximosACompletar : [],
  }

  return {
    hoy,
    puesto,
    disponible,
    ganando,
    rutas: conActividad,
    renovar,
    // Para la nota que lo explica. Determinista, sobre estas mismas cifras: un
    // narrador sobre cifras crudas es un amplificador de errores, y ese fallo ya
    // estaba vivo en el consejo que media contra el techo de la cartera.
    contexto: {
      clientes: num(data.clientes?.total),
      enMora: num(data.clientes?.enMora),
      saldoEnMora: num(data.clientes?.saldoEnMora),
      tieneCobradores: conActividad.length > 0,
    },
  }
}

/**
 * LA NOTA QUE LO EXPLICA — determinista, nunca un modelo sobre cifras crudas.
 *
 * Devuelve UNA frase, la que mas importa hoy, o null si no hay nada que decir.
 * Nada de consejos genéricos: cada rama se apoya en cifras que el propio panel
 * ya enseña, para que el dueño pueda comprobarla mirando arriba.
 *
 * ⚠ EL FORMATO DE MONEDA SE INYECTA, no se compone aqui.
 *
 * Este archivo no sabe en que pais esta el negocio. Componer «$369.000» a mano
 * dentro de una funcion de `lib/` es como salio un «369000» pelado en la caja
 * por ruta: el formato es del pais y vive en la interfaz. El que llama pasa su
 * `formatMoney` ya atado a su moneda.
 *
 * @param p    salida de `adaptarPanelDinero`
 * @param fmt  formateador de moneda del pais del usuario
 */
export function notaDelPanel(p, fmt = (n) => String(n)) {
  if (!p) return null
  const { hoy, puesto, disponible, ganando, contexto } = p

  // Lo primero que rompe un negocio de estos: quedarse sin caja para prestar
  // teniendo la calle llena.
  if (disponible.monto <= 0 && puesto.miPlata > 0) {
    return `No te queda caja para prestar: tienes ${fmt(puesto.miPlata)} afuera y nada disponible. Lo que entre hoy es lo único con lo que puedes volver a prestar.`
  }

  // ⚠ AQUI HABIA UNA RAMA DE MORA, Y SOBRABA.
  //
  // Decia «655 de tus 972 clientes estan atrasados (67%)» — exactamente la
  // misma cifra que la tarjeta blanca del panel dice tres centimetros mas
  // arriba, y la misma que repetia el consejo de IA. La mora se habria dicho
  // CUATRO veces en una pantalla.
  //
  // La cabecera de `Panel.jsx` ya fija la regla: «la mora se dice UNA vez».
  // Una nota que repite un numero visible no explica nada, solo ocupa sitio.
  // Esta nota es para lo que NO esta a la vista.

  // El dia va flojo.
  if (hoy.meta > 0 && hoy.pct !== null && hoy.pct < 50) {
    return `Llevas ${hoy.pct}% de lo que tocaba cobrar hoy: faltan ${fmt(Math.max(0, hoy.meta - hoy.cobrado))} por entrar.`
  }

  // Y si todo va bien, la frase que de verdad contesta «¿cómo me está yendo?».
  if (puesto.porGanar > 0) {
    return `Tienes ${fmt(puesto.miPlata)} afuera y, si todos terminan de pagar, vas a recibir ${fmt(puesto.porGanar)} de ganancia. Este mes llevas ${fmt(ganando.ganancia)}.`
  }

  return null
}
