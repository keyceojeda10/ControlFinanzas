// lib/modo-rapido.js — cómo decide la APP si el service worker usa el modo rápido.
//
// El modo rápido sirve el ARMAZÓN de cada pantalla desde el teléfono y lo
// refresca por detrás (ver `modoRapidoActivo` en public/sw.js). Desde el 23 nov
// 2026 nace encendido para todos y lo apaga el superadmin desde su panel
// (`AjusteGlobal`, GET /api/ajustes/modo-rapido). Aquí se decide, en el teléfono,
// qué se le dice al service worker. Va aparte de `OfflineProvider` para poder
// probarlo de verdad: el componente no tiene DOM en las pruebas.

/** Dónde guarda el teléfono su propia salida de soporte (`?rapido=1` / `?rapido=0`). */
export const CLAVE_LOCAL_MODO_RAPIDO = 'cf-modo-rapido'

/** Cada cuánto, como mucho, se vuelve a preguntar al servidor al volver a la pestaña. */
export const CADA_CUANTO_SE_PREGUNTA_MS = 30 * 60 * 1000

/**
 * ¿Modo rápido sí o no? → `true`, `false` o `null` («no decido nada»).
 *
 *   `propio` '0'  → apagado  (lo que el teléfono dice manda sobre el panel: es la
 *   `propio` '1'  → encendido  salida de soporte cuando a una sola persona le va raro)
 *   si no hay propio → lo que diga el servidor, pero SOLO con sesión: sin ella el
 *   servidor contesta «apagado» por defecto, y eso apagaría el modo de quien acaba
 *   de salir y volverá a entrar.
 *   si la petición falla o contesta algo raro → `null`: el service worker se queda
 *   como estaba. Apagarlo porque el teléfono se quedó sin señal sería castigar al
 *   cobrador que más lo necesita.
 *
 * @param {{ propio: string|null, autenticado: boolean, consultar: () => Promise<{activo?: unknown}|null> }} p
 * @returns {Promise<boolean|null>}
 */
export async function decidirModoRapido({ propio, autenticado, consultar }) {
  if (propio === '0') return false
  if (propio === '1') return true
  if (!autenticado) return null
  try {
    const respuesta = await consultar()
    return typeof respuesta?.activo === 'boolean' ? respuesta.activo : null
  } catch {
    return null
  }
}
