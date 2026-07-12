'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'

export default function SesionTracker() {
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return
    if (session.user.rol === 'superadmin') return

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
  }, [status, session?.user?.id, session?.user?.rol])

  return null
}
