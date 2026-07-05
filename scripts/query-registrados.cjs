const { crearPrisma } = require('../lib/prisma-cjs.cjs');
const p = crearPrisma();
(async () => {
  const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const leads = await p.botLead.findMany({
    where: {
      conversaciones: { some: { createdAt: { gte: desde }, rol: 'lead' } }
    },
    select: { nombre: true, temperatura: true, estado: true, telefono: true },
    orderBy: { temperatura: 'desc' }
  });

  console.log('=== LEADS CON RESPUESTA (ultimos 7 dias) ===\n');
  console.log('Nombre'.padEnd(30) + 'Temp'.padEnd(6) + 'Estado');
  console.log('-'.repeat(55));

  let registrados = 0;
  for (const l of leads) {
    const marker = l.estado === 'registrado' ? ' <<<' : '';
    console.log(l.nombre.padEnd(30) + String(l.temperatura).padEnd(6) + l.estado + marker);
    if (l.estado === 'registrado') registrados++;
  }

  console.log('\n' + '-'.repeat(55));
  console.log('Total leads con respuesta: ' + leads.length);
  console.log('Registrados: ' + registrados);
  console.log('Tasa: ' + Math.round(registrados / leads.length * 100) + '%');

  await p.$disconnect();
})();
