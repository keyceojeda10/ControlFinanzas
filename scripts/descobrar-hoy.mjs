// scripts/descobrar-hoy.mjs — borra los cobros de HOY de la cartera de prueba.
//
// PARA QUÉ: para cotejar la pantalla de «cobro hecho» hay que cobrar, y cobrar
// deja al cliente en «Ya cobrado» — la guardia que impide el doble cobro. A la
// segunda vuelta ya no queda a quién cobrarle y no hay forma de repetir la
// prueba. Esto devuelve la ruta al estado de antes de empezar el día.
//
// SOLO LOCAL, igual que `sembrar-demo.mjs`: aborta si DATABASE_URL no apunta a
// localhost. Solo toca pagos de hoy; el histórico no se toca.

import fs from 'node:fs'

for (const linea of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = linea.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const url = new URL(process.env.DATABASE_URL)
if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
  console.error(`ABORTADO: DATABASE_URL apunta a ${url.hostname}, no a local.`)
  process.exit(1)
}

const { default: mariadb } = await import('mariadb')
const con = await mariadb.createConnection({
  host: '127.0.0.1', port: Number(url.port) || 3306,
  user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
})

// Los pagos de hoy, y el movimiento de caja que cada uno generó. El orden
// importa: el movimiento cuelga del pago.
const pagos = await con.query(
  'SELECT id, prestamoId, montoPagado FROM Pago WHERE DATE(fechaPago) = CURDATE()',
)
console.log(`pagos de hoy: ${pagos.length}`)

for (const p of pagos) {
  // El ledger no guarda `pagoId`: guarda `referenciaId` + `referenciaTipo`.
  await con.query('DELETE FROM MovimientoCapital WHERE referenciaId = ?', [p.id]).catch(() => {})
  await con.query('DELETE FROM Pago WHERE id = ?', [p.id])
}

// No hace falta tocar el préstamo: `saldoPendiente` NO es columna, se calcula
// en cada lectura sumando los pagos. Borrado el pago, el saldo vuelve solo.

console.log('listo — la ruta vuelve a tener cobros pendientes')
await con.end()
