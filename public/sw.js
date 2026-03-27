// Service Worker — Control Finanzas PWA
const CACHE_NAME = 'cf-v5'
const API_CACHE  = 'cf-api-v5'

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
]

// ─── Install: precache app shell ────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch(() => {
        // Some pages may fail to cache during install (auth redirect), that's ok
        console.log('[SW] Some precache URLs failed, continuing...')
      })
    )
  )
  self.skipWaiting()
})

// ─── Activate: clean old caches ─────────────────────────────
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

  // Skip auth-related and offline sync requests (never cache)
  if (url.pathname.startsWith('/api/auth')) return
  if (url.pathname.startsWith('/api/offline')) return

  // Skip _next/data requests that may redirect
  if (url.pathname.startsWith('/_next/data')) return

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
    return new Response('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><div style="text-align:center"><h2>Sin conexion</h2><p>Revisa tu conexion a internet</p><p style="color:#f5c518;font-size:13px;margin-top:16px">Usa el boton &quot;Preparar offline&quot; en el Dashboard antes de salir</p></div></body></html>', {
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

// ─── Message handling (for sync trigger from app) ───────────
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  // Pre-cache pages for offline use after bulk sync
  if (e.data?.type === 'CACHE_PAGES') {
    const urls = e.data.urls || []
    e.waitUntil(
      caches.open(CACHE_NAME).then(async (cache) => {
        for (const url of urls) {
          try {
            const res = await fetch(url, { credentials: 'same-origin' })
            if (res.ok && !res.redirected) {
              await cache.put(url, res)
            }
          } catch {}
        }
      })
    )
  }
})
