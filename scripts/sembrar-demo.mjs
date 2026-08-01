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
  // Las cuotas cuelgan del prestamo con onDelete: Cascade, pero eso lo aplica
  // PRISMA, no la base: por SQL directo hay que borrarlas a mano o quedan
  // huerfanas y la siguiente siembra arranca con basura.
  await con.query(
    `DELETE q FROM CuotaAmortizacion q
       JOIN Prestamo pr ON pr.id = q.prestamoId
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
  // Dos préstamos abiertos a la vez. La tarjeta enseña "Deuda total", que aquí
  // es una suma: sin este caso no se ve nunca si el conteo aparece o no, y
  // tres créditos abiertos y uno solo se leen idénticos.
  { nombre: 'Ana Milena Guzmán',   ruta: 1, dir: 'Cl 30 # 7-22',   monto: 400000,  total: 480000,  cuota: 16000, pagados: 5,  atraso: 0, extra: { monto: 250000, total: 300000, cuota: 10000, pagados: 3, atraso: 9 } },
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

  // El segundo préstamo del mismo cliente, cuando el caso lo pide.
  if (c.extra) {
    const e = c.extra
    const eid = id('pr')
    await con.query(
      `INSERT INTO Prestamo
         (id, organizationId, clienteId, montoPrestado, totalAPagar, cuotaDiaria,
          diasPlazo, frecuencia, modoInteres, tasaInteres, totalPagado, estado, esClavo,
          fechaInicio, fechaFin, createdAt)
       VALUES (?,?,?,?,?,?,?, 'diario', 'fijo', ?,?, 'activo', 0, ?,?,NOW())`,
      [eid, org.id, cid, e.monto, e.total, e.cuota, 30, 20,
       e.cuota * e.pagados, fecha(30 + e.atraso), fecha(e.atraso - 1)]
    )
    for (let n = 0; n < e.pagados; n++) {
      await con.query(
        `INSERT INTO Pago (id, organizationId, prestamoId, cobradorId, montoPagado, tipo, metodoPago, fechaPago, createdAt)
         VALUES (?,?,?,?,?, 'completo', 'efectivo', ?, NOW())`,
        [id('pg'), org.id, eid, dueno.id, e.cuota, fecha(30 - n)]
      )
    }
  }

  creados++
}

// ── LOS DOS MODOS CON TABLA ────────────────────────────────────────────────
//
// No habia ni uno. Los 8 casos de arriba son `fijo` y `unico`, o sea el 73% de la
// cartera, y los 4 modos que SI tienen calendario —`lineal`, `lineal_dinamico`,
// `solo_interes`, `saldo`, el 6,2%— no aparecian en la siembra. Consecuencia: la
// tabla de amortizacion no se podia cotejar contra su lamina porque no habia
// ningun prestamo local que la enseñara. Una pantalla sin datos no se puede
// comparar con nada.
//
// El primero es LITERALMENTE el ejemplo de T12-01: $1.000.000, 20%, 6 meses,
// decreciente dinamico. Con las mismas cifras el cotejo deja de ser «se parece» y
// pasa a ser numero contra numero.
const CON_TABLA = [
  {
    nombre: 'Carlos Prueba 1', dir: 'Cl 21 # 14-60', ruta: 0,
    monto: 1000000, modo: 'lineal_dinamico', frecuencia: 'mensual',
    tasa: 20, periodos: 6,
    // Decreciente dinamico: el capital se reparte parejo y el interes se cobra
    // sobre el SALDO, asi que la parte dorada se encoge mes a mes. Eso es lo que
    // la barra partida tiene que enseñar sin que se lea un numero.
    cuota: (n, cap) => {
      const capitalCuota = Math.round(cap / 6)
      const saldoAntes = cap - capitalCuota * (n - 1)
      const interes = Math.round(saldoAntes * 0.20)
      return { capital: capitalCuota, interes }
    },
  },
  {
    // Globo: solo interes cada periodo y el capital entero al final. Es el modo
    // que hoy se recomienda para las lineas de credito, y su tabla es el caso
    // raro donde 5 de 6 filas son identicas y la ultima es enorme.
    nombre: 'Prueba Globo', dir: 'Cra 33 # 9-11', ruta: 1,
    monto: 2000000, modo: 'solo_interes', frecuencia: 'mensual',
    tasa: 5, periodos: 6,
    cuota: (n, cap) => ({ capital: n === 6 ? cap : 0, interes: Math.round(cap * 0.05) }),
  },
]

for (const t of CON_TABLA) {
  const cid = id('cl')
  await con.query(
    `INSERT INTO Cliente (id, organizationId, nombre, cedula, telefono, referencia, rutaId, estado, createdAt)
     VALUES (?,?,?,?,?,?,?, 'activo', NOW())`,
    [cid, org.id, t.nombre, String(Date.now()).slice(-8) + String(creados),
     MARCA + String(creados).padStart(5, '0'), t.dir, rutas[t.ruta].id]
  )

  const pid = id('pr')
  const diasPlazo = t.periodos * 30
  // El total sale de SUMAR las cuotas, no de una constante a mano. Con `1699999`
  // escrito aparte, la suma de las 6 filas daba 1.700.001 y la pantalla enseñaba un
  // «total» que no cuadraba con sus propias filas — por 2 pesos, pero en una tabla
  // que se le manda al cliente eso es una discusion. Los prestamos de verdad los
  // calcula `calcularPrestamo`, que ya los deja consistentes.
  const filas = Array.from({ length: t.periodos }, (_, i) => t.cuota(i + 1, t.monto))
  const totalReal = filas.reduce((a, f) => a + f.capital + f.interes, 0)
  await con.query(
    `INSERT INTO Prestamo
       (id, organizationId, clienteId, montoPrestado, totalAPagar, cuotaDiaria,
        diasPlazo, frecuencia, modoInteres, tasaInteres, totalPagado, estado, esClavo,
        fechaInicio, fechaFin, createdAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,0,'activo',0,?,?,NOW())`,
    // `cuotaDiaria` es la PRIMERA cuota, no cero. Lo tenia en 0 y el boton de la
    // ficha decia «REGISTRAR PAGO MENSUAL $0», los atajos de monto se quedaban sin
    // «Cuota» y la proyeccion no podia contar cuotas cubiertas. Los prestamos de
    // verdad la traen de `calcularPrestamo`; un dato de prueba que no se parece al
    // real solo sirve para cotejar pantallas que nunca fallan.
    [pid, org.id, cid, t.monto, totalReal, Math.round(filas[0].capital + filas[0].interes),
     diasPlazo, t.frecuencia, t.modo, t.tasa,
     // Empezado hace 10 dias: la cuota 1 aun no vence, asi que es la SIGUIENTE y
     // lleva la pastilla dorada. Con el prestamo empezado hace tres meses las
     // tres primeras saldrian apagadas y no se veria la pastilla.
     fecha(10), fecha(10 - diasPlazo)]
  )

  let saldo = t.monto
  for (let n = 1; n <= t.periodos; n++) {
    const { capital: cap, interes } = filas[n - 1]
    saldo -= cap
    await con.query(
      `INSERT INTO CuotaAmortizacion
         (id, prestamoId, numeroPeriodo, capital, interes, cuotaTotal, saldoRestante,
          pagado, interesPagado, fechaEsperada)
       VALUES (?,?,?,?,?,?,?,0,0,?)`,
      // La fecha esperada va con el convenio T05:00Z, igual que todo lo que
      // escribe fechas en este sistema: en produccion (UTC) un guardado a las
      // 00:00 locales cae el dia anterior.
      [id('cu'), pid, n, cap, interes, cap + interes, Math.max(0, saldo),
       new Date(Date.now() + (n * 30 - 10) * dia).toISOString().slice(0, 10) + ' 05:00:00']
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
console.log(`sembrados ${creados} clientes con préstamo (2 con tabla de amortización), ${rutas.length} rutas (una sin cobrador), caja y un gasto.`)
console.log('para deshacer: node scripts/sembrar-demo.mjs --borrar')
