'use client'

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'

const VoiceInput = forwardRef(function VoiceInput(
  { disabled, onRecordingStart, onInterimUpdate, onRecordingEnd, onConfirm, onCancel },
  ref
) {
  const [supported, setSupported] = useState(false)

  // Toda la lógica en refs para evitar stale closures y problemas de strict mode
  const stateRef = useRef({
    active: false,
    accumulated: '',
    recognition: null,
    safetyTimer: null,
  })

  // Callbacks siempre frescos
  const cbRef = useRef({ onRecordingStart, onInterimUpdate, onRecordingEnd, onConfirm, onCancel })
  useEffect(() => {
    cbRef.current = { onRecordingStart, onInterimUpdate, onRecordingEnd, onConfirm, onCancel }
  })

  useEffect(() => {
    const SR = typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition)
    setSupported(!!SR)
    return () => {
      const s = stateRef.current
      clearTimeout(s.safetyTimer)
      try { s.recognition?.abort() } catch {}
    }
  }, [])

  // startSession declarada como función normal que lee stateRef — sin useCallback para evitar circular
  function doStartSession() {
    const s = stateRef.current
    if (!s.active) return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return

    try {
      const rec = new SR()
      rec.lang = 'es-CO'
      rec.interimResults = true
      rec.maxAlternatives = 1
      rec.continuous = false // móvil no soporta continuous real; reiniciamos en onend

      rec.onresult = (e) => {
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
        if (e.error === 'no-speech' || e.error === 'audio-capture') {
          // Silencio o captura momentánea — reiniciar sin cancelar
          if (s.active) doStartSession()
          return
        }
        // Error real — cancelar todo
        doStopAll()
        cbRef.current.onRecordingEnd?.()
        cbRef.current.onCancel?.()
      }

      rec.onend = () => {
        s.recognition = null
        // Reiniciar automáticamente si sigue activo (reemplaza continuous:true)
        if (s.active) doStartSession()
      }

      s.recognition = rec
      rec.start()
    } catch {
      // Si falla (p.ej. otra instancia activa), onend lo retomará
    }
  }

  function doStopAll() {
    const s = stateRef.current
    s.active = false
    clearTimeout(s.safetyTimer)
    try { s.recognition?.abort() } catch {}
    s.recognition = null
    s.accumulated = ''
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

  const startRecording = useCallback(() => {
    const s = stateRef.current
    if (s.active || disabled) return
    s.active = true
    s.accumulated = ''

    s.safetyTimer = setTimeout(() => {
      doStopAll()
      cbRef.current.onRecordingEnd?.()
      cbRef.current.onCancel?.()
    }, 60000)

    cbRef.current.onRecordingStart?.()
    doStartSession()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled])

  if (!supported) return null

  return (
    <button
      type="button"
      onClick={startRecording}
      disabled={disabled}
      aria-label="Hablar con Lucas"
      className="w-10 h-10 rounded-[12px] flex items-center justify-center transition-all disabled:opacity-40 shrink-0"
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
  )
})

export default VoiceInput
