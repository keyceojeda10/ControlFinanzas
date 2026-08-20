const mysql = require('mysql2/promise')
;(async () => {
  const c = await mysql.createConnection({host:'127.0.0.1',port:3307,user:'prestamos_user',password:'Castro1083003897&/2026Bs%',database:'prestamos_db'})
  const id='cmprdx83y0073s7jv2c5ewt0m'
  const [r] = await c.query(`SELECT r.id,r.nombre,(SELECT COUNT(*) FROM Cliente WHERE rutaId=r.id) enRuta FROM Ruta r WHERE r.organizationId=?`,[id])
  console.log('RUTAS', r)
  const [sr] = await c.query(`SELECT COUNT(*) n FROM Cliente WHERE organizationId=? AND rutaId IS NULL`,[id])
  console.log('CLIENTES SIN RUTA', sr[0].n)
  const [f] = await c.query(`SELECT COUNT(*) n, DATE(fecha) d FROM Pago p JOIN Prestamo pr ON pr.id=p.prestamoId WHERE pr.organizationId=? GROUP BY DATE(fecha) ORDER BY d DESC LIMIT 8`,[id])
  console.log('PAGOS POR DIA', f)
  const [u] = await c.query(`SELECT u.nombre,u.rol,COUNT(p.id) pagos FROM User u LEFT JOIN Pago p ON p.registradoPorId=u.id WHERE u.organizationId=? GROUP BY u.id`,[id]).catch(e=>{console.log('(sin registradoPorId)',e.message);return [[]]})
  console.log('QUIEN REGISTRA', u)
  await c.end()
})().catch(e=>console.error('ERR', e.message))
