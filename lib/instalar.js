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
  return { so: ios ? 'ios' : android ? 'android' : 'escritorio', navegador, dentroDe }
}

/**
 * El camino:
 *   'un-toque'          — el navegador ya avisó: su ventana, de un toque.
 *   'abrir-en-chrome'   — Android dentro de otra app: saltar a Chrome.
 *   'ios-dentro'        — iPhone dentro de otra app: abrir en Safari.
 *   'ios-safari'        — iPhone en Safari: la flecha al botón Compartir (abajo).
 *   'ios-chrome'        — iPhone en Chrome: Compartir está arriba a la derecha.
 *   'pasos'             — lo demás (Firefox, escritorio, Chrome que aún no avisó).
 */
export function caminoInstalar(det, { hayToque = false } = {}) {
  if (det.dentroDe) return det.so === 'ios' ? 'ios-dentro' : det.so === 'android' ? 'abrir-en-chrome' : 'pasos'
  if (hayToque) return 'un-toque'
  if (det.so === 'ios') return det.navegador === 'chrome' ? 'ios-chrome' : det.navegador === 'safari' ? 'ios-safari' : 'pasos'
  return 'pasos'
}

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
