// lib/franja.js — La franja negra de arriba y la barra del sistema (18 nov 2026).
//
// El dueño, con una captura del iPhone: «la barra de notificaciones sale blanca
// y el bloque de nuestra aplicación empieza en negro; ese contraste se ve feo».
// El teléfono pinta esa barra con el color que la página declara en
// `<meta name="theme-color">`, y la app declaraba siempre el fondo gris claro.
//
// Aquí vive la lista de pantallas que llevan la franja negra (la usa el armazón
// para no pintar la cabecera vieja) y la función que le dice al teléfono el
// color. Sin 'use client': también la lee `app/layout.js` para el script que
// corre antes del primer pintado.

/** El negro de la franja. El mismo `NEGRO` de `components/armazon/CabeceraInicio.jsx`. */
export const NEGRO_FRANJA = '#15161A'

/** Las pantallas que pintan su propia cabecera negra en el móvil. */
export const CON_CABECERA_PROPIA = ['/dashboard', '/clientes', '/prestamos', '/cobros-hoy', '/rutas', '/caja', '/mas']

/** Las de detalle que también la llevan: la ruta por dentro (18 nov 2026).
 *  Como texto, porque el script de `app/layout.js` lo vuelve a armar en crudo. */
export const DETALLES_CON_CABECERA_PROPIA = '^/rutas/[^/]+$'

/** ¿Esta pantalla pinta su propia cabecera negra? La lista exacta o un detalle. */
export function tieneCabeceraPropia(pathname) {
  const p = (pathname || '').replace(/\/$/, '')
  return CON_CABECERA_PROPIA.includes(p) || new RegExp(DETALLES_CON_CABECERA_PROPIA).test(p)
}

/** La franja solo existe en el móvil: en el PC está la barra lateral. */
export const MEDIA_MOVIL = '(max-width: 1023.98px)'

/**
 * Le dice al teléfono de qué color pintar su barra de arriba. TODAS las etiquetas
 * `theme-color`: el layout declara dos (claro y oscuro, por `media`) y cambiar
 * solo la primera dejaba la otra con el color viejo.
 */
export function pintarBarraDelSistema(color) {
  if (typeof document === 'undefined' || !color) return
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', color))
}
