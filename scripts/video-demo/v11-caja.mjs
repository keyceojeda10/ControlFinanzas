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
import { correr, SECRETO, BASE } from './grabador.mjs'
import { quitarElDecorado } from './decorado-caja.mjs'
import { conectar, IDS } from './montar-demo.mjs'

/* ⚠ LA BARRA DE ABAJO SE APUNTA POR EL `nav`, NO POR EL `href` A SECAS.
   Reportado por el dueño viendo el vídeo 15: «no está señalando bien el icono;
   señala un texto y no el icono de los préstamos en el menú».
   En el panel hay DOS enlaces visibles a `/prestamos`: el «Ver todos →» de una
   tarjeta (y=1874) y el icono de la barra (y=890). `.first()` coge el de la
   tarjeta porque va antes en el DOM, y `:visible` no ayuda: los dos lo están.
   Hoy solo pasa con préstamos, pero cualquier «Ver todos» que se añada mañana
   rompe el de al lado, así que se acota a la barra en todos. */
const MENU = 'nav[aria-label="Navegación principal"]'

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
  /* ⚠ EL PRÉSTAMO DEL VÍDEO SE VA PRIMERO, Y CON SUS PAGOS.
     Va al principio por dos razones que aprendí de golpe:
       · Borrarlo después reventaba con `ER_ROW_IS_REFERENCED_2`: la toma
         anterior le había registrado un cobro y la clave ajena no deja.
       · Y si sigue vivo cuando se eligen los cuatro préstamos a cobrar, entra
         en el sorteo —es del primer cliente de la ruta— y el «cobrado» del día
         deja de ser los 92.600 que dice la voz. */
  const [viejos] = await cx.query(
    `SELECT id FROM Prestamo WHERE organizationId = ? AND nombreProducto = 'VIDEO-CAJA'`, [IDS.org])
  if (viejos.length) {
    const ids = viejos.map((x) => x.id)
    await cx.query('DELETE FROM Pago WHERE prestamoId IN (?)', [ids])
    await cx.query('DELETE FROM MovimientoCapital WHERE referenciaId IN (?)', [ids])
    await cx.query('DELETE FROM Prestamo WHERE id IN (?)', [ids])
  }

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
    await fetch(`${BASE}/api/prestamos/${p.id}/pagos`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ montoPagado: p.cuotaDiaria, tipo: 'completo', metodoPago: 'efectivo' }),
    }).catch(() => {})
  }

  /* ══ Y UN DESEMBOLSO DE HOY, QUE ES MEDIO VÍDEO ═════════════════════════════
   *
   * La toma 3 dice «prestó cuatrocientos cincuenta mil en la calle, y esa plata
   * salió de su bolsillo», y la 4 abre ese renglón para enseñar a quién. Sin un
   * préstamo entregado HOY, «Lo que prestaste» vale $0, el renglón no se abre y
   * la toma se queda diez segundos esperando a que un texto se deje pulsar.
   *
   * Antes salía por casualidad: la demo se pobló con préstamos de «hoy», y
   * aquel hoy ya pasó. Un decorado que depende del día en que se montó se
   * rompe solo. Ahora se crea aquí, con el importe exacto que dice la voz:
   * 92.600 cobrados − 450.000 prestados = −357.400 «en la mano», que es
   * literalmente lo que narra la toma 3. */
  const cx2 = await conectar()
  const [[cli]] = await cx2.query(
    `SELECT id FROM Cliente WHERE rutaId = ? ORDER BY ordenRuta LIMIT 1`, [IDS.ruta])
  await cx2.end()
  if (cli) {
    const r = await fetch(`${BASE}/api/prestamos`, {
      method: 'POST', headers: H,
      body: JSON.stringify({
        clienteId: cli.id, montoPrestado: 450000, tasaInteres: 20, diasPlazo: 30,
        frecuencia: 'diario', modoInteres: 'plano', metodoPago: 'efectivo',
        // ⚠ `fechaInicio` es obligatoria y el endpoint responde 400 sin ella.
        //   El `.catch(() => {})` se lo tragaba y el renglón salía en $0.
        fechaInicio: new Date().toISOString().slice(0, 10),
        nombreProducto: 'VIDEO-CAJA',
      }),
    })
    /* Se AVISA si falla, no se traga. Con el `.catch` mudo, el decorado salía
       incompleto y el fallo aparecía tres tomas después como un selector que no
       se dejaba pulsar. */
    if (!r.ok) console.warn(`   ⚠ no se pudo crear el desembolso del día: ${r.status} ${(await r.text()).slice(0, 120)}`)
  }
}

/** La caja del cobrador: la tiene en su pastilla de accesos. */
const cajaCobrador = async ({ ir, tocarSel, esperar }) => {
  await ir('/dashboard', /Buenas|Recaudado/i)
  await tocarSel(`${MENU} a[href="/caja"]`)
  await esperar(4200)
}

/** La del dueño vive en «Más». */
const cajaDueno = async ({ ir, tocarSel, esperar }) => {
  await ir('/dashboard', /Buenos|Recaudado/i)
  await tocarSel(`${MENU} a[href="/mas"]`)
  await esperar(2600)
  await tocarSel('button:has-text("Caja"):visible, a:has-text("Caja"):visible')
  await esperar(5000)
}

/* ══ ESTE VÍDEO ES SOLO LA CAJA DEL COBRADOR ═══════════════════════════════
 *
 * El dueño, después de verlo montado:
 *
 *   «Ese vídeo es bastante confuso. Ahí está la caja del administrador solo,
 *    sin cobradores, y está la caja del administrador con cobradores, y en el
 *    vídeo se revolvieron todos. Era una locura, no se entendía nada.»
 *
 * Tenía razón, y no era una impresión: las tres pantallas son distintas de
 * verdad. «Cuadre» solo existe si hay cobradores (`caja/page.jsx:1537`) y «Mi
 * cierre del día» solo le sale al dueño si él mismo cobra (`:1972`). El vídeo
 * enseñaba pantallas que a media audiencia no le aparecen nunca.
 *
 * Así que se parte en tres, y este se queda con las seis tomas del cobrador:
 *
 *   · 11 · La caja del cobrador          ← este
 *   · 18 · La caja si cobras tú solo     `v18-caja-solo.mjs`
 *   · 19 · La caja con cobradores        `v19-caja-cobradores.mjs`
 *
 * El ritmo lo pone la voz (`narrar`). Ver la nota larga de `grabador.mjs`.
 *
 *     node scripts/video-demo/voz.mjs 11-caja --solo-audio
 *     SIN_ROTULOS=1 LOCUCION=11-caja node scripts/video-demo/v11-caja.mjs
 */
const TOMAS = [
  {
    id: 'que_es',
    titulo: 'Qué es la caja del cobrador',
    async grabar(u) {
      const { empezar, narrar, reposo } = u
      await cajaCobrador(u)
      empezar()
      await narrar(0, { mirar: 'text=PAGOS DEL DÍA', escala: 1.7 })
      await narrar(1)
      await reposo(1400)
    },
  },

  {
    id: 'pagos',
    titulo: 'Lo que cobró, uno por uno',
    async grabar(u) {
      const { esperar, empezar, narrar, mirar, reposo, p } = u
      await cajaCobrador(u)
      empezar()
      await narrar(0, { mirar: 'text=4 registros', escala: 1.9, fila: true })
      /* Se baja por la lista mientras se cuenta: el renglón que se nombra —«se
         ve cuál fue»— solo se entiende viendo pasar los cobros. */
      await narrar(1, {
        hacer: async () => {
          await p.mouse.wheel(0, 220); await esperar(600)
          await mirar('text=PAGOS DEL DÍA', { escala: 1.5, ms: 2400 })
        },
      })
      await reposo(1400)
    },
  },

  {
    id: 'tu_dia',
    titulo: 'La cuenta del día, en cuatro renglones',
    async grabar(u) {
      const { empezar, narrar, reposo } = u
      await cajaCobrador(u)
      empezar()
      /* ⚠ DOS ACERCAMIENTOS EN ESTA TOMA, NO CUATRO.
         Puse uno por renglón y el montaje avisó: «dos acercamientos a 1,1s uno
         de otro, se ve como un tirón». Las cuatro frases son cortas y los zooms
         se montaban unos sobre otros. Se quedan el primero, que sitúa el bloque,
         y el de «Te queda en la mano», que es la cifra que el vídeo viene a
         explicar. Los dos de en medio se cuentan sin mover la cámara. */
      await narrar(0, { mirar: 'text=TU DÍA HASTA AHORA', escala: 1.6, fila: true })
      await narrar(1)
      await narrar(2)
      /* ⚠ `fila: true` EN «Te queda en la mano», SIEMPRE. Es un rótulo estrecho
         y pegado al margen: sin ensanchar el encuadre, la cifra se sale por la
         derecha y sale «Te queda en la mano» sin número, que es justo lo que
         este renglón viene a explicar. */
      await narrar(3, { mirar: 'text=Te queda en la mano', escala: 1.8, fila: true })
      await reposo(1600)
    },
  },

  {
    id: 'prestaste',
    titulo: 'De dónde salió cada peso',
    async grabar(u) {
      const { esperar, empezar, narrar, tocar, reposo } = u
      await cajaCobrador(u)
      empezar()
      await narrar(0, {
        hacer: async () => { await tocar('Lo que prestaste'); await esperar(2200) },
      })
      await narrar(1, { mirar: 'text=Lo que prestaste >> visible=true', escala: 1.7, fila: true })
      await narrar(2)
      await reposo(1600)
    },
  },

  {
    id: 'gasto',
    titulo: 'El pasaje y el almuerzo',
    async grabar(u) {
      const { esperar, empezar, narrar, tocar, reposo } = u
      await cajaCobrador(u)
      empezar()
      await narrar(0, {
        mirar: 'button:has-text("Reportar gasto menor"):visible', escala: 1.8,
        hacer: async () => { await tocar('Reportar gasto menor'); await esperar(2400) },
      })
      await narrar(1)
      await reposo(1600)
    },
  },

  {
    id: 'entregar',
    titulo: 'Las dos cifras de la noche',
    async grabar(u) {
      const { empezar, narrar, reposo } = u
      await cajaCobrador(u)
      empezar()
      await narrar(0)
      await narrar(1, { mirar: 'text=Lo que tocaba cobrar hoy', escala: 1.8, fila: true })
      await narrar(2, { mirar: 'text=Usar', escala: 2.0, fila: true })
      await narrar(3)
      await reposo(2200)
    },
  },
]

const cobrador = await galleta('cobrador')
const dueno = await galleta('owner')
// Ya no hay tomas del dueño en este vídeo: se fueron al 18 y al 19.
for (const t of TOMAS) if (t.rol === 'owner') t.cookie = dueno

try {
  await correr({
    nombre: 'la caja',
    dir: '/home/keyce/Desktop/videos-tutoriales/tomas-11',
    final: '/home/keyce/Desktop/videos-tutoriales/11-caja.mp4',
    tomas: TOMAS,
    cookie: cobrador,
    antesDeToma: limpiar,
  })
} finally {
  // El decorado no se queda vivo para el siguiente vídeo. Ver `quitarElDecorado`.
  await quitarElDecorado()
  console.log('· decorado de caja retirado')
}
