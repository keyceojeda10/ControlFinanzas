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
    icon: payload.icon || '/logo-icon.svg',
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
