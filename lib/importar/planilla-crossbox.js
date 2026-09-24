/* LA «PLANILLA RECAUDADOR» DE CROSSBOX — 24 sep 2026.
 *
 * Un prestamista que venía de Crossbox solo tenía su cartera en este PDF. Lo
 * convirtió a Excel y el importador dijo «No reconocí las columnas». Esto lee la
 * tabla a partir del texto con posiciones que da pdf.js (lib/importar/pdf-texto.js):
 *
 *   Fecha | U. Abono | Cliente | Teléfono | Crédito | Saldo | Cuota | Atrasadas | Vencidos
 *
 * Cada celda es una pieza de texto; un renglón son las piezas a la misma altura.
 * Se lee por los extremos: número, fecha y último abono al principio; crédito,
 * saldo, cuota, atrasadas y vencidos al final; teléfono y nombre en medio (el
 * nombre puede venir partido en varias piezas). La planilla NO trae tasa, cuotas,
 * frecuencia ni cédula: eso lo deduce lib/importar/deducir-condiciones.js.
 * Pura: sin pdf.js, sin base de datos.
 */
const MESES = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
  jan: 1, apr: 4, aug: 8, dec: 12,
}

/** «22 Sep 26» o «24 Sep 2026» → «2026-09-22». null si no es una fecha así. */
export function fechaCrossbox(texto) {
  const m = String(texto ?? '').trim().match(/^(\d{1,2}) ([A-Za-zé]{3})\w* (\d{2}|\d{4})$/)
  if (!m) return null
  const mes = MESES[m[2].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')]
  if (!mes) return null
  const anio = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
  return `${anio}-${String(mes).padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

const dinero = (s) => /^-?\$[\d,]+(\.\d{1,2})?$/.test(String(s).trim())
const pesos = (s) => Math.round(Number(String(s).replace(/[$,]/g, '')))
const entero = (s) => /^-?\d+$/.test(String(s).trim())

/** Las piezas de una página en renglones (misma altura ±3), cada uno de izquierda a derecha. */
function renglones(piezas) {
  const orden = piezas.filter((p) => String(p.str).trim()).sort((a, b) => b.y - a.y || a.x - b.x)
  const out = []
  for (const p of orden) {
    const r = out.find((x) => Math.abs(x.y - p.y) <= 3)
    if (r) r.piezas.push(p); else out.push({ y: p.y, piezas: [p] })
  }
  return out.map((r) => r.piezas.sort((a, b) => a.x - b.x).map((p) => String(p.str).trim()))
}

/**
 * paginas: [[{ str, x, y }]] — el texto de cada página con su posición.
 * null si no es la planilla de Crossbox.
 */
export function leerPlanillaCrossbox(paginas) {
  const plano = (paginas || []).map(renglones).flat()
  const texto = plano.map((r) => r.join(' ')).join('\n')
  if (!/Planilla Recaudador/i.test(texto) || !/Cr[eé]dito/.test(texto) || !/Atrasadas/.test(texto)) return null

  const cab = plano.find((r) => r.includes('Fecha:')) || []
  const fechaCorte = fechaCrossbox(cab[cab.indexOf('Fecha:') + 1])
  const iRuta = cab.indexOf('Ruta:')
  const ruta = iRuta >= 0 ? cab.slice(iRuta + 1).join(' ').trim() || null : null

  const filas = []
  let totales = null
  for (const r of plano) {
    if (r[0] === 'Totales' && r.length >= 4 && r.slice(1, 4).every(dinero)) {
      totales = { credito: pesos(r[1]), saldo: pesos(r[2]), cuota: pesos(r[3]) }
      continue
    }
    // [n, fecha, u.abono, …cliente…, teléfono?, crédito, saldo, cuota, atrasadas, vencidos]
    if (r.length < 9 || !entero(r[0]) || !fechaCrossbox(r[1])) continue
    const cola = r.slice(-5)
    if (!dinero(cola[0]) || !dinero(cola[1]) || !dinero(cola[2]) || !entero(cola[3]) || !entero(cola[4])) continue
    const medio = r.slice(3, -5)
    let telefono = ''
    if (medio.length > 1 && /^[\d\s+()-]{7,}$/.test(medio[medio.length - 1])) telefono = medio.pop().replace(/\D/g, '')
    const nunca = /^nunca$/i.test(r[2])
    filas.push({
      filaPlanilla: Number(r[0]),
      nombre: medio.join(' ').replace(/\s+/g, ' ').trim(),
      telefono,
      fechaInicio: fechaCrossbox(r[1]),
      ultimoAbono: nunca ? null : fechaCrossbox(r[2]),
      sinAbonos: nunca,
      montoPrestado: pesos(cola[0]),
      saldoActual: pesos(cola[1]),
      valorCuota: pesos(cola[2]),
      atrasadas: Number(cola[3]),
      vencidos: Number(cola[4]),
      fechaCorte,
    })
  }
  const suma = filas.reduce((a, f) => ({ credito: a.credito + f.montoPrestado, saldo: a.saldo + f.saldoActual }), { credito: 0, saldo: 0 })
  const cuadraConTotales = !!totales && totales.credito === suma.credito && totales.saldo === suma.saldo
  return { formato: 'crossbox-planilla', fechaCorte, ruta, filas, totales, suma, cuadraConTotales }
}
