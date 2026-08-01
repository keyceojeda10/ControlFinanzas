// scripts/ids-demo.mjs — los ids reales de la cartera de prueba.
//
// Los necesita `barrer-rutas.mjs` para las rutas de detalle: sin un id que
// exista, `/clientes/[id]` devuelve «no encontrado» y el barrido lo daria por
// bueno sin haber probado nada.
//
//   node scripts/ids-demo.mjs
//
// SOLO LOCAL, como el resto: lee DATABASE_URL del .env.
import fs from 'node:fs'
for (const l of fs.readFileSync('.env','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const u = new URL(process.env.DATABASE_URL)
const { default: mariadb } = await import('mariadb')
const c = await mariadb.createConnection({ host:'127.0.0.1', port:Number(u.port)||3306, user:decodeURIComponent(u.username), password:decodeURIComponent(u.password), database:u.pathname.slice(1) })
const one = async (t) => (await c.query(`SELECT id FROM ${t} LIMIT 1`))[0]?.id
console.log(JSON.stringify({ cliente: await one('Cliente'), ruta: await one('Ruta'), cobrador: (await c.query("SELECT id FROM User WHERE rol='cobrador' LIMIT 1"))[0]?.id }))
await c.end()
