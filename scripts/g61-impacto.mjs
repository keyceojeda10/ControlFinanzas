// scripts/g61-impacto.mjs — SOLO LECTURA. Cuánto se movería la mora si el modo
// clásico dejara de medirla con la fórmula plana y pasara a la tabla derivada.
//
// No cambia una línea de producción: llama a las DOS rutas sobre los mismos
// préstamos y resta. Es el paso 6 de la verificación —«si los deltas son
// exactamente los previstos, desplegar»— hecho ANTES de cablear, que es cuando
// todavía se puede decidir.
//
//   node --import ./scripts/alias-loader.mjs scripts/g61-impacto.mjs

import 'dotenv/config'
import mariadb from 'mariadb'
import { calcularMontoEnMora, tieneTablaAmortizacion } from '../lib/calculos.js'
import { derivarTabla } from '../lib/dinero/tabla.js'
import { inicioDia } from '../lib/dinero/esperado.js'

const CLASICOS = ['fijo', 'unico', 'manual', 'proporcional']

function url() {
  const u = new URL(process.env.DATABASE_URL)
  return {
    host: u.hostname, port: Number(u.port) || 3306,
    user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
    database: u.pathname.slice(1), connectionLimit: 3,
  }
}

/** La mora según la tabla derivada: lo vencido que no se ha cubierto. */
function moraSegunTabla(prestamo, hoy) {
  const filas = derivarTabla(prestamo)
  if (!filas.length) return null
  const corte = inicioDia(hoy)
  const vencido = filas
    .filter((f) => inicioDia(f.fechaEsperada) <= corte)
    .reduce((a, f) => a + f.cuotaTotal, 0)
  const pagado = Number(prestamo.totalPagado) || 0
  return Math.max(0, vencido - pagado)
}

const pool = mariadb.createPool(url())
const c = await pool.getConnection()

const prestamos = await c.query(`
  SELECT p.id, p.montoPrestado, p.totalAPagar, p.totalPagado,
         p.modoInteres, p.frecuencia, p.diasPlazo, p.fechaInicio, p.cuotaDiaria,
         p.diaCobroMes, p.diaCobroMes2, p.estado, p.fechaFin,
         o.nombre AS org, cl.nombre AS cliente
  FROM Prestamo p
  JOIN Organization o ON o.id = p.organizationId
  LEFT JOIN Cliente cl ON cl.id = p.clienteId
  WHERE p.estado = 'activo'
`)

const hoy = Date.now()
let n = 0, conMoraAntes = 0, conMoraDespues = 0
let moraAntes = 0, moraDespues = 0
const porModo = {}
const mayores = []

for (const p of prestamos) {
  if (!CLASICOS.includes(p.modoInteres || 'fijo')) continue
  const prestamo = { ...p, cuotasAmortizacion: [], pagos: [] }
  if (tieneTablaAmortizacion(prestamo)) continue   // no es clásico de verdad
  n++

  const antes = Number(calcularMontoEnMora(prestamo)) || 0
  const despues = moraSegunTabla(prestamo, hoy)
  if (despues == null) continue

  moraAntes += antes
  moraDespues += despues
  if (antes > 0) conMoraAntes++
  if (despues > 0) conMoraDespues++

  const m = p.modoInteres || 'fijo'
  porModo[m] ??= { n: 0, antes: 0, despues: 0 }
  porModo[m].n++; porModo[m].antes += antes; porModo[m].despues += despues

  const delta = despues - antes
  if (Math.abs(delta) > 0) mayores.push({ cliente: p.cliente, org: p.org, modo: m, antes, despues, delta })
}

mayores.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
const $ = (v) => '$' + Math.round(v).toLocaleString('es-CO')

console.log('── G6.1 · qué pasa si el modo clásico mide la mora con la tabla ──\n')
console.log(`Préstamos activos de modo clásico ... ${n}`)
console.log(`Con mora HOY (fórmula plana) ........ ${conMoraAntes}`)
console.log(`Con mora con la tabla derivada ...... ${conMoraDespues}`)
console.log(`\nMora total ANTES .................... ${$(moraAntes)}`)
console.log(`Mora total DESPUÉS .................. ${$(moraDespues)}`)
const dif = moraDespues - moraAntes
const pct = moraAntes > 0 ? ((dif / moraAntes) * 100).toFixed(1) : 'n/a'
console.log(`DIFERENCIA .......................... ${$(dif)}  (${pct}%)`)

console.log('\nPor modo:')
for (const [m, v] of Object.entries(porModo)) {
  console.log(`  ${m.padEnd(14)} ${String(v.n).padStart(5)} préstamos · ${$(v.antes)} → ${$(v.despues)}`)
}

console.log(`\nPréstamos donde la cifra cambia: ${mayores.length} de ${n}`)
console.log('Los seis mayores:')
for (const f of mayores.slice(0, 6)) {
  console.log(`  ${(f.cliente || '?').slice(0, 22).padEnd(23)} ${f.modo.padEnd(8)} ${$(f.antes)} → ${$(f.despues)}`)
}

await c.release()
await pool.end()
