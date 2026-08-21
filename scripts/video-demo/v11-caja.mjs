// scripts/video-demo/v11-caja.mjs
//
// VÍDEO 11 · La caja: cuadrar el día
//
//     node scripts/video-demo/v11-caja.mjs
//     node scripts/video-demo/v11-caja.mjs --toma 6
//     node scripts/video-demo/v11-caja.mjs --pegar
//
// El vídeo más delicado de la serie: aquí es donde el dinero cambia de manos.
// Va en dos mitades y con las dos sesiones —la del cobrador y la del dueño—,
// porque la gracia es que las dos cuenten lo mismo.
//
// ── LAS DOS PREGUNTAS QUE NO SON LA MISMA ──────────────────────────────────
//
//   el fajo   los billetes que el cobrador lleva encima y entrega de noche
//   la bolsa  el capital de la ruta, incluido lo que está en el banco
//
// De confundirlas sale la mitad de los descuadres. El vídeo las separa desde
// la primera toma y no vuelve a mezclarlas.
//
// ── Y LA TERCERA, QUE ES LA QUE SE ARREGLÓ ANTES DE GRABAR ─────────────────
//
//   «Te queda en la mano»       lo que de verdad tiene
//   «Lo que tocaba cobrar hoy»  la meta del día
//
// Ese segundo rótulo decía «Deberías tener en caja», y con un cobrador que
// presta en la calle las dos cifras se separan: −$357.400 contra $177.500 en la
// misma pantalla. Se renombró (no se tocó ninguna cuenta) para poder grabarlo.
//
// ── LO QUE NO SE PULSA ─────────────────────────────────────────────────────
//
//  · «Confirmar y entregar caja» cierra el día de verdad: se enseña el botón y
//    el campo, y se cuenta lo que pasa. Cerrarlo dejaría a las tomas siguientes
//    con la caja ya cuadrada y el bloque cambiado.
//  · «Ajustar saldo» del capital: es del vídeo de capital.

import { encode } from 'next-auth/jwt'
import { correr, SECRETO } from './grabador.mjs'
import { conectar, IDS } from './montar-demo.mjs'

const galleta = (rol) => encode({
  token: {
    sub: rol === 'owner' ? IDS.owner : IDS.cobrador,
    id: rol === 'owner' ? IDS.owner : IDS.cobrador,
    email: 'demo@ejemplo.com',
    name: rol === 'owner' ? 'Sofía Restrepo' : 'Andrés Vargas',
    rol, organizationId: IDS.org, plan: 'professional', country: 'co',
    orgNombre: 'Créditos del Valle', rutaIds: rol === 'owner' ? [] : [IDS.ruta],
  },
  secret: SECRETO,
})

/* ⚠ CADA TOMA NECESITA EL MISMO DÍA. Una caja vacía no enseña nada («el cero es
   un dato», pero aquí el dato es el cuadre), y una toma no puede heredar el
   gasto o el cierre que hizo la anterior. Se borra lo de hoy y se vuelven a
   registrar los cuatro cobros POR EL ENDPOINT REAL, para que las cifras sean
   las que el sistema produce y no las que yo escriba. */
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
  await cx.query('DELETE FROM GastoMenor WHERE organizationId = ?', [IDS.org]).catch(() => {})
  await cx.query('DELETE FROM CierreCaja WHERE organizationId = ?', [IDS.org]).catch(() => {})
  // Los recaudos de hoy se van con los pagos; el desembolso del día se queda.
  await cx.query(
    `DELETE FROM MovimientoCapital WHERE organizationId = ? AND tipo = 'recaudo'`, [IDS.org])
  await cx.end()

  const H = { cookie: `next-auth.session-token=${await galleta('cobrador')}`,
    'Content-Type': 'application/json' }
  for (const p of ps) {
    await fetch(`http://localhost:3016/api/prestamos/${p.id}/pagos`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ montoPagado: p.cuotaDiaria, tipo: 'completo', metodoPago: 'efectivo' }),
    }).catch(() => {})
  }
}

/** La caja del cobrador: la tiene en su pastilla de accesos. */
const cajaCobrador = async ({ ir, tocarSel, esperar }) => {
  await ir('/dashboard', /Buenas|Recaudado/i)
  await tocarSel('a[href="/caja"]:visible')
  await esperar(4200)
}

/** La del dueño vive en «Más». */
const cajaDueno = async ({ ir, tocarSel, esperar }) => {
  await ir('/dashboard', /Buenos|Recaudado/i)
  await tocarSel('a[href="/mas"]:visible')
  await esperar(2600)
  await tocarSel('button:has-text("Caja"):visible, a:has-text("Caja"):visible')
  await esperar(5000)
}

const TOMAS = [
  {
    id: 'que_es',
    titulo: 'Qué es la caja',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await cajaCobrador(u)
      empezar()
      await decir('La caja es donde el día se cuadra y la plata cambia de manos', 5.4)
      await esperar(5600)
      await mirar('text=PAGOS DEL DÍA', { escala: 1.7, ms: 4600 })
      await esperar(2600)
      await decir('Esta es la del cobrador, y es la que manda: la que él vive', 5.0)
      await esperar(5200)
      await reposo(3400)
    },
  },
  {
    id: 'pagos',
    titulo: 'Lo que cobró, uno por uno',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await cajaCobrador(u)
      empezar()
      await decir('Arriba, cada cobro del día con su hora y cómo le pagaron', 5.0)
      await esperar(5200)
      await mirar('text=4 registros', { escala: 1.9, ms: 4600, fila: true })
      await esperar(2600)
      await decir('Si algo no cuadra, aquí se ve cuál fue y se abre su préstamo', 5.2)
      await esperar(5400)
      await reposo(3400)
    },
  },
  {
    id: 'tu_dia',
    titulo: 'Prestar saca plata del bolsillo',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await cajaCobrador(u)
      empezar()
      await decir('Y abajo, la cuenta del día en cuatro renglones', 4.6)
      await esperar(4800)
      await mirar('text=TU DÍA HASTA AHORA', { escala: 1.6, ms: 4800, fila: true })
      await esperar(2800)
      await decir('Cobró noventa y dos mil seiscientos. Hasta ahí, fácil', 4.8)
      await esperar(5000)
      await decir('Pero prestó cuatrocientos cincuenta mil en la calle, y esa plata salió de su mano', 6.0)
      await esperar(6200)
      await mirar('text=Te queda en la mano', { escala: 1.8, ms: 4800, fila: true })
      await esperar(2800)
      await decir('Por eso le queda menos trescientos cincuenta y siete mil: puso de lo suyo', 5.6)
      await esperar(5800)
      await reposo(3600)
    },
  },
  {
    id: 'prestaste',
    titulo: 'De dónde salió cada peso',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocar, reposo } = u
      await cajaCobrador(u)
      empezar()
      await decir('Y ese renglón se abre, que es lo que evita discusiones', 5.0)
      await esperar(5200)
      await tocar('Lo que prestaste')
      await esperar(3000)
      await decir('Te dice a quién le prestó y cuánto, préstamo por préstamo', 5.0)
      await esperar(1800)
      await mirar('text=Lo que prestaste >> visible=true', { escala: 1.7, ms: 4600, fila: true })
      await esperar(2600)
      await decir('La suma de la lista es exactamente el número de arriba', 4.8)
      await esperar(5000)
      await reposo(3600)
    },
  },
  {
    id: 'gasto',
    titulo: 'El pasaje y el almuerzo',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocar, reposo } = u
      await cajaCobrador(u)
      empezar()
      await decir('Si gastó algo del día, va aquí abajo', 4.2)
      await esperar(4400)
      await mirar('button:has-text("Reportar gasto menor"):visible', { escala: 1.8, ms: 4600 })
      await esperar(1600)
      await tocar('Reportar gasto menor')
      await esperar(3200)
      await decir('El pasaje, el almuerzo, la gasolina de la moto', 4.4)
      await esperar(4600)
      await decir('Se descuenta solo de lo que tiene que entregar, sin apuntarlo aparte', 5.4)
      await esperar(5600)
      await reposo(3600)
    },
  },
  {
    id: 'entregar',
    titulo: 'Las dos cifras de la noche',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await cajaCobrador(u)
      empezar()
      await decir('Y llega la noche. Aquí hay dos cifras y no son la misma', 5.2)
      await esperar(5400)
      await mirar('text=Lo que tocaba cobrar hoy', { escala: 1.8, ms: 4800, fila: true })
      await esperar(2800)
      await decir('Esta es la meta del día: lo que le tocaba cobrar si todos pagaban', 5.4)
      await esperar(5600)
      await mirar('text=Usar', { escala: 2.0, ms: 4600, fila: true })
      await esperar(2600)
      await decir('Y esta es la que entrega: lo que de verdad tiene en la mano', 5.0)
      await esperar(5200)
      await decir('Cuenta los billetes, escribe cuánto trae, y entrega', 4.6)
      await esperar(4800)
      await reposo(3800)
    },
  },
  {
    id: 'dueno',
    titulo: 'La misma caja, desde el otro lado',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await cajaDueno(u)
      empezar()
      await decir('Ahora la otra mitad: lo que ve el dueño', 4.2)
      await esperar(4400)
      await mirar('text=CÓMO SE ARMA EL SALDO', { escala: 1.7, ms: 4800, fila: true })
      await esperar(2800)
      await decir('Lo mismo, pero de todas las rutas juntas y sin salir a la calle', 5.2)
      await esperar(5400)
      await decir('Y las cifras que comparten tienen que dar idénticas', 4.8)
      await esperar(5000)
      await reposo(3400)
    },
    rol: 'owner',
  },
  {
    id: 'pestanas',
    titulo: 'Las cuatro vistas',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await cajaDueno(u)
      empezar()
      await decir('Arriba tiene cuatro maneras de mirar el mismo día', 4.8)
      await esperar(5000)
      await mirar('button:has-text("Por ruta"):visible', { escala: 1.8, ms: 4800 })
      await esperar(2800)
      await decir('El día completo, ruta por ruta, cuenta por cuenta, y el cuadre', 5.2)
      await esperar(5400)
      await reposo(3400)
    },
    rol: 'owner',
  },
  {
    id: 'cuadre',
    titulo: 'Quién ya entregó',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocar, reposo } = u
      await cajaDueno(u)
      await tocar('Cuadre')
      await esperar(4200)
      empezar()
      await decir('El cuadre es el que se mira cada noche', 4.4)
      await esperar(4600)
      await mirar('text=CUADRE DEL DÍA', { escala: 1.7, ms: 4800 })
      await esperar(2800)
      await decir('Quién ya entregó y quién no, y cuánto dice el sistema que trae', 5.4)
      await esperar(5600)
      await mirar('text=SISTEMA', { escala: 1.9, ms: 4600, fila: true })
      await esperar(2600)
      await decir('Cuentas los billetes, confirmas, y si hay diferencia queda anotada', 5.4)
      await esperar(5600)
      await reposo(3600)
    },
    rol: 'owner',
  },
  {
    id: 'por_ruta',
    titulo: 'La caja de cada cobrador',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocar, reposo } = u
      await cajaDueno(u)
      await tocar('Por ruta')
      await esperar(4200)
      empezar()
      await decir('Y si tienes varios, aquí abres la caja de uno solo', 5.0)
      await esperar(5200)
      await mirar('text=CAJA POR COBRADOR', { escala: 1.7, ms: 4800 })
      await esperar(2800)
      await decir('Su día entero: lo que prestó, lo que cobró y todos sus movimientos', 5.4)
      await esperar(5600)
      await reposo(3400)
    },
    rol: 'owner',
  },
  {
    id: 'cuentas',
    titulo: 'Cuánto hay en cada cuenta',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocar, reposo } = u
      await cajaDueno(u)
      await tocar('Cuentas')
      await esperar(4200)
      empezar()
      await decir('«Cuentas» separa el efectivo de lo que entró por Nequi o al banco', 5.6)
      await esperar(5800)
      await mirar('text=Dinero por cuenta', { escala: 1.7, ms: 4800 })
      await esperar(2800)
      await decir('Y ojo, que es el movimiento del período, no el saldo del banco', 5.2)
      await esperar(5400)
      await reposo(3400)
    },
    rol: 'owner',
  },
  {
    id: 'cierre',
    titulo: 'Las dos tienen que decir lo mismo',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await cajaDueno(u)
      empezar()
      await decir('Y esto es lo único que hay que recordar de todo el vídeo', 5.0)
      await esperar(5200)
      /* ⚠ CON `text=` NO VALE PEGARLE `:visible`: es otro motor de selección.
         `text=SALDO EN CAJA` cazaba un <span> oculto de la copia de escritorio y
         la toma se quedaba esperando a que se dejara ver. Se dice aparte, con
         `>> visible=true`, o se apunta a otro texto que solo exista una vez. */
      await mirar('text=disponible para prestar >> visible=true', { escala: 1.7, ms: 4800, fila: true })
      await esperar(2800)
      await decir('Son dos preguntas: lo que el cobrador lleva encima esta noche', 5.0)
      await esperar(5200)
      await decir('Y el capital de la ruta, que incluye lo que está en el banco', 5.0)
      await esperar(5200)
      await decir('Cada pantalla puede enseñar más detalle. Lo que comparten, idéntico', 5.4)
      await esperar(5600)
      await reposo(4200)
    },
    rol: 'owner',
  },
]

const cobrador = await galleta('cobrador')
const dueno = await galleta('owner')
for (const t of TOMAS) if (t.rol === 'owner') t.cookie = dueno

await correr({
  nombre: 'la caja',
  dir: '/tmp/videos/11-caja',
  final: '/tmp/videos/11-caja.mp4',
  tomas: TOMAS,
  cookie: cobrador,
  antesDeToma: limpiar,
})
