#!/bin/bash
ssh -o ConnectTimeout=15 -o StrictHostKeyChecking=no root@69.62.87.141 'cd /home/control-finanzas && node -e "
const { PrismaClient } = require(\"./node_modules/.prisma/client\");
const p = new PrismaClient();
(async () => {
  try {
    // 1. Leads by estado
    const estados = await p.\$queryRaw\`SELECT estado, CAST(COUNT(*) AS UNSIGNED) as total FROM BotLead GROUP BY estado ORDER BY total DESC\`;
    console.log(\"=== LEADS BY ESTADO ===\");
    console.log(JSON.stringify(estados, (_, v) => typeof v === \"bigint\" ? Number(v) : v));

    // 2. Total leads
    const totalLeads = await p.\$queryRaw\`SELECT CAST(COUNT(*) AS UNSIGNED) as total FROM BotLead\`;
    console.log(\"=== TOTAL LEADS ===\");
    console.log(JSON.stringify(totalLeads, (_, v) => typeof v === \"bigint\" ? Number(v) : v));

    // 3. Total conversations
    const totalConvos = await p.\$queryRaw\`SELECT CAST(COUNT(*) AS UNSIGNED) as total FROM BotConversacion\`;
    console.log(\"=== TOTAL CONVERSATIONS ===\");
    console.log(JSON.stringify(totalConvos, (_, v) => typeof v === \"bigint\" ? Number(v) : v));

    // 4. Leads that responded
    const responded = await p.\$queryRaw\`SELECT CAST(COUNT(DISTINCT m.conversacionId) AS UNSIGNED) as total FROM BotMensaje m JOIN BotConversacion c ON m.conversacionId = c.id WHERE m.rol = \"lead\"\`;
    console.log(\"=== LEADS RESPONDED ===\");
    console.log(JSON.stringify(responded, (_, v) => typeof v === \"bigint\" ? Number(v) : v));

    console.log(\"DONE\");
  } catch (e) {
    console.error(\"ERROR:\", e.message);
  }
  await p.\$disconnect();
})();
"'
