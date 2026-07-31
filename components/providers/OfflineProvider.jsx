'use client'

import { useState, useEffect, useRef, useMemo, createContext, useContext, useCallback } from 'react'
import SyncDrawer from '@/components/offline/SyncDrawer'
import { iniciarAutoSync, obtenerPagosPendientes, obtenerPagosFallidos, eliminarPagoFallido, sincronizarPagos, sincronizarOrdenes, sincronizarTodo, obtenerSyncMeta, sincronizarCreaciones, obtenerClientesPendientes, obtenerPrestamosPendientes, obtenerClientesFallidos, obtenerPrestamosFallidos, obtenerMutacionesPendientes, obtenerMutacionesFallidas, obtenerMutacionesConflicto, sincronizarMutaciones, eliminarClienteFallido, eliminarPrestamoFallido, eliminarMutacion, reintentarMutacion } from '@/lib/offline'
import { ultimoEstadoConexion, hayInternetReal, invalidarCacheConexion } from '@/lib/connectivity'
import { setMutationCallback } from '@/lib/fetch-timeout'

const OfflineContext = createContext({ isOnline: true, pendingCount: 0, syncing: false, syncMeta: null, lastSyncedAt: 0, openSyncDrawer: () => {} })

export function useOffline() {
  return useContext(OfflineContext)
}

const MUTATION_SYNC_DELAY  = 3000  // 3s after a mutation
const MIN_AUTO_SYNC_GAP_MS = 60_000 // gap mínimo entre syncs completos (era 20s, subido a 60s)

export default function OfflineProvider({ children }) {
  const [isOnline, setIsOnline]         = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [failedPayments, setFailedPayments] = useState([])
  const [pendingDetails, setPendingDetails] = useState({
    pagos: [], clientes: [], prestamos: [], mutaciones: [],
  })
  const [failedDetails, setFailedDetails] = useState({
    pagos: [], clientes: [], prestamos: [], mutaciones: [],
  })
  const [conflictos, setConflictos] = useState([])
  const [syncResult, setSyncResult]     = useState(null)
  const [customToast, setCustomToast]   = useState(null)
  const [syncMeta, setSyncMeta]         = useState(null)
  const [bulkSyncing, setBulkSyncing]   = useState(false)
  const [bulkProgress, setBulkProgress] = useState(null)
  const [drawerOpen, setDrawerOpen]     = useState(false)
  // Counter that increments after every successful sync — pages watch this to refetch
  const [lastSyncedAt, setLastSyncedAt] = useState(0)
  const syncingRef = useRef(false)
  const syncingStartedAtRef = useRef(0)
  const lastAutoSyncAtRef = useRef(0)
  const swReloadPendienteRef = useRef(false)

  // Safety: liberar syncingRef si lleva demasiado tiempo (sincro colgada)
  const SYNCING_REF_TTL_MS = 75_000 // 75s — mas que timeout interno de sincronizarTodo
  const checkStaleLock = () => {
    if (syncingRef.current && Date.now() - syncingStartedAtRef.current > SYNCING_REF_TTL_MS) {
      syncingRef.current = false
      syncingStartedAtRef.current = 0
      setBulkSyncing(false)
      setBulkProgress(null)
    }
  }

  // Sync pending payments FIRST, then download fresh data.
  // By default we also notify pages so visible data stays up to date.
  const syncPendingThenFull = useCallback(async ({ silent = true, signalPages = true } = {}) => {
    if (!navigator.onLine) return
    // Declarado fuera del try para que el STEP 2 pueda leerlo (const tiene scope
    // de bloque: si se declara dentro del primer try, el segundo try no lo ve).
    let totalSynced = 0
    try {
      // STEP 1: Sync pending payments, orders AND creations to server FIRST
      // Orden: creaciones primero (para que los pagos offline puedan referenciar
      // préstamos recién creados), luego pagos, luego órdenes de ruta.
      const creResult = await sincronizarCreaciones()
      const mutResult = await sincronizarMutaciones()
      const payResult = await sincronizarPagos()
      const ordResult = await sincronizarOrdenes()
      totalSynced = creResult.synced + mutResult.synced + payResult.synced + ordResult.synced
      const totalFailed = creResult.failed + mutResult.failed + payResult.failed + ordResult.failed
      if (totalSynced > 0) {
        setSyncResult({ synced: totalSynced, failed: totalFailed })
        setTimeout(() => setSyncResult(null), 5000)
      }
    } catch { /* silent */ }

    // STEP 2: Now download fresh data from server (includes synced payments)
    checkStaleLock()
    if (syncingRef.current) return
    syncingRef.current = true
    syncingStartedAtRef.current = Date.now()
    if (!silent) setBulkSyncing(true)
    try {
      const result = await sincronizarTodo(silent ? () => {} : (p) => setBulkProgress(p))
      setSyncMeta({
        syncedAt: result.syncedAt,
        totalClientes: result.clientes,
        totalPrestamos: result.prestamos,
        totalRutas: result.rutas,
      })
      if (signalPages || totalSynced > 0) {
        setLastSyncedAt(Date.now())
      }
      if (!silent) {
        setBulkProgress({ step: 'done', message: `${result.clientes} clientes sincronizados` })
        setTimeout(() => setBulkProgress(null), 3000)
      }
    } catch { /* silent */ }
    finally {
      syncingRef.current = false
      syncingStartedAtRef.current = 0
      if (!silent) setBulkSyncing(false)
    }

    // STEP 3: Refresh pending count + failed items
    try {
      const [pending, failed, cliPend, presPend, mutPend, cliFail, presFail, mutFail, mutConf] = await Promise.all([
        obtenerPagosPendientes(),
        obtenerPagosFallidos(),
        obtenerClientesPendientes().catch(() => []),
        obtenerPrestamosPendientes().catch(() => []),
        obtenerMutacionesPendientes().catch(() => []),
        obtenerClientesFallidos().catch(() => []),
        obtenerPrestamosFallidos().catch(() => []),
        obtenerMutacionesFallidas().catch(() => []),
        obtenerMutacionesConflicto().catch(() => []),
      ])
      setPendingCount(pending.length + cliPend.length + presPend.length + mutPend.length)
      setFailedPayments(failed)
      setPendingDetails({ pagos: pending, clientes: cliPend, prestamos: presPend, mutaciones: mutPend })
      setFailedDetails({ pagos: failed, clientes: cliFail, prestamos: presFail, mutaciones: mutFail })
      setConflictos(mutConf)
    } catch { /* ignore */ }
  }, [])

  const requestAutoSync = useCallback(() => {
    if (!navigator.onLine) return
    checkStaleLock()
    if (syncingRef.current) return
    const now = Date.now()
    if (now - lastAutoSyncAtRef.current < MIN_AUTO_SYNC_GAP_MS) return
    lastAutoSyncAtRef.current = now
    // Silent means no blocking UI toast, but pages still refresh with fresh data.
    syncPendingThenFull({ silent: true, signalPages: true })
  }, [syncPendingThenFull])

  // Track pending payments count (MUST be defined before useEffects that reference it)
  const refreshPending = useCallback(async () => {
    try {
      const [pending, failed, cliPend, presPend, mutPend, cliFail, presFail, mutFail, mutConf] = await Promise.all([
        obtenerPagosPendientes(),
        obtenerPagosFallidos(),
        obtenerClientesPendientes().catch(() => []),
        obtenerPrestamosPendientes().catch(() => []),
        obtenerMutacionesPendientes().catch(() => []),
        obtenerClientesFallidos().catch(() => []),
        obtenerPrestamosFallidos().catch(() => []),
        obtenerMutacionesFallidas().catch(() => []),
        obtenerMutacionesConflicto().catch(() => []),
      ])
      setPendingCount(pending.length + cliPend.length + presPend.length + mutPend.length)
      setFailedPayments(failed)
      setPendingDetails({ pagos: pending, clientes: cliPend, prestamos: presPend, mutaciones: mutPend })
      setFailedDetails({ pagos: failed, clientes: cliFail, prestamos: presFail, mutaciones: mutFail })
      setConflictos(mutConf)
    } catch { /* ignore */ }
  }, [])

  // Solo sube pendientes al servidor — sin descargar datos (para visibility/focus)
  // NOTA: debe estar despues de refreshPending para evitar referencia a const no inicializada
  const syncPendingOnly = useCallback(async () => {
    if (!navigator.onLine) return
    try {
      await sincronizarCreaciones()
      await sincronizarMutaciones()
      await sincronizarPagos()
      await sincronizarOrdenes()
    } catch { /* silent */ }
    refreshPending()
  }, [refreshPending])

  const descartarPagoFallido = useCallback(async (id) => {
    await eliminarPagoFallido(id)
    refreshPending()
  }, [refreshPending])

  const descartarItem = useCallback(async (tipo, id) => {
    try {
      if (tipo === 'pago')      await eliminarPagoFallido(id)
      else if (tipo === 'cliente')   await eliminarClienteFallido(id)
      else if (tipo === 'prestamo')  await eliminarPrestamoFallido(id)
      else if (tipo === 'mutacion')  await eliminarMutacion(id)
    } catch {}
    refreshPending()
  }, [refreshPending])

  const reintentarItem = useCallback(async (tipo, id) => {
    try {
      if (tipo === 'mutacion') {
        await reintentarMutacion(id)
      }
      // Para pagos/clientes/prestamos fallidos, la estrategia es "descartar" en UI.
      // Un reintento requiere volver a encolar manualmente.
    } catch {}
    refreshPending()
    if (navigator.onLine) {
      setTimeout(() => syncPendingThenFull({ silent: false }), 300)
    }
  }, [refreshPending, syncPendingThenFull])

  // Resolver conflicto 412:
  //   accion='local'    -> pisar servidor con cambios del usuario
  //   accion='servidor' -> descartar mi cambio y quedarme con servidor
  const resolverConflicto = useCallback(async (id, accion) => {
    try {
      if (accion === 'servidor') {
        await eliminarMutacion(id)
      } else if (accion === 'local') {
        await reintentarMutacion(id, { forzar: true })
      }
    } catch {}
    refreshPending()
    if (navigator.onLine && accion === 'local') {
      setTimeout(() => syncPendingThenFull({ silent: false }), 300)
    }
  }, [refreshPending, syncPendingThenFull])

  // Track online/offline REAL (no solo navigator.onLine) + re-sync al volver.
  // Mantiene isOnline y ultimoEstadoConexion() frescos para que el badge sea
  // honesto en limbo y el interceptor pueda cortar GETs rapido cuando no hay
  // internet real.
  useEffect(() => {
    let cancelado = false

    const evaluar = async ({ forzar = false, syncSiVuelve = false } = {}) => {
      if (navigator.onLine === false) {
        if (!cancelado) setIsOnline(false)
        return
      }
      const real = await hayInternetReal({ forzar })
      if (cancelado) return
      setIsOnline((prev) => {
        // Si pasamos de offline -> online real, disparar sync.
        if (real && !prev && syncSiVuelve) {
          setTimeout(() => syncPendingThenFull({ silent: false, signalPages: true }), 1500)
        }
        return real
      })
    }

    setIsOnline(navigator.onLine)
    evaluar({ forzar: true })

    const goOnline  = () => { invalidarCacheConexion(); evaluar({ forzar: true, syncSiVuelve: true }) }
    const goOffline = () => { invalidarCacheConexion(); if (!cancelado) setIsOnline(false) }
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)

    // Ping periodico (cada 15s, pestana visible) para detectar el limbo, que no
    // dispara ningun evento nativo. Si el internet real cambia, syncSiVuelve.
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') evaluar({ syncSiVuelve: true })
    }, 15_000)

    return () => {
      cancelado = true
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
      clearInterval(interval)
    }
  }, [syncPendingThenFull])

  // ── EL SERVICE WORKER NO VA EN DESARROLLO ──
  //
  // Se registraba SIEMPRE, y en local eso no ayuda: estorba. Next reparte el
  // codigo en trozos con el nombre cambiado en cada compilacion, asi que en
  // cuanto se borra `.next` —o se recompila fuerte— el trozo que el service
  // worker tiene guardado apunta a un modulo que ya no existe. El componente
  // sale `undefined` y la pantalla revienta con «Element type is invalid».
  //
  // Es lo que le paso al usuario: veia pantallas ARREGLADAS HACE UNA HORA con
  // su version vieja, y `/prestamos` rota, con el codigo perfecto. Y yo no lo
  // podia ver porque todas mis capturas bloquean el service worker.
  //
  // En produccion si hace falta —es lo que deja cobrar sin señal—, y ahi los
  // nombres de los trozos no cambian hasta el siguiente despliegue.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    if (process.env.NODE_ENV !== 'production') {
      // Y se quita el que ya estuviera puesto de antes, con sus cajones: sin
      // esto, quien ya lo tenia registrado seguiria viendo lo viejo para
      // siempre aunque el codigo nuevo ya no lo registre.
      navigator.serviceWorker.getRegistrations()
        .then((rs) => rs.forEach((r) => r.unregister()))
        .catch(() => {})
      if (typeof caches !== 'undefined') {
        caches.keys().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => {})
      }
      return
    }

    navigator.serviceWorker.register('/sw.js').catch(() => {})

    // ── Y QUE LA APP SE ENTERE DE QUE HAY VERSION NUEVA ──
    //
    // `sw.js` ya hace `skipWaiting()` y `clients.claim()`, asi que el service
    // worker nuevo toma el mando enseguida. Pero el JavaScript que YA esta
    // corriendo en la pestaña sigue siendo el viejo hasta que se cierren todas
    // — o sea, en una app que se deja abierta, para siempre. Cada version
    // nueva se quedaba a medio camino: chunks nuevos servidos a una pagina
    // vieja, que es la otra mitad del «Element type is invalid».
    //
    // `controllerchange` avisa justo en ese momento. Se recarga una vez, con
    // guarda: sin ella, si algo vuelve a disparar el evento, la pagina entra
    // en bucle de recargas y no se puede ni cerrar.
    let recargando = false
    const alCambiar = () => {
      if (recargando) return
      recargando = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', alCambiar)

    // Warmup: la primera vez (por sesion) precachear las listas principales
    // para que si el usuario se queda sin red sin haber navegado, tenga
    // shells disponibles. Solo corre una vez por carga y solo si esta online.
    const WARMUP_KEY = 'cf-sw-warmup-at'
    const WARMUP_TTL = 30 * 60 * 1000 // 30 min
    const lastWarmup = Number(sessionStorage.getItem(WARMUP_KEY) || 0)
    const now = Date.now()
    if (navigator.onLine && now - lastWarmup > WARMUP_TTL) {
      sessionStorage.setItem(WARMUP_KEY, String(now))
      const warmup = () => {
        const sw = navigator.serviceWorker.controller
        if (!sw) return
        sw.postMessage({
          type: 'CACHE_PAGES',
          urls: ['/dashboard', '/clientes', '/prestamos', '/rutas', '/caja', '/capital', '/reportes', '/gastos', '/clientes/nuevo', '/prestamos/nuevo'],
        })
      }
      // Esperar un tick — si el SW no controla aun esta pagina, reintentar una vez
      setTimeout(warmup, 800)
      setTimeout(warmup, 4000)
    }

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', alCambiar)
    }
  }, [])

  // Start auto-sync safety net (30s interval)
  useEffect(() => {
    iniciarAutoSync()
  }, [])

  // Escuchar mensajes del SW (Background Sync dispara TRIGGER_SYNC cuando
  // el browser detecta red, incluso si la pestaña estaba en segundo plano).
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (e) => {
      if (e.data?.type === 'TRIGGER_SYNC' && navigator.onLine) {
        syncPendingThenFull({ silent: true })
      }
      if (e.data?.type === 'SW_UPDATED') {
        // Hay version nueva activada. Recargar es necesario para tomar el
        // codigo fresco, pero NUNCA interrumpiendo al usuario en plena vista
        // (podria estar llenando un pago). Estrategia:
        //   - pestana/app en segundo plano -> recargar ya (invisible)
        //   - pestana visible -> diferir hasta que pase a segundo plano
        if (!navigator.serviceWorker.controller) return // primera instalacion: la pagina ya vino fresca de red
        if (document.visibilityState === 'hidden') {
          window.location.reload()
          return
        }
        if (swReloadPendienteRef.current) return
        swReloadPendienteRef.current = true
        const onHide = () => {
          if (document.visibilityState === 'hidden') {
            document.removeEventListener('visibilitychange', onHide)
            window.location.reload()
          }
        }
        document.addEventListener('visibilitychange', onHide)
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [syncPendingThenFull])

  useEffect(() => {
    refreshPending()
    const interval = setInterval(refreshPending, 30000) // era 10s, subido a 30s
    return () => clearInterval(interval)
  }, [refreshPending])

  // Listen for sync trigger from payment pages
  useEffect(() => {
    const onPaymentQueued = () => refreshPending()
    window.addEventListener('paymentQueued', onPaymentQueued)
    return () => window.removeEventListener('paymentQueued', onPaymentQueued)
  }, [refreshPending])

  // Toast one-shot desde sessionStorage (usado cuando algo se guarda offline
  // y navegamos a otra página). Se muestra 4s y se limpia.
  useEffect(() => {
    const check = () => {
      try {
        const msg = sessionStorage.getItem('cf-toast')
        if (msg) {
          sessionStorage.removeItem('cf-toast')
          setCustomToast(msg)
          setTimeout(() => setCustomToast(null), 4000)
        }
      } catch {}
    }
    check()
    const onRoute = () => check()
    window.addEventListener('popstate', onRoute)
    const t = setInterval(check, 1500)
    return () => {
      window.removeEventListener('popstate', onRoute)
      clearInterval(t)
    }
  }, [])

  // ─── AUTO-SYNC: on mount + periodic + visibility change ───
  useEffect(() => {
    obtenerSyncMeta().then((meta) => { if (meta) setSyncMeta(meta) }).catch(() => {})

    // Sync shortly after app open.
    const initialTimeout = setTimeout(() => requestAutoSync(), 3000)

    // Keep offline data fresh continuously while online.
    const periodicSync = setInterval(() => {
      requestAutoSync()
    }, 90 * 1000)

    // Al volver a la pestaña/app: solo subir pendientes (rápido).
    // El sync completo (descarga) lo hace el intervalo periódico cada 90s.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncPendingOnly()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // Focus cubre PWA volviendo de background — igual, solo subir pendientes
    const handleFocus = () => {
      syncPendingOnly()
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      clearTimeout(initialTimeout)
      clearInterval(periodicSync)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleFocus)
    }
  }, [requestAutoSync, syncPendingOnly])

  // ─── MUTATION SYNC callback ───
  // El timeout de fetch se instala a nivel de modulo (lib/fetch-timeout.js)
  // para que este activo desde el primer render. Aqui solo registramos el
  // callback que dispara re-sync tras una mutacion exitosa.
  useEffect(() => {
    let mutationTimeout = null
    setMutationCallback(() => {
      if (mutationTimeout) clearTimeout(mutationTimeout)
      mutationTimeout = setTimeout(() => syncPendingThenFull({ silent: true, signalPages: false }), MUTATION_SYNC_DELAY)
    })
    return () => {
      setMutationCallback(null)
      if (mutationTimeout) clearTimeout(mutationTimeout)
    }
  }, [syncPendingThenFull])

  // ─── Offline navigation: force full-page loads when offline ───
  useEffect(() => {
    const DASHBOARD_ROUTES = ['/dashboard', '/clientes', '/prestamos', '/rutas', '/caja', '/cobradores', '/reportes', '/configuracion']

    const isDashboardRoute = (pathname) =>
      DASHBOARD_ROUTES.some((r) => pathname.startsWith(r))

    const handleClick = (e) => {
      if (navigator.onLine) return

      let el = e.target
      while (el && el.tagName !== 'A') el = el.parentElement
      if (!el || !el.href) return

      const url = new URL(el.href, window.location.origin)
      if (url.origin !== window.location.origin) return
      if (!isDashboardRoute(url.pathname)) return

      e.preventDefault()
      e.stopPropagation()
      window.location.href = url.pathname + url.search
    }

    document.addEventListener('click', handleClick, true)
    return () => {
      document.removeEventListener('click', handleClick, true)
    }
  }, [])

  const manualSync = async () => {
    if (!navigator.onLine) return
    await syncPendingThenFull({ silent: false, signalPages: true })
  }

  // Bulk sync: download everything for offline (manual trigger)
  const startBulkSync = async () => {
    if (!navigator.onLine) return
    checkStaleLock()
    if (bulkSyncing || syncingRef.current) return
    syncingRef.current = true
    syncingStartedAtRef.current = Date.now()
    setBulkSyncing(true)
    setBulkProgress({ step: 'downloading', message: 'Descargando datos...' })
    try {
      const result = await sincronizarTodo((progress) => setBulkProgress(progress))
      setSyncMeta({ syncedAt: result.syncedAt, totalClientes: result.clientes, totalPrestamos: result.prestamos, totalRutas: result.rutas })
      setBulkProgress({ step: 'done', message: `${result.clientes} clientes, ${result.prestamos} préstamos sincronizados` })
      setTimeout(() => setBulkProgress(null), 4000)
    } catch {
      setBulkProgress({ step: 'error', message: 'Error al sincronizar. Intenta de nuevo.' })
      setTimeout(() => setBulkProgress(null), 4000)
    } finally {
      syncingRef.current = false
      syncingStartedAtRef.current = 0
      setBulkSyncing(false)
    }
  }

  // Total de items que fallaron permanentemente (pagos/clientes/prestamos/ediciones).
  // Importante: estos NO estan en pendingCount, asi que sin esto el badge flotante
  // desaparece y el cobrador no se entera de que un pago no se guardo.
  const failedTotal = useMemo(() => (
    (failedDetails.pagos?.length || 0) +
    (failedDetails.clientes?.length || 0) +
    (failedDetails.prestamos?.length || 0) +
    (failedDetails.mutaciones?.length || 0)
  ), [failedDetails])

  // Set de IDs de entidades con mutaciones/pagos pendientes o fallidos para
  // que las cards muestren un badge "pendiente offline" sin N consultas.
  const pendientesIds = useMemo(() => {
    const s = new Set()
    for (const p of pendingDetails.pagos || []) if (p.prestamoId) s.add(p.prestamoId)
    for (const p of failedDetails.pagos || []) if (p.prestamoId) s.add(p.prestamoId)
    for (const c of pendingDetails.clientes || []) if (c.tempId) s.add(c.tempId)
    for (const c of failedDetails.clientes || []) if (c.tempId) s.add(c.tempId)
    for (const p of pendingDetails.prestamos || []) { if (p.tempId) s.add(p.tempId); if (p.clienteId) s.add(p.clienteId) }
    for (const p of failedDetails.prestamos || []) { if (p.tempId) s.add(p.tempId); if (p.clienteId) s.add(p.clienteId) }
    for (const m of pendingDetails.mutaciones || []) if (m.entityId) s.add(m.entityId)
    for (const m of failedDetails.mutaciones || []) if (m.entityId) s.add(m.entityId)
    return s
  }, [pendingDetails, failedDetails])

  return (
    <OfflineContext.Provider value={{ isOnline, pendingCount, failedPayments, pendingDetails, failedDetails, conflictos, pendientesIds, resolverConflicto, descartarPagoFallido, descartarItem, reintentarItem, refreshPending, manualSync, syncMeta, startBulkSync, bulkSyncing, bulkProgress, lastSyncedAt, openSyncDrawer: () => setDrawerOpen(true) }}>
      <SyncDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      {children}

      {/* Badge flotante unificado para mobile (abre el drawer). Se oculta en desktop (lg+) */}
      {(!isOnline || pendingCount > 0 || bulkSyncing || conflictos.length > 0 || failedTotal > 0) && (
        <button
          onClick={() => setDrawerOpen(true)}
          className={`lg:hidden fixed bottom-[84px] right-3 z-[9998] h-9 px-3 rounded-full flex items-center gap-2 shadow-lg backdrop-blur-xl bg-[var(--cf-surface)] border text-[var(--cf-ink)] text-xs font-semibold ${(conflictos.length > 0 || failedTotal > 0) ? 'border-[var(--cf-red-dark)] animate-pulse' : 'border-[var(--cf-border)]'}`}
          aria-label="Estado de sincronización"
        >
          {bulkSyncing ? (
            <svg className="w-3 h-3 animate-spin text-[var(--cf-ink-2)]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <span className={`w-2 h-2 rounded-full ${(conflictos.length > 0 || failedTotal > 0) ? 'bg-[var(--cf-red-dark)]' : !isOnline ? 'bg-[var(--cf-gold-dark)] animate-pulse' : 'bg-[var(--cf-ink-2)]'}`} />
          )}
          <span>
            {conflictos.length > 0
              ? `${conflictos.length} conflicto${conflictos.length > 1 ? 's' : ''}`
              : failedTotal > 0
                ? `${failedTotal} sin guardar`
                : !isOnline
                  ? (pendingCount > 0 ? `Sin señal · ${pendingCount} por subir` : 'Sin señal')
                  : bulkSyncing ? 'Subiendo…' : `${pendingCount} por subir`}
          </span>
        </button>
      )}

      {/* Custom toast (cliente/prestamo guardado offline, etc) */}
      {customToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] bg-[var(--cf-surface)] border border-[var(--cf-gold)] text-[var(--cf-ink)] text-xs px-4 py-2.5 rounded-[12px] shadow-xl flex items-center gap-2 max-w-[90vw]">
          <svg className="w-4 h-4 text-[var(--cf-gold)] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span>{customToast}</span>
        </div>
      )}

      {/* Sync result toast */}
      {syncResult && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] bg-[var(--cf-surface)] border border-[var(--cf-border)] text-[var(--cf-ink)] text-xs px-4 py-2.5 rounded-[12px] shadow-xl flex items-center gap-2 max-w-[90vw]">
          {syncResult.synced > 0 && (
            <span className="text-[var(--cf-green-dark)]">{syncResult.synced} cambio{syncResult.synced > 1 ? 's' : ''} sincronizado{syncResult.synced > 1 ? 's' : ''}</span>
          )}
          {syncResult.failed > 0 && (
            <span className="text-[var(--cf-red-dark)]">{syncResult.failed} fallido{syncResult.failed > 1 ? 's' : ''}</span>
          )}
        </div>
      )}

    </OfflineContext.Provider>
  )
}
