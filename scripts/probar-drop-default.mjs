// ¿Por qué `ALTER COLUMN ... DROP DEFAULT` no quita el valor por defecto?
//
// En el espejo la sentencia corre sin error y la columna se queda igual. Se
// prueban las tres formas sobre una tabla DE MENTIRA para ver cuál funciona de
// verdad en este MariaDB, sin tocar `Lead`.
//
//   node scripts/probar-drop-default.mjs

import mysql from 'mysql2/promise'
import fs from 'node:fs'

const u = new URL(/DATABASE_URL="?([^"\n]+)/.exec(fs.readFileSync('.env', 'utf8'))[1])
const cx = await mysql.createConnection({
  host: u.hostname, port: u.port || 3306,
  user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
  database: u.pathname.slice(1),
})

const [[v]] = await cx.query('SELECT VERSION() v')
console.log('motor:', v.v)

await cx.query('DROP TABLE IF EXISTS _prueba_default')
await cx.query('CREATE TABLE _prueba_default (id INT PRIMARY KEY, updatedAt DATETIME(3) NOT NULL DEFAULT current_timestamp(3))')

const ver = async (m) => {
  const [r] = await cx.query("SHOW COLUMNS FROM _prueba_default WHERE Field='updatedAt'")
  console.log(`  ${m}: Default=${r[0].Default ?? 'NULL'}`)
  return r[0].Default
}

await ver('creada')

console.log('\n1) ALTER COLUMN ... DROP DEFAULT')
await cx.query('ALTER TABLE _prueba_default ALTER COLUMN `updatedAt` DROP DEFAULT')
const tras1 = await ver('tras')

if (tras1) {
  console.log('\n2) MODIFY COLUMN sin DEFAULT')
  await cx.query('ALTER TABLE _prueba_default MODIFY COLUMN `updatedAt` DATETIME(3) NOT NULL')
  const tras2 = await ver('tras')
  if (!tras2) console.log('\n→ La que sirve es MODIFY COLUMN.')
} else {
  console.log('\n→ En una tabla limpia SÍ funciona. El problema es otro.')
}

await cx.query('DROP TABLE IF EXISTS _prueba_default')
console.log('\n(tabla de prueba borrada)')
await cx.end()
