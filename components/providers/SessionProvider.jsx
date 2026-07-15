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
  const [cachedSession] = useState(() => session || leerSessionCache())

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
