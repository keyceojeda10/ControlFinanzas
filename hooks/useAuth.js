'use client'
// hooks/useAuth.js - Hook de autenticación del lado del cliente

import { useSession } from 'next-auth/react'

export function useAuth() {
  const { data: session, status } = useSession()
  const loading = status === 'loading'

  return {
    session,
    loading,
    rol: session?.user?.rol ?? null,
    organizationId: session?.user?.organizationId ?? null,
    plan: session?.user?.plan ?? null,
    rutaId: session?.user?.rutaId ?? null,
    esOwner: session?.user?.rol === 'owner',
    esCobrador: session?.user?.rol === 'cobrador',
    esSuperadmin: session?.user?.rol === 'superadmin',
  }
}
