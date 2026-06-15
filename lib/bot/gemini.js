// lib/bot/gemini.js — Google Gemini API con rotacion de keys
const GEMINI_KEYS = (process.env.GEMINI_API_KEYS || '').split(',').filter(Boolean)
let keyIndex = 0
let retryCount = 0

function getKey() {
  if (GEMINI_KEYS.length === 0) return null
  const key = GEMINI_KEYS[keyIndex % GEMINI_KEYS.length]
  keyIndex++
  return key
}

const GEMINI_MODEL = 'gemini-2.5-flash'
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

export async function llamarGemini(systemPrompt, userContent, options = {}) {
  const key = getKey()
  if (!key) throw new Error('No hay GEMINI_API_KEYS configuradas')

  const { maxTokens = 2000, jsonMode = false, noThinking = false } = options

  const contents = []
  if (Array.isArray(userContent)) {
    contents.push(...userContent)
  } else {
    contents.push({ role: 'user', parts: [{ text: userContent }] })
  }

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.7,
    },
  }

  if (jsonMode) {
    body.generationConfig.responseMimeType = 'application/json'
  }

  if (noThinking) {
    body.generationConfig.thinkingConfig = { thinkingBudget: 0 }
  }

  const url = `${BASE_URL}/${GEMINI_MODEL}:generateContent?key=${key}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  })

  if (!res.ok) {
    const errText = await res.text()
    if ((res.status === 429 || res.status === 403) && GEMINI_KEYS.length > 1 && retryCount < GEMINI_KEYS.length) {
      retryCount++
      console.warn(`[Gemini] Key fallo (${res.status}), reintentando con otra...`)
      const result = await llamarGemini(systemPrompt, userContent, options)
      retryCount = 0
      return result
    }
    retryCount = 0
    throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 200)}`)
  }

  retryCount = 0
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const usage = data.usageMetadata || {}

  return {
    text,
    usage: {
      tokensIn: usage.promptTokenCount || 0,
      tokensOut: usage.candidatesTokenCount || 0,
    },
  }
}

// Llamar a Gemini con function calling (para reemplazar Claude tool_use)
export async function llamarGeminiConTool(systemPrompt, messages, tool, toolName, options = {}) {
  const key = getKey()
  if (!key) throw new Error('No hay GEMINI_API_KEYS configuradas')

  const { maxTokens = 500 } = options

  // Convertir mensajes formato Anthropic a Gemini
  const contents = []
  for (const m of messages) {
    const role = m.role === 'assistant' ? 'model' : 'user'
    if (typeof m.content === 'string') {
      contents.push({ role, parts: [{ text: m.content }] })
    } else if (Array.isArray(m.content)) {
      const parts = []
      for (const block of m.content) {
        if (block.type === 'text') {
          parts.push({ text: block.text })
        } else if (block.type === 'image') {
          parts.push({
            inlineData: {
              mimeType: block.source?.media_type || 'image/jpeg',
              data: block.source?.data || '',
            },
          })
        }
      }
      if (parts.length > 0) contents.push({ role, parts })
    }
  }

  // Convertir tool Anthropic a Gemini function declaration
  const geminiTool = {
    functionDeclarations: [{
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    }],
  }

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    tools: [geminiTool],
    toolConfig: {
      functionCallingConfig: {
        mode: 'ANY',
        allowedFunctionNames: [toolName],
      },
    },
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.7,
    },
  }

  const url = `${BASE_URL}/${GEMINI_MODEL}:generateContent?key=${key}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) {
    const errText = await res.text()
    if ((res.status === 429 || res.status === 403) && GEMINI_KEYS.length > 1 && retryCount < GEMINI_KEYS.length) {
      retryCount++
      console.warn(`[Gemini] Key fallo (${res.status}), reintentando con otra...`)
      const result = await llamarGeminiConTool(systemPrompt, messages, tool, toolName, options)
      retryCount = 0
      return result
    }
    retryCount = 0
    throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 200)}`)
  }

  retryCount = 0
  const data = await res.json()
  const usage = data.usageMetadata || {}
  const parts = data.candidates?.[0]?.content?.parts || []

  // Buscar function call en la respuesta
  const fnCall = parts.find(p => p.functionCall)
  if (fnCall?.functionCall) {
    return {
      parsed: fnCall.functionCall.args,
      rawText: '',
      usage: { tokensIn: usage.promptTokenCount || 0, tokensOut: usage.candidatesTokenCount || 0 },
    }
  }

  // Si no hay function call, devolver texto raw
  const text = parts.filter(p => p.text).map(p => p.text).join('')
  return {
    parsed: null,
    rawText: text,
    usage: { tokensIn: usage.promptTokenCount || 0, tokensOut: usage.candidatesTokenCount || 0 },
  }
}

export function geminiDisponible() {
  return GEMINI_KEYS.length > 0
}
