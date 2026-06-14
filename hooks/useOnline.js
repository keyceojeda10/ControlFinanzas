'use client'

import { useEffect, useState } from 'react'
import { hayInternetReal, invalidarCacheConexion } from '@/lib/connectivity'

// Devuelve el estado de conexion REAL (no solo navigator.onLine).
//
// navigator.onLine miente cuando hay datos/WiFi conectados pero sin paso a
// internet (el "limbo" tipico del cobrador en la calle). Este hook ademas
// hace un ping ligero a /api/ping para detectar ese caso y reportar offline,
// asi las paginas pueden caer a cache en vez de quedarse cargando.
//
// Empieza en true para evitar flash en SSR / primer render.
export function useOnline() {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    if (typeof navigator === 'undefined') return
    let cancelado = false

    const evaluar = async ({ forzar = false } = {}) => {
      // navigator.onLine === false es confiable: interfaz caida = offline.
      if (navigator.onLine === false) {
        if (!cancelado) setOnline(false)
        return
      }
      // Interfaz dice "online" -> verificar internet real con ping.
      const real = await hayInternetReal({ forzar })
      if (!cancelado) setOnline(real)
    }

    // Estado inicial: optimista con navigator, luego confirmar con ping.
    setOnline(navigator.onLine)
    evaluar({ forzar: true })

    // Eventos nativos: invalidar cache y re-evaluar de inmediato.
    const onNativeOnline = () => { invalidarCacheConexion(); evaluar({ forzar: true }) }
    const onNativeOffline = () => { invalidarCacheConexion(); setOnline(false) }
    window.addEventListener('online', onNativeOnline)
    window.addEventListener('offline', onNativeOffline)

    // Re-chequeo periodico (cada 15s) para detectar el limbo, que no dispara
    // ningun evento nativo. Solo cuando la pestana esta visible (ahorra bateria).
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') evaluar()
    }, 15_000)

    // Al volver a la pestana, re-evaluar de una.
    const onVisible = () => { if (document.visibilityState === 'visible') evaluar({ forzar: true }) }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelado = true
      window.removeEventListener('online', onNativeOnline)
      window.removeEventListener('offline', onNativeOffline)
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(interval)
    }
  }, [])

  return online
}
