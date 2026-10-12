/* ── ¿QUÉ PLANTILLAS ESTÁN APROBADAS? ────────────────────────────────────────
 *
 * El motor solo manda una plantilla que Meta ya aprobó. Mientras está en
 * revisión, el paso NO se apunta como enviado y sale en la primera vuelta del
 * cron después de la aprobación. Se pregunta a Meta y se guarda 30 minutos.
 *
 * Sin la clave de WhatsApp (el espejo) responde vacío: el motor no manda nada
 * por WhatsApp. Ver la memoria «el espejo no habla con nadie».
 *
 * También dice la CATEGORÍA que Meta les dio, que puede no ser la pedida: si
 * reclasifica una utility a marketing se ve aquí y no se insiste. */

const G = 'https://graph.facebook.com/v21.0'
const VIDA_MS = 30 * 60 * 1000
let cache = { hasta: 0, porNombre: new Map() }

export async function estadoPlantillas({ forzar = false } = {}) {
  const waba = process.env.WHATSAPP_WABA_ID || process.env.WABA_ID
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  if (!waba || !token) return new Map()
  if (!forzar && Date.now() < cache.hasta) return cache.porNombre
  try {
    const r = await fetch(`${G}/${waba}/message_templates?fields=name,status,category&limit=200&access_token=${token}`, {
      signal: AbortSignal.timeout(15000),
    })
    const j = await r.json()
    if (!r.ok || !Array.isArray(j.data)) throw new Error(j?.error?.message || `HTTP ${r.status}`)
    cache = { hasta: Date.now() + VIDA_MS, porNombre: new Map(j.data.map((t) => [t.name, { estado: t.status, categoria: t.category }])) }
  } catch (e) {
    console.error('[seguimiento] no pude leer las plantillas de Meta:', e.message)
    // Con el último dato bueno, si lo hay; si no, nada aprobado.
  }
  return cache.porNombre
}

export async function plantillaAprobada(nombre) {
  return (await estadoPlantillas()).get(nombre)?.estado === 'APPROVED'
}
