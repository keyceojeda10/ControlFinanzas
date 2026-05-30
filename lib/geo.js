// lib/geo.js — utilidades de geolocalizacion compartidas (browser + server)

/**
 * Pide la ubicacion actual del navegador con timeout corto.
 * Devuelve { latitud, longitud } o null si:
 *  - el navegador no soporta geolocation
 *  - el usuario nego el permiso
 *  - el GPS no responde dentro del timeout
 *
 * No bloquea la UX si falla. Usado al confirmar un pago.
 */
export async function obtenerCoordsRapido(timeoutMs = 4000) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null
  return new Promise((resolve) => {
    let resolved = false
    const done = (v) => {
      if (resolved) return
      resolved = true
      resolve(v)
    }
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => done({ latitud: pos.coords.latitude, longitud: pos.coords.longitude }),
        () => done(null),
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
      )
    } catch {
      done(null)
    }
    // failsafe por si el navegador nunca llama callbacks
    setTimeout(() => done(null), timeoutMs + 500)
  })
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
