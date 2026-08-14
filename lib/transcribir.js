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

/**
 * Devuelve `{ texto }` o `{ error }`. Nunca lanza: quien llama decide si un
 * fallo de transcripción tumba la petición entera o solo deja el audio sin
 * texto. En las sugerencias es lo segundo — perder la nota de voz de alguien
 * porque Groq tuvo un mal minuto sería lo peor que puede pasar aquí.
 */
export async function transcribirAudio(audio, { nombre = 'audio.webm' } = {}) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return { error: 'Servicio de voz no configurado' }
  if (!audio) return { error: 'Falta el audio' }

  const form = new FormData()
  form.append('file', audio, nombre)
  form.append('model', MODELO)
  form.append('language', 'es')
  form.append('response_format', 'json')

  try {
    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })
    if (!res.ok) {
      console.error('[transcribir] Groq:', await res.text())
      return { error: 'Error al transcribir' }
    }
    const data = await res.json()
    return { texto: data.text?.trim() ?? '' }
  } catch (e) {
    console.error('[transcribir] red:', e)
    return { error: 'Error de red con Groq' }
  }
}
