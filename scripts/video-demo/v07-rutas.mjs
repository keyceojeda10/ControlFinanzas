// scripts/video-demo/v07-rutas.mjs
//
// VÍDEO 7 · Las rutas: crearlas, llenarlas y ordenarlas
//
//     node scripts/video-demo/v07-rutas.mjs
//     node scripts/video-demo/v07-rutas.mjs --toma 5
//     node scripts/video-demo/v07-rutas.mjs --pegar
//
// Palabras del dueño: «la ruta tiene demasiada caña». Es la pantalla con más
// cosas del sistema —siete botones, tres pestañas, dos filtros y un modo
// recorrido aparte— y es la que el cobrador tiene delante toda la mañana.
//
// ── EL DECORADO QUE HUBO QUE ARREGLAR PRIMERO ──────────────────────────────
//
// El negocio de mentira NO servía para este vídeo y hubo que tocar
// `montar-demo` y `poblar-demo` antes de escribir una sola toma:
//
//  · Los ocho clientes se geocodificaban desde direcciones genéricas y salían
//    repartidos por media Colombia. La cabecera decía «8 clientes · 2.666,0 km»,
//    que contradice la idea entera de una ruta. Ahora van apiñados: «5,9 km».
//  · No había NI UN cliente sin ruta, así que no se podía enseñar ni «crear una
//    ruta» ni «agregar clientes». Ahora hay cinco, con préstamo, en otro barrio.
//  · Los cinco van todos en «Barrio La Floresta» porque las sugerencias agrupan
//    por PALABRA COMPARTIDA en la dirección: con un barrio distinto cada uno, la
//    pantalla decía «ya están agrupados» y el atajo no se veía.
//
// ── LO QUE NO SE TOCA EN CÁMARA ────────────────────────────────────────────
//
//  · «Google Maps» hace `window.open`: se enseña y se explica, no se pulsa.
//  · «Quitar de la ruta» usa `confirm()` del navegador. Playwright lo descarta
//    solo y la acción se cancelaría sin que se note.
//
// ── ⚠ TODOS LOS SELECTORES LLEVAN `:visible` ───────────────────────────────
//
// Esta pantalla pinta DOS ÁRBOLES: el de móvil y el de escritorio, con
// `hidden lg:block`, y comparten los mismos botones y las mismas etiquetas. A
// 540px la copia de escritorio sigue en el DOM, va PRIMERA, y `.first()` la
// coge: la toma se queda diez segundos esperando a que un elemento invisible se
// deje pulsar, y aborta. No es exclusivo de rutas: pasa en toda pantalla con
// versión de PC.

import { encode } from 'next-auth/jwt'
import { correr, SECRETO } from './grabador.mjs'
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

const RUTA_NUEVA = 'Ruta La Floresta'
const RUTA_VIEJA = 'Ruta Centro'

/* La ruta que crea la grabación se borra ANTES de cada toma y sus clientes
   vuelven a quedar sueltos: cada toma se lleva sola desde el principio, así que
   sin esto la segunda ya encontraría la ruta hecha. */
const limpiar = async (dosRutas = false) => {
  const cx = await conectar()
  const [extras] = await cx.query(
    'SELECT id FROM Ruta WHERE organizationId = ? AND id <> ?', [IDS.org, IDS.ruta])
  for (const r of extras) {
    await cx.execute('UPDATE Cliente SET rutaId = NULL, ordenRuta = 0 WHERE rutaId = ?', [r.id])
    await cx.execute('DELETE FROM Ruta WHERE id = ?', [r.id])
  }
  if (dosRutas) {
    // Para la toma del conmutador «Trabajo / Ordenar», que SOLO aparece con más
    // de una ruta (`rutas.length > 1` en la página). Con la ruta única de la
    // demo es invisible y la toma grabaría una pantalla sin lo que explica.
    const id = 'zzvideodemo000000000ruta02'
    await cx.execute(
      `INSERT INTO Ruta (id, nombre, organizationId, cobradorId, activo, orden, saldoCapital, createdAt)
       VALUES (?, ?, ?, NULL, 1, 1, 0, NOW())`, [id, RUTA_NUEVA, IDS.org])
    await cx.execute(
      `UPDATE Cliente SET rutaId = ?, ordenRuta = 0
       WHERE organizationId = ? AND rutaId IS NULL`, [id, IDS.org])
  }
  await cx.end()
}

/**
 * Camino común: del panel a la lista de rutas, TOCANDO la pastilla.
 *
 * ⚠ NO por texto. Hay dos enlaces a `/rutas`: el del menú de escritorio, que
 * lleva la palabra «Rutas» y a 540px está oculto, y el de la pastilla de abajo,
 * que es un icono SIN texto. `tocar('Rutas')` cogía el primero y se quedaba
 * diez segundos esperando a que un elemento invisible se dejara pulsar.
 */
const hastaRutas = async ({ ir, tocarSel, esperar }) => {
  await ir('/dashboard', /Buenos|Recaudado/i)
  await tocarSel(`${MENU} a[href="/rutas"]`)
  await esperar(2800)
}

/** Y de ahí, dentro de la ruta que ya tiene movimiento. */
const hastaLaRuta = async (u) => {
  await hastaRutas(u)
  await u.tocar(RUTA_VIEJA)
  await u.esperar(3200)
}

/* El ritmo lo pone la voz: `narrar(i)` dura lo que dura su frase y la pantalla
   se mueve DENTRO de ella. Ver la nota larga de `grabador.mjs`.

     node scripts/video-demo/voz.mjs 07-rutas --solo-audio
     SIN_ROTULOS=1 LOCUCION=07-rutas node scripts/video-demo/v07-rutas.mjs */
const TOMAS = [
  /* ══ CÓMO SE LLEGA, QUE FALTABA ═══════════════════════════════════════════
   * El dueño, con media edición hecha: «dice "vamos a crear las rutas", pero no
   * dice cómo llega al apartado». La causa era `hastaRutas(u)` ANTES de
   * `empezar()`: el camino se recorría de verdad y quedaba fuera de la
   * grabación. Ahora entra como primera toma, dentro del propio vídeo. */
  {
    id: 'como_llegar',
    titulo: 'Cómo llegar a las rutas',
    async grabar(u) {
      const { ir, esperar, empezar, narrar, tocarSel, reposo } = u
      await ir('/dashboard', /Buenos|Buenas|Recaudado/i)
      await esperar(1200)
      empezar()
      await esperar(700)
      await narrar(0, {
        mirar: `${MENU} a[href="/rutas"]`, escala: 2.4,
        hacer: async () => { await tocarSel(`${MENU} a[href="/rutas"]`); await esperar(2000) },
      })
      await narrar(1)
      await reposo(1400)
    },
  },

  {
    id: 'que_es',
    titulo: 'Qué es una ruta y dónde está',
    async grabar(u) {
      const { empezar, narrar, reposo } = u
      await hastaRutas(u)
      empezar()
      await narrar(0, { mirar: `[role="button"]:has-text("${RUTA_VIEJA}")`, escala: 1.5, fila: true })
      await narrar(1)
      await reposo(1400)
    },
  },

  {
    id: 'sin_ruta',
    titulo: 'Los clientes que no están en ninguna ruta',
    async grabar(u) {
      const { empezar, narrar, reposo } = u
      await hastaRutas(u)
      empezar()
      await narrar(0, { mirar: 'text=clientes sin ruta asignada', escala: 1.8 })
      await narrar(1, { mirar: 'text=Sin ruta', escala: 1.8, fila: true })
      await narrar(2)
      await reposo(1400)
    },
  },

  {
    id: 'crear',
    titulo: 'Crear una ruta',
    async grabar(u) {
      const { esperar, empezar, narrar, escribir, tocarSel, reposo } = u
      await hastaRutas(u)
      empezar()
      await narrar(0, {
        mirar: '[aria-label="Nueva ruta"]:visible', escala: 2.0,
        hacer: async () => { await tocarSel('[aria-label="Nueva ruta"]:visible'); await esperar(1800) },
      })
      await narrar(1, {
        hacer: async () => {
          await escribir('input[placeholder*="Nombre de la ruta"]', RUTA_NUEVA)
          await esperar(1200)
        },
      })
      await narrar(2)
      await reposo(1400)
    },
  },

  {
    id: 'quien_cobra',
    titulo: 'Quién la cobra y con cuánto arranca',
    dosRutas: false,
    async grabar(u) {
      const { esperar, empezar, narrar, escribir, tocar, tocarSel, reposo } = u
      await hastaRutas(u)
      await tocarSel('[aria-label="Nueva ruta"]:visible'); await esperar(2200)
      await escribir('input[placeholder*="Nombre de la ruta"]', RUTA_NUEVA)
      empezar()
      await narrar(0, { mirar: 'text=Quién la recorre', escala: 1.9 })
      await narrar(1)
      await narrar(2, { mirar: 'text=Capital de la ruta', escala: 1.8 })
      await narrar(3, {
        hacer: async () => { await tocar('Crear ruta'); await esperar(2600) },
      })
      await reposo(1600)
    },
  },

  {
    id: 'agregar',
    titulo: 'Meterle los clientes',
    async grabar(u) {
      const { esperar, empezar, narrar, escribir, tocar, tocarSel, reposo } = u
      await hastaRutas(u)
      await tocarSel('[aria-label="Nueva ruta"]:visible'); await esperar(2200)
      await escribir('input[placeholder*="Nombre de la ruta"]', RUTA_NUEVA)
      await tocar('Crear ruta'); await esperar(4200)
      empezar()
      await narrar(0)
      await narrar(1, {
        mirar: 'button:has-text("Agregar"):visible', escala: 1.8,
        hacer: async () => { await tocar('Agregar'); await esperar(2200) },
      })
      await narrar(2)
      await reposo(1400)
    },
  },

  {
    id: 'asignar',
    titulo: 'Marcarlos y meterlos',
    async grabar(u) {
      const { esperar, empezar, narrar, escribir, tocar, tocarSel, reposo, p } = u
      await hastaRutas(u)
      await tocarSel('[aria-label="Nueva ruta"]:visible'); await esperar(2200)
      await escribir('input[placeholder*="Nombre de la ruta"]', RUTA_NUEVA)
      await tocar('Crear ruta'); await esperar(4200)
      await tocar('Agregar'); await esperar(2600)
      empezar()
      /* ⚠ EL CONTADOR NO EXISTE HASTA QUE SE MARCA A ALGUIEN.
         El botón dice «Agregar» a secas y solo pasa a «Agregar (2)» con clientes
         marcados. La toma vieja lo buscaba sin marcar nada y se quedaba seis
         segundos esperando un rótulo que no iba a llegar. Y encima es lo que la
         frase cuenta —«marcas los que van en esta ruta»—, así que marcar en
         cámara no es un apaño: es la toma. */
      await narrar(0, {
        hacer: async () => {
          for (const quien of ['Nubia Castaño', 'Álvaro Betancur']) {
            await p.locator(`.fixed.inset-0 >> text=${quien}`).first().click().catch(() => {})
            await esperar(700)
          }
        },
      })
      await narrar(1, { mirar: '.fixed.inset-0 button:has-text("Agregar (")', escala: 1.9 })
      await narrar(2, {
        hacer: async () => {
          await tocarSel('.fixed.inset-0 button:has-text("Agregar (")')
          await esperar(2600)
        },
      })
      await reposo(1600)
    },
  },

  {
    id: 'sugerencias',
    titulo: 'El atajo: agrupar por barrio',
    async grabar(u) {
      const { esperar, empezar, narrar, tocar, reposo } = u
      await hastaRutas(u)
      empezar()
      await narrar(0, {
        mirar: 'button:has-text("Ver sugerencias"):visible', escala: 1.9,
        hacer: async () => { await tocar('Ver sugerencias'); await esperar(2200) },
      })
      await narrar(1, { mirar: 'text=5 clientes', escala: 1.7 })
      await narrar(2)
      await reposo(1600)
    },
  },

  {
    id: 'botones',
    titulo: 'Dentro de una ruta',
    async grabar(u) {
      const { empezar, narrar, reposo } = u
      await hastaLaRuta(u)
      empezar()
      await narrar(0)
      await narrar(1, { mirar: 'text=LO QUE TIENES PUESTO AQUÍ', escala: 1.6 })
      await narrar(2, { mirar: 'button:has-text("Imprimir hoja"):visible', escala: 1.6 })
      await reposo(1400)
    },
  },

  {
    id: 'mapa',
    titulo: 'Optimizar y el mapa',
    async grabar(u) {
      const { empezar, narrar, reposo } = u
      await hastaLaRuta(u)
      empezar()
      await narrar(0, { mirar: 'button:has-text("Optimizar"):visible', escala: 1.9 })
      await narrar(1, { mirar: 'button:has-text("Google Maps"):visible', escala: 1.9 })
      await narrar(2)
      await reposo(1400)
    },
  },

  {
    id: 'ordenar',
    titulo: 'Las tres vistas de los clientes',
    async grabar(u) {
      const { esperar, empezar, narrar, tocarSel, reposo } = u
      await hastaLaRuta(u)
      empezar()
      await narrar(0, { mirar: 'button:text-is("Cobros"):visible', escala: 1.8 })
      await narrar(1)
      await narrar(2, {
        hacer: async () => { await tocarSel('button:text-is("Ordenar"):visible'); await esperar(2200) },
      })
      await narrar(3)
      await reposo(1600)
    },
  },

  {
    id: 'auditoria',
    titulo: 'Auditoría, y las dos vistas del día',
    async grabar(u) {
      const { esperar, empezar, narrar, tocarSel, reposo } = u
      await hastaLaRuta(u)
      empezar()
      await narrar(0, {
        hacer: async () => { await tocarSel('button:text-is("Auditoría"):visible'); await esperar(2200) },
      })
      await narrar(1, {
        hacer: async () => { await tocarSel('button:text-is("Cobros"):visible'); await esperar(1800) },
      })
      await narrar(2, { mirar: 'button:has-text("Hoy"):visible', escala: 2.0 })
      await reposo(1600)
    },
  },

  {
    id: 'recorrido',
    titulo: 'Empezar recorrido',
    async grabar(u) {
      const { esperar, empezar, narrar, tocar, reposo } = u
      await hastaLaRuta(u)
      empezar()
      await narrar(0, {
        mirar: 'button:has-text("Empezar recorrido"):visible', escala: 1.8,
        hacer: async () => { await tocar('Empezar recorrido'); await esperar(2600) },
      })
      await narrar(1)
      await narrar(2)
      await reposo(1800)
    },
  },

  {
    id: 'ordenar_rutas',
    titulo: 'Ordenar las rutas entre ellas',
    dosRutas: true,
    async grabar(u) {
      const { esperar, empezar, narrar, tocarSel, reposo } = u
      await hastaRutas(u)
      empezar()
      await narrar(0, {
        mirar: 'button:text-is("Ordenar"):visible', escala: 1.9,
        hacer: async () => { await tocarSel('button:text-is("Ordenar"):visible'); await esperar(2000) },
      })
      await narrar(1, {
        hacer: async () => {
          await tocarSel('[aria-label="Bajar"]:not([disabled]):visible')
          await esperar(1200)
          await tocarSel('[aria-label="Subir"]:not([disabled]):visible', { espera: 1600 })
        },
      })
      await narrar(2, { mirar: 'button:has-text("Guardar copia"):visible', escala: 1.8 })
      await narrar(3, {
        hacer: async () => { await tocarSel('button:text-is("Trabajo"):visible'); await esperar(1800) },
      })
      await reposo(1600)
    },
  },

  {
    id: 'cierre',
    titulo: 'Dónde te deja',
    dosRutas: true,
    async grabar(u) {
      const { esperar, empezar, narrar, tocar, reposo } = u
      await hastaRutas(u)
      empezar()
      await narrar(0, { mirar: 'text=RECAUDADO HOY', escala: 1.6 })
      await narrar(1)
      await narrar(2, {
        mirar: 'button:has-text("Salir a cobrar"):visible', escala: 1.8,
        hacer: async () => { await tocar('Salir a cobrar'); await esperar(2600) },
      })
      await reposo(2200)
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
  nombre: 'rutas',
  dir: '/home/keyce/Desktop/videos-tutoriales/tomas-07',
  final: '/home/keyce/Desktop/videos-tutoriales/07-rutas.mp4',
  tomas: TOMAS,
  cookie,
  antesDeToma: (toma) => limpiar(Boolean(toma.dosRutas)),
})
