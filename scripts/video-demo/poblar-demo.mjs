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
import { conectar, montar, IDS, CLIENTES } from './montar-demo.mjs'

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
console.log(`  ${ids.length} clientes`)

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
console.log('· creando préstamos…')
/* Arrancan hace unos días para que los cobros de abajo tengan dónde caer y las
   fichas no salgan todas «recién creado». El campo es `frecuencia`, no
   `frecuenciaPago`: el endpoint lo desestructura así. */
const haceDias = (d) => {
  const f = new Date(Date.now() - d * 86400000)
  return f.toISOString().slice(0, 10)
}
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
console.log(`  ${prestamos.filter(Boolean).length} préstamos`)

// ── Unos cobros de días pasados ────────────────────────────────────────────
// Para que la ficha del cliente y los reportes tengan algo que enseñar.
/* ⚠ NINGÚN PAGO REGISTRADO A PROPÓSITO.
   Se probó darles historial, y como los pagos se registran con la fecha de hoy
   las paradas salían con «Ya abonó $21.000 hoy · sigue pendiente»: medio
   tachadas antes de empezar. Y correr las fechas por SQL fue peor —el préstamo
   se queda con su `ultimoPagoAt` y la ruta amanece vacía—.

   La ruta arranca limpia y el cobro se graba EN VIVO, que es justo lo que hay
   que enseñar. El historial de una ficha se ve después de cobrar. */

console.log('\n✓ negocio de demostración listo en', BASE)
await cx.end()
