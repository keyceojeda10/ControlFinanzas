// POST /api/push/probar — «mándame una de prueba», y la VERDAD de lo que pasó.
//
// El dueño, 20 sep 2026: «me dice que me llegan las notificaciones… pero
// realmente no llega nada en el teléfono». Tenía dos suscripciones guardadas desde
// mayo y `enviarPush` se tragaba los fallos: no había forma de saber —ni él ni
// yo— si el envío salía, si Apple lo rechazaba o si ese teléfono nunca se
// suscribió. Esto manda una a quien lo pide y cuenta, dispositivo por
// dispositivo, qué contestó el servicio.
import { getServerSession } from 'next-auth'
import webpush from 'web-push'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const SERVICIO = (endpoint) => {
  if (/web\.push\.apple\.com/.test(endpoint)) return 'iPhone o Mac'
  if (/fcm\.googleapis\.com/.test(endpoint)) return 'Android o Chrome'
  if (/notify\.windows\.com/.test(endpoint)) return 'Windows'
  if (/mozilla\.com/.test(endpoint)) return 'Firefox'
  return 'Otro'
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, privada = process.env.VAPID_PRIVATE_KEY
  if (!publica || !privada) return Response.json({ error: 'El servidor no tiene las claves de notificaciones' }, { status: 503 })
  webpush.setVapidDetails(process.env.VAPID_EMAIL || 'mailto:soporte@control-finanzas.com', publica, privada)

  // `esteEndpoint`: el de ESTE navegador, para decirle si la de prueba le llegó a él.
  const { esteEndpoint = null } = await request.json().catch(() => ({}))
  const subs = await prisma.pushSubscription.findMany({ where: { userId: session.user.id } })

  const carga = JSON.stringify({
    title: 'Notificación de prueba',
    body: 'Si estás leyendo esto en la pantalla de tu teléfono, las notificaciones funcionan.',
    url: '/configuracion?seccion=avisos', tag: 'prueba',  // el icono lo pone lib/push.js: PNG, no SVG
  })

  const dispositivos = await Promise.all(subs.map(async (sub) => {
    const base = { servicio: SERVICIO(sub.endpoint), desde: sub.createdAt, esEste: !!esteEndpoint && sub.endpoint === esteEndpoint }
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, carga)
      return { ...base, ok: true }
    } catch (err) {
      const codigo = err?.statusCode ?? null
      // 404/410: el dispositivo ya no existe (app borrada, permiso quitado). Se limpia.
      if (codigo === 404 || codigo === 410) await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
      console.error('[push/probar]', base.servicio, codigo, String(err?.body || err?.message || '').slice(0, 160))
      return { ...base, ok: false, codigo, caducada: codigo === 404 || codigo === 410 }
    }
  }))

  return Response.json({
    dispositivos,
    llegaron: dispositivos.filter((d) => d.ok).length,
    esteRecibe: dispositivos.some((d) => d.esEste && d.ok),
  })
}
