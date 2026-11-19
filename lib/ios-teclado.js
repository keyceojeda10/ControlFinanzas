// lib/ios-teclado.js — la pantalla que el teclado del iPhone deja encogida
// (inducción del 18 nov 2026, errores 2, 3 y 6).
//
// Lo que vio el dueño en el teléfono del cliente, con la app INSTALADA:
//   2 · el asistente no dejaba bajar: «la aplicación, boom, se jalaba hacia
//       arriba» al intentar llegar a «Continuar»;
//   3 · en «Nuevo préstamo» el pie con «Continuar» salía como una franja blanca;
//   6 · tras volver a entrar, la hoja de Inicio en blanco y sin poder deslizar.
// Los tres justo después de escribir algo (la confirmación del reinicio, el
// buscador del cliente, el correo y la contraseña).
//
// Es un fallo de iOS documentado, no nuestro: en una app de la pantalla de
// inicio el primer teclado encoge la ventana y no la devuelve —lo de abajo se
// pinta recortado, lo fijo al pie sube, el deslizamiento rebota— y en iOS 26 la
// parte visible queda además desplazada al cerrarlo (WebKit 297779). No se
// reproduce en un simulador: no hay teclado. Ver
// https://dev.to/cederhook/fixing-the-ios-standalone-pwa-keyboard-bug-that-shrinks-your-viewport-for-good-63d
// y https://developer.apple.com/forums/thread/800154.
//
// Aquí vive SOLO la decisión, para poder probarla. El que actúa es
// `components/armazon/ReparoTecladoIOS.js`.

/** Holgura en px: menos que esto es redondeo, no una pantalla encogida. */
export const HOLGURA_PX = 4

/** Después de tantos intentos seguidos que no sirven, se deja de intentar. */
export const MAX_FALLOS = 3

/**
 * ¿Es la app instalada en un iPhone o iPad? Fuera de ahí no se toca nada.
 * (El iPad nuevo se presenta como Mac con pantalla táctil.)
 */
export function esAppInstaladaEnIOS({ userAgent = '', platform = '', maxTouchPoints = 0, standalone = false, displayStandalone = false } = {}) {
  const ios = /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1)
  return ios && (standalone === true || displayStandalone === true)
}

/**
 * ¿Quedó la pantalla mal después del teclado?
 * @param m.alto        window.innerHeight ahora
 * @param m.altoMaximo  el mayor innerHeight visto con esta orientación
 * @param m.visibleAlto visualViewport.height (o null)
 * @param m.visibleTop  visualViewport.offsetTop (o null)
 * @param m.escribiendo hay un campo enfocado (el teclado sigue arriba)
 * @returns 'nada' | 'reacomodar' | 'remedir'
 *   · 'reacomodar' — solo está desplazada (iOS 26): basta con volver a poner
 *     el desplazamiento donde está.
 *   · 'remedir'    — la ventana quedó más corta: hay que obligar a iOS a medir.
 */
export function queHacerTrasElTeclado({ alto, altoMaximo, visibleAlto = null, visibleTop = null, escribiendo = false } = {}) {
  if (escribiendo) return 'nada'
  const encogida = Number(altoMaximo) > 0 && Number(alto) > 0 && Number(alto) < Number(altoMaximo) - HOLGURA_PX
  if (encogida) return 'remedir'
  const corrida = (Number(visibleTop) || 0) > HOLGURA_PX
    || (visibleAlto != null && Number(alto) > 0 && Number(visibleAlto) < Number(alto) - HOLGURA_PX)
  return corrida ? 'reacomodar' : 'nada'
}
