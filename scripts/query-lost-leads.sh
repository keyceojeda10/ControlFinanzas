#!/bin/bash
ssh root@69.62.87.141 'cd /home/control-finanzas && node -e "
const{PrismaClient}=require(String.fromCharCode(46,47,110,111,100,101,95,109,111,100,117,108,101,115,47,46,112,114,105,115,109,97,47,99,108,105,101,110,116));
const p=new PrismaClient();
(async()=>{
  const leads = await p.botLead.findMany({
    where: {
      temperatura: { gte: 50 },
      estado: { notIn: [\"registrado\", \"pendiente\"] }
    },
    orderBy: { temperatura: \"desc\" },
    take: 15,
    select: { id:true, nombre:true, estado:true, temperatura:true }
  });
  console.log(JSON.stringify(leads));
  await p.\$disconnect();
})().catch(e=>{console.error(e);process.exit(1)});
"'
