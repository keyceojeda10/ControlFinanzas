// El desfase que detenía TODOS los despliegues.
//
// ── QUÉ PASABA ─────────────────────────────────────────────────────────────
// `bash /home/deploy-sistema.sh` se paraba SIEMPRE con esto, aunque el cambio
// que se estuviera desplegando no tocara la base:
//
//     ALTER TABLE `Lead` ALTER COLUMN `updatedAt` DROP DEFAULT;
//
// La guardia está bien puesta —compara la base viva con `schema.prisma` y no
// deja pasar un despliegue con la base desincronizada—, pero como el desfase no
// se arreglaba nunca, salía en cada release y había que rodearla a mano. Una
// guardia que siempre grita deja de leerse, y ese es el día que se cuela algo.
//
// ── QUÉ LADO ESTÁ MAL ──────────────────────────────────────────────────────
// El de la BASE. Medido: de las 8 tablas con `updatedAt`, SIETE no llevan valor
// por defecto y sólo `Lead` lo lleva. `schema.prisma:808` dice `@updatedAt` sin
// `@default`, que es lo mismo que dicen las otras siete.
//
// ── POR QUÉ ES SEGURO ──────────────────────────────────────────────────────
// El valor por defecto sólo lo usaría un INSERT que no traiga la columna. Todas
// las escrituras a `Lead` pasan por Prisma —comprobado: no hay un solo SQL crudo
// que inserte ahí— y Prisma SIEMPRE manda `updatedAt` en un campo `@updatedAt`.
// O sea que ese valor por defecto no lo estaba usando nadie.
//
// No toca datos: es sólo la definición de la columna. Las 1.289 filas se quedan
// como están, con sus fechas.
//
//   node --import ./scripts/alias-loader.mjs scripts/arreglar-lead-updatedat.mjs
//   node --import ./scripts/alias-loader.mjs scripts/arreglar-lead-updatedat.mjs --aplicar

import mysql from 'mysql2/promise'
import fs from 'node:fs'

const APLICAR = process.argv.includes('--aplicar')

const url = /DATABASE_URL="?([^"\n]+)/.exec(fs.readFileSync('.env', 'utf8'))?.[1]
if (!url) throw new Error('No encontré DATABASE_URL en .env')
const u = new URL(url)
const cx = await mysql.createConnection({
  host: u.hostname,
  port: u.port || 3306,
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database: u.pathname.slice(1),
})

const columna = async () => {
  const [r] = await cx.query("SHOW COLUMNS FROM Lead WHERE Field='updatedAt'")
  return r[0]
}

const antes = await columna()
const [[filas]] = await cx.query('SELECT COUNT(*) n FROM Lead')
console.log(`base    : ${u.pathname.slice(1)}`)
console.log(`filas   : ${filas.n}`)
console.log(`ANTES   : Default=${antes.Default ?? 'NULL'} · Extra="${antes.Extra}"`)

if (!antes.Default) {
  console.log('\nYa está como lo pide el esquema. No hay nada que hacer.')
  await cx.end()
  process.exit(0)
}

if (!APLICAR) {
  console.log('\nEsto es lo que se haría:')
  console.log('   ALTER TABLE `Lead` ALTER COLUMN `updatedAt` DROP DEFAULT;')
  console.log('\nNo se ha tocado nada. Para aplicarlo, repetir con --aplicar')
  await cx.end()
  process.exit(0)
}

await cx.query('ALTER TABLE `Lead` ALTER COLUMN `updatedAt` DROP DEFAULT')

const despues = await columna()
const [[filasDespues]] = await cx.query('SELECT COUNT(*) n FROM Lead')
console.log(`DESPUES : Default=${despues.Default ?? 'NULL'} · Extra="${despues.Extra}"`)
console.log(`filas   : ${filasDespues.n} ${filasDespues.n === filas.n ? '(intactas)' : '⚠ CAMBIARON'}`)

if (despues.Default) {
  console.error('\n⚠ El valor por defecto sigue ahí. Revisar a mano.')
  process.exitCode = 1
} else if (filasDespues.n !== filas.n) {
  console.error('\n⚠ Cambió el número de filas. Esto NO debía pasar.')
  process.exitCode = 1
} else {
  console.log('\nListo. `prisma migrate diff` debería salir vacío y el deploy dejar de pararse.')
}

await cx.end()
