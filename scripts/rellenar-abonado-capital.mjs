// scripts/rellenar-abonado-capital.mjs — poblar `Prestamo.abonadoCapital`.
//
// La columna es nueva y arranca en 0. Hasta que se rellene, los préstamos que ya
// tienen un abono a capital seguirían enseñando la fecha inventada: la cascada
// no tendría qué restar.
//
// ── POR QUÉ ES SEGURO ──────────────────────────────────────────────────────
// El valor está DERIVADO de la tabla `Pago`: es la suma de los pagos de tipo
// `capital` de cada préstamo. No hay nada que decidir ni que adivinar, no toca
// ninguna otra columna, y correrlo dos veces da lo mismo.
//
//   node scripts/rellenar-abonado-capital.mjs             (solo mira)
//   node scripts/rellenar-abonado-capital.mjs --aplicar   (escribe)

import mysql from 'mysql2/promise'
import fs from 'node:fs'

const APLICAR = process.argv.includes('--aplicar')

const url = process.env.DATABASE_URL
  || /DATABASE_URL="?([^"\n]+)/.exec(fs.readFileSync('.env', 'utf8'))?.[1]
if (!url) throw new Error('No encontré DATABASE_URL')
const u = new URL(url)
const cx = await mysql.createConnection({
  host: u.hostname, port: u.port || 3306,
  user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
  database: u.pathname.slice(1), timezone: 'Z',
})

const plata = (n) => '$' + Math.round(n || 0).toLocaleString('es-CO')
const q = async (s, p = []) => (await cx.query(s, p))[0]

const [pend] = await q(`
  SELECT COUNT(*) n, ROUND(COALESCE(SUM(t.abonos),0)) total FROM (
    SELECT p.id, SUM(g.montoPagado) abonos
    FROM Prestamo p JOIN Pago g ON g.prestamoId = p.id AND g.tipo = 'capital'
    GROUP BY p.id
  ) t`)
console.log(`base    : ${u.pathname.slice(1)}`)
console.log(`préstamos con abono a capital: ${pend.n}  ·  ${plata(pend.total)}`)

const [vivos] = await q(`
  SELECT COUNT(DISTINCT p.id) n FROM Prestamo p
  JOIN Pago g ON g.prestamoId = p.id AND g.tipo = 'capital'
  WHERE p.estado = 'activo' AND EXISTS (SELECT 1 FROM CuotaAmortizacion c WHERE c.prestamoId = p.id)`)
console.log(`de esos, VIVOS y con tabla (los que hoy enseñan mal la fecha): ${vivos.n}`)

const [yaBien] = await q('SELECT COUNT(*) n FROM Prestamo WHERE abonadoCapital > 0')
console.log(`ya rellenados: ${yaBien.n}`)

if (!APLICAR) {
  console.log('\n(nada escrito — pasa --aplicar para guardarlo)')
  await cx.end()
  process.exit(0)
}

const [r] = await q(`
  UPDATE Prestamo p
  SET p.abonadoCapital = (
    SELECT COALESCE(SUM(g.montoPagado), 0) FROM Pago g
    WHERE g.prestamoId = p.id AND g.tipo = 'capital'
  )
  WHERE EXISTS (SELECT 1 FROM Pago g WHERE g.prestamoId = p.id AND g.tipo = 'capital')`)
console.log(`\nfilas escritas: ${r.affectedRows}`)

/* La comprobación que importa: que ni uno se quede corto o largo. */
const [mal] = await q(`
  SELECT COUNT(*) n FROM Prestamo p
  WHERE ROUND(p.abonadoCapital) <> ROUND((
    SELECT COALESCE(SUM(g.montoPagado), 0) FROM Pago g
    WHERE g.prestamoId = p.id AND g.tipo = 'capital'))`)
console.log(`préstamos que NO cuadran con sus pagos: ${mal.n}${mal.n ? '  ⚠' : '  (ninguno)'}`)

await cx.end()
