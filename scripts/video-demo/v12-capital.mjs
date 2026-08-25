// scripts/video-demo/v12-capital.mjs
//
// VÍDEO 12 · El capital: tu fondo de préstamos
//
//     node scripts/video-demo/v12-capital.mjs
//     node scripts/video-demo/v12-capital.mjs --toma 4
//     node scripts/video-demo/v12-capital.mjs --pegar
//
// El último de la serie, y el que cierra la cuenta: la caja es EL DÍA, el
// capital es EL FONDO. Sin esta distinción, quien mira la caja y ve poco cree
// que el negocio va mal cuando lo que pasa es que su plata está en la calle.
//
// ── LA CUENTA QUE HAY QUE ENSEÑAR ──────────────────────────────────────────
//
//     TODA TU PLATA        $12.013.433
//       lista para prestar  $6.392.600   ← la tienes
//       en la calle          $5.620.833   ← la tienen tus clientes
//
// ⚠ Y OJO CON LA TERCERA CIFRA: «por cobrar (cartera)» son $6.549.800, que NO
// es lo mismo. La cartera incluye el interés que todavía no has ganado; «en la
// calle» es TU plata. Sumar la cartera al fondo es inflar el patrimonio, que
// es de donde salen los «gané 7,9 veces más de lo que gané».
//
// ── LO QUE NO SE PULSA ─────────────────────────────────────────────────────
//
//  · «Registrar» de la hoja de mover plata: metería o sacaría dinero de verdad.
//  · «Cuadrar el saldo»: es un ajuste contable con su asiento.
//  · El interruptor de «modo estricto»: se enseña y se explica.

import { encode } from 'next-auth/jwt'
import { correr, SECRETO } from './grabador.mjs'
import { conectar, IDS } from './montar-demo.mjs'

/* El día de la demostración: cuatro cobros hechos por el endpoint real, para
   que las cifras del mes sean las que el sistema produce. Y sin residuos de la
   toma anterior. */
/* ⚠ LA BARRA DE ABAJO SE APUNTA POR EL `nav`, NO POR EL `href` A SECAS.
   Reportado por el dueño viendo el vídeo 15: «no está señalando bien el icono;
   señala un texto y no el icono de los préstamos en el menú».
   En el panel hay DOS enlaces visibles a `/prestamos`: el «Ver todos →» de una
   tarjeta (y=1874) y el icono de la barra (y=890). `.first()` coge el de la
   tarjeta porque va antes en el DOM, y `:visible` no ayuda: los dos lo están.
   Hoy solo pasa con préstamos, pero cualquier «Ver todos» que se añada mañana
   rompe el de al lado, así que se acota a la barra en todos. */
const MENU = 'nav[aria-label="Navegación principal"]'

const limpiar = async () => {
  const cx = await conectar()
  const [ps] = await cx.query(
    `SELECT p.id, p.cuotaDiaria FROM Prestamo p JOIN Cliente c ON c.id = p.clienteId
      WHERE c.rutaId = ? ORDER BY c.ordenRuta LIMIT 4`, [IDS.ruta])
  const [todos] = await cx.query(
    `SELECT p.id FROM Prestamo p JOIN Cliente c ON c.id = p.clienteId
      WHERE c.organizationId = ?`, [IDS.org])
  const ids = todos.map((x) => x.id)
  if (ids.length) {
    await cx.query('DELETE FROM Pago WHERE prestamoId IN (?)', [ids])
    await cx.query("UPDATE Prestamo SET totalPagado = 0, estado = 'activo' WHERE id IN (?)", [ids])
  }
  await cx.query(`DELETE FROM MovimientoCapital WHERE organizationId = ? AND tipo = 'recaudo'`, [IDS.org])
  // Y el modo estricto vuelve apagado: la toma que lo explica podría dejarlo puesto.
  await cx.execute('UPDATE Organization SET capitalEstricto = 0 WHERE id = ?', [IDS.org])
  await cx.end()

  const H = { cookie: `next-auth.session-token=${await encode({
    token: { sub: IDS.cobrador, id: IDS.cobrador, email: 'c@ejemplo.com', name: 'Andrés Vargas',
      rol: 'cobrador', organizationId: IDS.org, plan: 'professional', country: 'co',
      orgNombre: 'Créditos del Valle', rutaIds: [IDS.ruta] }, secret: SECRETO })}`,
    'Content-Type': 'application/json' }
  for (const p of ps) {
    await fetch(`http://localhost:3016/api/prestamos/${p.id}/pagos`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ montoPagado: p.cuotaDiaria, tipo: 'completo', metodoPago: 'efectivo' }),
    }).catch(() => {})
  }
}

/** Del panel al capital: vive en «Más», con el nombre «Mi plata». */
const hastaCapital = async ({ ir, tocarSel, esperar }) => {
  await ir('/dashboard', /Buenos|Recaudado/i)
  await tocarSel(`${MENU} a[href="/mas"]`)
  await esperar(2600)
  await tocarSel('button:has-text("Mi plata"):visible, a:has-text("Mi plata"):visible')
  await esperar(5000)
}

const TOMAS = [
  {
    id: 'que_es',
    titulo: 'Qué es el capital',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaCapital(u)
      empezar()
      await decir('El capital es tu fondo de préstamos: la plata que pusiste tú', 5.2)
      await esperar(5400)
      await mirar('text=TODA TU PLATA >> visible=true', { escala: 1.6, ms: 4800, fila: true })
      await esperar(2800)
      await decir('La caja es el día. Esto es el fondo, y son cosas distintas', 5.0)
      await esperar(5200)
      await reposo(3400)
    },
  },
  {
    id: 'toda_tu_plata',
    titulo: 'Dónde está tu plata',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaCapital(u)
      empezar()
      await decir('Arriba, todo lo que tienes, partido en dos', 4.2)
      await esperar(4400)
      await mirar('text=Lista para prestar >> visible=true', { escala: 1.8, ms: 4800, fila: true })
      await esperar(2800)
      await decir('Lo que tienes disponible ahora mismo para prestar', 4.4)
      await esperar(4600)
      await mirar('text=En la calle >> visible=true', { escala: 1.8, ms: 4800, fila: true })
      await esperar(2800)
      await decir('Y lo que está afuera, en manos de tus clientes, cobrándose', 5.0)
      await esperar(5200)
      await decir('Si la caja se ve vacía no es que el negocio vaya mal: está prestada', 5.6)
      await esperar(5800)
      await reposo(3600)
    },
  },
  {
    id: 'cartera',
    titulo: 'Tu plata no es la cartera',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaCapital(u)
      empezar()
      await decir('Y aquí hay dos cifras que se confunden todo el tiempo', 5.0)
      await esperar(5200)
      await mirar('text=CAPITAL PRESTADO >> visible=true', { escala: 1.8, ms: 4800, fila: true })
      await esperar(2800)
      await decir('«Capital prestado» es tu plata: lo que entregaste y te tienen que devolver', 5.8)
      await esperar(6000)
      await mirar('text=POR COBRAR >> visible=true', { escala: 1.8, ms: 4800, fila: true })
      await esperar(2800)
      await decir('«Por cobrar» es eso más el interés que todavía no has ganado', 5.2)
      await esperar(5400)
      await decir('Sumar la cartera a tu fondo es contarte plata que aún no es tuya', 5.4)
      await esperar(5600)
      await reposo(3600)
    },
  },
  {
    id: 'mover',
    titulo: 'Meter y sacar plata',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocar, reposo } = u
      await hastaCapital(u)
      empezar()
      await decir('Cuando metes plata tuya al negocio, se registra aquí', 5.0)
      await esperar(5200)
      await mirar('button:has-text("Registrar movimiento"):visible', { escala: 1.8, ms: 4400 })
      await esperar(1600)
      await tocar('Registrar movimiento')
      await esperar(3200)
      await decir('«Meto plata» cuando pones más, «saco plata» cuando retiras para ti', 5.6)
      await esperar(5800)
      await decir('Y le pones de dónde salió, para acordarte dentro de tres meses', 5.2)
      await esperar(5400)
      await reposo(3600)
    },
  },
  {
    id: 'cuadrar',
    titulo: 'Cuando la cuenta no coincide',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocar, reposo } = u
      await hastaCapital(u)
      empezar()
      await decir('Y si el saldo no coincide con lo que tienes de verdad', 5.0)
      await esperar(5200)
      await mirar('button:has-text("Cuadrar el saldo"):visible', { escala: 1.8, ms: 4400 })
      await esperar(1600)
      await tocar('Cuadrar el saldo')
      await esperar(3200)
      await decir('Le dices cuánto tienes y el sistema anota el ajuste con su motivo', 5.6)
      await esperar(5800)
      await decir('No lo borra ni lo esconde: queda en la lista, con fecha', 5.0)
      await esperar(5200)
      await reposo(3600)
    },
  },
  {
    id: 'estricto',
    titulo: 'Prestar sin tener',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaCapital(u)
      empezar()
      await decir('Este interruptor decide qué pasa si te quedas sin fondo', 5.2)
      await esperar(5400)
      await mirar('text=Modo estricto >> visible=true', { escala: 1.8, ms: 4800, fila: true })
      await esperar(2800)
      await decir('Apagado, puedes prestar igual y el saldo se va a negativo', 5.0)
      await esperar(5200)
      await decir('Encendido, el sistema no te deja prestar más de lo que tienes', 5.2)
      await esperar(5400)
      await reposo(3400)
    },
  },
  {
    id: 'mes',
    titulo: 'Cómo va el mes',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaCapital(u)
      empezar()
      await decir('Más abajo, el resumen del mes en cuatro cifras', 4.6)
      await esperar(4800)
      await mirar('text=PRESTADO >> visible=true', { escala: 1.7, ms: 4800, fila: true })
      await esperar(2800)
      await decir('Cuánto entregaste, cuánto te entró y cuánto se fue en gastos', 5.2)
      await esperar(5400)
      await decir('En un negocio que arranca esto sale muy negativo, y es normal', 5.2)
      await esperar(5400)
      await decir('Acabas de soltar la plata: todavía no ha vuelto', 4.4)
      await esperar(4600)
      await reposo(3600)
    },
  },
  {
    id: 'movimientos',
    titulo: 'De dónde salió cada peso',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaCapital(u)
      empezar()
      await decir('Y abajo está todo lo que ha pasado con tu plata', 5.0)
      await esperar(5200)
      await mirar('text=MOVIMIENTOS >> visible=true', { escala: 1.7, ms: 4800, fila: true })
      await esperar(2800)
      await decir('Cada movimiento con su fecha y el saldo que iba quedando', 5.0)
      await esperar(5200)
      await decir('Y los filtros de arriba: lo que agregaste, lo que retiraste, lo prestado', 5.6)
      await esperar(5800)
      await reposo(3600)
    },
  },
  {
    id: 'sin_ruta',
    titulo: 'La plata que nadie está cobrando',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaCapital(u)
      empezar()
      await decir('Y fíjate en este aviso, que es de los que ahorran plata', 5.2)
      await esperar(5400)
      await mirar('text=sin ruta asignada >> visible=true', { escala: 1.8, ms: 4800, fila: true })
      await esperar(2800)
      await decir('Te dice cuánta plata tienes en clientes que no están en ninguna ruta', 5.6)
      await esperar(5800)
      await decir('O sea, préstamos que nadie está saliendo a cobrar', 4.6)
      await esperar(4800)
      await reposo(3600)
    },
  },
  {
    id: 'cierre',
    titulo: 'La caja es el día, el capital es el fondo',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaCapital(u)
      empezar()
      await decir('Y con esto se cierra la cuenta completa del negocio', 5.0)
      await esperar(5200)
      await mirar('text=TODA TU PLATA >> visible=true', { escala: 1.6, ms: 4800, fila: true })
      await esperar(2800)
      await decir('La caja te dice cómo fue el día. El capital, cuánto tienes', 5.0)
      await esperar(5200)
      await decir('Y las dos juntas responden la única pregunta que importa', 5.0)
      await esperar(5200)
      await decir('Cuánta plata es tuya, y dónde está ahora mismo', 4.6)
      await esperar(4800)
      await reposo(4200)
    },
  },
]

const cookie = await encode({
  token: {
    sub: IDS.owner, id: IDS.owner, email: 'demo@ejemplo.com', name: 'Sofía Restrepo', rol: 'owner',
    organizationId: IDS.org, plan: 'professional', country: 'co',
    orgNombre: 'Créditos del Valle', rutaIds: [],
  },
  secret: SECRETO,
})

await correr({
  nombre: 'el capital',
  dir: '/home/keyce/Desktop/videos-tutoriales/tomas-12',
  final: '/home/keyce/Desktop/videos-tutoriales/12-capital.mp4',
  tomas: TOMAS,
  cookie,
  antesDeToma: limpiar,
})
