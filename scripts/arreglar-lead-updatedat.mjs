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
// ── POR QUÉ NO SE ARREGLABA SOLO ───────────────────────────────────────────
// El SQL que propone Prisma —`ALTER COLUMN ... DROP DEFAULT`— **no funciona en
// este motor**. MariaDB 10.11 lo acepta SIN ERROR y deja la columna igual, así
// que `CF_APLICAR_ESQUEMA=1` habría dicho «aplicado» y el desfase seguiría ahí
// en el siguiente despliegue. Para siempre.
//
// Comprobado sobre una tabla de mentira (`scripts/probar-drop-default.mjs`):
//   ALTER COLUMN `updatedAt` DROP DEFAULT      → Default=current_timestamp(3) ❌
//   MODIFY COLUMN `updatedAt` DATETIME(3) NOT NULL → Default=NULL ✅
//
// Por eso aquí va `MODIFY COLUMN`, y por eso el script COMPRUEBA el resultado
// en vez de fiarse de que la sentencia no reventó.
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

// El tipo y la nulabilidad se leen de la propia columna en vez de escribirlos a
// mano: `MODIFY COLUMN` REDEFINE la columna entera, así que teclear aquí un
// `DATETIME(3)` que no coincida con el vivo cambiaría el tipo de paso.
const SQL = 'ALTER TABLE `Lead` MODIFY COLUMN `updatedAt` '
  + `${antes.Type.toUpperCase()} ${antes.Null === 'NO' ? 'NOT NULL' : 'NULL'}`

if (!APLICAR) {
  console.log('\nEsto es lo que se haría:')
  console.log(`   ${SQL};`)
  console.log('\n(NO el `ALTER COLUMN ... DROP DEFAULT` que propone Prisma: este')
  console.log(' motor lo acepta sin error y no hace nada. Ver la cabecera.)')
  console.log('\nNo se ha tocado nada. Para aplicarlo, repetir con --aplicar')
  await cx.end()
  process.exit(0)
}

await cx.query(SQL)

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
