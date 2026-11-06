// lib/tarjeta/pedir-enlace.js — EL ENLACE DE LA TARJETA, DESDE LA PANTALLA DE COBRAR.
//
// El servidor decide si hay enlace (`url: null` si el dueño no manda la tarjeta).
// ⚠ NUNCA DETIENE UN RECIBO: si no llega en 2,5 s, sin señal o con error, el recibo
// sale sin enlace. Sin señal es además lo correcto: el pago aún no está en el
// servidor, y el cliente abriría una tarjeta sin su pago y reclamaría sin razón.

import { useEffect, useState } from 'react'

/** Lo máximo que el recibo espera por el enlace. */
const ESPERA_MS = 2500
/** Lo que se deja correr el pedido. Sigue aunque el recibo ya no espere: el siguiente lo tendrá. */
const ESPERA_PEDIDO_MS = 8000
/* Cuánto se recuerda un enlace ya recibido. ⚠ Sin esto, pedirlo de antemano no servía
   de nada: el recibo lo volvía a pedir al confirmar y, con la red lenta de la calle,
   se pasaba de la espera y salía sin enlace. Si el dueño apaga la tarjeta, el enlace
   deja de abrir en el servidor igual. */
const RECORDAR_MS = 5 * 60 * 1000
const pedidos = new Map()
const recibidos = new Map()

function pedir(clienteId) {
  if (pedidos.has(clienteId)) return pedidos.get(clienteId)
  const control = new AbortController()
  const reloj = setTimeout(() => control.abort(), ESPERA_PEDIDO_MS)
  const pedido = fetch(`/api/tarjeta/enlace/${encodeURIComponent(clienteId)}`, { signal: control.signal, cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const url = d?.url ?? null
      // Solo el que llegó: un fallo o un «no hay» no se queda guardado.
      if (url) recibidos.set(clienteId, { url, en: Date.now() })
      return url
    })
    .catch(() => null)
    .finally(() => {
      clearTimeout(reloj)
      pedidos.delete(clienteId)
    })
  pedidos.set(clienteId, pedido)
  return pedido
}

export function pedirEnlaceTarjeta(clienteId, { espera = ESPERA_MS } = {}) {
  if (!clienteId) return Promise.resolve(null)
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve(null)
  const guardado = recibidos.get(clienteId)
  if (guardado && Date.now() - guardado.en < RECORDAR_MS) return Promise.resolve(guardado.url)
  return new Promise((resolver) => {
    const reloj = setTimeout(() => resolver(null), espera)
    pedir(clienteId).then((url) => { clearTimeout(reloj); resolver(url) })
  })
}

/** Un pago que aún no está en el servidor no lleva enlace. */
export const pagoLlevaEnlace = (pago) => Boolean(pago) && !pago.offline

/** El enlace, pedido de antemano para tenerlo cuando se toque el botón. */
export function useEnlaceTarjeta(clienteId, activo = true) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!activo || !clienteId) { setUrl(null); return undefined }
    let vivo = true
    // Sin afán: aquí nadie está esperando, y es lo que deja el enlace listo para el recibo.
    pedirEnlaceTarjeta(clienteId, { espera: ESPERA_PEDIDO_MS }).then((u) => { if (vivo) setUrl(u) })
    return () => { vivo = false }
  }, [clienteId, activo])
  return url
}
