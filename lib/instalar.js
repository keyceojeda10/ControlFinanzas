// lib/instalar.js — qué camino toca para instalar la app en ESTE teléfono.
//
// «¿No hay algo que podamos hacer para que directamente se le descargue, que no
// tenga que seguir un paso a paso? Muchas personas se quedan ahí» (Carlos, 19
// oct 2026). Lo que se puede, y lo que no:
//
//   · ANDROID (Chrome, Samsung Internet, Edge): UN TOQUE. El navegador avisa
//     al abrir la página de que la app se puede instalar (`beforeinstallprompt`)
//     y ese aviso, guardado, abre su propia ventana «¿Instalar?». Lo que fallaba
//     es que solo lo oía la campana: Configuración y /instalar llegaban tarde y
//     caían en el paso a paso. Ahora se oye en el <head> (app/layout.js).
//   · DENTRO DE FACEBOOK O INSTAGRAM (su navegador interno) no se puede
//     instalar nada. En Android se salta a Chrome con un enlace `intent://`.
//   · IPHONE: Apple no deja que ninguna página se instale sola; siempre es
//     Compartir → «Agregar a inicio». Lo que sí se puede es que no tengan que
//     buscar: una flecha que apunta al botón exacto (GuiaInstalar.jsx).
//   · ⚠ SAFARI 26 ESCONDIÓ COMPARTIR (el dueño, 7 nov 2026, con el iPhone en la
//     mano: «no me sale ni para descargar ni nada»). La flecha apuntaba al centro
//     de abajo, que ahora es la barra de dirección: lo toca, Safari abre sus
//     favoritos y ahí se acaba. Compartir está dentro de los ··· de abajo a la
//     derecha, y «Agregar a Inicio» abajo en la lista (o en «Editar acciones»).
//   · ⚠ Y SAFARI 27 LOS QUITÓ: ver `safariMenuDePagina`.
//     ⚠ La versión de iOS en el navegador MIENTE: Safari 26 sigue diciendo «iPhone
//     OS 18_6». La que vale es `Version/26`.
//
// Puro, para probarlo sin navegador.

/** El teléfono, el navegador y si es el navegador interno de otra app. */
export function detectar(ua = '') {
  const s = String(ua)
  const ios = /iPad|iPhone|iPod/.test(s)
  const android = /Android/i.test(s)
  // El navegador interno de otra app: ahí no hay «instalar» posible.
  const dentroDe = /FBAN|FBAV|FB_IAB|FBIOS/.test(s) ? 'facebook'
    : /Instagram/i.test(s) ? 'instagram'
    : /musical_ly|Bytedance|TikTok/i.test(s) ? 'tiktok'
    : /WhatsApp/i.test(s) ? 'whatsapp'
    : (android && /; wv\)/.test(s)) ? 'otra app'
    : null
  const navegador = /CriOS/.test(s) ? 'chrome'
    : /FxiOS|Firefox/i.test(s) ? 'firefox'
    : /EdgiOS|EdgA|Edg\//.test(s) ? 'edge'
    : /SamsungBrowser/i.test(s) ? 'samsung'
    : /Chrome/i.test(s) ? 'chrome'
    : /Safari/i.test(s) ? 'safari'
    : 'otro'
  // Solo en Safari: en los demás de iPhone `Version/` no existe o no significa esto.
  const safariMayor = ios && navegador === 'safari' ? Number(/Version\/(\d+)/.exec(s)?.[1]) || null : null
  return { so: ios ? 'ios' : android ? 'android' : 'escritorio', navegador, dentroDe, safariMayor }
}

/**
 * El camino:
 *   'un-toque'          — el navegador ya avisó: su ventana, de un toque.
 *   'abrir-en-chrome'   — Android dentro de otra app: saltar a Chrome.
 *   'ios-dentro'        — iPhone dentro de otra app: abrir en Safari.
 *   'ios-safari'        — iPhone en Safari hasta el 18: la flecha al botón Compartir (abajo).
 *   'ios-safari-puntos' — Safari 26: la flecha al botón Más (···, abajo a la derecha).
 *   'ios-safari-menu'   — Safari 27 o más: la flecha al Menú de página (tres rayas,
 *                         abajo a la IZQUIERDA). Ver `PASOS_SAFARI_MENU`.
 *   'ios-chrome'        — iPhone en Chrome: Compartir está arriba a la derecha.
 *   'pasos'             — lo demás (Firefox, escritorio, Chrome que aún no avisó).
 */
export function caminoInstalar(det, { hayToque = false } = {}) {
  if (det.dentroDe) return det.so === 'ios' ? 'ios-dentro' : det.so === 'android' ? 'abrir-en-chrome' : 'pasos'
  if (hayToque) return 'un-toque'
  if (det.so === 'ios') {
    if (det.navegador === 'chrome') return 'ios-chrome'
    if (det.navegador !== 'safari') return 'pasos'
    return safariMenuDePagina(det) ? 'ios-safari-menu' : safariEscondeCompartir(det) ? 'ios-safari-puntos' : 'ios-safari'
  }
  return 'pasos'
}

/** ¿Es un Safari que NO enseña Compartir en la barra (26 en adelante)? */
export function safariEscondeCompartir(det) {
  return det?.so === 'ios' && det?.navegador === 'safari' && det?.safariMayor >= 26
}

/* ⚠ SAFARI 27 QUITÓ LOS TRES PUNTOS (16 nov 2026). Videollamada del dueño con un
   cliente que no podía instalar: la guía decía «toca los tres puntos de abajo a la
   derecha» y en iOS 27 ese botón ya es el de las PESTAÑAS. Compartir quedó dentro
   del «Menú de página» (tres rayas), a la IZQUIERDA de la dirección. Medido: 22 de
   75 que abrieron la guía en 10 días iban en Safari 27.
   Los nombres son los de la guía oficial de Apple en español de México (iOS 18, 26
   y 27: «Agregar a Inicio», «Editar acciones», «Abrir como app web»), no de guías
   en inglés: «Ver más» no existe. */
export function safariMenuDePagina(det) {
  return det?.so === 'ios' && det?.navegador === 'safari' && det?.safariMayor >= 27
}

/* Los dos últimos pasos son iguales en todas las versiones (guía de Apple). */
const PASO_AGREGAR_A_INICIO = {
  titulo: 'Toca «Agregar a Inicio»',
  texto: 'Baja en la lista que se abre. Si no aparece, al final de la lista toca «Editar acciones» y luego «Agregar a Inicio».',
}
const PASO_AGREGAR = {
  titulo: 'Toca «Agregar»',
  texto: 'Arriba a la derecha. Si ves «Abrir como app web», déjalo encendido. La app queda en tu pantalla de inicio, con su icono.',
}

/** Safari 27 o más (`ios-safari-menu`). */
export const PASOS_SAFARI_MENU = [
  {
    titulo: 'Toca el botón de tres rayas',
    texto: 'Está abajo a la izquierda, junto a la dirección. No toques el botón de la derecha: ese abre las pestañas. Si tu Safari muestra el botón Compartir (un cuadro con una flecha hacia arriba), toca ese y sáltate el paso 2.',
  },
  { titulo: 'Toca «Compartir»', texto: 'Está en el menú que se abre. Si no lo ves, baja un poco.' },
  PASO_AGREGAR_A_INICIO,
  PASO_AGREGAR,
]

/** Safari 26 (`ios-safari-puntos`). Los usan la guía de la flecha y la lista de
 *  pasos (`InstallGuideModal`). */
export const PASOS_SAFARI_PUNTOS = [
  {
    titulo: 'Toca los tres puntos (···)',
    texto: 'Están abajo a la derecha, junto a la dirección. No toques la dirección. Si tu Safari muestra el botón Compartir (un cuadro con una flecha hacia arriba), toca ese y sáltate el paso 2.',
  },
  { titulo: 'Toca «Compartir»', texto: 'Está en el menú que se abre.' },
  PASO_AGREGAR_A_INICIO,
  PASO_AGREGAR,
]

/** Safari hasta el 18 (`ios-safari`) y Chrome en iPhone (`ios-chrome`). */
export const PASOS_COMPARTIR = (arriba = false) => [
  {
    titulo: 'Toca Compartir',
    texto: arriba
      ? 'Es este botón, arriba a la derecha, junto a la dirección.'
      : 'Es este botón (un cuadro con una flecha hacia arriba), abajo en el centro.',
  },
  PASO_AGREGAR_A_INICIO,
  PASO_AGREGAR,
]

/** El enlace que en Android saca la página del navegador interno y la abre en
 *  Chrome. Si Chrome no está, el propio Android abre la misma dirección. */
export function enlaceAChrome(url) {
  const u = new URL(url)
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(':', '')};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(u.href)};end`
}

/* La captura temprana, para el <head> de app/layout.js. Va en texto porque se
   ejecuta antes que React: el aviso de Chrome llega al cargar y no se repite.
   `preventDefault` es lo que ya hacía la campana: la franja propia de Chrome
   salía encima de la barra de navegación. */
export const SCRIPT_CAPTURA_INSTALAR = `(function(){
  window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); window.__cfInstalar = e; window.dispatchEvent(new Event('cf:instalable')) });
  window.addEventListener('appinstalled', function(){ window.__cfInstalar = null; window.__cfInstalada = true; window.dispatchEvent(new Event('cf:instalada')) });
})()`
