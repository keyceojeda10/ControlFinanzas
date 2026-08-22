// scripts/video-demo/poblar-demo.mjs
//
// Le da HISTORIA al negocio de mentira, por los endpoints reales.
//
// Un negocio recién montado sale vacío en todas las pantallas, y un sistema
// vacío no enseña nada: la ruta sin paradas, la caja en cero, los reportes en
// blanco. Aquí se le crean clientes, préstamos y unos cobros de días pasados
// para que al grabar se vea un negocio en marcha.
//
// ⚠ TODO por los endpoints reales (`/api/clientes`, `/api/prestamos`, …). Si se
//   insertara por SQL, el vídeo enseñaría datos que el sistema nunca produjo y
//   cualquier incoherencia se vería en pantalla.

import { encode } from 'next-auth/jwt'
import { conectar, montar, IDS, CLIENTES, CLIENTES_SIN_RUTA } from './montar-demo.mjs'

const BASE = process.env.BASE || 'http://localhost:3016'
const SECRETO = 'prueba-rediseno-2026-no-usar-en-produccion-8f3a1c'

const sesion = async (userId, rol) => {
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

const pedir = async (H, metodo, ruta, datos) => {
  const r = await fetch(BASE + ruta, {
    method: metodo, headers: H, body: datos ? JSON.stringify(datos) : undefined,
  })
  const txt = await r.text()
  if (!r.ok) throw new Error(`${metodo} ${ruta} → ${r.status} ${txt.slice(0, 200)}`)
  try { return JSON.parse(txt) } catch { return txt }
}

/* ⚠ ARRIBA DEL TODO. Lo usan los dos bloques de préstamos, y al mover el de
   los «sin ruta» delante quedó por encima de su propia declaración: el guion
   reventaba con «Cannot access 'haceDias' before initialization». */
const haceDias = (d) => {
  const f = new Date(Date.now() - d * 86400000)
  return f.toISOString().slice(0, 10)
}

const cx = await conectar()
await montar(cx)

const owner = await sesion(IDS.owner, 'owner')

// ── Los clientes ───────────────────────────────────────────────────────────
console.log('· creando clientes…')
const ids = []
for (const c of CLIENTES) {
  const creado = await pedir(owner, 'POST', '/api/clientes', {
    nombre: c.nombre, cedula: c.cedula, telefono: c.tel, direccion: c.dir, rutaId: IDS.ruta,
  })
  ids.push(creado.id)
}

/* Los de la zona norte se crean SIN ruta: son la materia prima del vídeo de
   rutas, donde se crea una ruta nueva y se les mete desde «Agregar cliente». */
const idsSinRuta = []
for (const c of CLIENTES_SIN_RUTA) {
  const creado = await pedir(owner, 'POST', '/api/clientes', {
    nombre: c.nombre, cedula: c.cedula, telefono: c.tel, direccion: c.dir,
  })
  idsSinRuta.push(creado.id)
}
console.log(`  ${ids.length} clientes en ruta · ${idsSinRuta.length} sin ruta`)

/* ⚠ LAS COORDENADAS, DESPUÉS DE CREAR. El endpoint geocodifica la dirección y
   estas son genéricas: los ocho acabaron repartidos por media Colombia y la
   ruta decía «2.666,0 km». Se pisan aquí, ya apiñados por barrio. */
for (const [lista, idl] of [[CLIENTES, ids], [CLIENTES_SIN_RUTA, idsSinRuta]]) {
  for (let i = 0; i < lista.length; i++) {
    await cx.execute('UPDATE Cliente SET latitud = ?, longitud = ? WHERE id = ?',
      [lista[i].lat, lista[i].lng, idl[i]])
  }
}

// ── Los préstamos ──────────────────────────────────────────────────────────
// Montos y plazos variados para que la ruta no salga toda igual.
const PRESTAMOS = [
  { monto: 500_000, tasa: 20, plazo: 24, frecuencia: 'diario' },
  { monto: 300_000, tasa: 20, plazo: 20, frecuencia: 'diario' },
  { monto: 800_000, tasa: 20, plazo: 30, frecuencia: 'diario' },
  { monto: 400_000, tasa: 20, plazo: 24, frecuencia: 'diario' },
  { monto: 250_000, tasa: 20, plazo: 20, frecuencia: 'diario' },
  { monto: 600_000, tasa: 20, plazo: 24, frecuencia: 'diario' },
  { monto: 350_000, tasa: 20, plazo: 20, frecuencia: 'diario' },
  { monto: 450_000, tasa: 20, plazo: 24, frecuencia: 'diario' },
]
/* ⚠ LOS «SIN RUTA» SE CREAN PRIMERO, y no es un capricho de orden.
 *
 * `saldoAnterior` y `saldoNuevo` de cada movimiento se calculan EN EL ORDEN EN
 * QUE SE CREAN. Después, al repartir las fechas hacia atrás, uno se queda en el
 * día —tiene que ser de la ruta del cobrador, o su caja dice «prestaste $0»—, y
 * si ese no es el ÚLTIMO que se creó, la pantalla de Capital enseña la columna
 * del saldo dando saltos: «+$12.000.000 saldo $12.000.000» y debajo «−$300.000
 * saldo $6.300.000».
 *
 * Creando primero los de fuera de la ruta, el último es el de Wilmer —el de la
 * ruta— y la cadena de saldos queda en orden sin tocar ni un asiento. Reescribir
 * los saldos habría sido enseñar datos que el sistema nunca produjo. */
/* Los de la zona norte también llevan préstamo: un cliente «sin ruta» de verdad
   es alguien que ya está prestado y a quien nadie ha metido todavía en un
   recorrido. Sin préstamo, la ruta nueva del vídeo saldría con cinco paradas
   que no cobran nada. */
const SIN_RUTA_PRESTAMOS = [
  { monto: 350_000, tasa: 20, plazo: 20 },
  { monto: 500_000, tasa: 20, plazo: 24 },
  { monto: 200_000, tasa: 20, plazo: 20 },
  { monto: 700_000, tasa: 20, plazo: 30 },
  { monto: 300_000, tasa: 20, plazo: 24 },
]
for (let i = 0; i < idsSinRuta.length; i++) {
  const p = SIN_RUTA_PRESTAMOS[i]
  await pedir(owner, 'POST', '/api/prestamos', {
    clienteId: idsSinRuta[i], montoPrestado: p.monto, tasaInteres: p.tasa,
    diasPlazo: p.plazo, frecuencia: 'diario', modoInteres: 'plano',
    fechaInicio: haceDias(1), metodoPago: 'efectivo',
  })
}

console.log('· creando préstamos…')
/* Arrancan hace unos días para que los cobros de abajo tengan dónde caer y las
   fichas no salgan todas «recién creado». El campo es `frecuencia`, no
   `frecuenciaPago`: el endpoint lo desestructura así. */
const prestamos = []
for (let i = 0; i < ids.length; i++) {
  const p = PRESTAMOS[i]
  const creado = await pedir(owner, 'POST', '/api/prestamos', {
    clienteId: ids[i], montoPrestado: p.monto, tasaInteres: p.tasa,
    diasPlazo: p.plazo, frecuencia: p.frecuencia, modoInteres: 'plano',
    /* ⚠ NI MUY ATRÁS NI TODOS IGUAL, Y ESTO COSTÓ DOS INTENTOS:
    
       · Con 8 días de antigüedad y pocos cobros, los OCHO salían en mora y la
         lista era una pared roja. Un vídeo de venta con la cartera entera en
         rojo no vende.
       · Corrigiendo demasiado quedaron todos al día y la ruta dijo «hoy no
         toca cobrarle a nadie»: pantalla vacía, que es peor.
    
       Seis arrancan HOY —hoy les toca su primera cuota, así que la ruta sale
       llena y sin un solo atraso— y dos vienen de atrás para que las fichas
       tengan historial y uno enseñe la pastilla de mora, que también hay que
       poder explicar. */
    /* ⚠ AYER, NO HOY. Un préstamo diario que arranca hoy tiene su primera
       cuota MAÑANA, así que la ruta amanecía con dos paradas de ocho. Con un
       día de antigüedad y sin ningún pago, a los siete les toca hoy y ninguno
       está atrasado. El octavo viene de hace seis días para que la lista
       enseñe también la pastilla de mora, que hay que poder explicar. */
    fechaInicio: haceDias(i === 7 ? 6 : 1),
    metodoPago: 'efectivo',
  })
  prestamos.push(creado.id ?? creado.prestamo?.id)
}
console.log(`  ${prestamos.filter(Boolean).length + idsSinRuta.length} préstamos`)

// ── Unos cobros de días pasados ────────────────────────────────────────────
// Para que la ficha del cliente y los reportes tengan algo que enseñar.
/* ⚠ NINGÚN PAGO REGISTRADO A PROPÓSITO.
   Se probó darles historial, y como los pagos se registran con la fecha de hoy
   las paradas salían con «Ya abonó $21.000 hoy · sigue pendiente»: medio
   tachadas antes de empezar. Y correr las fechas por SQL fue peor —el préstamo
   se queda con su `ultimoPagoAt` y la ruta amanece vacía—.

   La ruta arranca limpia y el cobro se graba EN VIVO, que es justo lo que hay
   que enseñar. El historial de una ficha se ve después de cobrar. */

/* ══ LOS DESEMBOLSOS, FECHADOS HACIA ATRÁS ═══════════════════════════════
 *
 * ⚠ SIN ESTO LA CAJA DEL COBRADOR ES UN DISPARATE. «Lo que prestaste» del día
 * son los `MovimientoCapital` de tipo `desembolso` con fecha de HOY, y aquí se
 * crean los trece de una sentada: la caja abría con
 *
 *     Lo que cobraste      $21.800
 *     Lo que prestaste  −$3.650.000
 *     Te queda en la mano −$3.628.200
 *
 * En un día de verdad ningún cobrador entrega 3,6 millones. Se corren doce
 * movimientos a la fecha de arranque de su préstamo y SE DEJA UNO en el día,
 * que es lo normal: se prestó algo en la calle.
 *
 * No se toca `fechaInicio`: quién tiene cuota hoy no cambia, así que la ruta y
 * «cobrar hoy» siguen enseñando los mismos ocho de siempre. Y no se inventa
 * nada — se mueve la fecha de asientos que produjo el propio sistema. */
console.log('· fechando los movimientos hacia atrás…')
/* ══ LA HISTORIA DEL CAPITAL, EN ORDEN ═══════════════════════════════════
 *
 * ⚠ SIN ESTO LA CAJA Y EL CAPITAL SON UN DISPARATE. Los trece préstamos se
 * crean de una sentada, así que sus trece desembolsos quedan fechados HOY. «Lo
 * que prestaste» del día son justo esos movimientos, y la caja del cobrador
 * abría con «Te queda en la mano −$3.628.200»: en un día de verdad nadie
 * entrega 3,6 millones.
 *
 * ⚠ Y EL ORDEN IMPORTA TANTO COMO LA FECHA. En el primer intento se les puso a
 * todos la misma hora, y la pantalla de Capital —que lista los movimientos con
 * el saldo que iba quedando— salía dando saltos: «+$12.000.000 Saldo
 * $12.000.000» y justo debajo «−$300.000 Saldo $6.300.000». `saldoAnterior` y
 * `saldoNuevo` se calcularon en el orden en que se crearon; si las fechas no
 * respetan ese orden, la columna del saldo no cuadra con nada.
 *
 * Aquí se reparten EN SU ORDEN ORIGINAL: la inyección hace un mes, los
 * desembolsos por los días siguientes, y uno se queda en el día —el de un
 * cliente de la ruta del cobrador—, que es lo normal: se prestó en la calle.
 *
 * No se toca `fechaInicio`: quién tiene cuota hoy no cambia. */
const [movs] = await cx.query(
  `SELECT m.id movId, m.tipo, m.referenciaId, cl.rutaId
     FROM MovimientoCapital m
     LEFT JOIN Prestamo p ON p.id = m.referenciaId AND m.referenciaTipo = 'prestamo'
     LEFT JOIN Cliente cl ON cl.id = p.clienteId
    WHERE m.organizationId = ?
    ORDER BY m.createdAt, m.id`, [IDS.org])

/* El que se queda en el día tiene que ser de la RUTA DEL COBRADOR: dejando el
   último de la lista tocaba a un cliente sin ruta, y su caja seguía diciendo
   «Lo que prestaste $0» — el desembolso existía pero no era suyo. */
const enElDia = [...movs].reverse().find((m) => m.tipo === 'desembolso' && m.rutaId === IDS.ruta)
const enOrden = movs.filter((m) => m.movId !== enElDia?.movId)
const DIA = 86400000

for (let i = 0; i < enOrden.length; i++) {
  const m = enOrden[i]
  // La inyección del arranque, hace un mes. El resto, repartido por los
  // últimos diez días y en el mismo orden en que se crearon.
  const cuando = m.tipo === 'inyeccion'
    ? new Date(Date.now() - 30 * DIA)
    : new Date(Date.now() - (10 * DIA) + i * (DIA / 2))
  await cx.execute('UPDATE MovimientoCapital SET createdAt = ? WHERE id = ?', [cuando, m.movId])
  if (m.referenciaId) {
    await cx.execute('UPDATE Prestamo SET createdAt = ? WHERE id = ?', [cuando, m.referenciaId])
  }
}
console.log(`  ${enOrden.length} movimientos repartidos · 1 se queda en el día`)

console.log('\n✓ negocio de demostración listo en', BASE)
await cx.end()
