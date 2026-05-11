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
    restartTimer: null,
    startedAt: 0,
    failCount: 0,
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
      clearTimeout(s.restartTimer)
      try { s.recognition?.abort() } catch {}
    }
  }, [])

  function doStartSession() {
    const s = stateRef.current
    if (!s.active) return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return

    // Si ya hay una instancia activa, no crear otra
    if (s.recognition) return

    const rec = new SR()
    rec.lang = 'es-CO'
    rec.interimResults = true
    rec.maxAlternatives = 1
    rec.continuous = false

    rec.onresult = (e) => {
      s.failCount = 0 // hubo resultado — resetear contador de fallos
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
        // Sin permiso de micrófono — abortar completamente
        doStopAll()
        cbRef.current.onRecordingEnd?.()
        cbRef.current.onCancel?.()
        return
      }
      if (e.error === 'no-speech' || e.error === 'audio-capture' || e.error === 'network') {
        // Transitorio — reiniciar con pequeña pausa
        if (s.active) scheduleRestart(300)
        return
      }
      // Cualquier otro error — abortar
      doStopAll()
      cbRef.current.onRecordingEnd?.()
      cbRef.current.onCancel?.()
    }

    rec.onend = () => {
      s.recognition = null
      if (!s.active) return
      const elapsed = Date.now() - s.startedAt
      if (elapsed < 300) {
        // Cerró demasiado rápido — posiblemente iOS sin permisos o colisión
        s.failCount = (s.failCount || 0) + 1
        if (s.failCount >= 3) {
          // Tres fallos consecutivos — rendirse para no entrar en loop
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

    // Pedir permiso de micrófono explícitamente antes de SpeechRecognition.
    // En iOS Safari el permiso llega async y sin esto onend dispara antes de que
    // el usuario acepte, causando el efecto de "se abre y se cierra".
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Cerrar el stream de inmediato — solo necesitábamos el permiso
      stream.getTracks().forEach(t => t.stop())
    } catch {
      // Usuario rechazó permiso o no hay micrófono — no iniciar
      return
    }

    s.active = true
    s.accumulated = ''
    s.failCount = 0

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
