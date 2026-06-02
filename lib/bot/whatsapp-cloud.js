// lib/bot/whatsapp-cloud.js — Cliente para la WhatsApp Cloud API oficial de Meta
//
// Reemplaza a lib/bot/openwa-client.js. Mantiene las mismas firmas publicas
// (sendText, configurado, resolverTelefono, tieneWhatsApp) para minimizar
// cambios aguas arriba, y agrega lo propio de la API oficial:
//   - sendTemplate(): unico modo permitido para PRIMER contacto en frio
//     (fuera de la ventana de 24h Meta solo deja enviar plantillas aprobadas).
//   - downloadMedia(): para notas de voz / imagenes (Meta entrega media_id).
//   - healthCheck(): estado del numero/token (reemplaza al getSessionStatus/QR
//     de OpenWA — la Cloud API no tiene sesion ni QR).
//
// Env vars (en .env del VPS):
//   WHATSAPP_ACCESS_TOKEN     token permanente del System User
//   WHATSAPP_PHONE_NUMBER_ID  id del numero del bot comercial
//   WHATSAPP_WABA_ID          (opcional) id de la cuenta de WhatsApp Business
//   WHATSAPP_GRAPH_VERSION    (opcional) version del Graph API, default v21.0

const GRAPH = 'https://graph.facebook.com'
const VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v21.0'
const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || ''
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || ''
const TEMPLATE_LANG_DEFAULT = process.env.WHATSAPP_TEMPLATE_LANG || 'es'

function headers() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  }
}

export function configurado() {
  return Boolean(TOKEN && PHONE_NUMBER_ID)
}

// Normaliza un telefono a E.164 sin '+' (lo que espera Meta en el campo `to`).
// Numeros colombianos: 10 digitos que empiezan en 3 -> anteponer 57.
export function toWaNumber(phone) {
  let d = (phone || '').replace(/\D/g, '')
  if (d.length === 10 && d.startsWith('3')) d = '57' + d
  return d
}

// Compat: algunas partes del codigo viejo llamaban toChatId. Lo dejamos como
// alias del numero E.164 (Meta no usa el sufijo @c.us).
export function toChatId(phone) {
  return toWaNumber(phone)
}

async function postMessage(payload) {
  if (!configurado()) {
    throw new Error('WhatsApp Cloud API no configurado. Define WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID.')
  }
  const res = await fetch(`${GRAPH}/${VERSION}/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
    signal: AbortSignal.timeout(20000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`
    const err = new Error(`Cloud API: ${msg}`)
    err.response = data
    err.status = res.status
    throw err
  }
  return data
}

// Envia texto libre. SOLO valido dentro de la ventana de 24h (tras respuesta
// del lead). Para primer contacto en frio usar sendTemplate().
// preview_url: true -> WhatsApp genera la tarjeta de previsualizacion cuando el
// mensaje contiene un link (muestra imagen/titulo del sitio).
export async function sendText(phone, text) {
  return postMessage({
    to: toWaNumber(phone),
    type: 'text',
    text: { preview_url: true, body: text },
  })
}

// Envia una plantilla aprobada. Es el unico modo permitido para INICIAR la
// conversacion (primer contacto / seguimientos fuera de la ventana de 24h).
//
// Meta soporta dos formatos de variable en el body:
//   - NOMBRADAS: {{nombre}} -> parametro { type:'text', parameter_name:'nombre', text }
//   - POSICIONALES: {{1}}   -> parametro { type:'text', text }
// Nuestras plantillas usan variables NOMBRADAS. `variables` se pasa como objeto
// { nombre: 'Carlos' }. Si se pasa un array, se usa el modo posicional (compat).
export async function sendTemplate(phone, templateName, variables = {}, lang = TEMPLATE_LANG_DEFAULT) {
  const components = []
  let parameters = []

  if (Array.isArray(variables)) {
    // Modo posicional {{1}}, {{2}}, ...
    parameters = variables.map(v => ({ type: 'text', text: String(v ?? '') }))
  } else if (variables && typeof variables === 'object') {
    // Modo nombrado {{nombre}}, {{...}}
    parameters = Object.entries(variables).map(([k, v]) => ({
      type: 'text',
      parameter_name: k,
      text: String(v ?? ''),
    }))
  }

  if (parameters.length > 0) {
    components.push({ type: 'body', parameters })
  }

  return postMessage({
    to: toWaNumber(phone),
    type: 'template',
    template: {
      name: templateName,
      language: { code: lang },
      ...(components.length ? { components } : {}),
    },
  })
}

// Sube un archivo a Meta y devuelve su media_id (vive 90 dias). Necesario para
// que el admin pueda enviar imagenes/audios/documentos desde el panel.
export async function uploadMedia(buffer, mimetype) {
  if (!configurado()) {
    throw new Error('WhatsApp Cloud API no configurado.')
  }
  const form = new FormData()
  form.append('messaging_product', 'whatsapp')
  form.append('type', mimetype)
  form.append('file', new Blob([buffer], { type: mimetype }), 'archivo')

  const res = await fetch(`${GRAPH}/${VERSION}/${PHONE_NUMBER_ID}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` }, // sin Content-Type: lo pone FormData
    body: form,
    signal: AbortSignal.timeout(30000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.id) {
    const msg = data?.error?.message || `HTTP ${res.status}`
    const err = new Error(`Cloud API uploadMedia: ${msg}`)
    err.response = data
    throw err
  }
  return data.id
}

// Envia un media ya subido (por media_id) al lead. tipo: image|audio|document.
// Solo valido dentro de la ventana de 24h (igual que sendText).
export async function sendMedia(phone, mediaId, tipo, caption) {
  const obj = { id: mediaId }
  if (caption && (tipo === 'image' || tipo === 'document')) obj.caption = caption
  return postMessage({
    to: toWaNumber(phone),
    type: tipo,
    [tipo]: obj,
  })
}

// Resuelve el numero real desde el payload de Meta. En la Cloud API el campo
// `from` del webhook YA viene como E.164 plano (sin @c.us), asi que basta con
// limpiar a digitos. Se mantiene la firma por compatibilidad con el webhook.
export async function resolverTelefono(fromRaw) {
  if (!fromRaw) return ''
  return String(fromRaw).replace(/\D/g, '')
}

// La Cloud API no expone un "check de contacto" fiable. Devolvemos null para
// NO bloquear el envio; si el numero no tiene WhatsApp, el envio de la
// plantilla fallara con un error explicito que se registra en quien llama.
export async function tieneWhatsApp(_phone) {
  return null
}

// Descarga un archivo multimedia (nota de voz / imagen) a partir del media_id
// que envia Meta en el webhook. Devuelve { base64, mimetype } o null.
export async function downloadMedia(mediaId) {
  if (!configurado() || !mediaId) return null
  try {
    // 1) obtener la URL temporal del media
    const metaRes = await fetch(`${GRAPH}/${VERSION}/${mediaId}`, {
      headers: headers(),
      signal: AbortSignal.timeout(15000),
    })
    const meta = await metaRes.json().catch(() => ({}))
    if (!metaRes.ok || !meta.url) return null

    // 2) descargar el binario (requiere el mismo Bearer token)
    const binRes = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      signal: AbortSignal.timeout(20000),
    })
    if (!binRes.ok) return null
    const buf = Buffer.from(await binRes.arrayBuffer())
    return { base64: buf.toString('base64'), mimetype: meta.mime_type || 'application/octet-stream' }
  } catch (e) {
    console.error('[WA Cloud] downloadMedia error:', e.message)
    return null
  }
}

// Marca un mensaje entrante como leido (doble check azul). Opcional, mejora la
// percepcion del lead. No critico: si falla, se ignora.
export async function markRead(messageId) {
  if (!configurado() || !messageId) return
  try {
    await postMessage({ status: 'read', message_id: messageId })
  } catch {
    /* no critico */
  }
}

// Chequeo de salud del numero/token. Reemplaza a getSessionStatus de OpenWA.
// Devuelve { configurado, ok, status, phone?, raw? } sin lanzar excepcion.
export async function healthCheck() {
  if (!configurado()) {
    return { configurado: false, ok: false, status: 'no_configurado' }
  }
  try {
    const fields = 'display_phone_number,verified_name,quality_rating,messaging_limit_tier'
    const res = await fetch(
      `${GRAPH}/${VERSION}/${PHONE_NUMBER_ID}?fields=${fields}`,
      { headers: headers(), signal: AbortSignal.timeout(10000) }
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        configurado: true,
        ok: false,
        status: data?.error?.message || `HTTP ${res.status}`,
      }
    }
    return {
      configurado: true,
      ok: true,
      status: 'conectado',
      phone: data.display_phone_number || null,
      verifiedName: data.verified_name || null,
      qualityRating: data.quality_rating || null,
      tier: data.messaging_limit_tier || null,
      raw: data,
    }
  } catch (e) {
    return { configurado: true, ok: false, status: 'error', error: e.message }
  }
}
