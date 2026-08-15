// Service Worker — Control Finanzas PWA
const CACHE_NAME   = 'cf-v934'
// API_CACHE solo sube cuando cambian las CIFRAS que devuelve el servidor.
//
// Este release SÍ las cambia, en `/api/cobros-hoy` (Adenda 5):
//   · `pagadoPct` — cuánto lleva pagado el cliente, que es lo que pinta la
//     barra a sangre del pie de cada tarjeta.
//   · `prestamos[]` con `fechaInicio`, `totalPagado` y `totalAPagar` — el
//     plegador que abre los saldos por préstamo, identificados por su fecha.
//
// Sin subirlo, el teléfono serviría la respuesta guardada —sin esos campos— y
// las tarjetas saldrían con la barra a cero y el plegador vacío. Que es peor
// que no tenerlos: una barra en cero dice «no ha pagado nada».
//
// (Antes subió por `telefono`, `latitud` y `longitud` en ese mismo endpoint y
// por `atrasoRuta` en `/api/rutas`.)
const API_CACHE    = 'cf-api-v106'
// Cache inmutable para _next/static — NO se borra entre versiones.
// Los chunks llevan hash en el nombre, así que nunca hay stale content.
const STATIC_CACHE = 'cf-static'

// Endpoints que NUNCA deben servirse desde cache si el navegador esta online.
// Si la red falla, ahi si caemos al cache. Sin esto, microcortes en 4G hacen que
// el usuario vea siempre el mismo snapshot guardado.
const NETWORK_ONLY_WHEN_ONLINE = ['/api/dashboard/resumen']
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
  html[data-theme="light"]{--bg:#F4F4F1;--surface:#FFFFFF;--text:#15161A;--muted:#63676F;--border:rgba(20,20,28,0.08);--warn-bg:rgba(245,197,24,0.15);}
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
    <h1>Esta función no está disponible sin conexión</h1>
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
  '/api/cobros-hoy',   // pestana principal del cobrador: debe abrir sin senal
  '/api/prestamos',
  '/api/clientes',
  '/api/rutas',
  '/api/cobradores',
  '/api/caja',
  '/api/gastos',
  '/api/capital/movimientos',
  '/api/reportes/resumen',
  '/api/reportes/ingresos',
  '/api/reportes/cartera',
  '/api/reportes/cobradores',
  '/api/grupos',
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

// ─── Activate: limpiar las cachés viejas ───────────────────────────
//
// ⚠ STATIC_CACHE SOBREVIVE, que es lo único que la hace útil. Antes se borraba
// en cada despliegue «porque los chunk IDs pueden repetirse entre builds con
// contenido diferente»: se comprobó con dos compilaciones distintas y de los 389
// nombres comunes los 389 traían contenido idéntico. El nombre lleva la huella
// del contenido; la misma URL no puede significar dos cosas.
//
// Borrarla tenía un coste que se pagaba entero: tras cada release, todos los
// usuarios se bajaban otra vez el código de la app desde Boston. Y de regalo,
// conservarla evita el `ChunkLoadError` del cambio de versión —el de quien tiene
// la pantalla abierta y pide un archivo que el servidor ya reemplazó—, porque
// ahora ese archivo sigue en su teléfono.
//
// Lo que sí se borra en cada versión es CACHE_NAME (las páginas) y, cuando
// cambian las cifras, API_CACHE. Ahí es donde el contenido viejo miente.
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== API_CACHE && k !== STATIC_CACHE && k !== AJUSTES_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => podarCache(STATIC_CACHE))
      .then(() => self.clients.matchAll()).then((clients) => {
      clients.forEach((c) => c.postMessage({ type: 'SW_UPDATED' }))
    })
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

  // /api/auth/session — cachear para que useSession() resuelva offline
  // Sin esto, NextAuth queda en status:'loading' y toda la app muestra skeleton
  if (url.pathname === '/api/auth/session') {
    e.respondWith(networkFirstAPI(request))
    return
  }

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

  // ── EL CÓDIGO DE LA APP: DE LA CACHÉ, SIN PREGUNTAR A LA RED ────────────
  //
  // Iba a la red SIEMPRE, y encima `networkFirst` no guarda nada: la caché de
  // los chunks estaba viva en el nombre y muerta en los hechos. Con el servidor
  // en Boston, cada cambio de sección pagaba viajes de ~90 ms para traer
  // archivos que no pueden cambiar. Y sin señal la app no podía ni cargar su
  // propio código.
  //
  // El comentario que había aquí decía que caché primero servía chunks viejos
  // «porque los chunk IDs de Next.js pueden repetirse entre builds con contenido
  // diferente». Se comprobó con dos compilaciones distintas del proyecto: de los
  // 389 nombres presentes en las dos, los 389 traían contenido IDÉNTICO, y los
  // archivos que cambiaron estrenaron nombre. El hash del nombre ES el del
  // contenido, así que la misma URL no puede significar dos cosas.
  //
  // El fallo real era otro y está arreglado en `cacheFirst`: se buscaba en TODAS
  // las cachés, huérfanas incluidas, en vez de en la que toca.
  if (url.pathname.startsWith('/_next/static')) {
    e.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // Page navigations: network-first, fallback to cache.
  // Con el modo rápido encendido (solo quien lo activa en su propio teléfono),
  // el armazón sale de la caché y se refresca por detrás. Las cifras no: cada
  // sección las sigue pidiendo al API, y el API sigue yendo a la red primero.
  if (request.mode === 'navigate') {
    e.respondWith(
      modoRapidoActivo().then((rapido) =>
        rapido ? armazonGuardadoYRefresca(request) : networkFirstPage(request))
    )
    return
  }

  // Everything else: network with cache fallback
  e.respondWith(networkFirst(request))
})

// ─── Strategies ─────────────────────────────────────────────

async function networkFirstAPI(request) {
  const url = new URL(request.url)
  const isNetworkOnly = NETWORK_ONLY_WHEN_ONLINE.some((p) => url.pathname.startsWith(p))

  try {
    const response = await fetch(request)
    // Only cache successful, non-redirected responses
    if (response.ok && !response.redirected) {
      const cache = await caches.open(API_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    // Para endpoints "network-only" (dashboard), si el navegador esta online
    // pero el fetch fallo (microcorte 4G), NO devolver cache: devolver error
    // explicito para que el cliente sepa que no hay datos frescos.
    if (isNetworkOnly && self.navigator && self.navigator.onLine) {
      return new Response(JSON.stringify({ error: 'Red inestable', offline: true }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }
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

/**
 * ── MODO RÁPIDO (apagado para todo el mundo) ──────────────────────────────
 *
 * Sirve el ARMAZÓN de la pantalla desde el teléfono y lo refresca por detrás,
 * en vez de esperar el viaje a Boston (~90 ms de ida y vuelta, más el resto).
 *
 * ⚠ ARMAZÓN, NO CIFRAS. Las seis secciones son componentes de cliente que piden
 * sus números al API por separado —dashboard 8 llamadas, caja 12—, así que la
 * página guardada no lleva plata dentro: lleva el marco, y las cifras siguen
 * yendo a la red como siempre. Ni una sola ruta de `/api/` cambia aquí.
 *
 * Está detrás de un interruptor porque el dueño no puede juzgarlo en el espejo
 * —sus palabras: «el espejo te sirve es a ti»— y necesita sentirlo en la app de
 * verdad, con su cartera, sin exponer a nadie más. Se enciende por dispositivo
 * con `?rapido=1` y se apaga con `?rapido=0`.
 */
const AJUSTES_CACHE = 'cf-ajustes'
const CLAVE_MODO_RAPIDO = '/__modo-rapido'
let modoRapido = null // null = todavía no se ha leído

async function modoRapidoActivo() {
  if (modoRapido !== null) return modoRapido
  try {
    const cache = await caches.open(AJUSTES_CACHE)
    modoRapido = !!(await cache.match(CLAVE_MODO_RAPIDO))
  } catch {
    modoRapido = false
  }
  return modoRapido
}

/**
 * Del teléfono ya, y se refresca por detrás para la próxima vez.
 *
 * Si no hay nada guardado se comporta igual que antes: espera a la red. Así el
 * primer acceso a cada pantalla nunca puede enseñar algo que no existe.
 */
async function armazonGuardadoYRefresca(request) {
  const cache = await caches.open(CACHE_NAME)
  const guardado = await cache.match(request)

  const refresco = fetch(request)
    .then((response) => {
      if (response.ok && !response.redirected) cache.put(request, response.clone())
      return response
    })
    .catch(() => null)

  if (guardado) {
    // No se espera al refresco: se deja corriendo para la próxima navegación.
    return guardado
  }
  return (await refresco) ?? networkFirstPage(request)
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

/**
 * Caché primero, MIRANDO UNA SOLA CACHÉ.
 *
 * ⚠ Antes usaba `caches.match(request)`, que busca en TODAS las cachés del
 * origen —incluidas las huérfanas de versiones viejas—. Eso sí podía devolver
 * algo que ya no correspondía, y por ese susto se apagó la caché de los chunks
 * entera. La causa no era «caché primero»: era buscar en todos lados. Abriendo
 * la caché por su nombre, lo que no está ahí no existe.
 */
async function cacheFirst(request, nombreCache = STATIC_CACHE) {
  const cache = await caches.open(nombreCache)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
      podarCache(nombreCache)
    }
    return response
  } catch {
    return new Response('', { status: 503 })
  }
}

/**
 * La caché de los chunks sobrevive a los despliegues, así que sin podarla
 * crecería para siempre: cada versión deja los suyos. Como el nombre de cada
 * archivo lleva su propia huella, los viejos no molestan —simplemente ya nadie
 * los pide—, y se van por antigüedad. `cache.keys()` devuelve en orden de
 * inserción, así que el primero de la lista es el más antiguo.
 *
 * El tope está muy por encima de lo que un usuario carga de una versión (una
 * compilación entera son ~390 archivos y nadie visita todas las pantallas), y
 * la poda corre en segundo plano: no se espera.
 */
const TOPE_ARCHIVOS_EN_CACHE = 500
let podando = false
async function podarCache(nombreCache) {
  if (podando) return
  podando = true
  try {
    const cache = await caches.open(nombreCache)
    const claves = await cache.keys()
    const sobran = claves.length - TOPE_ARCHIVOS_EN_CACHE
    if (sobran > 0) await Promise.all(claves.slice(0, sobran).map((k) => cache.delete(k)))
  } catch {
    // Podar es mantenimiento: si falla, se sirve igual.
  } finally {
    podando = false
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

  // El interruptor del modo rápido. Se guarda en su propia cache —que sobrevive
  // a los despliegues— porque el service worker se duerme y se despierta solo:
  // una variable en memoria se perderia y el ajuste se apagaria sin avisar.
  if (e.data?.type === 'MODO_RAPIDO') {
    const activo = !!e.data.activo
    modoRapido = activo
    e.waitUntil(caches.open(AJUSTES_CACHE).then((cache) =>
      activo
        ? cache.put(CLAVE_MODO_RAPIDO, new Response('1'))
        : cache.delete(CLAVE_MODO_RAPIDO)
    ))
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
