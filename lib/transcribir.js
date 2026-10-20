// lib/transcribir.js — pasar un audio a texto, en un solo sitio.
//
// La llamada a Groq vivía dentro de `app/api/voz/transcribir/route.js`, que es
// el endpoint que usa el asistente. Cuando la campaña de sugerencias necesitó lo
// mismo, la opción era copiar quince líneas —incluido el manejo de la clave— o
// sacarlas aquí. Copiadas, el día que cambie el modelo o el proveedor habría que
// acordarse de los dos sitios, y uno de los dos se quedaría atrás.
//
// Whisper en español y no autodetectado: la app es de Colombia y forzar el
// idioma evita que una nota corta con ruido salga transcrita en portugués.

const MODELO = 'whisper-large-v3-turbo'

/* Groq acepta hasta 896 en la pista, contados como bytes (una tilde o una ñ
   son dos). Se deja margen. */
export const TOPE_PROMPT_BYTES = 850
export function recortarBytes(texto, tope) {
  const enc = new TextEncoder()
  if (enc.encode(texto).length <= tope) return texto
  let out = ''
  for (const ch of texto) {
    if (enc.encode(out + ch).length > tope) break
    out += ch
  }
  return out
}

/**
 * Devuelve `{ texto }` o `{ error }`. Nunca lanza: quien llama decide si un
 * fallo de transcripción tumba la petición entera o solo deja el audio sin
 * texto. En las sugerencias es lo segundo — perder la nota de voz de alguien
 * porque Groq tuvo un mal minuto sería lo peor que puede pasar aquí.
 */
/* `prompt`: palabras que el audio probablemente trae y que Whisper debe
 * escribir TAL CUAL. Sin esto escribe los nombres de aquí a la inglesa: dijeron
 * «Jeison Valencia» y transcribió «Jason Valencia» (prueba con voz real, 14 oct
 * 2026), y lo mismo pasa con Brayan, Maicol, Estiven o Yeferson. */
export async function transcribirAudio(audio, { nombre = 'audio.webm', prompt = null } = {}) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return { error: 'Servicio de voz no configurado' }
  if (!audio) return { error: 'Falta el audio' }

  const form = new FormData()
  form.append('file', audio, nombre)
  form.append('model', MODELO)
  form.append('language', 'es')
  form.append('response_format', 'json')
  if (prompt) form.append('prompt', recortarBytes(String(prompt), TOPE_PROMPT_BYTES))

  try {
    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })
    if (!res.ok) {
      console.error('[transcribir] Groq:', await res.text())
      /* ⚠ LA PISTA ES UNA AYUDA, NO UNA CONDICIÓN. Si Groq la rechaza (era
         demasiado larga: 897 de 896), se transcribe otra vez sin ella. Antes se
         perdía el audio entero y la búsqueda decía «No te escuché». */
      if (prompt) return transcribirAudio(audio, { nombre })
      return { error: 'Error al transcribir' }
    }
    const data = await res.json()
    return { texto: data.text?.trim() ?? '' }
  } catch (e) {
    console.error('[transcribir] red:', e)
    return { error: 'Error de red con Groq' }
  }
}
