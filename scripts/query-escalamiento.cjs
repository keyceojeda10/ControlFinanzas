// Analisis de escalamiento del bot - ultimos 7 dias
// Ejecutar: node scripts/query-escalamiento.cjs
const { crearPrisma } = require('../lib/prisma-cjs.cjs');
const p = crearPrisma();
const ser = (_, v) => (typeof v === 'bigint' ? Number(v) : v);

(async () => {
  try {
    const hace7d = new Date(Date.now() - 7 * 24 * 3600 * 1000);

    // 1. Leads alertados (total historico)
    const alertadosTotal = await p.botLead.count({ where: { alertado: true } });
    console.log('alertados_total_historico:', alertadosTotal);

    // 2. Leads alertados actualizados en los ultimos 7 dias
    const alertados7d = await p.botLead.count({ where: { alertado: true, updatedAt: { gte: hace7d } } });
    console.log('alertados_7d:', alertados7d);

    // 3. Leads con temperatura alta sin alertar (posibles escalamientos perdidos)
    const calientesSinAlertar = await p.botLead.findMany({
      where: { alertado: false, temperatura: { gte: 65 }, updatedAt: { gte: hace7d } },
      select: { nombre: true, temperatura: true, estado: true, updatedAt: true },
      orderBy: { temperatura: 'desc' },
      take: 15,
    });
    console.log('\ncalientes_sin_alertar (temp>=65, 7d):');
    calientesSinAlertar.forEach(l => {
      console.log(`  ${l.nombre} | temp:${l.temperatura} | ${l.estado} | ${new Date(l.updatedAt).toLocaleString('es-CO')}`);
    });

    // 4. Leads estado 'interesado' sin alertar en 7d
    const interesadoSinAlertar = await p.botLead.count({
      where: { alertado: false, estado: 'interesado', updatedAt: { gte: hace7d } }
    });
    console.log('\ninteresado_sin_alertar_7d:', interesadoSinAlertar);

    // 5. Distribucion de estados en 7d
    const estados7d = await p.$queryRaw`
      SELECT estado, CAST(COUNT(*) AS UNSIGNED) as total
      FROM BotLead
      WHERE updatedAt >= ${hace7d}
      GROUP BY estado ORDER BY total DESC
    `;
    console.log('\nestados_actualizados_7d:', JSON.stringify(estados7d, ser));

    // 6. Leads nuevos en 7d
    const nuevos7d = await p.botLead.count({ where: { createdAt: { gte: hace7d } } });
    console.log('\nnuevos_7d:', nuevos7d);

    // 7. Sample para verificar que campo alertado existe
    const sample = await p.botLead.findFirst({ select: { id: true, alertado: true, temperatura: true, estado: true } });
    console.log('\nsample_lead:', JSON.stringify(sample, ser));

    // 8. Leads del router con keyword de escalamiento (buscamos en conversaciones)
    const convEscal = await p.botConversacion.count({
      where: {
        rol: 'lead',
        createdAt: { gte: hace7d },
        texto: {
          contains: 'persona'
        }
      }
    });
    console.log('\nconversaciones_con_keyword_persona_7d:', convEscal);

    const convHumano = await p.botConversacion.count({
      where: {
        rol: 'lead',
        createdAt: { gte: hace7d },
        texto: { contains: 'humano' }
      }
    });
    console.log('conversaciones_con_keyword_humano_7d:', convHumano);

    const convAsesor = await p.botConversacion.count({
      where: {
        rol: 'lead',
        createdAt: { gte: hace7d },
        texto: { contains: 'asesor' }
      }
    });
    console.log('conversaciones_con_keyword_asesor_7d:', convAsesor);

    // 9. Leads que tienen al menos 1 conversacion con mensaje del bot indicando escalamiento
    const botEscalMsg = await p.botConversacion.count({
      where: {
        rol: 'bot',
        createdAt: { gte: hace7d },
        texto: { contains: 'asesor' }
      }
    });
    console.log('\nmensajes_bot_con_asesor_7d (respuesta fija escalamiento):', botEscalMsg);

  } catch (e) {
    console.error('ERROR:', e.message, '\n', e.stack);
  }
  await p.$disconnect();
})();
