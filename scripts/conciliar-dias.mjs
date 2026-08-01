// Concilia N dias de una organizacion, dia a dia. SOLO LECTURA.
//
// Es la demostracion de que la conciliacion nueva SI puede decir que no cuadra,
// contra el libro real del cliente que se queja.
//
//   node --import ./scripts/alias-loader.mjs scripts/conciliar-dias.mjs --org=xxx --dias=60

import 'dotenv/config'
import mariadb from 'mariadb'
import { ALCANCE, resumirLibro, conciliar } from '../lib/dinero/conciliacion.js'

const org = process.argv.find((a) => a.startsWith('--org='))?.slice(6)
const dias = Number(process.argv.find((a) => a.startsWith('--dias='))?.slice(7)) || 60
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
  const o = (await c.query('SELECT nombre FROM Organization WHERE id=?', [org]))[0]
  console.log(`\n══ ${o.nombre.slice(0, 44)} · ultimos ${dias} dias ══\n`)

  let conDescuadre = 0, sanos = 0, sinMovimiento = 0
  let peor = null
  const filas = []

  for (let i = dias; i >= 0; i--) {
    // Dia Colombia: de las 05:00Z a las 05:00Z del siguiente.
    const base = new Date(Date.now() - i * 86400000)
    const y = base.getUTCFullYear(), m = base.getUTCMonth(), d = base.getUTCDate()
    const ini = new Date(Date.UTC(y, m, d, 5))
    const fin = new Date(ini.getTime() + 86400000)
    const fecha = ini.toISOString().slice(0, 10)

    const movimientos = await c.query(
      `SELECT tipo, monto, saldoAnterior, saldoNuevo, descripcion, metodoPago, createdAt
         FROM MovimientoCapital
        WHERE organizationId=? AND createdAt >= ? AND createdAt < ?
        ORDER BY createdAt ASC`,
      [org, ini, fin],
    )
    if (!movimientos.length) { sinMovimiento++; continue }

    const pagos = (await c.query(
      `SELECT COALESCE(SUM(p.montoPagado),0) t,
              COALESCE(SUM(CASE WHEN p.metodoPago='transferencia' THEN p.montoPagado ELSE 0 END),0) digital
         FROM Pago p JOIN Prestamo pr ON pr.id=p.prestamoId
        WHERE p.organizationId=? AND p.fechaPago >= ? AND p.fechaPago < ?
          AND p.tipo NOT IN ('recargo','descuento') AND pr.estado <> 'cancelado'`,
      [org, ini, fin],
    ))[0]

    const gastos = (await c.query(
      `SELECT COALESCE(SUM(monto),0) t FROM GastoMenor
        WHERE organizationId=? AND estado='aprobado' AND fecha >= ? AND fecha < ?`,
      [org, ini, fin],
    ))[0]

    const desem = (await c.query(
      `SELECT COALESCE(SUM(monto),0) t FROM MovimientoCapital
        WHERE organizationId=? AND tipo='desembolso' AND createdAt >= ? AND createdAt < ?`,
      [org, ini, fin],
    ))[0]

    const libro = resumirLibro(movimientos)
    const r = conciliar({
      alcance: ALCANCE.ORGANIZACION,
      libro,
      operaciones: {
        pagos: Number(pagos.t), pagosDigital: Number(pagos.digital),
        pagosEfectivo: Number(pagos.t) - Number(pagos.digital),
        gastos: Number(gastos.t), desembolsos: Number(desem.t),
      },
    })

    if (r.cuadra) sanos++
    else {
      conDescuadre++
      if (!peor || Math.abs(r.diferencias.sinExplicar) > Math.abs(peor.diferencias.sinExplicar)) {
        peor = { ...r, fecha }
      }
    }
    filas.push({ fecha, ...r.diferencias, movs: movimientos.length, sinEfecto: libro.sinEfecto })
  }

  console.log(`   dias cuadrados ......... ${sanos}`)
  console.log(`   dias CON DESCUADRE ..... ${conDescuadre}`)
  console.log(`   dias sin movimiento .... ${sinMovimiento}\n`)

  const rotos = filas.filter((f) => f.sinExplicar !== 0 || f.recaudo !== 0 || f.gastos !== 0 || f.desembolsos !== 0)
  if (rotos.length) {
    console.log('   fecha        difRecaudo        difGastos   difDesembolsos     sinExplicar   movs')
    for (const f of rotos.slice(-18)) {
      console.log(`   ${f.fecha}  ${plata(f.recaudo).padStart(15)} ${plata(f.gastos).padStart(15)} ${plata(f.desembolsos).padStart(15)} ${plata(f.sinExplicar).padStart(15)}   ${f.movs}`)
    }
  }

  if (peor) {
    console.log(`\n   ── el peor dia: ${peor.fecha} ──`)
    console.log(`      abrio en ................ ${plata(peor.libro.apertura)}`)
    console.log(`      entro ................... ${plata(peor.libro.recaudo)}  (efectivo ${plata(peor.libro.recaudoEfectivo)} · digital ${plata(peor.libro.recaudoDigital)})`)
    console.log(`      presto .................. ${plata(peor.libro.desembolsos)}`)
    console.log(`      gasto ................... ${plata(peor.libro.gastos)}`)
    console.log(`      inyecciones / retiros ... ${plata(peor.libro.inyecciones)} / ${plata(peor.libro.retiros)}`)
    console.log(`      correcciones ............ ${plata(peor.libro.ajustes)}`)
    console.log(`      cerro en ................ ${plata(peor.libro.cierre)}`)
    console.log(`      ► SIN EXPLICAR .......... ${plata(peor.diferencias.sinExplicar)}`)
    if (peor.libro.sinEfecto) {
      console.log(`      (${peor.libro.sinEfectoCantidad} asiento(s) por ${plata(peor.libro.sinEfecto)} que NO movieron efectivo)`)
    }
  }
  console.log('')
} finally {
  c.release()
  await pool.end()
}
