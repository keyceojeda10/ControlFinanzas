// lib/dinero/recorrido-abierto.js — CUÁNTO DE LO PAGADO EN UN ABIERTO FUE CAPITAL.
//
// ══ POR QUÉ (5 nov 2026) ═══════════════════════════════════════════════════
//
// Se contaba en bloque: todo el interés asentado contra todos los «completo».
// Inversiones Jk (Yaneris Díaz) pagó el interés de noviembre como «intereses»
// y antes, el 3 oct, $250.000 como «completo». La cuenta en bloque le cargó al
// completo del 3 oct el interés de noviembre —que se venció un mes DESPUÉS—:
// el capital «subió» a $1.120.000 y se asentó diciembre por adelantado.
//
// La regla (Carlos, 5 nov 2026):
//   · lo pagado como «intereses» es interés, siempre, y paga los meses del más
//     viejo al más nuevo;
//   · un «completo» paga primero el interés que ya venció en su fecha y luego
//     el del mes que está corriendo (el cliente que paga el mes unos días
//     antes); lo que sobre baja capital;
//   · un «capital» es capital.
// La regla estricta («solo lo vencido ese día») ponía en mora a quien paga el
// mes antes del corte: unos 8 préstamos activos de varios negocios.
//
// ⚠ Un «completo» con fecha del día de inicio (o antes) es el abono previo de
// la carga, y se cuenta como antes de este cambio: para el capital con que
// empieza un mes no existe (`abono-previo-de-que-fue`); para el capital de hoy
// cubre el interés sin pagar y el resto es capital.
//
// ⚠ VIVE APARTE Y SIN IMPORTAR `calculos.js` a propósito: la usan
// `calcularCapitalRestante` (calculos.js) y `repartirPagado` (reparto.js), y
// `calculos.js` importa de `reparto.js`. Eran dos copias «gemelas» de la misma
// cuenta; ahora es una sola.

const HORA_MS = 60 * 60 * 1000

/** El día de Colombia de un instante, o el mismo 'YYYY-MM-DD' si ya lo es. */
function diaDe(x) {
  if (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)) return x
  return new Date(new Date(x).getTime() - 5 * HORA_MS).toISOString().slice(0, 10)
}

const sumar = (lista) => lista.reduce((a, p) => a + (Number(p.montoPagado) || 0), 0)

/**
 * @param {object} prestamo  `pagos` (fechaPago, tipo, montoPagado), `devengos`
 *   (periodo, interes), `fechaInicio`, `montoPrestado`
 * @param {{ hasta?: Date|string|number|null, base?: number }} [opciones]
 *   `hasta`: cuenta solo lo de ese día o antes (el capital con que empieza un
 *   mes); sin él, todo. `base`: el capital de arranque (por defecto `montoPrestado`).
 * @returns {{ capital: number, aCapital: number, interesDebido: number }}
 *   `aCapital`: lo que los pagos bajaron del capital, sin tope.
 */
export function recorridoDelAbierto(prestamo, { hasta = null, base } = {}) {
  const inicial = Number(base ?? prestamo?.montoPrestado) || 0
  const pagos = prestamo?.pagos ?? []
  const devengos = prestamo?.devengos ?? []
  const deTipo = (lista, t) => lista.filter((p) => p.tipo === t)

  /* Un `select` que no pidió las fechas no deja ordenar nada: se cuenta en
     bloque, como antes. Con tope las fechas son obligatorias (lo vigila
     `capitalAbiertoAlDia`). */
  if (hasta == null && (pagos.some((p) => !p?.fechaPago) || devengos.some((d) => !d?.periodo))) {
    const devengado = devengos.reduce((a, d) => a + (Number(d.interes) || 0), 0)
    const sinPagar = Math.max(0, devengado - sumar(deTipo(pagos, 'intereses')))
    const completos = sumar(deTipo(pagos, 'completo'))
    const aCapital = sumar(deTipo(pagos, 'capital')) + Math.max(0, completos - sinPagar)
    return { capital: Math.max(0, Math.round(inicial - aCapital)), aCapital, interesDebido: Math.max(0, Math.round(sinPagar - completos)) }
  }

  const tope = hasta != null ? diaDe(hasta) : null
  const arranque = prestamo?.fechaInicio ? diaDe(prestamo.fechaInicio) : ''
  const meses = devengos
    .map((d) => ({ dia: String(d.periodo).slice(0, 10), resta: Number(d.interes) || 0 }))
    .filter((m) => tope == null || m.dia <= tope)
    .sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : 0))
  const hastaTope = pagos
    .filter((p) => p?.fechaPago)
    .map((p) => ({ ...p, dia: diaDe(p.fechaPago) }))
    .filter((p) => tope == null || p.dia <= tope)

  // 1. Lo pagado como interés, del mes más viejo al más nuevo.
  let credito = sumar(deTipo(hastaTope, 'intereses'))
  for (const m of meses) {
    const c = Math.min(credito, m.resta)
    m.resta -= c
    credito -= c
  }

  // 2b. Cada completo, en orden: lo vencido a su fecha y el mes que corre; el resto, capital.
  let aCapital = sumar(deTipo(hastaTope, 'capital'))

  /* 2a. El abono previo de la carga (un completo del día de inicio o antes) se
     cuenta igual que siempre: cubre el interés que haya sin pagar y lo que
     sobra es capital; para el capital con que empieza un mes no cuenta. */
  if (tope == null) {
    for (const p of hastaTope.filter((x) => x.tipo === 'completo' && x.dia <= arranque)) {
      let monto = Number(p.montoPagado) || 0
      for (const m of meses) {
        const c = Math.min(monto, m.resta)
        m.resta -= c
        monto -= c
      }
      aCapital += monto
    }
  }

  const completos = hastaTope
    .filter((p) => p.tipo === 'completo' && p.dia > arranque)
    .sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : 0))
  for (const p of completos) {
    let monto = Number(p.montoPagado) || 0
    const cierreDelMes = meses.find((m) => m.dia > p.dia)?.dia
    for (const m of meses) {
      if (!(monto > 0)) break
      if (m.dia > p.dia && m.dia !== cierreDelMes) break
      const c = Math.min(monto, m.resta)
      m.resta -= c
      monto -= c
    }
    aCapital += monto
  }

  const interesDebido = meses.reduce((a, m) => a + m.resta, 0)
  return { capital: Math.max(0, Math.round(inicial - aCapital)), aCapital, interesDebido: Math.max(0, Math.round(interesDebido)) }
}
