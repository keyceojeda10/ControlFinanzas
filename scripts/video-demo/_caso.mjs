import { conectar } from './montar-demo.mjs'
const cx = await conectar()
const [c] = await cx.query('SHOW COLUMNS FROM Pago')
console.log('Pago:', c.map(x => x.Field).join(', '))
const [[r]] = await cx.query(
  `SELECT p.totalAPagar, p.totalPagado,
     (SELECT COALESCE(SUM(montoPagado),0) FROM Pago g WHERE g.prestamoId = p.id) suma,
     (SELECT COALESCE(SUM(montoPagado),0) FROM Pago g WHERE g.prestamoId = p.id
        AND g.tipo NOT IN ('recargo','descuento')) sumaSinRecargo
   FROM Prestamo p WHERE p.id = 'cmqydmh9k002gdamnlwyvk2lc'`)
const $ = (n) => '$' + Math.round(Number(n||0)).toLocaleString('es-CO')
console.log(`totalAPagar ${$(r.totalAPagar)} · totalPagado ${$(r.totalPagado)}`)
console.log(`suma de pagos ${$(r.suma)} · sin recargos ${$(r.sumaSinRecargo)}`)
console.log(r.totalPagado === r.sumaSinRecargo ? '✓ CUADRA al peso' : '✗ no cuadra')
await cx.end()
