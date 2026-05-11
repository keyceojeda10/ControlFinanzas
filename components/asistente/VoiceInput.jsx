'use client'

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'

/**
 * VoiceInput — botón de micrófono para el asistente Lucas.
 *
 * Estrategia iOS/Android:
 *   1. El tap llama getUserMedia() dentro del handler (user gesture obligatorio en iOS Safari).
 *   2. El stream obtenido se pasa al padre vía onRecordingStart(stream) para que
 *      WaveformBar lo use directamente (sin segundo getUserMedia).
 *   3. SpeechRecognition se inicia DESPUÉS de obtener el stream, lo que resuelve
 *      el rechazo silencioso de iOS que disparaba onend en <300ms.
 *   4. Si SpeechRecognition no está disponible, muestra aviso al usuario.
 */
const VoiceInput = forwardRef(function VoiceInput(
  { disabled, onRecordingStart, onInterimUpdate, onRecordingEnd, onConfirm, onCancel, onPermissionDenied },
  ref
) {
  const [noSpeechAPI, setNoSpeechAPI] = useState(false) // aviso "no soportado"

  // Estado en ref para evitar stale closures
  const stateRef = useRef({
    active: false,
    accumulated: '',
    recognition: null,
    stream: null,
    safetyTimer: null,
    restartTimer: null,
    startedAt: 0,
    failCount: 0,
  })

  // Callbacks siempre frescos
  const cbRef = useRef({ onRecordingStart, onInterimUpdate, onRecordingEnd, onConfirm, onCancel, onPermissionDenied })
  useEffect(() => {
    cbRef.current = { onRecordingStart, onInterimUpdate, onRecordingEnd, onConfirm, onCancel, onPermissionDenied }
  })

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      const s = stateRef.current
      clearTimeout(s.safetyTimer)
      clearTimeout(s.restartTimer)
      try { s.recognition?.abort() } catch {}
      try { s.stream?.getTracks().forEach(t => t.stop()) } catch {}
    }
  }, [])

  function getSR() {
    if (typeof window === 'undefined') return null
    return window.SpeechRecognition || window.webkitSpeechRecognition || null
  }

  function doStartSession() {
    const s = stateRef.current
    if (!s.active) return
    const SR = getSR()
    if (!SR) return
    if (s.recognition) return // ya hay instancia activa

    const rec = new SR()
    rec.lang = 'es-CO'
    rec.interimResults = true
    rec.maxAlternatives = 1
    rec.continuous = false

    rec.onresult = (e) => {
      s.failCount = 0
      let fin = ''
      let interim = ''
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) fin += e.results[i][0].transcript + ' '
        else interim += e.results[i][0].transcript
      }
      if (fin) s.accumulated += fin
      cbRef.current.onInterimUpdate?.((s.accumulated + interim).trim())
    }

    rec.onerror = (e) => {
      s.recognition = null
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        doStopAll()
        cbRef.current.onRecordingEnd?.()
        cbRef.current.onPermissionDenied?.()
        cbRef.current.onCancel?.()
        return
      }
      if (e.error === 'no-speech' || e.error === 'audio-capture' || e.error === 'network') {
        if (s.active) scheduleRestart(300)
        return
      }
      doStopAll()
      cbRef.current.onRecordingEnd?.()
      cbRef.current.onCancel?.()
    }

    rec.onend = () => {
      s.recognition = null
      if (!s.active) return
      const elapsed = Date.now() - s.startedAt
      if (elapsed < 300) {
        s.failCount = (s.failCount || 0) + 1
        if (s.failCount >= 3) {
          doStopAll()
          cbRef.current.onRecordingEnd?.()
          cbRef.current.onCancel?.()
          return
        }
        scheduleRestart(400)
      } else {
        s.failCount = 0
        scheduleRestart(50)
      }
    }

    s.recognition = rec
    s.startedAt = Date.now()
    try {
      rec.start()
    } catch {
      s.recognition = null
      if (s.active) scheduleRestart(500)
    }
  }

  function scheduleRestart(ms) {
    const s = stateRef.current
    clearTimeout(s.restartTimer)
    s.restartTimer = setTimeout(() => {
      if (s.active) doStartSession()
    }, ms)
  }

  function doStopAll() {
    const s = stateRef.current
    s.active = false
    clearTimeout(s.safetyTimer)
    clearTimeout(s.restartTimer)
    try { s.recognition?.abort() } catch {}
    s.recognition = null
    try { s.stream?.getTracks().forEach(t => t.stop()) } catch {}
    s.stream = null
    s.accumulated = ''
    s.failCount = 0
  }

  useImperativeHandle(ref, () => ({
    cancel() {
      doStopAll()
      cbRef.current.onRecordingEnd?.()
      cbRef.current.onCancel?.()
    },
    confirm(text) {
      const final = text || stateRef.current.accumulated.trim()
      doStopAll()
      cbRef.current.onRecordingEnd?.()
      if (final) cbRef.current.onConfirm?.(final)
    },
  }))

  const startRecording = useCallback(async () => {
    const s = stateRef.current
    if (s.active || disabled) return

    // Verificar soporte de SpeechRecognition antes de pedir micrófono
    const SR = getSR()
    if (!SR) {
      setNoSpeechAPI(true)
      setTimeout(() => setNoSpeechAPI(false), 4000)
      return
    }

    // Paso 1: getUserMedia DENTRO del handler (user gesture — crítico para iOS Safari)
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    } catch {
      cbRef.current.onPermissionDenied?.()
      return
    }

    // Paso 2: Iniciar sesión de reconocimiento con el stream ya obtenido
    s.stream = stream
    s.active = true
    s.accumulated = ''
    s.failCount = 0

    s.safetyTimer = setTimeout(() => {
      doStopAll()
      cbRef.current.onRecordingEnd?.()
      cbRef.current.onCancel?.()
    }, 60000)

    // Pasar el stream al padre para que WaveformBar lo use directamente
    cbRef.current.onRecordingStart?.(stream)
    doStartSession()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled])

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={startRecording}
        disabled={disabled}
        aria-label="Hablar con Lucas"
        className="w-10 h-10 rounded-[12px] flex items-center justify-center transition-all disabled:opacity-40"
        style={{
          background: 'var(--color-bg-hover)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-muted)',
        }}
      >
        <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round"/>
          <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Aviso inline cuando el navegador no soporta SpeechRecognition */}
      {noSpeechAPI && (
        <div
          className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50 text-[11px] px-3 py-2 rounded-xl whitespace-nowrap text-center"
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          }}
        >
          Tu navegador no soporta entrada de voz.
          <br />
          Usa Chrome o Safari.
        </div>
      )}
    </div>
  )
})

export default VoiceInput
