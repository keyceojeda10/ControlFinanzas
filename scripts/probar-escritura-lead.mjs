// ¿Se puede seguir escribiendo en `Lead` sin el valor por defecto?
//
// Es LA pregunta que deja cerrado el arreglo de `Lead.updatedAt`. Quitar el
// `DEFAULT current_timestamp(3)` sólo rompería a quien insertara SIN traer la
// columna. Prisma siempre la trae en un campo `@updatedAt` — pero eso hay que
// verlo, no suponerlo, porque si fallara se caería la entrada de leads de los
// anuncios y nadie se enteraría hasta que dejaran de llegar.
//
// Va por SQL crudo a propósito: reproduce EXACTAMENTE la forma del INSERT que
// manda Prisma (con `updatedAt` incluido) sin tener que montar el adaptador de
// MariaDB que Prisma 7 exige. Lo que se prueba es la COLUMNA, no el ORM.
//
// Crea una fila de mentira, la modifica, comprueba que la fecha avanza y la
// borra. No deja rastro.
//
//   node scripts/probar-escritura-lead.mjs

import mysql from 'mysql2/promise'
import fs from 'node:fs'

const u = new URL(/DATABASE_URL="?([^"\n]+)/.exec(fs.readFileSync('.env', 'utf8'))[1])
const cx = await mysql.createConnection({
  host: u.hostname, port: u.port || 3306,
  user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
  database: u.pathname.slice(1),
})

// `Lead` es palabra reservada en MariaDB: sin las comillas oblicuas es un error
// de sintaxis.
const T = '`Lead`'
const id = `PRUEBA-BORRAR-${Date.now()}`
let creada = false

try {
  await cx.query(
    `INSERT INTO ${T} (id, nombre, telefono, estado, createdAt, updatedAt) VALUES (?,?,?,?,NOW(3),NOW(3))`,
    [id, 'PRUEBA BORRAR', '+000000000000', 'nuevo'],
  )
  creada = true
  const [[a]] = await cx.query(`SELECT updatedAt FROM ${T} WHERE id=?`, [id])
  console.log('INSERT trayendo updatedAt (como hace Prisma): OK ·', a.updatedAt)

  await new Promise((r) => setTimeout(r, 1100))
  await cx.query(`UPDATE ${T} SET estado=?, updatedAt=NOW(3) WHERE id=?`, ['contactado', id])
  const [[b]] = await cx.query(`SELECT updatedAt FROM ${T} WHERE id=?`, [id])
  const avanzo = b.updatedAt.getTime() > a.updatedAt.getTime()
  console.log('UPDATE:', avanzo ? 'OK · la fecha avanzó' : '✗ la fecha NO avanzó')

  // Y la comprobación que de verdad importa: SIN la columna tiene que fallar.
  // Es lo que confirma que el valor por defecto ya no está y que nadie puede
  // apoyarse en él sin darse cuenta.
  let fallo = false
  try {
    await cx.query(`INSERT INTO ${T} (id, nombre, telefono, estado, createdAt) VALUES (?,?,?,?,NOW(3))`,
      [`${id}-sin`, 'PRUEBA SIN UPDATEDAT', '+000000000000', 'nuevo'])
    await cx.query(`DELETE FROM ${T} WHERE id=?`, [`${id}-sin`])
  } catch {
    fallo = true
  }
  console.log('INSERT sin updatedAt:', fallo
    ? 'falla, como debe (ya no hay valor por defecto)'
    : '⚠ pasó — el valor por defecto sigue ahí')

  if (!avanzo) process.exitCode = 1
  else console.log('\nEscribir y editar leads sigue funcionando.')
} finally {
  if (creada) {
    await cx.query(`DELETE FROM ${T} WHERE id=?`, [id])
    console.log('(fila de prueba borrada)')
  }
  const [[n]] = await cx.query(`SELECT COUNT(*) n FROM ${T}`)
  console.log('filas reales:', n.n)
  await cx.end()
}
