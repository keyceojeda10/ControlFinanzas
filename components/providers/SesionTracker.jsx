'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { marcarSoloLectura, estaEnSoloLectura } from '@/lib/modo-vista'
import { olvidarLecturasDeOtraCuenta } from '@/lib/cambio-de-cuenta'

export default function SesionTracker() {
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return
    if (session.user.rol === 'superadmin') return
    if (session.user.soloLectura) return

    let mounted = true

    const ping = () => {
      if (!mounted) return
      fetch('/api/sesiones', { method: 'POST', keepalive: true }).catch(() => {})
    }

    ping()
    const interval = setInterval(ping, 10 * 60 * 1000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [status, session?.user?.id, session?.user?.rol, session?.user?.soloLectura])

  // La marca de solo lectura del teléfono sigue a la sesión. Si la vista se
  // cerró sin pasar por la franja (sesión nueva, otra pestaña), se apaga aquí
  // y se tiran las lecturas que quedaron del cobrador.
  useEffect(() => {
    if (status !== 'authenticated') return
    const enVista = !!session?.user?.soloLectura
    if (enVista !== estaEnSoloLectura()) {
      marcarSoloLectura(enVista)
      if (!enVista) olvidarLecturasDeOtraCuenta()
    }
  }, [status, session?.user?.soloLectura])

  return null
}
