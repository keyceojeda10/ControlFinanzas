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
  await tocarSel('a[href="/rutas"]:visible')
  await esperar(2800)
}

/** Y de ahí, dentro de la ruta que ya tiene movimiento. */
const hastaLaRuta = async (u) => {
  await hastaRutas(u)
  await u.tocar(RUTA_VIEJA)
  await u.esperar(3200)
}

const TOMAS = [
  {
    id: 'que_es',
    titulo: 'Qué es una ruta y dónde está',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaRutas(u)
      empezar()
      await decir('Una ruta es un grupo de clientes que cobra la misma persona', 5.0)
      await esperar(5200)
      await mirar(`[role="button"]:has-text("${RUTA_VIEJA}")`, { escala: 1.5, ms: 4800 })
      await esperar(2600)
      await decir('De un vistazo: quién la lleva, cuántos cobros y cuánto entró', 5.2)
      await esperar(5400)
      await reposo(3200)
    },
  },
  {
    id: 'sin_ruta',
    titulo: 'Los clientes que no están en ninguna ruta',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaRutas(u)
      empezar()
      await decir('Si tienes clientes fuera de toda ruta, te lo dice arriba', 5.0)
      await esperar(5200)
      await mirar('text=clientes sin ruta asignada', { escala: 1.8, ms: 4600 })
      await esperar(2600)
      await decir('Y abajo salen juntos, para que no se te pierda ninguno', 5.0)
      await esperar(1600)
      await mirar('text=Sin ruta', { escala: 1.8, ms: 4600 })
      await esperar(2600)
      await reposo(3400)
    },
  },
  {
    id: 'crear',
    titulo: 'Crear una ruta',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocar, tocarSel, escribir, reposo } = u
      await hastaRutas(u)
      empezar()
      await decir('Para crear una, el botón del más, arriba a la derecha', 4.8)
      await esperar(5000)
      await mirar('[aria-label="Nueva ruta"]:visible', { escala: 2.0, ms: 4200 })
      await esperar(1200)
      await tocarSel('[aria-label="Nueva ruta"]:visible')
      await esperar(2600)
      await decir('Lo primero, el nombre. Ponle el del barrio', 4.4)
      await esperar(4600)
      await escribir('input[placeholder*="Nombre de la ruta"]', RUTA_NUEVA)
      await esperar(2400)
      await decir('Así es como la va a buscar el cobrador en su teléfono', 4.8)
      await esperar(5000)
      await reposo(3200)
    },
  },
  {
    id: 'quien_cobra',
    titulo: 'Quién la recorre y el capital',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocar, tocarSel, escribir, reposo, p } = u
      await hastaRutas(u)
      await tocarSel('[aria-label="Nueva ruta"]:visible'); await esperar(2200)
      await escribir('input[placeholder*="Nombre de la ruta"]', RUTA_NUEVA)
      await esperar(1200)
      empezar()
      await decir('Después, quién la recorre', 3.6)
      await esperar(3800)
      await mirar('text=Quién la recorre', { escala: 1.9, ms: 4400 })
      await p.selectOption('select', { label: 'Andrés Vargas' }).catch(() => {})
      await esperar(2600)
      await decir('Puedes dejarla sin cobrador si la cobras tú', 4.4)
      await esperar(4600)
      await mirar('text=Capital de la ruta', { escala: 1.8, ms: 4400 })
      await esperar(1200)
      await decir('Y ponerle un capital de arranque, que es opcional', 4.6)
      await esperar(4800)
      await tocar('Crear ruta')
      await esperar(3400)
      await reposo(3800)
    },
  },
  {
    id: 'agregar',
    titulo: 'Meterle clientes a la ruta',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocar, tocarSel, reposo } = u
      await hastaRutas(u)
      await tocarSel('[aria-label="Nueva ruta"]:visible'); await esperar(2200)
      await u.escribir('input[placeholder*="Nombre de la ruta"]', RUTA_NUEVA)
      await esperar(900)
      // Al crear, el sistema te mete DENTRO de la ruta nueva; no hay que volver
      // a la lista a buscarla.
      await tocar('Crear ruta'); await esperar(4200)
      empezar()
      await decir('La ruta nace vacía. Ahora hay que meterle los clientes', 5.0)
      await esperar(5200)
      await mirar('button:has-text("Agregar"):visible', { escala: 1.8, ms: 4400 })
      await esperar(1000)
      await tocar('Agregar')
      await esperar(2800)
      await decir('Salen los que no están en ninguna ruta. Los buscas o los marcas', 5.4)
      await esperar(5600)
      await reposo(3400)
    },
  },
  {
    id: 'asignar',
    titulo: 'Marcarlos y asignarlos',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocar, tocarSel, reposo, p } = u
      await hastaRutas(u)
      await tocarSel('[aria-label="Nueva ruta"]:visible'); await esperar(2200)
      await u.escribir('input[placeholder*="Nombre de la ruta"]', RUTA_NUEVA)
      await esperar(900)
      await tocar('Crear ruta'); await esperar(4200)
      await tocar('Agregar'); await esperar(2600)
      empezar()
      await decir('Marcas los que van en esta ruta', 3.8)
      await esperar(1400)
      for (const n of ['Gladys Restrepo', 'Hernán Zapata', 'Diana Marcela Ruiz',
        'Álvaro Betancur', 'Nubia Castaño']) {
        await p.locator(`text=${n}`).first().click({ timeout: 6000 }).catch(() => {})
        await esperar(650)
      }
      await esperar(2200)
      await mirar('button:has-text("Agregar ("):visible', { escala: 1.9, ms: 4200 })
      await esperar(1000)
      await decir('Y el botón te va contando cuántos llevas', 4.2)
      await esperar(4400)
      await tocar('Agregar (')
      await esperar(3600)
      await decir('Ya están dentro, con su préstamo y su cuota', 4.4)
      await esperar(4600)
      await reposo(3800)
    },
  },
  {
    id: 'sugerencias',
    titulo: 'El atajo: las sugerencias',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocar, tocarSel, reposo } = u
      await hastaRutas(u)
      empezar()
      await decir('Y hay un atajo que hace todo esto de un toque', 4.4)
      await esperar(4600)
      await mirar('button:has-text("Ver sugerencias"):visible', { escala: 1.9, ms: 4200 })
      await esperar(1000)
      await tocar('Ver sugerencias')
      await esperar(3000)
      await decir('El sistema mira las direcciones y te agrupa los del mismo barrio', 5.4)
      await esperar(5600)
      await mirar('text=5 clientes', { escala: 1.7, ms: 4600 })
      await esperar(2600)
      await decir('Le cambias el nombre si quieres, eliges cobrador, y ya está', 5.2)
      await esperar(5400)
      await reposo(3600)
    },
  },
  {
    id: 'botones',
    titulo: 'Los botones de la ruta',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaLaRuta(u)
      empezar()
      await decir('Dentro de una ruta hay bastante. Vamos por partes', 4.6)
      await esperar(4800)
      await mirar('text=LO QUE TIENES PUESTO AQUÍ', { escala: 1.6, ms: 4600 })
      await esperar(2400)
      await decir('Arriba, la plata: cuánto tienes puesto y cuánto llevas hoy', 5.2)
      await esperar(5400)
      await mirar('button:has-text("Imprimir hoja"):visible', { escala: 1.6, ms: 4600 })
      await esperar(2400)
      await decir('«Imprimir hoja» te saca el recorrido en papel para la calle', 5.2)
      await esperar(5400)
      await reposo(3400)
    },
  },
  {
    id: 'mapa',
    titulo: 'Optimizar y el mapa',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaLaRuta(u)
      empezar()
      await decir('«Optimizar» te reordena las paradas por cercanía', 4.8)
      await esperar(5000)
      await mirar('button:has-text("Optimizar"):visible', { escala: 1.9, ms: 4400 })
      await esperar(2400)
      await decir('Y «Google Maps» abre el recorrido entero en el navegador', 5.2)
      await esperar(1600)
      await mirar('button:has-text("Google Maps"):visible', { escala: 1.9, ms: 4400 })
      await esperar(2400)
      await decir('Para eso hace falta que los clientes tengan su punto puesto', 5.2)
      await esperar(5400)
      await reposo(3400)
    },
  },
  {
    id: 'ordenar',
    titulo: 'Ordenar el recorrido',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocarSel, reposo } = u
      await hastaLaRuta(u)
      empezar()
      await decir('Abajo están los clientes, y tienen tres formas de verse', 4.8)
      await esperar(5000)
      await mirar('button:text-is("Cobros"):visible', { escala: 1.8, ms: 4400 })
      await esperar(1600)
      await decir('«Cobros» es la del día a día: a quién le toca hoy', 4.8)
      await esperar(5000)
      await tocarSel('button:text-is("Ordenar"):visible')
      await esperar(2600)
      await decir('«Ordenar» es para armar el recorrido: se arrastra y se suelta', 5.4)
      await esperar(5600)
      await decir('El orden que dejes aquí es el que ve el cobrador en la calle', 5.2)
      await esperar(5400)
      await reposo(3600)
    },
  },
  {
    id: 'auditoria',
    titulo: 'Auditoría, y la ruta comprimida',
    /* ⚠ «Hoy» SE ENSEÑA, NO SE PULSA. Es un conmutador cuya etiqueta no cambia,
       y en el negocio de la demostración les toca a los ocho a propósito
       (`poblar-demo` lo explica): al pulsarlo la lista queda igual. Un botón que
       se pulsa y no pasa nada en pantalla es peor que no enseñarlo. Se subraya y
       se cuenta de palabra. */
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocarSel, reposo } = u
      await hastaLaRuta(u)
      empezar()
      await decir('«Auditoría» es la del dueño: quién pagó y quién no', 4.8)
      await esperar(1600)
      await tocarSel('button:text-is("Auditoría"):visible')
      await esperar(3200)
      await decir('Una lista apretada, para revisar sin entrar en cada uno', 5.0)
      await esperar(1600)
      await mirar('button:has-text("Pendientes"):visible', { escala: 1.8, ms: 4400 })
      await esperar(2400)
      await decir('Y los filtra: los que pagaron, los que faltan, los que abonaron a medias', 5.8)
      await esperar(6000)
      await tocarSel('button:text-is("Cobros"):visible')
      await esperar(2600)
      await decir('Al lado tienes la ruta comprimida y la ruta completa', 4.8)
      await esperar(1600)
      await mirar('button:has-text("Hoy"):visible', { escala: 2.0, ms: 4400 })
      await esperar(2400)
      await decir('«Hoy» deja solo las paradas del día; quitándolo, la ruta entera', 5.4)
      await esperar(5600)
      await reposo(3600)
    },
  },
  {
    id: 'recorrido',
    titulo: 'Empezar el recorrido',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocar, tocarSel, reposo } = u
      await hastaLaRuta(u)
      empezar()
      await decir('Y esto es lo que usa el cobrador en la calle', 4.4)
      await esperar(4600)
      await mirar('button:has-text("Empezar recorrido"):visible', { escala: 1.8, ms: 4400 })
      await esperar(1200)
      await tocar('Empezar recorrido')
      await esperar(3600)
      await decir('Una parada a la vez, con lo que tiene que cobrar delante', 5.2)
      await esperar(5400)
      await decir('Sin listas ni buscar: termina una y pasa a la siguiente', 5.0)
      await esperar(5200)
      await reposo(4000)
    },
  },
  {
    id: 'ordenar_rutas',
    titulo: 'Ordenar las rutas entre sí',
    dosRutas: true,
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocarSel, reposo } = u
      await hastaRutas(u)
      empezar()
      await decir('Cuando ya tienes varias, también las puedes ordenar', 4.8)
      await esperar(5000)
      await mirar('button:text-is("Ordenar"):visible', { escala: 1.9, ms: 4400 })
      await esperar(1200)
      await tocarSel('button:text-is("Ordenar"):visible')
      await esperar(2800)
      await decir('Las subes y las bajas hasta dejarlas como las trabajas', 5.0)
      await esperar(2000)
      /* Se PULSAN. Enseñar las flechas sin moverlas dejaba un botón en pantalla
         y nada pasando, que es la misma queja de siempre. Baja una y sube la
         otra, para que se vea el intercambio y quede como estaba. */
      /* ⚠ `:not([disabled])`. La flecha de subir de la PRIMERA ruta viene
         deshabilitada —no hay nada encima— y `.first()` la cogía: un botón
         deshabilitado nunca se pone «enabled», así que la espera agotaba los
         diez segundos y la toma abortaba. */
      await tocarSel('[aria-label="Bajar"]:not([disabled]):visible')
      await esperar(2400)
      await tocarSel('[aria-label="Subir"]:not([disabled]):visible', { espera: 2600 })
      await esperar(2200)
      await decir('También hay copia de seguridad de tus rutas, aquí arriba', 5.0)
      await esperar(1600)
      await mirar('button:has-text("Guardar copia"):visible', { escala: 1.8, ms: 4400 })
      await esperar(2400)
      await tocarSel('button:text-is("Trabajo"):visible')
      await esperar(2600)
      await decir('Y vuelves a «Trabajo», que es la vista de todos los días', 4.8)
      await esperar(5000)
      await reposo(3600)
    },
  },
  {
    id: 'cierre',
    titulo: 'Dónde te deja',
    dosRutas: true,
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocar, tocarSel, reposo } = u
      await hastaRutas(u)
      empezar()
      await decir('Y ya está: dos rutas, cada una con su gente y su cobrador', 5.2)
      await esperar(5400)
      await mirar('text=RECAUDADO HOY', { escala: 1.6, ms: 4600 })
      await esperar(2400)
      await decir('Arriba, lo de todas juntas: lo que llevas y lo que falta', 5.0)
      await esperar(5200)
      await mirar('button:has-text("Salir a cobrar"):visible', { escala: 1.8, ms: 4400 })
      await esperar(1400)
      await tocar('Salir a cobrar')
      await esperar(3600)
      await decir('Y «Salir a cobrar» te lleva derecho al día', 4.4)
      await esperar(4600)
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
  nombre: 'rutas',
  dir: '/tmp/videos/07-rutas',
  final: '/tmp/videos/07-rutas.mp4',
  tomas: TOMAS,
  cookie,
  antesDeToma: (toma) => limpiar(Boolean(toma.dosRutas)),
})
