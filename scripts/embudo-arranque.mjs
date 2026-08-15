// scripts/embudo-arranque.mjs — dónde se cae la gente nueva, paso a paso.
//
// ── POR QUÉ ────────────────────────────────────────────────────────────────
// De los 29 que se registraron con la campaña nueva (12-15 ago 2026), 26
// entraron, 16 crearon un cliente —ONCE de ellos exactamente uno— y **uno solo**
// terminó el arranque. 17 no pasaron de «traer tu cartera»: nueve se quedaron
// ahí y ocho la saltaron.
//
// Eso lo dice `Organization.onboardingStep`. Lo que NO decía es qué pasa DENTRO
// del paso 2, que son tres pantallas seguidas con el mismo número: la de
// planes, la de elegir método, y la foto o el Excel. Sin separarlas no se sabe
// si se van ante el precio, ante las tres opciones, o intentando la foto — y
// son tres arreglos distintos.
//
// Desde el 15 ago 2026 se apuntan esas bifurcaciones y el resultado de cada
// lectura de foto. Este informe las lee.
//
//   node scripts/embudo-arranque.mjs           (últimos 7 días)
//   node scripts/embudo-arranque.mjs 14        (últimos 14)

import mysql from 'mysql2/promise'
import fs from 'node:fs'

const DIAS = Number(process.argv[2]) || 7

const url = process.env.DATABASE_URL
  || /DATABASE_URL="?([^"\n]+)/.exec(fs.readFileSync('.env', 'utf8'))?.[1]
if (!url) throw new Error('No encontré DATABASE_URL')
const u = new URL(url)
const cx = await mysql.createConnection({
  host: u.hostname, port: u.port || 3306,
  user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
  database: u.pathname.slice(1), timezone: 'Z',
})
const q = async (s, p = []) => (await cx.query(s, p))[0]
const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '—')

const INTERNOS = "('keycejob@gmail.com','ccaojd@gmail.com','owner@test.com','controlfinanzasgmail@gmail.com')"

/* ── 1 · El embudo grueso, de la base ─────────────────────────────────────── */
const [g] = await q(`
  SELECT COUNT(*) registrados,
    SUM(u.lastLoginAt IS NOT NULL) entraron,
    SUM(o.onboardingStep >= 1) eligieron_perfil,
    SUM(o.onboardingStep >= 2) llegaron_a_cartera,
    SUM(o.onboardingStep = 3) la_saltaron,
    SUM(o.onboardingStep = 99) terminaron,
    SUM(EXISTS(SELECT 1 FROM Cliente c WHERE c.organizationId = o.id)) con_cliente,
    SUM((SELECT COUNT(*) FROM Cliente c WHERE c.organizationId = o.id) >= 5) con_5_clientes
  FROM Organization o JOIN User u ON u.organizationId = o.id AND u.rol = 'owner'
  WHERE u.email NOT IN ${INTERNOS} AND o.createdAt > DATE_SUB(NOW(), INTERVAL ? DAY)`, [DIAS])

console.log(`\n══ ARRANQUE · últimos ${DIAS} días ══\n`)
const n = g.registrados
console.log(`  se registraron            ${String(n).padStart(4)}`)
console.log(`  entraron                  ${String(g.entraron).padStart(4)}  ${pct(g.entraron, n)}`)
console.log(`  eligieron perfil          ${String(g.eligieron_perfil).padStart(4)}  ${pct(g.eligieron_perfil, n)}`)
console.log(`  llegaron a «tu cartera»   ${String(g.llegaron_a_cartera).padStart(4)}  ${pct(g.llegaron_a_cartera, n)}`)
console.log(`  la SALTARON               ${String(g.la_saltaron).padStart(4)}  ${pct(g.la_saltaron, n)}`)
console.log(`  cargaron 1+ cliente       ${String(g.con_cliente).padStart(4)}  ${pct(g.con_cliente, n)}`)
console.log(`  cargaron 5+ clientes      ${String(g.con_5_clientes).padStart(4)}  ${pct(g.con_5_clientes, n)}`)
console.log(`  terminaron el arranque    ${String(g.terminaron).padStart(4)}  ${pct(g.terminaron, n)}`)

/* ── 2 · Lo que la base no ve: dentro del paso 2 ──────────────────────────── */
console.log(`\n  dentro de «traer tu cartera»:`)
const ev = await q(`
  SELECT evento, COUNT(*) veces, COUNT(DISTINCT organizationId) negocios
  FROM Evento
  WHERE evento LIKE 'onb\\_%' AND createdAt > DATE_SUB(NOW(), INTERVAL ? DAY)
  GROUP BY evento ORDER BY negocios DESC`, [DIAS])
if (!ev.length) {
  console.log('    (todavía sin datos — se apuntan desde el 15 ago)')
} else {
  for (const e of ev) console.log(`    ${e.evento.padEnd(24)} ${String(e.negocios).padStart(4)} negocios (${e.veces} veces)`)
}

const met = await q(`
  SELECT JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.metodo')) metodo, COUNT(DISTINCT organizationId) negocios
  FROM Evento WHERE evento = 'onb_metodo' AND createdAt > DATE_SUB(NOW(), INTERVAL ? DAY)
  GROUP BY metodo ORDER BY negocios DESC`, [DIAS])
if (met.length) {
  console.log(`\n  qué método eligen:`)
  for (const m of met) console.log(`    ${String(m.metodo).padEnd(10)} ${m.negocios}`)
}

/* ── 3 · El lector de fotos ───────────────────────────────────────────────── */
console.log(`\n  el lector de fotos:`)
const lec = await q(`
  SELECT JSON_EXTRACT(metadata, '$.ok') ok,
         JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.motivo')) motivo,
         COUNT(*) veces, COUNT(DISTINCT organizationId) negocios,
         ROUND(AVG(JSON_EXTRACT(metadata, '$.ms'))) ms
  FROM Evento WHERE evento = 'cartulina_leida' AND createdAt > DATE_SUB(NOW(), INTERVAL ? DAY)
  GROUP BY ok, motivo ORDER BY veces DESC`, [DIAS])
if (!lec.length) {
  console.log('    (nadie lo ha usado en esta ventana, o todavía sin datos)')
} else {
  for (const l of lec) {
    const rot = String(l.ok) === 'true' ? 'leyó bien' : `falló · ${l.motivo ?? '?'}`
    console.log(`    ${rot.padEnd(24)} ${String(l.veces).padStart(4)} veces · ${l.negocios} negocios · ${l.ms} ms de media`)
  }
  /* Que lea no basta: si saca el nombre y no el monto, el usuario tiene que
     escribirlo igual y la promesa de «con una foto» no se cumple. */
  const [c] = await q(`
    SELECT COUNT(*) n,
      SUM(JSON_EXTRACT(metadata,'$.conNombre') = true) con_nombre,
      SUM(JSON_EXTRACT(metadata,'$.conMonto') = true) con_monto
    FROM Evento WHERE evento='cartulina_leida' AND JSON_EXTRACT(metadata,'$.ok') = true
      AND createdAt > DATE_SUB(NOW(), INTERVAL ? DAY)`, [DIAS])
  if (c.n) console.log(`    de las que leyó: con nombre ${pct(c.con_nombre, c.n)} · con monto ${pct(c.con_monto, c.n)}`)
}

await cx.end()
