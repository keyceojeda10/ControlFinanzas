'use client'
// components/providers/SessionProvider.jsx
// Wrapper de NextAuth SessionProvider con cache local para resiliencia offline.
// Guarda la ultima sesion en localStorage y la inyecta como initial value
// para que useSession() no quede en 'loading' cuando no hay red.

import { SessionProvider as NextAuthSessionProvider, useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'cf-session-cache'

function leerSessionCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw)
    if (parsed?.user?.email) return parsed
  } catch {}
  return undefined
}

function guardarSessionCache(session) {
  try {
    if (session?.user?.email) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    }
  } catch {}
}

function SessionUpdater() {
  const { data: session } = useSession()
  useEffect(() => {
    if (session?.user?.email) guardarSessionCache(session)
  }, [session])
  return null
}

export default function SessionProvider({ children, session }) {
  /* El primer render del cliente TIENE que arrancar con lo mismo que el del
     servidor, o React tira el HTML (#418). Por eso, con red, manda la sesión
     que bajó del servidor (app/layout.js). La guardada solo entra:
     · si el servidor no mandó ninguna (como era antes), y
     · SIN SEÑAL: el HTML viene entonces de la caché del SW y puede traer la
       sesión de otra cuenta (cuentas guardadas); la última de este teléfono es
       la buena, aunque cueste un repintado. */
  const [cachedSession] = useState(() => {
    if (typeof window === 'undefined') return session || undefined
    if (!session) return leerSessionCache()
    if (navigator.onLine === false) return leerSessionCache() ?? session
    return session
  })

  useEffect(() => {
    if (session?.user?.email) guardarSessionCache(session)
  }, [session])

  return (
    <NextAuthSessionProvider
      session={cachedSession}
      refetchInterval={0}
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
    >
      <SessionUpdater />
      {children}
    </NextAuthSessionProvider>
  )
}
