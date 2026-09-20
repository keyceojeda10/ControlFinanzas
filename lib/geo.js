// lib/geo.js — utilidades de geolocalizacion compartidas (browser + server)

/* ══ EL GPS NO PUEDE TENER ESPERANDO A UN COBRO ═══════════════════════════════
 *
 * El dueño, 20 sep 2026: «el sistema a veces se cuelga en el pago… no muestra
 * ninguna pantalla y después en unos segundos la muestra de repente… queda uno
 * como que ¿qué está pasando aquí? No se sabe si se hizo».
 *
 * La causa estaba aquí. Antes de MANDAR el pago, las tres pantallas de cobro
 * hacían `await obtenerCoordsRapido()`: una lectura de GPS en ALTA PRECISIÓN con
 * 4 s de plazo (4,5 con el seguro). Dentro de una casa el GPS tarda eso o no
 * llega, así que el cobro salía del teléfono hasta cuatro segundos y medio
 * después del gesto, sin nada en pantalla. El servidor contesta en décimas: el
 * «cuelgue» era el teléfono esperando satélites.
 *
 * Medido en producción (7 días): 3.942 cobros, el 70 % con coordenadas —esos
 * esperaron la lectura— y el 30 % sin ellas, de los que una parte esperó los
 * 4,5 s enteros para nada.
 *
 * Ahora:
 *   1. `calentarCoords()` pide la posición ANTES —al abrir la pantalla o la hoja
 *      de cobro— y la guarda. Mientras la persona elige el método y desliza, el
 *      GPS ya está trabajando.
 *   2. `obtenerCoordsRapido()` contesta AL INSTANTE si hay una lectura de menos
 *      de un minuto; si no, espera a la que está en curso un máximo de 1,2 s.
 *   3. Si aun así el cobro sale sin coordenadas, `completarUbicacionDelPago()`
 *      se las pone después, cuando el GPS conteste. El dato de auditoría no se
 *      pierde; lo que se quita es la espera.
 */
const FRESCA_MS = 60_000
const ESPERA_MAX_MS = 1200

let ultima = null      // { latitud, longitud, cuando }
let enCurso = null     // Promise de la lectura que está en marcha

function leerGps(timeoutMs) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null)
  return new Promise((resolve) => {
    let resuelto = false
    const listo = (v) => {
      if (resuelto) return
      resuelto = true
      if (v) ultima = { ...v, cuando: Date.now() }
      resolve(v)
    }
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => listo({ latitud: pos.coords.latitude, longitud: pos.coords.longitude }),
        () => listo(null),
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
      )
    } catch {
      listo(null)
    }
    // Seguro por si el navegador nunca llama a ninguno de los dos.
    setTimeout(() => listo(null), timeoutMs + 500)
  })
}

const fresca = () => (ultima && Date.now() - ultima.cuando < FRESCA_MS
  ? { latitud: ultima.latitud, longitud: ultima.longitud }
  : null)

/** Pone el GPS a trabajar YA, sin esperar a nadie. Llamarlo al abrir una
 *  pantalla u hoja desde la que se cobra. No pide permiso si ya se negó. */
export function calentarCoords() {
  if (fresca() || enCurso) return
  enCurso = leerGps(10_000).finally(() => { enCurso = null })
}

/**
 * La ubicacion para un pago, SIN tener esperando al pago.
 * Devuelve { latitud, longitud } o null. Nunca tarda mas de `esperaMs`.
 *
 * `esperaMs` largo (8000) lo usa «guardar la ubicacion del cliente», donde la
 * persona SI esta esperando el dato y no hay plata en juego.
 */
export async function obtenerCoordsRapido(esperaMs = ESPERA_MAX_MS) {
  const ya = fresca()
  if (ya) return ya
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null
  if (!enCurso) enCurso = leerGps(Math.max(esperaMs, 10_000)).finally(() => { enCurso = null })
  return Promise.race([
    enCurso,
    new Promise((resolve) => setTimeout(() => resolve(null), esperaMs)),
  ])
}

/**
 * El cobro salio sin coordenadas porque el GPS aun no habia contestado: cuando
 * conteste, se le ponen. No bloquea nada y nunca lanza.
 */
export async function completarUbicacionDelPago(pagoId) {
  try {
    if (!pagoId || typeof navigator === 'undefined' || !navigator.geolocation) return false
    const coords = fresca() ?? await (enCurso ?? leerGps(10_000))
    if (!coords) return false
    const res = await fetch(`/api/pagos/${pagoId}/ubicacion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coords),
      keepalive: true,
    })
    // `true` = el pago quedó con ubicación: el comprobante lo dice.
    return Boolean(res?.ok)
  } catch { return false /* la ubicacion es un dato de apoyo: si no llega, no pasa nada */ }
}

/**
 * Distancia en metros entre dos puntos (formula Haversine).
 * Devuelve null si alguno de los argumentos es null/undefined.
 */
export function distanciaMetros(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some((v) => v == null)) return null
  const R = 6371000 // radio Tierra en metros
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

/**
 * Valida un par lat/lng. Si esta fuera de rango devuelve null para ambos.
 * Si todo OK devuelve { latitud, longitud } como floats.
 */
export function sanitizarCoords(lat, lng) {
  const latNum = Number(lat)
  const lngNum = Number(lng)
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return { latitud: null, longitud: null }
  if (latNum < -90 || latNum > 90) return { latitud: null, longitud: null }
  if (lngNum < -180 || lngNum > 180) return { latitud: null, longitud: null }
  return { latitud: latNum, longitud: lngNum }
}
