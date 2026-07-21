// Analitica del bot de WhatsApp. Correr EN el VPS:
//   cd /home/control-finanzas && node scripts/bot-analytics-remote.cjs
//
// La version anterior consultaba tablas que ya no existen (BotMensaje unida a
// BotConversacion por conversacionId). Hoy el esquema es plano: BotConversacion
// ES el mensaje y apunta directo al lead con botLeadId. El script fallaba
// entero, asi que la herramienta para medir el bot llevaba tiempo inservible.
//
// Solo lecturas.
const { crearPrisma } = require('../lib/prisma-cjs.cjs')
const p = crearPrisma()
const N = (v) => (typeof v === 'bigint' ? Number(v) : v)
const pct = (a, b) => (b > 0 ? ((100 * a) / b).toFixed(1) + '%' : 'n/a')

;(async () => {
  try {
    // ── Funnel ────────────────────────────────────────────────
    const [{ t: totalLeads }] = await p.$queryRaw`SELECT CAST(COUNT(*) AS UNSIGNED) t FROM BotLead`
    const [{ t: respondieron }] = await p.$queryRaw`
      SELECT CAST(COUNT(DISTINCT botLeadId) AS UNSIGNED) t FROM BotConversacion WHERE rol='lead'`
    const [{ t: registrados }] = await p.$queryRaw`
      SELECT CAST(COUNT(*) AS UNSIGNED) t FROM BotLead WHERE estado='registrado'`

    console.log('==================== FUNNEL ====================')
    console.log(`  Leads totales      : ${N(totalLeads)}`)
    console.log(`  Respondieron       : ${N(respondieron)}  (${pct(N(respondieron), N(totalLeads))})`)
    console.log(`  Registrados        : ${N(registrados)}  (${pct(N(registrados), N(totalLeads))} del total)`)
    console.log(`  Conversion sobre los que respondieron: ${pct(N(registrados), N(respondieron))}`)

    const estados = await p.$queryRaw`
      SELECT estado, CAST(COUNT(*) AS UNSIGNED) t FROM BotLead GROUP BY estado ORDER BY t DESC`
    console.log('\n  Por estado:')
    for (const e of estados) console.log(`    ${e.estado}: ${N(e.t)}`)

    // ── Tendencia semanal ─────────────────────────────────────
    console.log('\n==================== POR SEMANA ====================')
    const semanas = await p.$queryRaw`
      SELECT DATE_FORMAT(DATE_SUB(createdAt, INTERVAL WEEKDAY(createdAt) DAY),'%Y-%m-%d') w,
             CAST(COUNT(*) AS UNSIGNED) tot,
             CAST(SUM(estado='registrado') AS UNSIGNED) reg
      FROM BotLead WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 10 WEEK)
      GROUP BY w ORDER BY w DESC`
    for (const s of semanas) {
      console.log(`  ${s.w}: ${N(s.tot)} leads -> ${N(s.reg)} registrados (${pct(N(s.reg), N(s.tot))})`)
    }

    // ── Entrega (deliverability) ──────────────────────────────
    console.log('\n==================== ENTREGA (mensajes del bot) ====================')
    const entrega = await p.$queryRaw`
      SELECT COALESCE(estadoEntrega,'(sin ack)') e, CAST(COUNT(*) AS UNSIGNED) t
      FROM BotConversacion WHERE rol='bot' GROUP BY estadoEntrega ORDER BY t DESC`
    for (const e of entrega) console.log(`  ${e.e}: ${N(e.t)}`)

    const errores = await p.$queryRaw`
      SELECT COALESCE(errorEntrega,'(sin detalle)') e, CAST(COUNT(*) AS UNSIGNED) t
      FROM BotConversacion WHERE rol='bot' AND estadoEntrega='fallido'
      GROUP BY errorEntrega ORDER BY t DESC LIMIT 8`
    if (errores.length) {
      console.log('\n  Razones de fallo:')
      for (const e of errores) console.log(`    ${N(e.t)}x  ${e.e}`)
    }

    const [{ ok, bad }] = await p.$queryRaw`
      SELECT CAST(SUM(estadoEntrega IN ('enviado','entregado','leido')) AS UNSIGNED) ok,
             CAST(SUM(estadoEntrega='fallido') AS UNSIGNED) bad
      FROM BotConversacion
      WHERE rol='bot' AND estadoEntrega IS NOT NULL AND createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
    console.log(`\n  Tasa de entrega (7 dias): ${pct(N(ok), N(ok) + N(bad))}  (${N(bad)} fallidos)`)

    // ── Conversacion ──────────────────────────────────────────
    console.log('\n==================== CONVERSACION ====================')
    const [mp] = await p.$queryRaw`
      SELECT AVG(c) a, MAX(c) mx FROM (SELECT botLeadId, COUNT(*) c FROM BotConversacion GROUP BY botLeadId) s`
    console.log(`  Mensajes por lead: promedio ${Number(mp.a).toFixed(1)} | maximo ${N(mp.mx)}`)
    const porRol = await p.$queryRaw`
      SELECT rol, CAST(COUNT(*) AS UNSIGNED) t FROM BotConversacion GROUP BY rol`
    for (const r of porRol) console.log(`    ${r.rol}: ${N(r.t)}`)

    // ── Costo ─────────────────────────────────────────────────
    console.log('\n==================== COSTO API (30 dias) ====================')
    const gasto = await p.$queryRaw`
      SELECT proveedor, modelo, CAST(COUNT(*) AS UNSIGNED) llamadas, ROUND(SUM(costoUsd),4) usd
      FROM BotGastoApi WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY proveedor, modelo ORDER BY usd DESC`
    let total = 0
    for (const g of gasto) {
      total += Number(g.usd || 0)
      console.log(`  ${g.proveedor}/${g.modelo}: ${N(g.llamadas)} llamadas, $${g.usd}`)
    }
    console.log(`  TOTAL: $${total.toFixed(4)} USD`)
  } catch (e) {
    console.error('ERROR:', e.message)
    process.exitCode = 1
  } finally {
    await p.$disconnect()
  }
})()
