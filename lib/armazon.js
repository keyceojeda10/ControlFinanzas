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
const NAVEGACION = [
  '/dashboard',
  '/cobros-hoy',
  '/clientes',
  '/prestamos',
  '/rutas',
  '/caja',
  '/mas',
]

// Fichas: se llega desde una lista, así que la salida es VOLVER, no saltar.
// Abajo va la acción de la ficha, no una barra de destinos.
const DETALLE = [
  /^\/clientes\/[^/]+$/,
  /^\/clientes\/[^/]+\/(editar|historial)$/,
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
  /^\/cobradores\/nuevo/,
  /^\/socios\/nuevo/,
  /^\/lineas-credito\/nueva/,
  /^\/soporte\/nuevo/,
  /^\/migrador/,
  /^\/carga-masiva/,
  /^\/prestamos\/simulador/,
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
    return { cabecera: CABECERA.NAVEGACION, pastilla: true, motivo: 'está explorando: necesita saber dónde está y poder saltar' }
  }
  if (DETALLE.some((re) => re.test(p))) {
    return { cabecera: CABECERA.DETALLE, pastilla: false, motivo: 'llegó desde una lista: su salida es volver, no saltar' }
  }

  // El resto son pantallas de segundo nivel a las que se llega desde "Más":
  // capital, gastos, reportes, analíticas, configuración, actividad, socios…
  // Se llega buscando algo concreto, así que llevan cabecera de detalle para
  // poder volver, pero no pastilla: no son destinos de navegación.
  return { cabecera: CABECERA.DETALLE, pastilla: false, motivo: 'segundo nivel: se llega a consultar algo concreto' }
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
