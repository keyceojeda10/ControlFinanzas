'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'

// Antes: un ping cada 30s, sin deduplicar, aunque el cobrador estuviera quieto.
// Eso escribia 2 filas (User.update + UbicacionLog.create) 120 veces por hora y
// por cobrador: ~10x el volumen de escritura de los cobros reales, mas ~43 MB
// al mes de datos moviles de su bolsillo.
// Ahora: cada 2 minutos, y solo si de verdad se movio. Cada 10 minutos manda
// igual aunque este quieto, para que "ultima ubicacion" no quede congelada.
const INTERVALO_MS = 120_000
const MIN_METROS = 50
const LATIDO_MS = 600_000

// Haversine en metros
function distancia(a, b) {
  const R = 6371000
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const lat1 = a.lat * Math.PI / 180
  const lat2 = b.lat * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

export default function UbicacionProvider({ children }) {
  const { esCobrador, loading } = useAuth()
  const posRef = useRef(null)
  const watchRef = useRef(null)
  const intervalRef = useRef(null)
  const ultimaEnviadaRef = useRef(null)
  const ultimoEnvioMsRef = useRef(0)

  useEffect(() => {
    if (loading || !esCobrador) return
    if (!navigator.geolocation) return

    function iniciar() {
      watchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          posRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 30_000, timeout: 10_000 },
      )

      enviar()
      intervalRef.current = setInterval(enviar, INTERVALO_MS)
    }

    function detener() {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current)
        watchRef.current = null
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    async function enviar() {
      const pos = posRef.current
      if (!pos) return

      const ultima = ultimaEnviadaRef.current
      const desdeUltimo = Date.now() - (ultimoEnvioMsRef.current || 0)
      if (ultima && distancia(ultima, pos) < MIN_METROS && desdeUltimo < LATIDO_MS) return

      try {
        await fetch('/api/ubicacion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pos),
          keepalive: true,
        })
        ultimaEnviadaRef.current = pos
        ultimoEnvioMsRef.current = Date.now()
      } catch {}
    }

    function onVisibility() {
      if (document.hidden) {
        detener()
      } else {
        iniciar()
      }
    }

    iniciar()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      detener()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [loading, esCobrador])

  return children
}
