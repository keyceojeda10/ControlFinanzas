// scripts/unico-devengo.mjs — SOLO LECTURA. Cuánto pesa la decisión de la
// curva de devengo en cuota única.
//
// Hoy `interesPara()` devuelve `capital * tasa` para `unico` e IGNORA los
// meses: todo el interés se devenga el día del desembolso. Esto mide qué
// cambiaría si se devengara con el tiempo, para poder decidir con cifras.
//
//   node --import ./scripts/alias-loader.mjs scripts/unico-devengo.mjs

import 'dotenv/config'
import mariadb from 'mariadb'

const u = new URL(process.env.DATABASE_URL)
const pool = mariadb.createPool({
  host: u.hostname, port: Number(u.port) || 3306,
  user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
  database: u.pathname.slice(1), connectionLimit: 3,
})
const c = await pool.getConnection()

const filas = await c.query(`
  SELECT p.id, p.montoPrestado, p.totalAPagar, p.totalPagado, p.diasPlazo,
         p.fechaInicio, p.fechaFin, p.tasaInteres, o.nombre AS org
  FROM Prestamo p JOIN Organization o ON o.id = p.organizationId
  WHERE p.estado = 'activo' AND p.modoInteres = 'unico'
`)

const hoy = Date.now()
const $ = (v) => '$' + Math.round(v).toLocaleString('es-CO')

let capital = 0, interesPactado = 0, devengadoLineal = 0
let sinVencer = 0, vencidos = 0
const plazos = {}
let interesEnJuego = 0   // lo que HOY se cobra de mas frente al lineal

for (const p of filas) {
  const cap = Number(p.montoPrestado) || 0
  const total = Number(p.totalAPagar) || 0
  const int = Math.max(0, total - cap)
  capital += cap
  interesPactado += int

  const ini = new Date(p.fechaInicio).getTime()
  const fin = p.fechaFin ? new Date(p.fechaFin).getTime() : ini + (Number(p.diasPlazo) || 30) * 86400000
  const largo = Math.max(1, fin - ini)
  const corrido = Math.min(largo, Math.max(0, hoy - ini))
  const fraccion = corrido / largo

  devengadoLineal += int * fraccion
  interesEnJuego += int * (1 - fraccion)
  if (hoy < fin) sinVencer++; else vencidos++

  const d = Number(p.diasPlazo) || 0
  const cubo = d <= 30 ? '≤30 días' : d <= 60 ? '31-60' : d <= 90 ? '61-90' : d <= 180 ? '91-180' : '>180'
  plazos[cubo] = (plazos[cubo] || 0) + 1
}

console.log('── Cuota única: cuánto pesa la curva de devengo ──\n')
console.log(`Préstamos activos de cuota única .. ${filas.length}`)
console.log(`  aún NO vencidos ................. ${sinVencer}`)
console.log(`  ya vencidos ..................... ${vencidos}`)
console.log(`\nCapital en la calle ............... ${$(capital)}`)
console.log(`Interés pactado ................... ${$(interesPactado)}`)
console.log(`\nHOY se considera devengado ........ ${$(interesPactado)}  (el 100%, desde el dia 1)`)
console.log(`Con curva lineal se devengaria .... ${$(devengadoLineal)}`)
console.log(`DIFERENCIA (interes aun no ganado)  ${$(interesEnJuego)}`)
console.log('\nPlazos:')
for (const [k, v] of Object.entries(plazos).sort()) console.log(`  ${k.padEnd(10)} ${v}`)

await c.release()
await pool.end()
