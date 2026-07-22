// Script to analyze lost leads - run on VPS via SSH
const QUERY_SCRIPT = `
const { PrismaClient } = require('./node_modules/.prisma/client');
const p = new PrismaClient();

(async () => {
  // GROUP A: Hot leads (temp >= 50) that didn't register
  console.log('=== GROUP A: HOT LEADS THAT DID NOT CONVERT ===');
  const hotLeads = await p.botLead.findMany({
    where: {
      temperatura: { gte: 50 },
      estado: { notIn: ['registrado', 'pendiente'] }
    },
    orderBy: { temperatura: 'desc' },
    take: 15,
    select: {
      id: true, nombre: true, estado: true, temperatura: true,
      esPrestamista: true, metodoActual: true, cantClientes: true,
      createdAt: true
    }
  });

  for (const lead of hotLeads) {
    console.log('\\n--- LEAD: ' + lead.nombre + ' | Temp: ' + lead.temperatura + ' | Estado: ' + lead.estado + ' ---');
    console.log('Info: prestamista=' + lead.esPrestamista + ', metodo=' + lead.metodoActual + ', clientes=' + lead.cantClientes);

    const msgs = await p.botConversacion.findMany({
      where: { botLeadId: lead.id },
      orderBy: { createdAt: 'asc' },
      select: { rol: true, texto: true, createdAt: true, tipoMensaje: true }
    });

    for (const m of msgs) {
      const ts = new Date(m.createdAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' });
      const tipo = m.tipoMensaje !== 'chat' ? ' [' + m.tipoMensaje + ']' : '';
      console.log('[' + m.rol.toUpperCase() + ']' + tipo + ' (' + ts + ') ' + m.texto);
    }
  }

  // GROUP B: Dropped early - engaged but went cold
  console.log('\\n\\n=== GROUP B: DROPPED EARLY (engaged but went cold) ===');

  // Get leads with estado no_interesado or (contactado with temp < 30)
  // that have at least 2 lead messages
  const coldLeads = await p.$queryRaw\`
    SELECT bl.id, bl.nombre, bl.estado, bl.temperatura, bl.esPrestamista,
           bl.metodoActual, bl.cantClientes, bl.createdAt,
           (SELECT COUNT(*) FROM BotConversacion bc WHERE bc.botLeadId = bl.id AND bc.rol = 'lead') as leadMsgCount
    FROM BotLead bl
    WHERE (
      bl.estado = 'no_interesado'
      OR bl.estado = 'bloqueado'
      OR (bl.estado = 'contactado' AND bl.temperatura < 30)
      OR (bl.estado = 'cerrado' AND bl.temperatura < 30)
    )
    AND (SELECT COUNT(*) FROM BotConversacion bc WHERE bc.botLeadId = bl.id AND bc.rol = 'lead') >= 2
    ORDER BY RAND()
    LIMIT 15
  \`;

  for (const lead of coldLeads) {
    console.log('\\n--- LEAD: ' + lead.nombre + ' | Temp: ' + lead.temperatura + ' | Estado: ' + lead.estado + ' | LeadMsgs: ' + lead.leadMsgCount + ' ---');
    console.log('Info: prestamista=' + lead.esPrestamista + ', metodo=' + lead.metodoActual + ', clientes=' + lead.cantClientes);

    const msgs = await p.botConversacion.findMany({
      where: { botLeadId: lead.id },
      orderBy: { createdAt: 'asc' },
      select: { rol: true, texto: true, createdAt: true, tipoMensaje: true }
    });

    for (const m of msgs) {
      const ts = new Date(m.createdAt).toLocaleString('es-CO', { timeZone: 'America/Bogota' });
      const tipo = m.tipoMensaje !== 'chat' ? ' [' + m.tipoMensaje + ']' : '';
      console.log('[' + m.rol.toUpperCase() + ']' + tipo + ' (' + ts + ') ' + m.texto);
    }
  }

  // Summary stats
  console.log('\\n\\n=== SUMMARY STATS ===');
  const totalLeads = await p.botLead.count();
  const registered = await p.botLead.count({ where: { estado: 'registrado' } });
  const noInteresado = await p.botLead.count({ where: { estado: 'no_interesado' } });
  const bloqueado = await p.botLead.count({ where: { estado: 'bloqueado' } });
  const cerrado = await p.botLead.count({ where: { estado: 'cerrado' } });
  const contactado = await p.botLead.count({ where: { estado: 'contactado' } });
  const interesado = await p.botLead.count({ where: { estado: 'interesado' } });
  const pendiente = await p.botLead.count({ where: { estado: 'pendiente' } });

  console.log('Total leads: ' + totalLeads);
  console.log('Registrado: ' + registered);
  console.log('No interesado: ' + noInteresado);
  console.log('Bloqueado: ' + bloqueado);
  console.log('Cerrado: ' + cerrado);
  console.log('Contactado: ' + contactado);
  console.log('Interesado: ' + interesado);
  console.log('Pendiente: ' + pendiente);

  // Hot leads distribution
  const hotCount = await p.botLead.count({ where: { temperatura: { gte: 50 }, estado: { notIn: ['registrado', 'pendiente'] } } });
  console.log('Hot leads (>=50 temp) not converted: ' + hotCount);

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
`;

// Write the script to a temp file, SCP it, run it
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const tmpFile = path.join(__dirname, '_tmp_query.js');
fs.writeFileSync(tmpFile, QUERY_SCRIPT);

try {
  // SCP the script to VPS
  execSync(`scp "${tmpFile}" root@69.62.87.141:/home/control-finanzas/_tmp_query.js`, { timeout: 15000 });

  // Run on VPS and capture output
  const output = execSync(
    `ssh root@69.62.87.141 "cd /home/control-finanzas && node _tmp_query.js && rm _tmp_query.js"`,
    { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }
  );

  const outPath = path.join(__dirname, '_lost_leads_output.txt');
  fs.writeFileSync(outPath, output.toString());
  console.log('Output saved to: ' + outPath);
} catch (err) {
  console.error('Error:', err.message);
  if (err.stdout) {
    const outPath = path.join(__dirname, '_lost_leads_output.txt');
    fs.writeFileSync(outPath, err.stdout.toString());
    console.log('Partial output saved to: ' + outPath);
  }
} finally {
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
}
