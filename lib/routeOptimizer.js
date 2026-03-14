// lib/routeOptimizer.js — Optimización de ruta (TSP Nearest Neighbor + Haversine)

/**
 * Calcula la distancia en metros entre dos puntos GPS usando la fórmula Haversine
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000 // Radio de la Tierra en metros
  const toRad = (deg) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * Calcula la distancia total de una ruta (suma de distancias consecutivas)
 */
export function totalDistance(clientes) {
  let total = 0
  for (let i = 0; i < clientes.length - 1; i++) {
    total += haversineDistance(
      clientes[i].latitud, clientes[i].longitud,
      clientes[i + 1].latitud, clientes[i + 1].longitud
    )
  }
  return total
}

/**
 * Optimiza el orden de visita de clientes usando Nearest Neighbor TSP
 * - Empieza por el primer cliente con coordenadas
 * - En cada paso, elige el cliente más cercano no visitado
 * - Clientes sin coordenadas quedan al final
 * 
 * @param {Array} clientes - Array de clientes con { id, latitud, longitud, ... }
 * @returns {{ optimized: Array, sinCoords: Array, distanciaAntes: number, distanciaDespues: number }}
 */
export function optimizeRoute(clientes) {
  // Separar clientes con y sin coordenadas
  const conCoords = clientes.filter((c) => c.latitud != null && c.longitud != null)
  const sinCoords = clientes.filter((c) => c.latitud == null || c.longitud == null)

  if (conCoords.length < 2) {
    return {
      optimized: [...conCoords, ...sinCoords],
      sinCoords: sinCoords.length,
      distanciaAntes: 0,
      distanciaDespues: 0,
    }
  }

  // Distancia antes de optimizar
  const distanciaAntes = totalDistance(conCoords)

  // Nearest Neighbor TSP
  const visited = new Set()
  const result = []

  // Empezar por el primer cliente
  let current = conCoords[0]
  result.push(current)
  visited.add(current.id)

  while (visited.size < conCoords.length) {
    let nearest = null
    let nearestDist = Infinity

    for (const c of conCoords) {
      if (visited.has(c.id)) continue
      const dist = haversineDistance(
        current.latitud, current.longitud,
        c.latitud, c.longitud
      )
      if (dist < nearestDist) {
        nearestDist = dist
        nearest = c
      }
    }

    if (nearest) {
      result.push(nearest)
      visited.add(nearest.id)
      current = nearest
    }
  }

  const distanciaDespues = totalDistance(result)

  return {
    optimized: [...result, ...sinCoords],
    sinCoords: sinCoords.length,
    distanciaAntes: Math.round(distanciaAntes),
    distanciaDespues: Math.round(distanciaDespues),
  }
}
