// scripts/reconstruir-pagos.mjs — el historial de pagos que nunca se guardó.
//
// ── QUÉ RECONSTRUYE ────────────────────────────────────────────────────────
// `Suscripcion` es UNA fila por organización y renovar la pisa: `montoCOP`, la
// fecha y el id de la transacción se sobrescriben. Así que de los pagos
// anteriores no quedaba nada y la pregunta «¿cuánto entró este mes?» no tenía
// respuesta. El libro (`PagoSuscripcion`) arregla el futuro; esto rescata el
// pasado.
//
// El rastro sobrevivió en `AdminLog`, con el monto escrito dentro de la frase:
//
//   pago_aprobado → Pago aprobado por wompi #1485602-…-25463. Plan: starter. Monto: $39000
//   pago_directo  → Plan starter asignado (pago directo). Período: Mensual. Monto: $39.000. …
//
// ── POR QUÉ ES SEGURO ──────────────────────────────────────────────────────
// Solo INSERTA. No actualiza ni borra una sola fila existente, ni toca
// `Suscripcion`, ni `Organization`. Y es idempotente: cada apunte lleva una
// llave única —el id real de la transacción cuando lo hay, y `adminlog:<id>`
// cuando el pago se registró a mano— así que correrlo dos veces no duplica
// nada.
//
// ⚠ Las filas quedan marcadas `origen = 'reconstruido'`. No son lo mismo que un
//   pago registrado en vivo: el monto viene de leer un texto. Si algún día una
//   cifra no cuadra, se sabe de cuáles dudar.
//
// ── CÓMO SE CORRE ──────────────────────────────────────────────────────────
//   node scripts/reconstruir-pagos.mjs              (solo mira y cuenta)
//   node scripts/reconstruir-pagos.mjs --aplicar    (escribe)
//
// Lee DATABASE_URL de .env, así que apunta a donde apunte el .env. Primero el
// espejo, se cuadra, y solo entonces producción.

import mysql from 'mysql2/promise'
import fs from 'node:fs'
import { leerApunteDeAdminLog } from '../lib/libro-pagos.js'

const APLICAR = process.argv.includes('--aplicar')

/* La variable de entorno gana sobre el .env: así se apunta al espejo o a un
   túnel sin tocar el fichero (y sin dejarlo apuntando a producción por olvido). */
const url = process.env.DATABASE_URL
  || /DATABASE_URL="?([^"\n]+)/.exec(fs.readFileSync('.env', 'utf8'))?.[1]
if (!url) throw new Error('No encontré DATABASE_URL ni en el entorno ni en .env')
const u = new URL(url)
const cx = await mysql.createConnection({
  host: u.hostname,
  port: u.port || 3306,
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database: u.pathname.slice(1),
  /* ⚠ SIN ESTO LOS MESES SALEN CORRIDOS. mysql2 interpreta las columnas
     DATETIME como hora LOCAL de quien corre el script, pero la base las guarda
     en UTC. Sin `timezone: 'Z'` el resumen de aquí no coincidía con el de la
     pantalla: junio salía $259.001 corto y julio $141.001 largo. */
  timezone: 'Z',
})

const plata = (n) => '$' + Math.round(n).toLocaleString('es-CO')

const [logs] = await cx.query(`
  SELECT id, adminId, organizacionId, accion, detalle, createdAt
  FROM AdminLog
  WHERE accion IN ('pago_directo','pago_aprobado')
  ORDER BY createdAt ASC
`)

console.log(`base    : ${u.pathname.slice(1)}`)
console.log(`registros de activación: ${logs.length}`)

const apuntes = []
const ilegibles = []
const sinOrg = []

for (const log of logs) {
  const a = leerApunteDeAdminLog(log)
  if (!a)                 { ilegibles.push(log); continue }
  if (!log.organizacionId) { sinOrg.push(log);   continue }
  if (a.montoCOP <= 0)     { continue }          // cortesías y planes de $0
  apuntes.push({ ...a, organizationId: log.organizacionId, fecha: log.createdAt })
}

/* ── La segunda fuente ──────────────────────────────────────────────────────
 * Hay 8 suscripciones con monto cobrado cuya organización NO tiene ni un
 * registro de activación: son de febrero a julio, de antes de que se registrara
 * todo, y valen $603.000. Se rescatan de la propia suscripción.
 *
 * No pueden duplicarse: la condición es que la organización no tenga NINGÚN
 * apunte en `AdminLog`, así que nada de lo suyo entró por la vía de arriba.
 * Van con `gateway = 'desconocido'` porque eso es exactamente lo que se sabe. */
const [huerfanas] = await cx.query(`
  SELECT s.id, s.organizationId, s.plan, s.montoCOP, s.fechaInicio
  FROM Suscripcion s
  WHERE s.montoCOP > 0
    AND NOT EXISTS (
      SELECT 1 FROM AdminLog a
      WHERE a.organizacionId = s.organizationId
        AND a.accion IN ('pago_directo','pago_aprobado'))
  ORDER BY s.fechaInicio ASC
`)
for (const s of huerfanas) {
  apuntes.push({
    organizationId: s.organizationId,
    plan: s.plan,
    montoCOP: s.montoCOP,
    periodo: 'mensual',
    gateway: 'desconocido',
    gatewayId: `susc:${s.id}`,
    adminId: null,
    fecha: s.fechaInicio,
  })
}
if (huerfanas.length) console.log(`+ ${huerfanas.length} rescatadas de suscripciones sin registro`)

/* Nada de recortes en silencio: lo que no se pudo leer se dice. */
if (ilegibles.length) {
  console.log(`\n⚠ ${ilegibles.length} sin formato reconocido (NO se apuntan):`)
  for (const l of ilegibles.slice(0, 5)) console.log(`    ${l.accion} · ${String(l.detalle).slice(0, 90)}`)
}
if (sinOrg.length) console.log(`⚠ ${sinOrg.length} sin organización (NO se apuntan)`)

/* El mes se corta en Bogotá, igual que en /api/admin/inicio: el servidor corre
   en UTC y lo cobrado a las 19:00 del día 31 es del mes que acaba, no del
   siguiente. */
const mesBogota = (d) => {
  const b = new Date(new Date(d).getTime() - 5 * 3600000)
  return `${b.getUTCFullYear()}-${String(b.getUTCMonth() + 1).padStart(2, '0')}`
}

const porMes = {}
for (const a of apuntes) {
  const k = mesBogota(a.fecha)
  porMes[k] = porMes[k] ?? { n: 0, total: 0 }
  porMes[k].n += 1
  porMes[k].total += a.montoCOP
}

console.log(`\nlegibles: ${apuntes.length}   total: ${plata(apuntes.reduce((s, a) => s + a.montoCOP, 0))}\n`)
console.log('  mes       pagos   entró')
for (const k of Object.keys(porMes).sort()) {
  console.log(`  ${k}   ${String(porMes[k].n).padStart(5)}   ${plata(porMes[k].total).padStart(12)}`)
}

if (!APLICAR) {
  console.log('\n(nada escrito — pasa --aplicar para guardarlo)')
  await cx.end()
  process.exit(0)
}

let escritos = 0
let repetidos = 0
for (const a of apuntes) {
  const [[ya]] = await cx.query('SELECT id FROM PagoSuscripcion WHERE gatewayId = ?', [a.gatewayId])
  if (ya) { repetidos++; continue }
  await cx.query(
    `INSERT INTO PagoSuscripcion
       (id, organizationId, plan, montoCOP, periodo, gateway, gatewayId, referencia, adminId, origen, fecha)
     VALUES (?,?,?,?,?,?,?,NULL,?,'reconstruido',?)`,
    [
      `rec_${a.gatewayId}`.slice(0, 190).replace(/[^a-zA-Z0-9_:-]/g, '_'),
      a.organizationId, a.plan, a.montoCOP, a.periodo, a.gateway, a.gatewayId, a.adminId, a.fecha,
    ],
  )
  escritos++
}

console.log(`\nescritos : ${escritos}`)
console.log(`ya estaban: ${repetidos}`)

const [[tot]] = await cx.query('SELECT COUNT(*) n, SUM(montoCOP) s FROM PagoSuscripcion')
console.log(`libro    : ${tot.n} apuntes · ${plata(tot.s ?? 0)}`)

await cx.end()
