// lib/pedir-compartido.js — la misma pregunta, una sola vez.
//
// ── QUÉ ARREGLA ────────────────────────────────────────────────────────────
// Al entrar a la app salían 18 peticiones para 8 datos distintos. Medido en el
// espejo, en modo producción:
//
//     4×  /api/pagos/estado          2×  /api/plan/uso
//     2×  /api/notificaciones        2×  /api/auth/estado-verificacion
//     2×  /api/configuracion/perfil  2×  /api/ping   2×  /api/sesiones
//
// Dos causas, las dos legítimas por separado:
//
//  1. **El mismo componente montado dos veces.** `NotificationsCenter` vive en
//     la cabecera Y en la barra lateral: una la esconde el CSS según el ancho,
//     pero las dos se montan y las dos preguntan.
//  2. **El efecto se repite cuando llega la sesión.** `useEffect(..., [email,
//     rol])` corre una vez con los valores vacíos y otra cuando el hook resuelve.
//
// Arreglar cada sitio por separado sería tocar seis componentes y dejar la
// puerta abierta al séptimo. Esto lo cierra en un punto: si esa misma URL ya se
// está pidiendo —o se pidió hace un momento— se comparte la respuesta.
//
// ── DÓNDE **NO** SE USA ────────────────────────────────────────────────────
// ⚠ En nada que lleve plata. Un saldo, un recaudado o una cuota se piden siempre
// de nuevo: compartir una respuesta de hace tres segundos en una pantalla de
// dinero es exactamente la clase de mentira que este proyecto ya se comió una
// vez. Esto es para estados de fondo —el plan, el correo verificado, los avisos,
// el perfil—, que no cambian mientras el usuario cruza una pantalla.

/** url -> { promesa, expira } */
const enVuelo = new Map()

const VENTANA_MS = 5000

// ⚠ El estado de la suscripción y el uso del plan piden 60 s en vez de 5.
// Sus efectos dependen de `pathname`, así que preguntaban en CADA pantalla:
// cruzar cuatro secciones eran ocho peticiones para dos datos que cambian
// como mucho una vez al día. Con un minuto, cruzar la app entera no cuesta
// ninguna. Lo que se puede quedar viejo hasta un minuto es el aviso de «te
// quedan N días» o «vas por 45 de 50 clientes» — avisos, no puertas: quien de
// verdad no deja pasar del límite es el servidor, en cada creación.

/**
 * Pide una URL y devuelve el JSON ya parseado, compartiendo la petición con
 * quien la esté pidiendo a la vez.
 *
 * ⚠ Devuelve el JSON, NO la `Response`. Dos componentes no pueden leer el cuerpo
 * de la misma respuesta —el segundo se encuentra el cuerpo ya consumido—, así
 * que lo que se comparte es el dato, no el sobre.
 *
 * Si la petición falla o el servidor responde mal, devuelve `null` y NO se
 * guarda: el siguiente que pregunte vuelve a intentarlo de verdad.
 */
export function pedirCompartido(url, { ventanaMs = VENTANA_MS, ...opciones } = {}) {
  const ahora = Date.now()
  const guardado = enVuelo.get(url)
  if (guardado && guardado.expira > ahora) return guardado.promesa

  const promesa = fetch(url, opciones)
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (d === null) enVuelo.delete(url)
      return d
    })
    .catch(() => {
      enVuelo.delete(url)
      return null
    })

  enVuelo.set(url, { promesa, expira: ahora + ventanaMs })
  return promesa
}

/**
 * Olvida lo guardado para que la próxima pregunta salga de verdad.
 *
 * Se llama después de cambiar algo que el dato refleja —guardar el teléfono,
 * marcar un aviso como leído— porque si no, durante unos segundos se seguiría
 * viendo lo de antes. Sin argumentos, olvida todo.
 */
export function olvidarCompartido(url) {
  if (url) enVuelo.delete(url)
  else enVuelo.clear()
}
