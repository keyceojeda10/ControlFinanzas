// Script to be run ON the VPS: cd /home/control-finanzas && node scripts/bot-analytics-remote.cjs
// Copy this file to VPS first, or pass via SSH

const { crearPrisma } = require('../lib/prisma-cjs.cjs');
const p = crearPrisma();

const ser = (_, v) => (typeof v === "bigint" ? Number(v) : v);

(async () => {
  try {
    // 1. Leads by estado
    const estados = await p.$queryRaw`SELECT estado, CAST(COUNT(*) AS UNSIGNED) as total FROM BotLead GROUP BY estado ORDER BY total DESC`;
    console.log("=== 1. LEADS BY ESTADO ===");
    for (const e of estados) console.log(`  ${e.estado}: ${Number(e.total)}`);

    // 2. Total leads
    const [{ total: totalLeads }] = await p.$queryRaw`SELECT CAST(COUNT(*) AS UNSIGNED) as total FROM BotLead`;
    console.log("\n=== 2. CONVERSION FUNNEL ===");
    console.log(`  Total leads: ${Number(totalLeads)}`);

    // Leads that responded (have at least 1 message with rol='lead')
    const [{ total: respondedCount }] = await p.$queryRaw`
      SELECT CAST(COUNT(DISTINCT c.leadId) AS UNSIGNED) as total
      FROM BotConversacion c
      JOIN BotMensaje m ON m.conversacionId = c.id
      WHERE m.rol = 'lead'`;
    console.log(`  Responded (sent at least 1 msg): ${Number(respondedCount)}`);

    // Reached interesado
    const [{ total: interesadoCount }] = await p.$queryRaw`
      SELECT CAST(COUNT(*) AS UNSIGNED) as total FROM BotLead WHERE estado = 'interesado'`;
    console.log(`  Reached 'interesado': ${Number(interesadoCount)}`);

    // Registered
    const [{ total: registradoCount }] = await p.$queryRaw`
      SELECT CAST(COUNT(*) AS UNSIGNED) as total FROM BotLead WHERE estado = 'registrado'`;
    console.log(`  Reached 'registrado': ${Number(registradoCount)}`);

    const respRate = totalLeads > 0 ? ((Number(respondedCount) / Number(totalLeads)) * 100).toFixed(1) : 0;
    const convRate = totalLeads > 0 ? ((Number(registradoCount) / Number(totalLeads)) * 100).toFixed(1) : 0;
    console.log(`  Response rate: ${respRate}%`);
    console.log(`  Overall conversion rate: ${convRate}%`);

    // 3. Total conversations
    const [{ total: totalConvos }] = await p.$queryRaw`SELECT CAST(COUNT(*) AS UNSIGNED) as total FROM BotConversacion`;
    console.log("\n=== 3. TOTAL CONVERSATIONS ===");
    console.log(`  ${Number(totalConvos)}`);

    // 4. Average messages per lead
    const avgMsgs = await p.$queryRaw`
      SELECT AVG(msg_count) as avg_msgs, MAX(msg_count) as max_msgs, MIN(msg_count) as min_msgs
      FROM (
        SELECT c.leadId, CAST(COUNT(*) AS UNSIGNED) as msg_count
        FROM BotMensaje m
        JOIN BotConversacion c ON m.conversacionId = c.id
        GROUP BY c.leadId
      ) sub`;
    console.log("\n=== 4. MESSAGES PER LEAD ===");
    console.log(`  Average: ${Number(avgMsgs[0].avg_msgs).toFixed(1)}`);
    console.log(`  Max: ${Number(avgMsgs[0].max_msgs)}`);
    console.log(`  Min: ${Number(avgMsgs[0].min_msgs)}`);

    // Total messages
    const [{ total: totalMsgs }] = await p.$queryRaw`SELECT CAST(COUNT(*) AS UNSIGNED) as total FROM BotMensaje`;
    console.log(`  Total messages: ${Number(totalMsgs)}`);

    // 5. Registered leads details
    const registrados = await p.$queryRaw`
      SELECT l.id, l.nombre, l.telefono, l.temperatura, l.hookId, l.createdAt,
        (SELECT CAST(COUNT(*) AS UNSIGNED) FROM BotMensaje m JOIN BotConversacion c ON m.conversacionId = c.id WHERE c.leadId = l.id) as msg_count
      FROM BotLead l
      WHERE l.estado = 'registrado'
      ORDER BY l.createdAt DESC`;
    console.log("\n=== 5. REGISTERED LEADS ===");
    for (const r of registrados) {
      console.log(`  - ${r.nombre || 'Sin nombre'} | temp: ${r.temperatura} | msgs: ${Number(r.msg_count)} | hook: ${r.hookId || 'N/A'} | date: ${r.createdAt}`);
    }

    // 6. Temperature distribution
    console.log("\n=== 6. TEMPERATURE DISTRIBUTION ===");
    const temps = await p.$queryRaw`
      SELECT
        CASE
          WHEN temperatura = 0 THEN '0 (cold)'
          WHEN temperatura BETWEEN 1 AND 30 THEN '1-30 (low)'
          WHEN temperatura BETWEEN 31 AND 60 THEN '31-60 (medium)'
          WHEN temperatura BETWEEN 61 AND 85 THEN '61-85 (warm)'
          WHEN temperatura BETWEEN 86 AND 100 THEN '86-100 (hot)'
        END as temp_range,
        CAST(COUNT(*) AS UNSIGNED) as total
      FROM BotLead
      GROUP BY temp_range
      ORDER BY MIN(temperatura)`;
    for (const t of temps) console.log(`  ${t.temp_range}: ${Number(t.total)}`);

    // 7. Top 10 hookIds
    console.log("\n=== 7. TOP 10 HOOK IDs ===");
    const hooks = await p.$queryRaw`
      SELECT l.hookId,
        CAST(COUNT(*) AS UNSIGNED) as total,
        CAST(SUM(CASE WHEN l.estado = 'registrado' THEN 1 ELSE 0 END) AS UNSIGNED) as registrados,
        CAST(SUM(CASE WHEN l.estado = 'interesado' THEN 1 ELSE 0 END) AS UNSIGNED) as interesados
      FROM BotLead l
      GROUP BY l.hookId
      ORDER BY total DESC
      LIMIT 10`;
    for (const h of hooks) {
      const hookName = h.hookId || 'NULL';
      console.log(`  ${hookName}: ${Number(h.total)} leads, ${Number(h.registrados)} registrados, ${Number(h.interesados)} interesados`);
    }

    // 8. Leads per week (last 8 weeks)
    console.log("\n=== 8. LEADS PER WEEK (LAST 8 WEEKS) ===");
    const weeks = await p.$queryRaw`
      SELECT
        DATE_FORMAT(DATE_SUB(createdAt, INTERVAL WEEKDAY(createdAt) DAY), '%Y-%m-%d') as week_start,
        CAST(COUNT(*) AS UNSIGNED) as total,
        CAST(SUM(CASE WHEN estado = 'registrado' THEN 1 ELSE 0 END) AS UNSIGNED) as registrados
      FROM BotLead
      WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 8 WEEK)
      GROUP BY week_start
      ORDER BY week_start DESC`;
    for (const w of weeks) {
      console.log(`  Week of ${w.week_start}: ${Number(w.total)} leads, ${Number(w.registrados)} registrados`);
    }

    // 9. Response rate by hour (Colombia UTC-5)
    console.log("\n=== 9. LEAD RESPONSES BY HOUR (UTC-5 Colombia) ===");
    const hours = await p.$queryRaw`
      SELECT
        HOUR(CONVERT_TZ(m.createdAt, '+00:00', '-05:00')) as hora,
        CAST(COUNT(*) AS UNSIGNED) as total_msgs,
        CAST(COUNT(DISTINCT c.leadId) AS UNSIGNED) as unique_leads
      FROM BotMensaje m
      JOIN BotConversacion c ON m.conversacionId = c.id
      WHERE m.rol = 'lead'
      GROUP BY hora
      ORDER BY hora`;
    for (const h of hours) {
      console.log(`  ${String(h.hora).padStart(2, '0')}:00 - ${Number(h.total_msgs)} messages from ${Number(h.unique_leads)} unique leads`);
    }

    // Extra: estados breakdown for responded vs non-responded
    console.log("\n=== EXTRA: ESTADO OF NON-RESPONDERS ===");
    const nonResp = await p.$queryRaw`
      SELECT l.estado, CAST(COUNT(*) AS UNSIGNED) as total
      FROM BotLead l
      WHERE l.id NOT IN (
        SELECT DISTINCT c.leadId FROM BotConversacion c
        JOIN BotMensaje m ON m.conversacionId = c.id
        WHERE m.rol = 'lead'
      )
      GROUP BY l.estado
      ORDER BY total DESC`;
    for (const n of nonResp) console.log(`  ${n.estado}: ${Number(n.total)}`);

    // Extra: avg temperature by estado
    console.log("\n=== EXTRA: AVG TEMPERATURE BY ESTADO ===");
    const avgTemp = await p.$queryRaw`
      SELECT estado, ROUND(AVG(temperatura), 1) as avg_temp, CAST(COUNT(*) AS UNSIGNED) as total
      FROM BotLead
      GROUP BY estado
      ORDER BY avg_temp DESC`;
    for (const a of avgTemp) console.log(`  ${a.estado}: avg temp ${a.avg_temp} (${Number(a.total)} leads)`);

  } catch (e) {
    console.error("ERROR:", e.message);
    console.error(e.stack);
  }
  await p.$disconnect();
})();
