'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'

const INTERVALO_MS = 30_000

export default function UbicacionProvider({ children }) {
  const { esCobrador, loading } = useAuth()
  const posRef = useRef(null)
  const watchRef = useRef(null)
  const intervalRef = useRef(null)

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
      try {
        await fetch('/api/ubicacion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pos),
          keepalive: true,
        })
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
