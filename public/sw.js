// Service Worker — Control Finanzas PWA
const CACHE_NAME = 'cf-v15'
const API_CACHE  = 'cf-api-v15'
const DB_NAME = 'cf-offline'
const DB_VERSION = 4
const STORE_MUTACIONES = 'mutaciones_pendientes'
const STORE_PAGOS = 'pagos_pendientes'

// HTML amigable cuando no hay nada cacheado y estamos sin conexion.
// Respeta el tema (lee cf-theme de localStorage) y ofrece boton para volver.
const OFFLINE_FALLBACK_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Sin conexion - Control Finanzas</title>
<script>
(function(){try{
  var t=localStorage.getItem('cf-theme')||'system';
  var r=t==='system'?(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):t;
  document.documentElement.setAttribute('data-theme',r);
}catch(e){}})();
</script>
<style>
  :root{--bg:#060609;--surface:#0d0d12;--text:#f0f0f5;--muted:#9a9ab0;--border:rgba(255,255,255,0.08);--accent:#f5c518;--warn-bg:rgba(245,197,24,0.1);--warn:#f5c518;}
  html[data-theme="light"]{--bg:#f5f7fb;--surface:#ffffff;--text:#1a1a2e;--muted:#5a5a72;--border:rgba(20,20,40,0.08);--warn-bg:rgba(245,197,24,0.15);}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased}
  .wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
  .card{max-width:360px;width:100%;text-align:center}
  .icon{width:80px;height:80px;margin:0 auto 20px;border-radius:50%;background:var(--warn-bg);border:1px solid var(--warn);display:flex;align-items:center;justify-content:center}
  .icon svg{width:40px;height:40px;color:var(--warn)}
  h1{font-size:18px;font-weight:700;margin-bottom:8px}
  p{font-size:14px;color:var(--muted);line-height:1.5;margin-bottom:24px}
  button{width:100%;height:44px;border-radius:12px;border:none;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:8px;font-family:inherit}
  .primary{background:var(--accent);color:#000}
  .secondary{background:transparent;color:var(--muted);border:1px solid var(--border)}
  .secondary:hover{background:var(--surface)}
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="icon">
      <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"/>
      </svg>
    </div>
    <h1>Esta funcion no esta disponible sin conexion</h1>
    <p>Vuelve a intentarlo cuando recuperes la red. Puedes seguir usando las partes principales de la app mientras tanto.</p>
    <button class="primary" onclick="location.href='/dashboard'">Volver al Dashboard</button>
    <button class="secondary" onclick="location.reload()">Reintentar</button>
  </div>
</div>
</body>
</html>`

// Only precache static assets (NOT auth-protected pages)
const PRECACHE_URLS = [
  '/icon.svg',
  '/logo-icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/login',
]

// API routes to cache for offline reads (GET only)
const CACHEABLE_API = [
  '/api/dashboard/resumen',
  '/api/prestamos',
  '/api/clientes',
  '/api/rutas',
  '/api/cobradores',
  '/api/auth/session',
  '/api/caja',
  '/api/gastos',
  '/api/capital/movimientos',
  '/api/reportes/resumen',
  '/api/reportes/ingresos',
  '/api/reportes/cartera',
  '/api/reportes/cobradores',
]

// Auth routes that should NEVER be cached (login/logout flows)
const AUTH_SKIP = [
  '/api/auth/callback',
  '/api/auth/signin',
  '/api/auth/signout',
  '/api/auth/csrf',
  '/api/auth/providers',
]

// ─── Install: precache app shell ────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch(() => {
        console.log('[SW] Some precache URLs failed, continuing...')
      })
    )
  )
  // skipWaiting: activar el SW nuevo inmediatamente. Necesario porque la
  // logica del fallback offline cambio y los usuarios no pueden esperar a
  // cerrar todas las pestañas para recibir el fix.
  self.skipWaiting()
})

// ─── Activate: clean old caches (incluyendo versiones viejas de API) ──────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// ─── Fetch: strategy per request type ───────────────────────
self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = new URL(request.url)

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return

  // Skip non-GET for caching
  if (request.method !== 'GET') return

  // Skip auth flows (signin/signout/callback) — never cache these
  if (AUTH_SKIP.some((p) => url.pathname.startsWith(p))) return

  // Skip offline sync requests (never cache)
  if (url.pathname.startsWith('/api/offline')) return

  // _next/data (RSC payloads for client-side navigation): network-first with fallback
  // Without this, offline client-side navigation crashes Next.js Router
  if (url.pathname.startsWith('/_next/data')) {
    e.respondWith(networkFirstRSC(request))
    return
  }

  // API requests: network-first, fallback to cache
  if (url.pathname.startsWith('/api/') && CACHEABLE_API.some((p) => url.pathname.startsWith(p))) {
    e.respondWith(networkFirstAPI(request))
    return
  }

  // Next.js static assets (_next/static): cache-first
  if (url.pathname.startsWith('/_next/static')) {
    e.respondWith(cacheFirst(request))
    return
  }

  // Page navigations: network-first, fallback to cache
  if (request.mode === 'navigate') {
    e.respondWith(networkFirstPage(request))
    return
  }

  // Everything else: network with cache fallback
  e.respondWith(networkFirst(request))
})

// ─── Strategies ─────────────────────────────────────────────

async function networkFirstAPI(request) {
  try {
    const response = await fetch(request)
    // Only cache successful, non-redirected responses
    if (response.ok && !response.redirected) {
      const cache = await caches.open(API_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    return new Response(JSON.stringify({ error: 'Sin conexión', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// Rutas padre para fallback en rutas dinámicas cuando el ID específico no está
// cacheado (p.ej. /clientes/offline-xxx creado sin red). Next.js sirve el shell
// de la ruta padre y luego el cliente React carga datos desde IndexedDB.
const DYNAMIC_ROUTE_FALLBACKS = [
  { prefix: '/clientes/', fallback: '/clientes' },
  { prefix: '/prestamos/', fallback: '/prestamos' },
  { prefix: '/rutas/', fallback: '/rutas' },
  { prefix: '/cobradores/', fallback: '/cobradores' },
]

async function networkFirstPage(request) {
  try {
    const response = await fetch(request)
    // Never cache redirects — they cause "service worker has redirections" errors
    if (response.ok && !response.redirected) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached

    // Fallback cascada: padre de ruta dinamica -> dashboard -> cualquier pagina cacheada
    try {
      const url = new URL(request.url)
      const match = DYNAMIC_ROUTE_FALLBACKS.find(r => url.pathname.startsWith(r.prefix) && url.pathname !== r.fallback)
      if (match) {
        const parentCached = await caches.match(match.fallback)
        if (parentCached) return parentCached
      }
      // Dashboard shell
      const dashboardCached = await caches.match('/dashboard')
      if (dashboardCached) return dashboardCached
      // Ultimo recurso: cualquier pagina dashboard cacheada (la primera que aparezca)
      const cache = await caches.open(CACHE_NAME)
      const keys = await cache.keys()
      for (const req of keys) {
        const u = new URL(req.url)
        if (['/dashboard', '/clientes', '/prestamos', '/rutas', '/caja'].some(p => u.pathname === p)) {
          const hit = await cache.match(req)
          if (hit) return hit
        }
      }
    } catch {}

    return new Response(OFFLINE_FALLBACK_HTML, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('', { status: 503 })
  }
}

async function networkFirst(request) {
  try {
    return await fetch(request)
  } catch {
    const cached = await caches.match(request)
    return cached || new Response('', { status: 503 })
  }
}

// RSC payloads (_next/data): cache when online, serve cached when offline
async function networkFirstRSC(request) {
  try {
    const response = await fetch(request)
    if (response.ok && !response.redirected) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    // No cached RSC payload — return empty JSON so Next.js doesn't hard-crash
    // The page component will then fall back to IndexedDB via its own error handling
    return new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// ─── Push Notifications ───────────────────────────────────
self.addEventListener('push', (e) => {
  if (!e.data) return
  try {
    const data = e.data.json()
    e.waitUntil(
      self.registration.showNotification(data.title || 'Control Finanzas', {
        body: data.body,
        icon: data.icon || '/logo-icon.svg',
        badge: '/icons/icon-192.png',
        data: { url: data.url || '/dashboard' },
        vibrate: [200, 100, 200],
      })
    )
  } catch {}
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = e.notification.data?.url || '/dashboard'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing tab if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      // Open new tab
      return self.clients.openWindow(url)
    })
  )
})

// ─── Background Sync: dispara cuando el navegador detecta red ────
// El browser invoca este evento incluso si la pestaña esta minimizada o
// cerrada (dentro de los limites de cada plataforma). Nosotros notificamos
// a todos los clients abiertos para que ejecuten la sincronizacion via
// postMessage. Si no hay clients, no hay mucho que hacer desde SW sin
// replicar toda la logica de IndexedDB + auth aqui, asi que simplemente
// reintentamos en el proximo evento.
self.addEventListener('sync', (event) => {
  if (event.tag === 'cf-sync-pending') {
    event.waitUntil(handleBackgroundSync())
  }
})

// Estrategia: si hay clients abiertos, delegar a ellos (tienen la logica JS completa).
// Si NO hay clients, el SW sincroniza directo desde IndexedDB usando las cookies
// de sesion (se incluyen automaticamente en fetch same-origin dentro del SW).
async function handleBackgroundSync() {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  if (clients.length > 0) {
    for (const client of clients) {
      client.postMessage({ type: 'TRIGGER_SYNC' })
    }
    return
  }

  // Sin clients: sincronizamos directamente desde aqui.
  // Solo procesamos mutaciones (updates) y pagos — son los mas criticos y no
  // dependen de tempIds complicados. Las creaciones con tempIds esperan a que
  // un client se abra (tienen mapeos de ID en memoria que complican el SW).
  let resultado = { pagos: 0, mutaciones: 0, fallidos: 0, conflictos: 0 }
  try {
    const mut = await syncMutacionesFromSW()
    const pag = await syncPagosFromSW()
    resultado.mutaciones = mut.synced
    resultado.pagos = pag.synced
    resultado.fallidos = mut.failed + pag.failed
    resultado.conflictos = mut.conflictos
  } catch (e) {
    throw e
  }

  // Notificacion local al usuario si hubo actividad relevante
  await notificarResultadoSync(resultado)
}

async function notificarResultadoSync({ pagos, mutaciones, fallidos, conflictos }) {
  const totalOk = pagos + mutaciones
  if (totalOk === 0 && fallidos === 0 && conflictos === 0) return
  try {
    let title, body, url = '/dashboard'
    if (conflictos > 0) {
      title = 'Conflictos al sincronizar'
      body = `${conflictos} cambio${conflictos > 1 ? 's' : ''} necesita${conflictos > 1 ? 'n' : ''} revision. Abre la app para resolver.`
    } else if (fallidos > 0 && totalOk === 0) {
      title = 'Error al sincronizar'
      body = `${fallidos} cambio${fallidos > 1 ? 's' : ''} no pudo${fallidos > 1 ? 'ieron' : ''} subirse. Abre la app para revisar.`
    } else if (totalOk > 0) {
      const partes = []
      if (pagos > 0) partes.push(`${pagos} pago${pagos > 1 ? 's' : ''}`)
      if (mutaciones > 0) partes.push(`${mutaciones} cambio${mutaciones > 1 ? 's' : ''}`)
      title = 'Sincronizado'
      body = `${partes.join(' y ')} guardado${totalOk > 1 ? 's' : ''} en el servidor.`
      if (fallidos > 0) body += ` (${fallidos} fallaron)`
    }
    await self.registration.showNotification(title, {
      body,
      icon: '/logo-icon.svg',
      badge: '/icons/icon-192.png',
      tag: 'cf-sync-result',
      renotify: false,
      data: { url },
      silent: totalOk > 0 && fallidos === 0 && conflictos === 0,
    })
  } catch {}
}

// ─── IndexedDB helpers (SW-side, promise-based) ────────────────
function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
    // No onupgradeneeded: la app principal crea el schema.
  })
}

function idbGetAll(db, storeName) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readonly')
      const req = tx.objectStore(storeName).getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror   = () => reject(req.error)
    } catch (e) { reject(e) }
  })
}

function idbUpdate(db, storeName, key, patch) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      const req = store.get(key)
      req.onsuccess = () => {
        const rec = req.result
        if (rec) { Object.assign(rec, patch); store.put(rec) }
        tx.oncomplete = () => resolve()
      }
      req.onerror = () => reject(req.error)
    } catch (e) { reject(e) }
  })
}

async function syncMutacionesFromSW() {
  let db
  try { db = await openOfflineDB() } catch { return { synced: 0, failed: 0, conflictos: 0 } }
  const todas = await idbGetAll(db, STORE_MUTACIONES).catch(() => [])
  const pendientes = todas.filter(m => !m.synced && !m.failedPermanent && !m.conflict)
  let synced = 0, failed = 0, conflictos = 0

  for (const m of pendientes) {
    // Skip si depende de tempId (requiere mapeo que solo esta en la app)
    if (typeof m.entityId === 'string' && m.entityId.startsWith('offline-')) continue

    let url = ''
    let method = 'PATCH'
    let body = m.payload
    if (m.tipo === 'cliente.update') url = `/api/clientes/${m.entityId}`
    else if (m.tipo === 'prestamo.update') url = `/api/prestamos/${m.entityId}`
    else if (m.tipo === 'prestamo.cerrar') {
      url = `/api/prestamos/${m.entityId}`
      body = { estado: m.payload?.estado || 'completado' }
    } else if (m.tipo === 'gasto.create') {
      url = '/api/gastos'
      method = 'POST'
    } else continue

    const headers = { 'Content-Type': 'application/json', 'X-Mutation-Id': String(m.id) }
    if (m.baseUpdatedAt) headers['X-If-Unmodified-Since'] = m.baseUpdatedAt

    try {
      const res = await fetch(url, { method, headers, body: JSON.stringify(body), credentials: 'same-origin' })
      if (res.ok) {
        await idbUpdate(db, STORE_MUTACIONES, m.id, { synced: true })
        synced++
      } else if (res.status === 412) {
        let snap = null
        try { const g = await fetch(url, { credentials: 'same-origin' }); if (g.ok) snap = await g.json() } catch {}
        await idbUpdate(db, STORE_MUTACIONES, m.id, { failedPermanent: true, conflict: true, servidorSnapshot: snap, error: 'Conflicto: registro modificado en servidor' })
        conflictos++
      } else if (res.status >= 400 && res.status < 500) {
        let errorMsg = `HTTP ${res.status}`
        try { const d = await res.json(); errorMsg = d.error || errorMsg } catch {}
        await idbUpdate(db, STORE_MUTACIONES, m.id, { failedPermanent: true, error: errorMsg })
        failed++
      } else {
        await idbUpdate(db, STORE_MUTACIONES, m.id, { intentos: (m.intentos || 0) + 1 })
      }
    } catch { /* red fallo: reintento del browser */ }
  }
  return { synced, failed, conflictos }
}

async function syncPagosFromSW() {
  let db
  try { db = await openOfflineDB() } catch { return { synced: 0, failed: 0 } }
  const todos = await idbGetAll(db, STORE_PAGOS).catch(() => [])
  const pendientes = todos.filter(p => !p.synced && !p.failedPermanent)
  let synced = 0, failed = 0

  for (const p of pendientes) {
    // Skip si prestamoId es un tempId (depende de creacion no sincronizada)
    if (typeof p.prestamoId === 'string' && p.prestamoId.startsWith('offline-')) continue

    try {
      const res = await fetch(`/api/prestamos/${p.prestamoId}/pagos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          montoPagado:  p.montoPagado,
          tipo:         p.tipo,
          nota:         p.nota ? `${p.nota} [offline: ${p.createdAt}]` : `[offline: ${p.createdAt}]`,
          diasAbonados: p.diasAbonados,
          metodoPago:   p.metodoPago,
          plataforma:   p.plataforma,
        }),
      })
      if (res.ok) {
        await idbUpdate(db, STORE_PAGOS, p.id, { synced: true })
        synced++
      } else if (res.status >= 400 && res.status < 500) {
        let errorMsg = `HTTP ${res.status}`
        try { const d = await res.json(); errorMsg = d.error || errorMsg } catch {}
        await idbUpdate(db, STORE_PAGOS, p.id, { failedPermanent: true, errorMsg })
        failed++
      }
    } catch { /* reintento futuro */ }
  }
  return { synced, failed }
}

// ─── Message handling (for sync trigger from app) ───────────
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  // Limpiar cache de API al hacer logout (previene leak cross-sesión/cross-org)
  if (e.data?.type === 'CLEAR_API_CACHE') {
    e.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith('cf-api-')).map((k) => caches.delete(k)))
      )
    )
  }

  // Pre-cache pages for offline use after bulk sync
  if (e.data?.type === 'CACHE_PAGES') {
    const urls = e.data.urls || []
    e.waitUntil(
      caches.open(CACHE_NAME).then(async (cache) => {
        const chunksToCache = new Set()

        for (const url of urls) {
          try {
            const res = await fetch(url, { credentials: 'same-origin' })
            if (res.ok && !res.redirected) {
              // Parse HTML to find JS chunks needed for this page
              const clone = res.clone()
              try {
                const html = await clone.text()
                const scriptMatches = html.matchAll(/src="(\/_next\/static\/[^"]+)"/g)
                for (const m of scriptMatches) {
                  chunksToCache.add(m[1])
                }
                // Re-create response from text for caching
                await cache.put(url, new Response(html, {
                  status: res.status,
                  headers: res.headers,
                }))
              } catch {
                await cache.put(url, res)
              }
            }
          } catch {}
        }

        // Pre-cache discovered JS chunks
        for (const chunk of chunksToCache) {
          try {
            const existing = await cache.match(chunk)
            if (!existing) {
              const res = await fetch(chunk)
              if (res.ok) await cache.put(chunk, res)
            }
          } catch {}
        }
      })
    )
  }
})
