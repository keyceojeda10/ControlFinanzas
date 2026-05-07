'use client'

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'

/**
 * VoiceInput — botón micrófono + motor de reconocimiento de voz.
 *
 * Props:
 *   disabled          — deshabilita el botón
 *   onRecordingStart  — llamado cuando el engine empieza a escuchar
 *   onInterimUpdate   — llamado con el texto parcial/acumulado mientras habla
 *   onRecordingEnd    — llamado cuando el engine se detiene (cancel o confirm)
 *   onConfirm(text)   — llamado al confirmar con el texto final
 *   onCancel()        — llamado al cancelar
 *
 * Ref expone:
 *   cancel()          — para que el padre cancele desde WaveformBar
 *   confirm(text)     — para que el padre confirme desde WaveformBar
 */
const VoiceInput = forwardRef(function VoiceInput(
  { disabled, onRecordingStart, onInterimUpdate, onRecordingEnd, onConfirm, onCancel },
  ref
) {
  const [supported, setSupported] = useState(false)
  const recognitionRef = useRef(null)
  const safetyTimerRef = useRef(null)

  useEffect(() => {
    const SR =
      typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition)
    setSupported(!!SR)
  }, [])

  useEffect(
    () => () => {
      clearTimeout(safetyTimerRef.current)
      try { recognitionRef.current?.abort() } catch {}
    },
    []
  )

  const stopEngine = useCallback(() => {
    clearTimeout(safetyTimerRef.current)
    try { recognitionRef.current?.abort() } catch {}
    recognitionRef.current = null
  }, [])

  // Expose imperative API to parent
  useImperativeHandle(ref, () => ({
    cancel() {
      stopEngine()
      onRecordingEnd?.()
      onCancel?.()
    },
    confirm(text) {
      stopEngine()
      onRecordingEnd?.()
      if (text) onConfirm?.(text)
    },
  }), [stopEngine, onRecordingEnd, onCancel, onConfirm])

  const startRecording = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return

    const recognition = new SR()
    recognition.lang = 'es-CO'
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.continuous = true

    // Rastrear si el engine llegó a arrancar — evita que onerror antes de onstart cierre el waveform
    let started = false

    safetyTimerRef.current = setTimeout(() => {
      stopEngine()
      onRecordingEnd?.()
      onCancel?.()
    }, 30000)

    recognition.onstart = () => {
      started = true
      onRecordingStart?.()
    }

    recognition.onresult = (e) => {
      let finalAccum = ''
      let interimAccum = ''
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalAccum += e.results[i][0].transcript + ' '
        } else {
          interimAccum += e.results[i][0].transcript
        }
      }
      const display = (finalAccum + interimAccum).trim()
      onInterimUpdate?.(display)
    }

    recognition.onerror = (e) => {
      clearTimeout(safetyTimerRef.current)
      stopEngine()
      // Solo notificar al padre si el engine llegó a arrancar — si falló antes de onstart
      // (ej: panel oculto, permiso denegado) no tocar el estado del padre
      if (started) {
        onRecordingEnd?.()
        onCancel?.()
      }
    }

    recognition.onend = () => {
      clearTimeout(safetyTimerRef.current)
      // Si el engine terminó solo (sin abort explícito) y ya había arrancado, notificar al padre
      if (started && recognitionRef.current) {
        recognitionRef.current = null
        onRecordingEnd?.()
        onCancel?.()
      }
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      clearTimeout(safetyTimerRef.current)
      recognitionRef.current = null
    }
  }, [stopEngine, onRecordingStart, onRecordingEnd, onInterimUpdate, onCancel])

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
      <svg
        style={{ width: '16px', height: '16px' }}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19 10v2a7 7 0 0 1-14 0v-2"
        />
        <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round" />
        <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round" />
      </svg>
    </button>
  )
})

export default VoiceInput
