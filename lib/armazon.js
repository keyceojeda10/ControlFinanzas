// lib/armazon.js — La regla de supresión del armazón.
//
// Transcrita de docs/design_handoff/02-ARMAZON.md sección E, que es normativa.
//
// LA DECISIÓN QUE DEFINE EL REDISEÑO:
//
//   El armazón se gana su sitio. Aparece cuando el usuario está NAVEGANDO y se
//   retira cuando está haciendo UNA SOLA COSA.
//
// Cabecera (56px) + pastilla (62px + 18px de separación) ocupan 137px de los 844
// de un teléfono — un sexto de la pantalla. En una app de cobro ese sexto es una
// tarjeta de cliente más.
//
// LA PREGUNTA QUE DECIDE los casos que no estén en la tabla:
//
//   ¿El usuario llegó aquí buscando, o llegó a hacer una cosa?
//     · Buscando        -> armazón completo
//     · A hacer una cosa -> solo la salida
//     · "Las dos"       -> la pantalla está haciendo demasiado; hay que partirla.
//
// Esto vive en un módulo aparte, y no como condicionales repartidos por los
// layouts, para que la regla se pueda LEER y PROBAR de un solo sitio. Una regla
// de este peso escrita a pedazos se desincroniza sola.

/** Los tres modos de cabecera + la ausencia total. */
export const CABECERA = {
  NAVEGACION: 'navegacion',  // marca mínima: glifo, buscar, campana, avatar
  DETALLE:    'detalle',     // atrás + título del objeto + acciones DE ESE objeto
  TAREA:      'tarea',       // cerrar + espina de progreso
  NINGUNA:    'ninguna',     // ni siquiera barra de estado (firma del pagaré)
}

// LAS SEIS PANTALLAS DE NAVEGACIÓN (regla §E de 02-ARMAZON.md, lámina T39-05).
// El usuario llegó explorando: necesita saber dónde está y poder saltar.
//
// «/mas» va aquí aunque no sea una de las seis, y por una razón concreta: ES un
// destino de la pastilla. Sin él se resolvería como detalle —flecha de volver,
// sin título— y la barra desaparecería justo al tocarla. Una pantalla a la que
// se llega DESDE la barra no puede quedarse sin barra.
//
// Ojo con la distinción: las SEIS con armazón completo (panel, cobrar hoy,
// clientes, préstamos, rutas, caja) NO son los CINCO destinos de la pastilla
// (panel, clientes, caja, rutas, más). No es la misma lista, y confundirlas fue
// lo que me hizo tener siete items en la barra lateral.
//
// Y OJO CON «/cobros-hoy», que es la excepción: lleva cabecera de navegación
// pero NO pastilla. Ver `SIN_PASTILLA` justo debajo.
const NAVEGACION = [
  '/dashboard',
  '/cobros-hoy',
  '/clientes',
  '/prestamos',
  '/rutas',
  '/caja',
  '/mas',
]

/**
 * Pantallas de navegación que NO llevan pastilla porque su ACCIÓN ocupa ese
 * hueco. Regla §4 de «lo que nunca cambia»: «cuando la pastilla no está, su
 * sitio lo ocupa la acción de la pantalla […] en un botón de píldora flotante en
 * la misma posición cuando la pantalla es una lista sobre la que se actúa».
 *
 * `/cobros-hoy` es exactamente eso: una lista sobre la que se actúa. Su lámina
 * (T02-02) dibuja «Empezar ruta · 11» y el botón de mapa en el sitio de la
 * pastilla, y NO dibuja la pastilla — comprobado en el archivo: no tiene el FAB.
 *
 * LA TABLA DE §E DICE LO CONTRARIO, y hay que saberlo: lista «cobrar hoy» entre
 * las que llevan pastilla. Las dos cosas no caben —mismo hueco, 62px a 18px del
 * borde— así que manda la lámina de la pantalla, que es más específica. Decidido
 * con el usuario: en esta pantalla el cobrador está trabajando, no explorando, y
 * «Empezar ruta» es lo que vino a hacer. La navegación queda a un toque desde la
 * cabecera.
 */
const SIN_PASTILLA = ['/cobros-hoy']

// Fichas: se llega desde una lista, así que la salida es VOLVER, no saltar.
// Abajo va la acción de la ficha, no una barra de destinos.
const DETALLE = [
  /^\/clientes\/[^/]+$/,
  /^\/clientes\/[^/]+\/historial$/,
  /^\/prestamos\/[^/]+$/,
  /^\/rutas\/[^/]+$/,
  /^\/cobradores\/[^/]+$/,
  /^\/socios\/[^/]+$/,
  /^\/lineas-credito\/[^/]+$/,
  /^\/soporte\/[^/]+$/,
]

// Tareas: salirse a medias pierde datos. Una barra de destinos es una trampa.
const TAREA = [
  /^\/prestamos\/nuevo/,
  /^\/clientes\/nuevo/,
  // EDITAR ES UNA TAREA, NO UNA FICHA. Estaba en `DETALLE`, así que era el
  // ÚNICO formulario de la app que conservaba la pastilla — y la pastilla le
  // tapaba el botón de guardar: se editaba el cliente y no había forma de
  // guardarlo. Lo reportó un usuario.
  //
  // Lo arreglé mal la primera vez: subí la barra POR ENCIMA de la pastilla, y
  // como lo hice en los dos formularios, «Crear cliente» y «Revisar préstamo»
  // —que nunca tuvieron pastilla— quedaron flotando a media pantalla con un
  // hueco debajo. El dueño: «se ve terrible». La barra vuelve a `bottom-0` y
  // lo que se va es la pastilla, que es lo que sobra en un formulario.
  /^\/clientes\/[^/]+\/editar$/,
  /^\/cobradores\/nuevo/,
  /^\/socios\/nuevo/,
  /^\/lineas-credito\/nueva/,
  /^\/soporte\/nuevo/,
  /^\/migrador/,
  /^\/carga-masiva/,
  // EL SIMULADOR NO ES UNA TAREA: NO GUARDA NADA.
  //
  // Estaba aquí, así que su cabecera llevaba ✕ de cerrar en vez de flecha de
  // volver, como si salirse a medias costara algo. Reportado por el dueño:
  // «simulador (con otro tipo de cabecera con botón de cierre no con botón de
  // volver atrás), está igual que los wizards, no sé si es inconsistencia».
  // Lo era.
  //
  // El criterio de esta lista es «salirse a medias pierde datos», y el propio
  // simulador lo dice en su código: «No escribe en la base». Se teclea un monto,
  // se mira la cuota y se sale — y su botón «crear este préstamo» solo pasa los
  // números por la URL a la pantalla de crear, que ESA sí es una tarea.
  //
  // El migrador y la carga masiva se quedan: ahí sí hay una foto procesada o un
  // Excel cargado que se pierde al salir.
  // EL CHAT TAMBIÉN ES UNA TAREA. Lucas tiene su barra de escribir fija abajo,
  // y la pastilla se la tapaba: en el teléfono no se veía el campo, igual que
  // pasó con el botón de guardar en «editar cliente». Un chat con el teclado
  // abierto no es un sitio desde el que se navega a otra parte.
  /^\/asistente/,
]

// Sin armazón de ningún tipo: el teléfono cambia de manos o todavía no hay
// a dónde navegar.
const SIN_ARMAZON = [
  /^\/firma/,          // horizontal, y quien firma no debe poder navegar
  /^\/portal/,         // no es la app: es una consulta del cliente final
  /^\/registro/,
  /^\/login/,
  /^\/verificar-email/,
  /^\/forgot-password/,
]

const limpiar = (p) => (p || '/').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/'

/**
 * Qué armazón le toca a una ruta.
 *
 * @returns {{cabecera: string, pastilla: boolean, motivo: string}}
 *   `motivo` existe para que el porqué viaje con la decisión: si mañana alguien
 *   se pregunta por qué una pantalla no tiene barra, la respuesta está acá y no
 *   en el historial de git.
 */
export function resolverArmazon(pathname) {
  const p = limpiar(pathname)

  if (SIN_ARMAZON.some((re) => re.test(p))) {
    return { cabecera: CABECERA.NINGUNA, pastilla: false, motivo: 'todavía no hay a dónde navegar, o el teléfono cambia de manos' }
  }
  if (TAREA.some((re) => re.test(p))) {
    return { cabecera: CABECERA.TAREA, pastilla: false, motivo: 'salirse a medias pierde datos' }
  }
  if (NAVEGACION.includes(p)) {
    if (SIN_PASTILLA.includes(p)) {
      return { cabecera: CABECERA.NAVEGACION, pastilla: false, motivo: 'su acción ocupa el sitio de la pastilla: es una lista sobre la que se actúa' }
    }
    return { cabecera: CABECERA.NAVEGACION, pastilla: true, motivo: 'está explorando: necesita saber dónde está y poder saltar' }
  }
  if (DETALLE.some((re) => re.test(p))) {
    // ── LA FICHA TAMBIEN LLEVA PASTILLA ──
    //
    // Aqui decia `pastilla: false`, con este motivo: «llego desde una lista: su
    // salida es volver, no saltar». La idea era que en una ficha se viene a una
    // cosa concreta y se sale por donde se entro.
    //
    // En la practica no se cumple. Se abre la ficha de un cliente para mirar
    // como va, y de ahi se salta a la caja o a cobrar hoy — no se vuelve a la
    // lista para volver a bajar. Sin pastilla, cada salto son dos toques y una
    // pantalla intermedia que no se queria ver.
    //
    // Decidido con el usuario el 30 jul. Se pierde: 80px de alto, y que la
    // flecha de volver deje de ser la unica salida. Se gana: no tener que
    // desandar el camino para ir a otra parte.
    return { cabecera: CABECERA.DETALLE, pastilla: true, motivo: 'desde una ficha también se salta a otra parte, no solo se vuelve' }
  }

  // El resto son pantallas de segundo nivel a las que se llega desde «Más»:
  // capital, gastos, reportes, analíticas, configuración, actividad, socios…
  //
  // ⚠ ANTES ESTAS SE QUEDABAN SIN PASTILLA, y el motivo escrito era: «la
  // pastilla llevaría a los cinco destinos de siempre, que es de donde se acaba
  // de venir».
  //
  // ESE RAZONAMIENTO ERA FALSO, y lo reportó el dueño usando la app: «entramos
  // a un callejón sin salida porque no hay ningún botón que nos devuelva al menú
  // principal o al Home».
  //
  // No se viene del panel: se viene de «Más». Así que la flecha te devuelve a
  // «Más», y para llegar al Home hacen falta DOS toques — y saber que hay que
  // pasar por ahí. Sin pastilla, la única salida es una flecha de 40px en la
  // esquina, y quien no la ve se siente encerrado. Que es exactamente lo que
  // pasó.
  //
  // Añadir la pastilla no quita nada: son los mismos cinco destinos, y ninguna
  // pantalla pierde su flecha. Es la dirección segura del cambio.
  return { cabecera: CABECERA.DETALLE, pastilla: true, motivo: 'segundo nivel: se consulta algo concreto, pero se tiene que poder salir a cualquier sitio' }
}

/**
 * Los cinco destinos de la pastilla, en orden.
 *
 * DECISIÓN DEL PROYECTO (28 jul 2026): el handoff dice que Rutas desaparece en
 * cuentas sin cobradores. Se adopta la pastilla y el orden nuevos, pero NO el
 * ocultamiento: sacar un destino de la barra ya rompió una vez al cliente con
 * más cobradores, el mismo día. Un destino que aparece y desaparece rompe la
 * memoria muscular, que es lo único que tiene alguien que cobra de pie.
 */
export const DESTINOS = [
  { href: '/dashboard',  nombre: 'Panel' },
  { href: '/clientes',   nombre: 'Clientes' },
  { href: '/prestamos',  nombre: 'Préstamos' },
  { href: '/rutas',      nombre: 'Rutas' },
  { href: '/mas',        nombre: 'Más' },
]

/** Qué destino de la pastilla está activo. El más específico gana. */
export function destinoActivo(pathname) {
  const p = limpiar(pathname)
  let mejor = null
  for (const d of DESTINOS) {
    if (p === d.href || p.startsWith(d.href + '/')) {
      if (!mejor || d.href.length > mejor.href.length) mejor = d
    }
  }
  return mejor?.href ?? null
}

/**
 * Las dos letras del avatar, a partir del nombre completo.
 *
 * Vive acá y no dentro de un componente porque la usan los DOS armazones —la
 * cabecera móvil y la barra lateral— y hasta ahora solo la tenía Armazon.jsx:
 * la barra lateral se montaba sin iniciales y pintaba el avatar vacío.
 *
 * Devuelve «·» y no una cadena vacía cuando no hay nombre: un círculo azul con
 * nada dentro parece un fallo de carga; con un punto parece lo que es.
 */
export function iniciales(nombre = '') {
  const partes = String(nombre).trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '·'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
}

/**
 * El rol, escrito como lo escribe la lámina.
 *
 * En la base son `owner` / `cobrador` / `superadmin`, y la barra lateral lo
 * pintaba en crudo: en la captura de escritorio decía «owner» debajo del nombre,
 * en una app que está entera en español. T39-05 dice «dueño».
 */
const ROLES = {
  owner: 'dueño',
  cobrador: 'cobrador',
  superadmin: 'administrador',
}
export function rolEnEspanol(rol = '') {
  return ROLES[String(rol).toLowerCase()] ?? String(rol)
}

/* ══ A DÓNDE VUELVE LA FLECHA ══════════════════════════════════════════════

   `router.back()` A SECAS DEJA UNA PANTALLA EN BLANCO, y es el caso normal, no
   el raro. Medido en la app:

       entrada directa a /configuracion  →  history.length = 2
       pulsar la flecha                  →  about:blank

   Con dos entradas —about:blank y la página— retroceder SALE DE LA APP. Y así se
   entra la mitad de las veces: escribiendo la URL, recargando con Ctrl+Shift+R, o
   abriendo la PWA desde el icono. El usuario lo reportó como «el ícono de volver
   sale dañado, no vuelve»: hacía algo, pero lo que hacía era irse.

   Así que la flecha necesita un DESTINO, no solo un gesto. Vive acá, al lado de
   `resolverArmazon`, porque es la misma taxonomía de rutas: lo que decide qué
   cabecera lleva una pantalla decide también de dónde vino. */

/* Las fichas vuelven a SU lista, no a la anterior del historial. Desde la ficha
   de un cliente al que llegaste buscando, «atrás» al buscador es correcto; sin
   historial, a la lista de clientes es lo único sensato. */
const PADRES = [
  [/^\/clientes\/[^/]+/, '/clientes'],
  [/^\/prestamos\/(nuevo|simulador)/, '/prestamos'],
  [/^\/prestamos\/[^/]+/, '/prestamos'],
  [/^\/rutas\/[^/]+/, '/rutas'],
  [/^\/cobradores\/[^/]+/, '/cobradores'],
  [/^\/socios\/[^/]+/, '/socios'],
  [/^\/lineas-credito\/[^/]+/, '/lineas-credito'],
  [/^\/soporte\/[^/]+/, '/soporte'],
  [/^\/caja\/cobrador\/[^/]+/, '/caja'],
  [/^\/configuracion\/[^/]+/, '/configuracion'],
  [/^\/dashboard\/[^/]+/, '/dashboard'],
]

/**
 * El padre lógico de una ruta: a dónde lleva la flecha cuando no hay historial.
 *
 * Las de segundo nivel —gastos, capital, reportes, configuración, actividad…—
 * caen en «Más», que es de donde se llega a ellas. Los destinos de la pastilla
 * vuelven al panel: son la raíz, no tienen padre, pero dejar la flecha sin nada
 * que hacer es justo lo que estamos arreglando.
 */
export function volverA(pathname) {
  const p = limpiar(pathname)
  for (const [re, padre] of PADRES) {
    if (re.test(p)) return padre
  }
  if (NAVEGACION.includes(p)) return '/dashboard'
  return '/mas'
}

/**
 * ¿Se puede retroceder sin salirse de la app?
 *
 * Next numera sus entradas en `history.state.idx`. En 0 estamos en la primera
 * de esta pestaña: retroceder sale al about:blank del que venimos. Se le pasa el
 * `history` para poder probarlo sin navegador.
 */
export function puedeRetroceder(historial) {
  const h = historial ?? (typeof window !== 'undefined' ? window.history : null)
  if (!h) return false
  const idx = h.state?.idx
  // Sin `idx` no sabemos dónde estamos: con `length > 2` hay algo detrás que casi
  // seguro es de la app, y con 2 o menos, no.
  if (typeof idx !== 'number') return (h.length ?? 0) > 2
  return idx > 0
}
