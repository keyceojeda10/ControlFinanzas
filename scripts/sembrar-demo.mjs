// scripts/sembrar-demo.mjs — cartera de prueba para poder auditar las pantallas.
//
// PARA QUÉ: una cuenta vacía enseña estados vacíos, no pantallas. Sin clientes
// ni préstamos, el panel muestra el onboarding y las listas su estado vacío,
// así que no hay nada que comparar contra el rediseño.
//
// SOLO LOCAL. Aborta si DATABASE_URL no apunta a localhost.
// Reversible: `node scripts/sembrar-demo.mjs --borrar` deja la base como estaba.
//
// Los datos imitan los casos del handoff a propósito: un cliente en mora de 36
// días, uno con atraso leve, varios al día, una ruta sin cobrador y un clavo.
// Son los casos que el rediseño trata distinto; con una cartera "bonita" no se
// ve si el riel de estado o la pastilla de días funcionan.

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

const [org] = await con.query('SELECT id, country FROM Organization LIMIT 1')
const [dueno] = await con.query('SELECT id FROM User WHERE organizationId = ? LIMIT 1', [org.id])
if (!org || !dueno) { console.error('ABORTADO: no hay organización. Regístrate primero.'); process.exit(1) }

const MARCA = '30099'   // prefijo de telefono reservado para los datos de prueba

if (process.argv.includes('--borrar')) {
  // Prestamo no tiene campo de notas, asi que la marca vive en el CLIENTE
  // (referencia) y todo lo demas se borra colgando de el.
  await con.query(
    `DELETE p FROM Pago p
       JOIN Prestamo pr ON pr.id = p.prestamoId
       JOIN Cliente c ON c.id = pr.clienteId
      WHERE c.telefono LIKE ?`, [`${MARCA}%`])
  await con.query(
    `DELETE pr FROM Prestamo pr JOIN Cliente c ON c.id = pr.clienteId
      WHERE c.telefono LIKE ?`, [`${MARCA}%`])
  await con.query('DELETE FROM Cliente WHERE telefono LIKE ?', [`${MARCA}%`])
  await con.query('DELETE FROM Ruta WHERE nombre LIKE ?', ['%(demo)'])
  console.log('datos de auditoría borrados')
  await con.end()
  process.exit(0)
}

const id = (p) => `${p}_${Math.random().toString(36).slice(2, 12)}`
const dia = 86400000
const fecha = (hace) => new Date(Date.now() - hace * dia).toISOString().slice(0, 10) + ' 05:00:00'

// ── Rutas. Una queda SIN COBRADOR a propósito: es el agujero que el rediseño
//    muestra como agujero, y sin él no se puede verificar esa tarjeta.
const rutas = [
  { id: id('rt'), nombre: 'Bolivariana (demo)', cobradorId: dueno.id },
  { id: id('rt'), nombre: 'Ruta sur (demo)', cobradorId: null },
]
for (const r of rutas) {
  await con.query(
    'INSERT INTO Ruta (id, organizationId, nombre, cobradorId, activo, createdAt) VALUES (?,?,?,?,1,NOW())',
    [r.id, org.id, r.nombre, r.cobradorId]
  )
}

// ── Clientes y préstamos, cubriendo los casos que el diseño trata distinto.
const CASOS = [
  { nombre: 'Steven Olmos',        ruta: 0, dir: 'Cl 8 # 31-05',   monto: 500000,  total: 600000,  cuota: 20000, pagados: 6,  atraso: 36 },
  { nombre: 'Carlitos Chaparro',   ruta: 0, dir: 'Cra 9 # 12-40',  monto: 680000,  total: 779000,  cuota: 17334, pagados: 13, atraso: 4 },
  { nombre: 'María Fernanda Restrepo Vélez', ruta: 0, dir: 'Cra 12 # 4-18', monto: 900000, total: 1080000, cuota: 24000, pagados: 11, atraso: 0 },
  { nombre: 'Jhoan Sebastián Cruz', ruta: 1, dir: 'Cl 52 # 8-40',  monto: 600000,  total: 750000,  cuota: 50000, pagados: 8,  atraso: 0 },
  { nombre: 'Marta Lucía Ríos',    ruta: 1, dir: 'Cra 45 # 12-30', monto: 1000000, total: 1200000, cuota: 0,     pagados: 0,  atraso: 0, unico: true },
  { nombre: 'Julián Vélez',        ruta: 0, dir: 'Cl 65 # 22-14',  monto: 184733,  total: 220000,  cuota: 8000,  pagados: 2,  atraso: 35, clavo: true },
]

let creados = 0
for (const c of CASOS) {
  const cid = id('cl')
  await con.query(
    `INSERT INTO Cliente (id, organizationId, nombre, cedula, telefono, referencia, rutaId, estado, createdAt)
     VALUES (?,?,?,?,?,?,?, 'activo', NOW())`,
    // Cedula unica por corrida: la tabla tiene indice unico (org, cedula) y
    // una siembra a medias dejaria la siguiente sin poder empezar.
    [cid, org.id, c.nombre, String(Date.now()).slice(-8) + String(creados),
     MARCA + String(creados).padStart(5, '0'), c.dir, rutas[c.ruta].id]
  )

  const pid = id('pr')
  const totalPagado = c.cuota * c.pagados
  await con.query(
    `INSERT INTO Prestamo
       (id, organizationId, clienteId, montoPrestado, totalAPagar, cuotaDiaria,
        diasPlazo, frecuencia, modoInteres, tasaInteres, totalPagado, estado, esClavo,
        fechaInicio, fechaFin, createdAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,'activo',?,?,?,NOW())`,
    [pid, org.id, cid, c.monto, c.total, c.cuota,
     30, c.unico ? 'mensual' : 'diario', c.unico ? 'unico' : 'fijo', 20,
     totalPagado, c.clavo ? 1 : 0, fecha(30 + c.atraso), fecha(c.atraso - 1)]
  )

  for (let n = 0; n < c.pagados; n++) {
    await con.query(
      `INSERT INTO Pago (id, organizationId, prestamoId, cobradorId, montoPagado, tipo, metodoPago, fechaPago, createdAt)
       VALUES (?,?,?,?,?, 'completo', ?, ?, NOW())`,
      [id('pg'), org.id, pid, dueno.id, c.cuota, n % 2 ? 'nequi' : 'efectivo', fecha(30 - n)]
    )
  }
  creados++
}

// ── Caja con saldo, para que "Mi plata" y el extracto tengan qué enseñar.
const [capital] = await con.query('SELECT id FROM Capital WHERE organizationId = ?', [org.id])
if (capital) await con.query('UPDATE Capital SET saldo = ? WHERE id = ?', [2520280, capital.id])
// Capital es la unica de estas tablas con updatedAt obligatorio.
else await con.query('INSERT INTO Capital (id, organizationId, saldo, updatedAt) VALUES (?,?,?,NOW())', [id('cap'), org.id, 2520280])

await con.query(
  `INSERT INTO GastoMenor (id, organizationId, description, monto, fecha, estado)
   VALUES (?,?,?,?,?, 'aprobado')`,
  [id('gs'), org.id, 'Almuerzo', 10000, fecha(3)]
)

await con.end()
console.log(`sembrados ${creados} clientes con préstamo, ${rutas.length} rutas (una sin cobrador), caja y un gasto.`)
console.log('para deshacer: node scripts/sembrar-demo.mjs --borrar')
