// lib/bot/guias-sender.js — Envia una guia visual (varias imagenes en orden)
// a un lead por la WhatsApp Cloud API.
//
// Se llama desde el webhook cuando la decision del agente trae `enviarGuia`.
// Manda las imagenes con un pequeno delay entre cada una para que lleguen en
// orden (Meta no garantiza orden si se disparan a la vez).

import * as wa from './whatsapp-cloud'
import { getGuia, urlsDeGuia } from './guias-catalogo'

const DELAY_MS = 1200

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Envia las imagenes de la guia `slug` al telefono. Devuelve
// { ok, slug, enviadas, total, wamids } o { ok:false, error } si el slug no existe.
// La primera imagen lleva un caption con el titulo + "Paso 1 de N".
export async function enviarGuia(phone, slug) {
  const guia = getGuia(slug)
  if (!guia) return { ok: false, error: `Guia desconocida: ${slug}` }

  const urls = urlsDeGuia(slug)
  if (!urls.length) return { ok: false, error: `Guia sin imagenes: ${slug}` }

  const wamids = []
  let enviadas = 0
  for (let i = 0; i < urls.length; i++) {
    const caption = `${guia.titulo} — Paso ${i + 1} de ${urls.length}`
    try {
      const r = await wa.sendImageLink(phone, urls[i], caption)
      wamids.push(wa.wamidDe(r))
      enviadas++
    } catch (e) {
      console.error(`[Guias] Error enviando ${slug} paso ${i + 1}:`, e.message)
      // seguimos con los demas pasos; mejor mandar parcial que nada
    }
    if (i < urls.length - 1) await sleep(DELAY_MS)
  }

  return { ok: enviadas > 0, slug, enviadas, total: urls.length, wamids }
}
