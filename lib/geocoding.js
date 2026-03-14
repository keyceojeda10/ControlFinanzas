// lib/geocoding.js — Geocodificación con Nominatim (OpenStreetMap, gratis)

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

/**
 * Geocodifica una dirección de texto a coordenadas lat/lng
 * Usa Nominatim (OpenStreetMap) — gratis, sin API key
 * Rate limit: 1 petición/segundo (solo se llama al guardar un cliente)
 * 
 * @param {string} direccion - Dirección de texto
 * @param {string} ciudad - Ciudad opcional para mejorar precisión
 * @returns {{ lat: number, lng: number } | null}
 */
export async function geocodeAddress(direccion, ciudad = '') {
  if (!direccion?.trim()) return null

  const query = ciudad
    ? `${direccion}, ${ciudad}, Colombia`
    : `${direccion}, Colombia`

  try {
    const url = new URL(NOMINATIM_URL)
    url.searchParams.set('q', query)
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', '1')
    url.searchParams.set('countrycodes', 'co')

    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'ControlFinanzas/1.0 (app.control-finanzas.com)',
      },
    })

    if (!res.ok) return null

    const data = await res.json()
    if (!data?.length) return null

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    }
  } catch {
    return null
  }
}
