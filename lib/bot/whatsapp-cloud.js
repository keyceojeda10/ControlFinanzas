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
//
// Casos reales que estaban llegando crudos a Meta y generaban errores eternos:
//   '0000000000'   -> se enviaba tal cual -> #131009 dos veces al dia por 17 dias
//   '13001234567'  -> movil colombiano guardado con prefijo 1 (EE.UU.) -> #131026
// Ahora se corrigen los arreglables y se RECHAZA la basura (devuelve null) para
// que el llamador no queme un envio ni acumule errores permanentes.
export function toWaNumber(phone) {
  let d = (phone || '').replace(/\D/g, '')
  if (!d) return null

  // Colombia: 10 digitos empezando en 3 -> 57XXXXXXXXXX
  if (d.length === 10 && d.startsWith('3')) d = '57' + d

  // 11 digitos que empiezan en 1 seguido de movil colombiano (3XX): el '1' es un
  // codigo de pais de EE.UU. mal guardado. Corregir a 57.
  if (d.length === 11 && d.startsWith('1') && d[1] === '3') d = '57' + d.slice(1)

  // Un numero valido en E.164 tiene entre 8 y 15 digitos y no puede ser todo
  // ceros ni empezar en 0 (E.164 no admite el 0 inicial de marcacion nacional).
  if (d.length < 8 || d.length > 15) return null
  if (d.startsWith('0')) return null
  if (/^(\d)\1+$/.test(d)) return null // 0000000000, 1111111111, etc.

  return d
}

// True si el telefono se puede enviar a Meta. Usar antes de intentar un envio
// para no gastar intentos ni ensuciar la reputacion del numero con errores.
export function telefonoEnviable(phone) {
  return toWaNumber(phone) !== null
}

// Compat: algunas partes del codigo viejo llamaban toChatId. Lo dejamos como
// alias del numero E.164 (Meta no usa el sufijo @c.us).
export function toChatId(phone) {
  return toWaNumber(phone)
}

// Codigo propio para telefono invalido. Se marca como PERMANENTE (#131009) para
// que los callers que ya clasifican errores permanentes no reintenten eternamente.
export const ERROR_TELEFONO_INVALIDO = 'TELEFONO_INVALIDO'

async function postMessage(payload) {
  /* ⚠ LOS CORTES DE AQUI ARRIBA TAMBIEN SE APUNTAN.
   *
   * La primera version solo apuntaba despues de hablar con Meta, asi que un
   * telefono invalido o el sistema sin configurar seguian sin dejar rastro —
   * que es exactamente el agujero que este registro viene a tapar. Si alguien
   * pregunta «¿por que no le llego?», la respuesta tiene que estar aqui aunque
   * el mensaje no saliera nunca del servidor. */
  if (!configurado()) {
    const msg = 'WhatsApp Cloud API no configurado. Define WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID.'
    await apuntar(payload, null, msg)
    throw new Error(msg)
  }
  // Cortar aca los telefonos que no se pueden enviar: sin esto salian crudos a
  // Meta y volvian como #131009/#131026, gastando intentos y reputacion.
  if (!payload?.to) {
    const msg = `Cloud API: telefono invalido, no se envia (#131009 ${ERROR_TELEFONO_INVALIDO})`
    await apuntar(payload, null, msg)
    const err = new Error(msg)
    err.permanente = true
    err.codigo = 131009
    throw err
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
    await apuntar(payload, null, msg)
    const err = new Error(`Cloud API: ${msg}`)
    err.response = data
    err.status = res.status
    throw err
  }
  await apuntar(payload, data?.messages?.[0]?.id || null, null)
  return data
}

/* ══ LO QUE SALE, APUNTADO ═════════════════════════════════════════════════
 *
 * ⚠ NACIÓ DE NO PODER CONTESTAR «¿SE MANDÓ O NO?». El 28 de agosto quedó la
 * duda de si un envío a 36 organizaciones había salido, y no había forma de
 * saberlo desde ningún sitio: ni el panel, ni la base, ni los registros de la
 * aplicación. Hicieron falta una hora, el syslog del servidor y la analítica de
 * Meta por medias horas para concluir que NO había salido.
 *
 * Va en `postMessage` y no en `sendTemplate` porque por aquí pasa TODO —las
 * plantillas y el texto libre—, así que no hay forma de mandar algo por fuera
 * del registro.
 *
 * ⚠ NUNCA ROMPE EL ENVÍO. Si la base no responde, se traga el fallo: apuntar
 * importa, mandar importa más. Y el `import` es dinámico porque los guiones
 * sueltos del servidor corren con node a secas, donde el cliente de Prisma no
 * resuelve — sin eso dejarían de poder enviar por no poder apuntar. */
async function apuntar(payload, wamid, error) {
  try {
    const { prisma } = await import('@/lib/prisma')
    await prisma.envioWhatsapp.create({
      data: {
        telefono: String(payload?.to ?? ''),
        tipo: payload?.type === 'template' ? 'template' : 'texto',
        plantilla: payload?.template?.name ?? null,
        wamid,
        ok: !error,
        error: error ? String(error).slice(0, 2000) : null,
      },
    })
  } catch { /* apuntar no puede impedir mandar */ }
}

// Extrae el wamid (id del mensaje saliente asignado por Meta) de la respuesta
// de postMessage(). Util para guardarlo en BotConversacion.wamid y poder
// correlacionar despues los acks de entrega (value.statuses[]) del webhook.
export function wamidDe(respuesta) {
  return respuesta?.messages?.[0]?.id || null
}

// Envia texto libre. SOLO valido dentro de la ventana de 24h (tras respuesta
// del lead). Para primer contacto en frio usar sendTemplate().
// preview_url: true -> WhatsApp genera la tarjeta de previsualizacion cuando el
// mensaje contiene un link (muestra imagen/titulo del sitio).
export async function sendText(phone, text, previewUrl = true) {
  return postMessage({
    to: toWaNumber(phone),
    type: 'text',
    text: { preview_url: previewUrl, body: text },
  })
}

/* ══ BOTONES ═══════════════════════════════════════════════════════════════
 *
 * Texto con hasta TRES botones de respuesta. Como `sendText`, solo vale dentro
 * de la ventana de 24 h.
 *
 * ⚠ POR QUÉ BOTONES Y NO TEXTO. Medido sobre las conversaciones desde julio: de
 * los leads que contestan algo, **la mitad se queda en dos o tres mensajes**.
 * No hay sitio para una conversación que dé rodeos — o se resuelve en los dos
 * primeros turnos, o no se resuelve. Un botón gasta cero turnos en que la
 * persona escriba lo que quiere.
 *
 * ⚠ LOS LÍMITES DE META NO SON SUGERENCIAS. Un botón con el título de más de 20
 * caracteres, o dos con el mismo id, hacen que Meta rechace el mensaje ENTERO
 * con un 400 — no manda una versión recortada, no manda nada. Por eso aquí se
 * recorta y se valida antes de salir, en vez de confiar en quien llama.
 *
 * La respuesta llega al webhook como `interactive.button_reply.id`, que es el
 * `id` que se pone aquí. */
const MAX_BOTONES = 3
const MAX_TITULO  = 20
const MAX_CUERPO  = 1024

export async function sendButtons(phone, texto, botones = []) {
  const lista = (Array.isArray(botones) ? botones : []).slice(0, MAX_BOTONES)
  if (!lista.length) {
    /* Sin botones esto es un texto normal, y mandarlo como interactivo sería un
       400. Se degrada en vez de fallar: el mensaje importa más que el formato. */
    return sendText(phone, texto)
  }
  const vistos = new Set()
  const limpios = []
  for (const b of lista) {
    const id = String(b?.id ?? '').trim().slice(0, 256)
    const titulo = String(b?.titulo ?? b?.title ?? '').trim().slice(0, MAX_TITULO)
    if (!id || !titulo || vistos.has(id)) continue
    vistos.add(id)
    limpios.push({ type: 'reply', reply: { id, title: titulo } })
  }
  if (!limpios.length) return sendText(phone, texto)

  return postMessage({
    to: toWaNumber(phone),
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: String(texto ?? '').slice(0, MAX_CUERPO) },
      action: { buttons: limpios },
    },
  })
}

/** Lo que pulsó el lead, o `null` si escribió texto. El webhook recibe la
 *  respuesta de un botón en `interactive.button_reply`, no en `text.body`: sin
 *  leer esto, un botón pulsado llega como un mensaje vacío. */
export function botonPulsado(msg) {
  const r = msg?.interactive?.button_reply
  if (!r?.id) return null
  return { id: String(r.id), titulo: String(r.title ?? '') }
}

// Envia una plantilla aprobada. Es el unico modo permitido para INICIAR la
// conversacion (primer contacto / seguimientos fuera de la ventana de 24h).
//
// Meta soporta dos formatos de variable en el body:
//   - NOMBRADAS: {{nombre}} -> parametro { type:'text', parameter_name:'nombre', text }
//   - POSICIONALES: {{1}}   -> parametro { type:'text', text }
// Nuestras plantillas usan variables NOMBRADAS. `variables` se pasa como objeto
// { nombre: 'Carlos' }. Si se pasa un array, se usa el modo posicional (compat).
//
// Plantillas Authentication (OTP tipo COPY_CODE): Meta requiere el codigo en el
// componente 'button' (sub_type: 'url', index: 0), NO en el body. Si el nombre
// de la plantilla contiene 'otp' o 'verificacion' y variables es un array de 1
// elemento, se envia en formato Authentication automaticamente.
export async function sendTemplate(phone, templateName, variables = {}, lang = TEMPLATE_LANG_DEFAULT) {
  const components = []

  const isAuthOtp = Array.isArray(variables) && variables.length === 1 &&
    (templateName.includes('otp') || templateName.includes('verificacion'))

  if (isAuthOtp) {
    // Plantilla Authentication con boton COPY_CODE:
    // body recibe el codigo, button recibe el codigo como parametro de URL
    const codigo = String(variables[0] ?? '')
    components.push({
      type: 'body',
      parameters: [{ type: 'text', text: codigo }],
    })
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: codigo }],
    })
  } else if (Array.isArray(variables) && variables.length > 0) {
    // Modo posicional {{1}}, {{2}}, ...
    components.push({
      type: 'body',
      parameters: variables.map(v => ({ type: 'text', text: String(v ?? '') })),
    })
  } else if (variables && typeof variables === 'object' && !Array.isArray(variables)) {
    // Modo nombrado {{nombre}}, {{...}}
    const parameters = Object.entries(variables).map(([k, v]) => ({
      type: 'text',
      parameter_name: k,
      text: String(v ?? ''),
    }))
    if (parameters.length > 0) {
      components.push({ type: 'body', parameters })
    }
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

// Envia una imagen por URL publica (Meta la descarga). No requiere subirla
// antes con uploadMedia. Solo valido dentro de la ventana de 24h. Util para
// mandar las guias visuales (viven en /public/guias/...).
export async function sendImageLink(phone, link, caption) {
  const img = { link }
  if (caption) img.caption = caption
  return postMessage({
    to: toWaNumber(phone),
    type: 'image',
    image: img,
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
