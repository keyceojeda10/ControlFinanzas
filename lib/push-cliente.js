// lib/push-cliente.js — encender y apagar los avisos de ESTE teléfono.
//
// Vivía copiado dentro de la pantalla de Configuración (y otra vez en un
// `NotificationsCenter` que ya nadie monta). Ahora lo usan dos sitios —la
// campana, que lo ofrece cuando hay algo que avisar, y Configuración— y dos
// copias de esto acaban suscribiendo distinto.
//
// Solo navegador. Ninguna función lanza: devuelven el estado en que quedó.

import { estaEnSoloLectura } from '@/lib/modo-vista'

/** 'sin-soporte' | 'bloqueado' | 'encendido' | 'apagado' */
export async function estadoPush() {
  if (typeof window === 'undefined') return 'sin-soporte'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'sin-soporte'
  if (Notification.permission === 'denied') return 'bloqueado'
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    return sub ? 'encendido' : 'apagado'
  } catch { return 'apagado' }
}

function claveVapid() {
  const clave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!clave) return null
  const relleno = '='.repeat((4 - (clave.length % 4)) % 4)
  const crudo = atob((clave + relleno).replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(crudo.length)
  for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i)
  return bytes
}

// En «ver como», este teléfono no se suscribe a los avisos del cobrador.
export async function activarPush() {
  if (estaEnSoloLectura()) return 'apagado'
  try {
    if ((await estadoPush()) === 'sin-soporte') return 'sin-soporte'
    const permiso = await Notification.requestPermission()
    if (permiso !== 'granted') return permiso === 'denied' ? 'bloqueado' : 'apagado'
    const clave = claveVapid()
    if (!clave) return 'apagado'
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: clave })
    const { endpoint, keys } = sub.toJSON()
    const res = await fetch('/api/push/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, keys }),
    })
    return res.ok ? 'encendido' : 'apagado'
  } catch (e) {
    console.error('[push]', e?.message)
    return estadoPush()
  }
}

export async function desactivarPush() {
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await fetch('/api/push/unsubscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {})
      await sub.unsubscribe()
    }
    return 'apagado'
  } catch { return estadoPush() }
}
