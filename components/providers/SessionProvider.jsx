'use client'
// components/providers/SessionProvider.jsx
// Wrapper de NextAuth SessionProvider con cache local para resiliencia offline.
// Guarda la ultima sesion en localStorage y la inyecta como initial value
// para que useSession() no quede en 'loading' cuando no hay red.

import { SessionProvider as NextAuthSessionProvider, useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { pedirSesionOtraVez, PEDIR_OTRA_VEZ_CADA_MS } from '@/lib/sesion-perdida'

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
  const { data: session, status } = useSession()
  useEffect(() => {
    if (session?.user?.email) guardarSessionCache(session)
  }, [session])

  // Si una renovación falló, next-auth no la vuelve a pedir: se le pide (ver lib/sesion-perdida.js).
  useEffect(() => {
    if (status !== 'unauthenticated') return
    pedirSesionOtraVez()
    const reloj = setInterval(pedirSesionOtraVez, PEDIR_OTRA_VEZ_CADA_MS)
    const alVolver = () => { if (document.visibilityState === 'visible') pedirSesionOtraVez() }
    window.addEventListener('online', pedirSesionOtraVez)
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      clearInterval(reloj)
      window.removeEventListener('online', pedirSesionOtraVez)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [status])
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
      /* ⚠ LA SESIÓN SE RENUEVA MIENTRAS SE USA (22 oct 2026). Con 0 nunca se
         pedía `/api/auth/session`, que es lo único que reescribe la cookie, así
         que vencía a las 8 h de ENTRAR aunque llevara el día entero cobrando:
         PRESTA MIL se quedó a media tarde con «No autorizado» en el teléfono y
         el computador encerrado. Cada 10 min con red: las 8 h pasan a ser 8 h
         sin usarla. Sin red no se pide (`refetchWhenOffline`). */
      refetchInterval={10 * 60}
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
    >
      <SessionUpdater />
      {children}
    </NextAuthSessionProvider>
  )
}
