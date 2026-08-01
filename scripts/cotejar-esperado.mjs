// La vieja contra la nueva, prestamo por prestamo, sobre la cartera REAL.
//
// La prueba de equivalencia dice que coinciden para hoy sobre una rejilla
// sintetica. Si contra produccion NO coinciden, la rejilla no cubre algo que
// la cartera real si tiene. Este script lo encuentra en vez de suponerlo.
//
// SOLO LECTURA.
//
//   node --import ./scripts/alias-loader.mjs scripts/cotejar-esperado.mjs --org=xxx

import 'dotenv/config'
import mariadb from 'mariadb'
import { tienePeriodoEsperadoHoy } from '../lib/calculos.js'
import { tocaCobrarEn, cuotaDelPeriodo, inicioDia } from '../lib/dinero/esperado.js'
import { obtenerDiasSinCobro, esHoySinCobro, esHoyFestivo } from '../lib/dias-sin-cobro.js'

const org = process.argv.find((a) => a.startsWith('--org='))?.slice(6)
if (!org) throw new Error('falta --org=')

const url = new URL(process.env.DATABASE_URL)
const pool = mariadb.createPool({
  host: url.hostname, port: Number(url.port) || 3306,
  user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
  database: url.pathname.slice(1), connectionLimit: 3,
})

const plata = (n) => `$${Math.round(n).toLocaleString('es-CO')}`
const c = await pool.getConnection()
try {
  const orgRow = (await c.query('SELECT nombre, diasSinCobro FROM Organization WHERE id=?', [org]))[0]
  const festivos = await c.query('SELECT fecha FROM Festivo WHERE organizationId=?', [org])

  const filas = await c.query(
    `SELECT p.id, p.cuotaDiaria, p.frecuencia, p.fechaInicio, p.diasPlazo,
            p.diaCobroSemana, p.diaCobroMes, p.diaCobroMes2, p.diasSinCobro AS presDias,
            p.modoInteres, p.totalAPagar, p.totalPagado,
            cl.diasSinCobro AS cliDias, r.diasSinCobro AS rutaDias
       FROM Prestamo p
       JOIN Cliente cl ON cl.id = p.clienteId
       LEFT JOIN Ruta r ON r.id = cl.rutaId
      WHERE p.organizationId = ? AND p.estado='activo' AND p.esClavo=0
        AND cl.estado <> 'eliminado'`,
    [org],
  )

  const hoy = inicioDia()
  let vieja = 0, nueva = 0
  const discrepancias = []

  for (const f of filas) {
    const p = {
      id: f.id,
      cuotaDiaria: Number(f.cuotaDiaria),
      frecuencia: f.frecuencia,
      fechaInicio: f.fechaInicio,
      diasPlazo: f.diasPlazo,
      diaCobroSemana: f.diaCobroSemana,
      diaCobroMes: f.diaCobroMes,
      diaCobroMes2: f.diaCobroMes2,
      diasSinCobro: f.presDias,
      modoInteres: f.modoInteres,
      totalAPagar: Number(f.totalAPagar),
      totalPagado: Number(f.totalPagado),
      cuotasAmortizacion: [],
    }
    // La vieja resolvia los dias sin cobro SIN el prestamo; la nueva CON el.
    // Se prueban las dos, para separar el efecto del predicado del efecto del
    // override por prestamo.
    const cliente = { diasSinCobro: f.cliDias }
    const ruta = { diasSinCobro: f.rutaDias }
    const diasSinPrestamo = obtenerDiasSinCobro(cliente, ruta, orgRow)
    const diasConPrestamo = obtenerDiasSinCobro(cliente, ruta, orgRow, p)

    const hoySinCobro = esHoySinCobro(diasSinPrestamo) || esHoyFestivo(festivos)
    const v = tienePeriodoEsperadoHoy(p, hoySinCobro, diasSinPrestamo, festivos)
    const n = tocaCobrarEn(p, hoy, diasConPrestamo, festivos)

    const cuota = cuotaDelPeriodo(p)
    if (v) vieja += cuota
    if (n) nueva += cuota

    if (v !== n) {
      discrepancias.push({
        id: f.id, freq: f.frecuencia, cuota,
        inicio: new Date(f.fechaInicio).toISOString().slice(0, 10),
        ancla: f.diaCobroMes ?? f.diaCobroSemana ?? '(sin ancla)',
        override: f.presDias ?? null,
        vieja: v, nueva: n,
      })
    }
  }

  console.log(`\n══ ${orgRow.nombre} · ${filas.length} prestamos activos · hoy ${hoy.toISOString().slice(0, 10)} ══\n`)
  console.log(`   esperado con la VIEJA .... ${plata(vieja)}`)
  console.log(`   esperado con la NUEVA .... ${plata(nueva)}`)
  console.log(`   discrepancias ............ ${discrepancias.length}\n`)

  const porCausa = new Map()
  for (const d of discrepancias) {
    const k = `${d.freq} · ancla ${d.ancla} · override ${d.override ?? 'no'} · vieja=${d.vieja} nueva=${d.nueva}`
    if (!porCausa.has(k)) porCausa.set(k, { n: 0, monto: 0, ej: d })
    const e = porCausa.get(k); e.n += 1; e.monto += d.cuota
  }
  for (const [k, e] of [...porCausa.entries()].sort((a, b) => b[1].monto - a[1].monto)) {
    console.log(`   ${String(e.n).padStart(4)} × ${k}`)
    console.log(`        ${plata(e.monto).padStart(16)}   ej: inicio ${e.ej.inicio}, cuota ${plata(e.ej.cuota)}`)
  }
  console.log('')
} finally {
  c.release()
  await pool.end()
}
