// scripts/video-demo/historia-demo.mjs
//
// LA HISTORIA DEL NEGOCIO DE ATREZZO — «Créditos del Valle», SOLO EN EL ESPEJO
//
// El agente de los videos (13 nov 2026): «refrescaron la base del espejo y se
// borró el negocio de prueba. Lo volví a montar […] pero quedó sin historia: 13
// préstamos creados hoy y ningún cobro de días anteriores. Para La caja hace
// falta historia.»
//
// ⚠ POR QUÉ NO POR SQL. `poblar-demo.mjs` ya lo dice: correr fechas de pagos a
// mano deja `ultimoPagoAt` y la caja del día desfasados, y la ruta amanece
// vacía. Aquí los cobros entran por LA MISMA PUERTA QUE LA APP: la subida de los
// cobros hechos sin señal (`offlineId` + `fechaPago`), que guarda cada cobro con
// su fecha real —hasta 30 días atrás— y la caja, la mora y el «al día» la leen
// de ahí (`resolverFechaDelPago`).
//
// Lo único que se toca por SQL es `fechaInicio`/`fechaFin` de préstamos SIN
// PAGOS (o con el de hoy): pasan a arrancar el día en que salió su plata, que
// `poblar-demo.mjs` ya fechó hacia atrás. Sin pagos encima, mover el arranque no
// descuadra nada.
//
// Uso (espejo en :3016, túnel 3341 abierto):
//   node scripts/video-demo/historia-demo.mjs            # hasta HOY incluido
//   HASTA_AYER=1 node scripts/video-demo/historia-demo.mjs
// Se puede repetir: un día que ya tiene cobro no se vuelve a cobrar.

import { encode } from 'next-auth/jwt'
import { conectar, IDS } from './montar-demo.mjs'

const BASE = process.env.BASE_DEMO || 'http://localhost:3016'
const SECRETO = 'prueba-rediseno-2026-no-usar-en-produccion-8f3a1c'
const DIA = 86400000
const BOGOTA = 5 * 3600000

/** 'YYYY-MM-DD' del día en Bogotá. */
const diaDe = (t) => new Date(new Date(t).getTime() - BOGOTA).toISOString().slice(0, 10)
/** Ese día en Bogotá a la hora `h` (decimal), en UTC. */
const aLas = (dia, h) => new Date(new Date(`${dia}T00:00:00.000Z`).getTime() + BOGOTA + h * 3600000)

async function sesion(rol) {
  const userId = rol === 'owner' ? IDS.owner : IDS.cobrador
  const t = await encode({
    token: {
      sub: userId, id: userId, email: `${rol}@ejemplo.invalid`,
      name: rol === 'owner' ? 'Sofía Restrepo' : 'Andrés Vargas',
      rol, organizationId: IDS.org, plan: 'professional', country: 'co',
      orgNombre: 'Créditos del Valle', rutaIds: rol === 'cobrador' ? [IDS.ruta] : [],
    },
    secret: SECRETO,
  })
  return { cookie: `next-auth.session-token=${t}`, 'Content-Type': 'application/json' }
}

/* La variedad, para que la caja y la ruta no sean una pared verde:
   · el préstamo en mora (`poblar-demo`: arranca 6 días atrás) no paga nada;
   · uno se salta un día (atrasado uno);
   · uno paga a medias un día. */
const SALTA_UN_DIA = 'Álvaro Betancur'
const PAGA_A_MEDIAS = 'Diana Marcela Ruiz'

const cx = await conectar()   // ⚠ conectar() aborta si la base no es prestamos_espejo
const hoy = diaDe(Date.now())
const ultimo = process.env.HASTA_AYER ? diaDe(Date.now() - DIA) : hoy

const [prestamos] = await cx.query(
  `SELECT p.id, c.nombre, c.rutaId, p.frecuencia, p.cuotaDiaria, p.fechaInicio, p.fechaFin, p.createdAt,
          (SELECT COUNT(*) FROM Pago g WHERE g.prestamoId = p.id AND g.fechaPago < ?) pagosViejos
     FROM Prestamo p JOIN Cliente c ON c.id = p.clienteId
    WHERE p.organizationId = ? AND p.estado = 'activo'
    ORDER BY p.createdAt`, [aLas(hoy, 0), IDS.org])

/* 1 · Que arranquen el día en que salió su plata. El de mora se queda como
   está: ya arranca atrás y ESE es su papel. */
const [desembolsos] = await cx.query(
  `SELECT referenciaId, MIN(createdAt) t FROM MovimientoCapital
    WHERE organizationId = ? AND tipo = 'desembolso' GROUP BY referenciaId`, [IDS.org])
const salio = new Map(desembolsos.map((d) => [d.referenciaId, d.t]))
let movidos = 0
for (const p of prestamos) {
  if (diaDe(p.fechaInicio) !== hoy && diaDe(p.fechaInicio) !== diaDe(Date.now() - DIA)) continue // ya tiene su arranque
  if (Number(p.pagosViejos) > 0) continue
  const nuevoDia = diaDe(salio.get(p.id) ?? p.createdAt)
  if (nuevoDia >= diaDe(p.fechaInicio)) continue
  const nuevoInicio = new Date(`${nuevoDia}T05:00:00.000Z`)
  const delta = nuevoInicio.getTime() - new Date(p.fechaInicio).getTime()
  await cx.execute(
    'UPDATE Prestamo SET fechaInicio = ?, fechaFin = ? WHERE id = ? AND organizationId = ?',
    [nuevoInicio, p.fechaFin ? new Date(new Date(p.fechaFin).getTime() + delta) : null, p.id, IDS.org])
  p.fechaInicio = nuevoInicio
  movidos++
}
console.log(`· ${movidos} préstamos arrancan ahora el día en que salió su plata`)

/* 2 · Los cobros de cada día, por la puerta de los cobros sin señal. */
const sesiones = { owner: await sesion('owner'), cobrador: await sesion('cobrador') }
let hechos = 0, yaEstaban = 0, fallos = 0
for (const p of prestamos) {
  const enMora = diaDe(p.fechaInicio) !== diaDe(salio.get(p.id) ?? p.fechaInicio) && Number(p.pagosViejos) === 0 && p.frecuencia === 'diario' && new Date(salio.get(p.id) ?? 0) > new Date(p.fechaInicio)
  if (enMora) { console.log(`  ${p.nombre}: se queda en mora, a propósito`); continue }
  if (p.frecuencia !== 'diario') continue
  const quien = p.rutaId ? 'cobrador' : 'owner'
  for (let d = new Date(new Date(p.fechaInicio).getTime() + DIA); diaDe(d.getTime() + BOGOTA) <= ultimo; d = new Date(d.getTime() + DIA)) {
    const dia = diaDe(d.getTime() + BOGOTA)
    const [[ya]] = await cx.query(
      `SELECT COUNT(*) n FROM Pago WHERE prestamoId = ? AND fechaPago >= ? AND fechaPago < ?`,
      [p.id, aLas(dia, 0), aLas(dia, 24)])
    if (Number(ya.n) > 0) { yaEstaban++; continue }
    if (p.nombre === SALTA_UN_DIA && dia === diaDe(Date.now() - 2 * DIA)) continue
    const medias = p.nombre === PAGA_A_MEDIAS && dia === diaDe(Date.now() - DIA)
    const monto = medias ? Math.round(p.cuotaDiaria / 2 / 100) * 100 : p.cuotaDiaria
    // Entre las 8:30 y las 16:30, distinto cada día y cada cliente.
    const hora = 8.5 + ((p.id.charCodeAt(p.id.length - 1) + Number(dia.slice(-2)) * 7) % 80) / 10
    const cuando = aLas(dia, hora).toISOString()
    const res = await fetch(`${BASE}/api/prestamos/${p.id}/pagos`, {
      method: 'POST', headers: sesiones[quien],
      body: JSON.stringify({
        montoPagado: monto, tipo: medias ? 'parcial' : 'completo', metodoPago: 'efectivo',
        fechaPago: cuando, offlineId: cuando, plataforma: 'web',
      }),
    })
    if (res.ok) hechos++
    else { fallos++; console.log(`  ✗ ${p.nombre} ${dia}: ${res.status} ${(await res.text()).slice(0, 160)}`) }
  }
}
console.log(`· ${hechos} cobros de días pasados · ${yaEstaban} ya estaban · ${fallos} fallos`)

const [porDia] = await cx.query(
  `SELECT DATE(DATE_SUB(fechaPago, INTERVAL 5 HOUR)) dia, COUNT(*) n, SUM(montoPagado) total
     FROM Pago WHERE organizationId = ? GROUP BY dia ORDER BY dia`, [IDS.org])
for (const r of porDia) console.log(`  ${new Date(r.dia).toISOString().slice(0, 10)}  ${String(r.n).padStart(2)} cobros  $${Number(r.total).toLocaleString('es-CO')}`)
await cx.end()
process.exit(fallos ? 1 : 0)
