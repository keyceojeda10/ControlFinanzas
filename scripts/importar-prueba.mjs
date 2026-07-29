// scripts/importar-prueba.mjs — la importación de verdad, contra la BD local.
//
// POR QUÉ EXISTE: el lector y el puente están probados, pero unas pruebas
// verdes no son una importación. Lo que hay que ver es cuántas FILAS quedan en
// la tabla al final. Si salen 68 clientes y la cartera son ~128 millones, está
// bien; si sale 1, el agrupado por cédula se me escapó.
//
//   node scripts/importar-prueba.mjs            # cuenta antes, importa, cuenta después
//   node scripts/importar-prueba.mjs --borrar   # deshace (borra los SIN- de esta corrida)
//
// Aborta si DATABASE_URL no apunta a localhost.

import fs from 'node:fs'
import path from 'node:path'
import * as XLSX from 'xlsx'
import mysql from 'mysql2/promise'
import { leerExcel } from '../lib/importar/excel.js'
import { aCargaMasiva } from '../lib/importar/aCargaMasiva.js'

const ARCHIVO = path.join(process.cwd(), 'CF Diseño 2026', 'Docuemntos para prueba',
  'cred-activos-general-7c08518ae74-2026-07-15-16_15_33.328.xlsx')
const BORRAR = process.argv.includes('--borrar')
const SEMILLA = 'imp'

const env = fs.readFileSync('.env', 'utf8')
const url = /DATABASE_URL\s*=\s*["']?([^"'\n\r]+)/.exec(env)?.[1]
if (!url || !/localhost|127\.0\.0\.1/.test(url)) {
  console.error('ABORTO: DATABASE_URL no apunta a localhost.')
  process.exit(1)
}

const u = new URL(url)
const con = await mysql.createConnection({
  host: u.hostname, port: u.port || 3306,
  user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
  database: u.pathname.slice(1),
})

const contar = async () => {
  const [[c]] = await con.query('SELECT COUNT(*) n FROM Cliente')
  const [[p]] = await con.query('SELECT COUNT(*) n, COALESCE(SUM(montoPrestado),0) m FROM Prestamo')
  const [[s]] = await con.query("SELECT COUNT(*) n FROM Cliente WHERE cedula LIKE 'SIN-%'")
  return { clientes: c.n, prestamos: p.n, capital: Number(p.m), marcadores: s.n }
}

if (BORRAR) {
  const [r] = await con.query(
    "DELETE FROM Prestamo WHERE clienteId IN (SELECT id FROM Cliente WHERE cedula LIKE ?)", [`SIN-${SEMILLA}%`])
  const [r2] = await con.query("DELETE FROM Cliente WHERE cedula LIKE ?", [`SIN-${SEMILLA}%`])

  // LOS MOVIMIENTOS DE CAPITAL TAMBIÉN. Borrar solo préstamos y clientes deja
  // los desembolsos en el libro: la primera vez dejé 136 apuntes por
  // $256.000.000 y el panel enseñaba «Toda tu plata −$249.410.062». Una caja en
  // rojo por basura de pruebas es indistinguible de una caja en rojo de verdad.
  const [r3] = await con.query(
    "DELETE FROM MovimientoCapital WHERE tipo = 'desembolso' AND descripcion LIKE '%masiva%'")
  const [r4] = await con.query('SELECT id, saldo FROM Capital LIMIT 1')
  if (r4.length) {
    const [[suma]] = await con.query(
      "SELECT COALESCE(SUM(CASE WHEN tipo IN ('desembolso','gasto','retiro') THEN -monto ELSE monto END), 0) s FROM MovimientoCapital")
    await con.query('UPDATE Capital SET saldo = ? WHERE id = ?', [Number(suma.s), r4[0].id])
  }
  console.log(`borrados ${r2.affectedRows} clientes, ${r.affectedRows} préstamos y ${r3.affectedRows} movimientos de capital`)
  await con.end()
  process.exit(0)
}

const antes = await contar()
console.log('ANTES  ', antes)

// ── Leer el archivo por el mismo camino que la app ──
const wb = XLSX.read(fs.readFileSync(ARCHIVO), { type: 'buffer' })
const hoja = wb.Sheets[wb.SheetNames[0]]
const lectura = leerExcel(XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: '' }))
console.log(`leídas ${lectura.filas.length} filas · escala ×${lectura.escala.factor} (mediana ${lectura.escala.mediana})`)

const { filas, descartadas } = aCargaMasiva(lectura.filas, { semilla: SEMILLA, hoy: new Date().toISOString().slice(0, 10) })
console.log(`a importar ${filas.length} · descartadas ${descartadas.length}`, descartadas.slice(0, 5))
console.log(`claves distintas: ${new Set(filas.map((f) => f.cedula)).size}`)

// ── Llamar al endpoint real, con la sesión de auditoría ──
const { cookie } = JSON.parse(fs.readFileSync('.auditoria/sesion.json', 'utf8'))
const res = await fetch('http://localhost:3000/api/carga-masiva/importar', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', cookie: `${cookie.name}=${cookie.value}` },
  body: JSON.stringify({ filas }),
})
const data = await res.json().catch(() => ({}))
console.log(`\nHTTP ${res.status}`, JSON.stringify(data).slice(0, 600))

const despues = await contar()
console.log('\nDESPUÉS', despues)
console.log('\nDIFERENCIA')
console.log(`  clientes  +${despues.clientes - antes.clientes}   (esperado +${filas.length})`)
console.log(`  préstamos +${despues.prestamos - antes.prestamos}   (esperado +${filas.length})`)
console.log(`  capital   +${(despues.capital - antes.capital).toLocaleString('es-CO')}`)

const ok = despues.clientes - antes.clientes === filas.length
console.log(`\n${ok ? 'OK' : 'MAL'}: ${ok ? 'un cliente por fila' : 'las filas NO se separaron en clientes distintos'}`)

await con.end()
