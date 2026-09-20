// lib/push.js — Web Push Notification helper
import webpush from 'web-push'
import { prisma } from '@/lib/prisma'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:soporte@control-finanzas.com'

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE)
}

/**
 * Envía push notification a un usuario específico
 * @param {string} userId - ID del usuario destino
 * @param {object} payload - { title, body, url, icon }
 */
export async function enviarPush(userId, payload) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  })

  const notification = JSON.stringify({
    title: payload.title || 'Control Finanzas',
    body: payload.body,
    url: payload.url || '/dashboard',
    /* ⚠ PNG, NO EL SVG: Chrome en Android no pinta un SVG en una notificación
       y deja el hueco. El `badge` —la silueta de la barra de estado— lo pone el
       service worker, que es quien conoce las rutas que tiene cacheadas. */
    icon: payload.icon || '/icons/icon-192.png',
    // Con `tag`, dos avisos del mismo asunto se reemplazan en el teléfono en
    // vez de apilarse. Lo pone `lib/notificar.js`.
    ...(payload.tag ? { tag: payload.tag } : {}),
  })

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          notification
        )
      } catch (err) {
        // 410 Gone or 404 = subscription expired, remove it
        if (err.statusCode === 410 || err.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
        } else {
          // Un fallo que NO es «ese dispositivo ya no existe» se quedaba mudo:
          // `allSettled` se lo tragaba y nadie sabía que los avisos no salían.
          console.error('[push]', err?.statusCode ?? '?', String(err?.body || err?.message || '').slice(0, 160))
        }
        throw err
      }
    })
  )

  return results
}

/**
 * Envía push a todos los owners de una organización
 */
export async function enviarPushOrg(organizationId, payload) {
  const owners = await prisma.user.findMany({
    where: { organizationId, rol: 'owner' },
    select: { id: true },
  })

  await Promise.allSettled(
    owners.map((owner) => enviarPush(owner.id, payload))
  )
}
