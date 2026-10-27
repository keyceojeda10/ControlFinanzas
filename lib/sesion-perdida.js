/* ⚠ UNA RENOVACIÓN FALLIDA NO PUEDE DEJAR AL TELÉFONO SIN SESIÓN EL RESTO DEL
   DÍA (27 oct 2026). next-auth v4 solo sondea mientras HAY sesión: si una
   renovación falla (mala señal, un reinicio del servidor), la deja en `null` y
   no la vuelve a pedir hasta recargar. La cookie sigue buena y se cobra, pero
   todo lo que sale de la sesión caía a falso: a los cobradores de PRESTA MIL
   se les fue «Gestión» —y con ella «Financiar el saldo»— de la ficha.

   `SessionProvider` la vuelve a pedir cada 30 s, al volver la señal y al volver
   a la app. El único camino que next-auth 4.24 deja para pedirla sin recargar
   la pantalla es su aviso entre pestañas (`nextauth.message`, `event:
   'session'`): se le da desde esta misma. Solo si este teléfono tenía sesión y
   no está en /login. Lo vigila lib/__tests__/sesion-perdida-vuelve.test.js. */

export const PEDIR_OTRA_VEZ_CADA_MS = 30 * 1000

// La misma clave que STORAGE_KEY en components/providers/SessionProvider.jsx.
const CLAVE_SESION_GUARDADA = 'cf-session-cache'

function habiaSesion() {
  try { return !!JSON.parse(localStorage.getItem(CLAVE_SESION_GUARDADA) || 'null')?.user?.email } catch { return false }
}

export function pedirSesionOtraVez() {
  if (typeof window === 'undefined' || navigator.onLine === false) return
  if (window.location.pathname.startsWith('/login') || !habiaSesion()) return
  window.dispatchEvent(new StorageEvent('storage', {
    key: 'nextauth.message',
    newValue: JSON.stringify({ event: 'session', data: { trigger: 'getSession' }, timestamp: Math.floor(Date.now() / 1000) }),
  }))
}
