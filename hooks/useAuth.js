'use client'
// hooks/useAuth.js - Hook de autenticación del lado del cliente

import { useSession } from 'next-auth/react'

export function useAuth() {
  const { data: session, status, update } = useSession()
  const loading = status === 'loading'

  const esOwner    = session?.user?.rol === 'owner'
  const permisos   = session?.user?.permisos ?? {}
  const ocultarCapital = session?.user?.ocultarCapitalCobradores ?? false

  return {
    session,
    loading,
    updateSession: update,
    rol: session?.user?.rol ?? null,
    organizationId: session?.user?.organizationId ?? null,
    plan: session?.user?.plan ?? null,
    country: session?.user?.country ?? 'co',
    timezone: session?.user?.timezone ?? null,
    orgNombre: session?.user?.orgNombre ?? null,
    modoAbreviado: session?.user?.modoAbreviado ?? false,
    ocultarSaldoWA: session?.user?.ocultarSaldoWA ?? false,
    rutaId: session?.user?.rutaId ?? null,
    rutaIds: session?.user?.rutaIds ?? [],
    esOwner,
    esCobrador: session?.user?.rol === 'cobrador',
    esSuperadmin: session?.user?.rol === 'superadmin',
    // Permisos: owner siempre true, cobrador según configuración
    puedeCrearPrestamos: esOwner || Boolean(permisos.crearPrestamos),
    puedeGestionarPrestamos: esOwner || Boolean(permisos.gestionarPrestamos ?? permisos.crearPrestamos),
    puedeCrearClientes:  esOwner || Boolean(permisos.crearClientes),
    puedeEditarClientes: esOwner || Boolean(permisos.editarClientes),
    puedeReportarGastos: esOwner || Boolean(permisos.reportarGastos ?? true),
    puedeVerCapital:     esOwner || (!ocultarCapital && Boolean(permisos.verCapital)),
    puedeVerCapitalRuta: !ocultarCapital && Boolean(permisos.verCapitalRuta),
    puedeVerSaldoCaja:   esOwner || Boolean(permisos.verSaldoCaja),
    puedeGestionarRutas: esOwner || Boolean(permisos.gestionarRutas),
    puedeAplicarDescuentos: esOwner || Boolean(permisos.aplicarDescuentos),
    puedeDesembolsarLinea: esOwner || Boolean(permisos.desembolsarLinea),
    puedeReabrirCajaSinAprobacion: esOwner || Boolean(permisos.reabrirCajaSinAprobacion),
  }
}
