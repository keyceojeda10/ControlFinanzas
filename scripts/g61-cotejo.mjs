// scripts/g61-cotejo.mjs — SOLO LECTURA. ¿El cableado real da lo que predijo
// la simulación?
//
// `g61-impacto.mjs` midió con el código VIEJO y simuló el nuevo aparte. Esto
// suma la mora con el código YA CABLEADO. Si las dos cifras coinciden, la
// simulación describía el cambio de verdad; si no, una de las dos miente y hay
// que averiguar cuál ANTES de desplegar.
//
//   node --import ./scripts/alias-loader.mjs scripts/g61-cotejo.mjs

import 'dotenv/config'
import mariadb from 'mariadb'
import { calcularMontoEnMora, tieneTablaAmortizacion } from '../lib/calculos.js'

const CLASICOS = ['fijo', 'unico', 'manual', 'proporcional']
const PREDICHO = 1306613757   // lo que dijo la simulación

const u = new URL(process.env.DATABASE_URL)
const pool = mariadb.createPool({
  host: u.hostname, port: Number(u.port) || 3306,
  user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
  database: u.pathname.slice(1), connectionLimit: 3,
})
const c = await pool.getConnection()

const filas = await c.query(`
  SELECT p.id, p.montoPrestado, p.totalAPagar, p.totalPagado, p.diasPlazo,
         p.modoInteres, p.frecuencia, p.fechaInicio, p.fechaFin, p.cuotaDiaria,
         p.diaCobroMes, p.diaCobroMes2
  FROM Prestamo p WHERE p.estado = 'activo'
`)

let n = 0, conMora = 0, total = 0
const porModo = {}

for (const p of filas) {
  if (!CLASICOS.includes(p.modoInteres || 'fijo')) continue
  const prestamo = { ...p, cuotasAmortizacion: [], pagos: [] }
  if (tieneTablaAmortizacion(prestamo)) continue
  n++
  const mora = Number(calcularMontoEnMora(prestamo)) || 0
  total += mora
  if (mora > 0) conMora++
  const m = p.modoInteres || 'fijo'
  porModo[m] ??= { n: 0, mora: 0 }
  porModo[m].n++; porModo[m].mora += mora
}

const $ = (v) => '$' + Math.round(v).toLocaleString('es-CO')
console.log('── G6.1 · cotejo: simulación vs cableado real ──\n')
console.log(`Préstamos clásicos activos ... ${n}`)
console.log(`Con mora ..................... ${conMora}`)
console.log(`MORA TOTAL (código cableado) . ${$(total)}`)
console.log(`Predicho por la simulación ... ${$(PREDICHO)}`)
const dif = total - PREDICHO
console.log(`DIFERENCIA ................... ${$(dif)}  ${Math.abs(dif) < 1000 ? '✓ coinciden' : '⚠ NO coinciden'}`)
console.log('\nPor modo:')
for (const [m, v] of Object.entries(porModo)) {
  console.log(`  ${m.padEnd(14)} ${String(v.n).padStart(5)} · ${$(v.mora)}`)
}

await c.release()
await pool.end()
