'use client'

import { useEffect, useState } from 'react'

// Devuelve el estado de conexion. Empieza en true para evitar flash en SSR.
export function useOnline() {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    setOnline(navigator.onLine)
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}
