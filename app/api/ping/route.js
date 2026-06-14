// Endpoint ultraliviano para verificar conectividad real a internet.
// NO toca DB ni auth — solo confirma que la red llega al servidor.
// Usado por useOnline/OfflineProvider para detectar el "limbo" (interfaz
// conectada pero sin paso real a internet), que navigator.onLine no detecta.
export const dynamic = 'force-dynamic'

export function GET() {
  return new Response('pong', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}

export function HEAD() {
  return new Response(null, {
    status: 200,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  })
}
