'use client'

/**
 * VoiceInput — entrada de voz para Lucas.
 *
 * Arquitectura:
 * - El onClick del botón es SÍNCRONO. Llama rec.start() directamente sin await.
 *   Esto es crítico para iOS Safari: cualquier await antes de start() rompe
 *   el contexto de "user gesture" y la API rechaza el permiso silenciosamente.
 * - La visualización de waveform (canvas) pide getUserMedia por su cuenta
 *   en un useEffect separado — eso sí puede ser async porque no necesita
 *   el user gesture (el permiso ya fue concedido por SpeechRecognition).
 * - UI al estilo ChatGPT: modal overlay que reemplaza el input bar completo.
 */

import {
  useState, useRef, useEffect, useCallback,
  forwardRef, useImperativeHandle,
} from 'react'

// ─── Waveform canvas ────────────────────────────────────────────────────────
const BAR_COUNT = 40

function Waveform({ active }) {
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)
  const barsRef   = useRef(new Float32Array(BAR_COUNT).fill(0.05))
  const analyserRef = useRef(null)
  const ctxRef    = useRef(null)

  useEffect(() => {
    if (!active) return
    let cancelled = false

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        const ac = new (window.AudioContext || window.webkitAudioContext)()
        ctxRef.current = ac
        const src = ac.createMediaStreamSource(stream)
        const an  = ac.createAnalyser()
        an.fftSize = 128
        an.smoothingTimeConstant = 0.8
        src.connect(an)
        analyserRef.current = an
        draw()
      } catch {
        simulate()
      }
    }

    function draw() {
      if (cancelled) return
      const canvas = canvasRef.current
      if (!canvas) return
      const c = canvas.getContext('2d')
      const an = analyserRef.current
      if (an) {
        const data = new Uint8Array(an.frequencyBinCount)
        an.getByteFrequencyData(data)
        const step = Math.floor(data.length / BAR_COUNT)
        for (let i = 0; i < BAR_COUNT; i++) {
          const raw = data[i * step] / 255
          barsRef.current[i] = barsRef.current[i] * 0.65 + raw * 0.35
        }
      }
      renderBars(c, canvas)
      rafRef.current = requestAnimationFrame(draw)
    }

    function simulate() {
      if (cancelled) return
      const canvas = canvasRef.current
      if (!canvas) return
      const c = canvas.getContext('2d')
      for (let i = 0; i < BAR_COUNT; i++) {
        const t = 0.04 + Math.random() * 0.28
        barsRef.current[i] = barsRef.current[i] * 0.75 + t * 0.25
      }
      renderBars(c, canvas)
      rafRef.current = requestAnimationFrame(simulate)
    }

    function renderBars(c, canvas) {
      const W = canvas.width, H = canvas.height
      c.clearRect(0, 0, W, H)
      const accent = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-accent').trim() || '#f5c518'
      const barW = Math.max(2, Math.floor((W - (BAR_COUNT - 1) * 2) / BAR_COUNT))
      for (let i = 0; i < BAR_COUNT; i++) {
        const h = Math.max(3, barsRef.current[i] * (H - 4))
        const x = i * (barW + 2)
        const y = (H - h) / 2
        c.globalAlpha = 0.35 + barsRef.current[i] * 0.65
        c.fillStyle = accent
        c.beginPath()
        const r = Math.min(2, barW / 2, h / 2)
        if (c.roundRect) c.roundRect(x, y, barW, h, r)
        else c.rect(x, y, barW, h)
        c.fill()
      }
      c.globalAlpha = 1
    }

    init()
    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      try { ctxRef.current?.close() } catch {}
      analyserRef.current = null
      ctxRef.current = null
    }
  }, [active])

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={28}
      aria-hidden="true"
      style={{ flex: 1, minWidth: 0, height: '28px', display: 'block' }}
    />
  )
}

// ─── VoiceInput ─────────────────────────────────────────────────────────────
const VoiceInput = forwardRef(function VoiceInput(
  { disabled, onRecordingStart, onInterimUpdate, onRecordingEnd, onConfirm, onCancel, onSend },
  ref,
) {
  const [supported, setSupported] = useState(false)
  const [state, setState]  = useState('idle') // 'idle' | 'recording' | 'error'
  const [errorMsg, setErrorMsg] = useState('')
  const [transcript, setTranscript] = useState('')

  const recRef  = useRef(null)
  const accRef  = useRef('')
  const activeRef = useRef(false)
  const failRef = useRef(0)
  const restartTimerRef = useRef(null)
  const safetyTimerRef  = useRef(null)
  const startedAtRef    = useRef(0)

  // Callbacks siempre frescos
  const cbRef = useRef({ onRecordingStart, onInterimUpdate, onRecordingEnd, onConfirm, onCancel, onSend })
  useEffect(() => {
    cbRef.current = { onRecordingStart, onInterimUpdate, onRecordingEnd, onConfirm, onCancel, onSend }
  })

  useEffect(() => {
    const SR = typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition)
    setSupported(!!SR)
    return () => {
      clearTimeout(restartTimerRef.current)
      clearTimeout(safetyTimerRef.current)
      try { recRef.current?.abort() } catch {}
    }
  }, [])

  function getSR() {
    return window.SpeechRecognition || window.webkitSpeechRecognition
  }

  function stopAll(reason) {
    activeRef.current = false
    clearTimeout(restartTimerRef.current)
    clearTimeout(safetyTimerRef.current)
    try { recRef.current?.abort() } catch {}
    recRef.current = null
    accRef.current = ''
    failRef.current = 0
    setState('idle')
    setTranscript('')
    cbRef.current.onRecordingEnd?.()
    if (reason === 'cancel') cbRef.current.onCancel?.()
  }

  function startSession() {
    if (!activeRef.current) return
    const SR = getSR()
    if (!SR || recRef.current) return

    const rec = new SR()
    rec.lang = 'es-CO'
    rec.interimResults = true
    rec.maxAlternatives = 1
    rec.continuous = false

    rec.onstart = () => {
      failRef.current = 0
    }

    rec.onresult = (e) => {
      failRef.current = 0
      let fin = '', interim = ''
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) fin += e.results[i][0].transcript + ' '
        else interim += e.results[i][0].transcript
      }
      if (fin) accRef.current += fin
      const full = (accRef.current + interim).trim()
      setTranscript(full)
      cbRef.current.onInterimUpdate?.(full)
    }

    rec.onerror = (e) => {
      recRef.current = null
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        activeRef.current = false
        clearTimeout(safetyTimerRef.current)
        setState('error')
        setErrorMsg('Permiso de micrófono denegado. Actívalo en tu navegador.')
        cbRef.current.onRecordingEnd?.()
        cbRef.current.onCancel?.()
        return
      }
      if (['no-speech', 'audio-capture', 'network'].includes(e.error)) {
        if (activeRef.current) scheduleRestart(400)
        return
      }
      // otro error — cancelar
      stopAll('cancel')
    }

    rec.onend = () => {
      recRef.current = null
      if (!activeRef.current) return
      const elapsed = Date.now() - startedAtRef.current
      if (elapsed < 350) {
        failRef.current += 1
        if (failRef.current >= 4) { stopAll('cancel'); return }
        scheduleRestart(500)
      } else {
        failRef.current = 0
        scheduleRestart(80)
      }
    }

    recRef.current = rec
    startedAtRef.current = Date.now()
    try { rec.start() } catch {
      recRef.current = null
      if (activeRef.current) scheduleRestart(600)
    }
  }

  function scheduleRestart(ms) {
    clearTimeout(restartTimerRef.current)
    restartTimerRef.current = setTimeout(() => {
      if (activeRef.current) startSession()
    }, ms)
  }

  // Ref API para el padre
  useImperativeHandle(ref, () => ({
    cancel() { stopAll('cancel') },
    confirm(text) {
      const final = text ?? accRef.current.trim()
      stopAll('confirm')
      if (final) cbRef.current.onConfirm?.(final)
    },
  }))

  // ─── CLICK HANDLER — COMPLETAMENTE SÍNCRONO ────────────────────────────
  // NO async, NO await, NO getUserMedia aquí.
  // SpeechRecognition.start() activa el permiso de micrófono por sí solo.
  const handleClick = useCallback(() => {
    if (disabled || activeRef.current) return
    const SR = getSR()
    if (!SR) {
      setState('error')
      setErrorMsg('Tu navegador no soporta entrada de voz. Usa Chrome o Safari.')
      setTimeout(() => setState('idle'), 4000)
      return
    }

    // Activar
    activeRef.current = true
    accRef.current = ''
    failRef.current = 0
    setState('recording')
    setTranscript('')
    setErrorMsg('')

    // Safety timeout: 60 segundos
    clearTimeout(safetyTimerRef.current)
    safetyTimerRef.current = setTimeout(() => {
      stopAll('cancel')
    }, 60000)

    cbRef.current.onRecordingStart?.()
    startSession()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled])

  if (!supported) return null

  // ─── UI: estado recording ─────────────────────────────────────────────
  if (state === 'recording') {
    const hasText = !!transcript
    return (
      <div
        className="flex items-center gap-2 w-full rounded-[16px] px-3"
        style={{
          height: '48px',
          background: 'var(--color-bg-hover)',
          border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
        }}
      >
        {/* Punto rojo pulsante */}
        <span
          className="shrink-0 w-2 h-2 rounded-full"
          style={{ background: '#ef4444', animation: 'voice-pulse 1.4s ease-in-out infinite' }}
        />

        {/* Transcript o placeholder */}
        <span
          className="text-xs shrink-0 truncate"
          style={{
            minWidth: '44px',
            maxWidth: '100px',
            color: hasText ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
            fontStyle: hasText ? 'normal' : 'italic',
          }}
          title={transcript}
        >
          {transcript || 'Escuchando...'}
        </span>

        {/* Waveform */}
        <Waveform active={true} />

        {/* Botones */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Cancelar */}
          <button
            type="button"
            onClick={() => stopAll('cancel')}
            aria-label="Cancelar"
            className="w-8 h-8 rounded-[10px] flex items-center justify-center transition-all"
            style={{
              background: 'color-mix(in srgb, var(--color-text-muted) 12%, transparent)',
              color: 'var(--color-text-muted)',
              border: '1px solid color-mix(in srgb, var(--color-text-muted) 20%, transparent)',
            }}
          >
            <svg style={{ width: '13px', height: '13px' }} fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {/* Editar (poner en textarea) */}
          <button
            type="button"
            onClick={() => {
              const final = accRef.current.trim() || transcript.trim()
              stopAll('confirm')
              if (final) cbRef.current.onConfirm?.(final)
            }}
            disabled={!hasText}
            aria-label="Editar texto"
            title="Editar antes de enviar"
            className="w-8 h-8 rounded-[10px] flex items-center justify-center transition-all disabled:opacity-30"
            style={{
              background: 'color-mix(in srgb, var(--color-text-muted) 12%, transparent)',
              color: 'var(--color-text-muted)',
              border: '1px solid color-mix(in srgb, var(--color-text-muted) 20%, transparent)',
            }}
          >
            <svg style={{ width: '13px', height: '13px' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487a2.25 2.25 0 013.182 3.182L7.5 20.213l-4 1 1-4L16.862 4.487z" />
            </svg>
          </button>
          {/* Enviar directo */}
          <button
            type="button"
            onClick={() => {
              const final = accRef.current.trim() || transcript.trim()
              stopAll('confirm')
              if (final) {
                if (cbRef.current.onSend) cbRef.current.onSend(final)
                else cbRef.current.onConfirm?.(final)
              }
            }}
            disabled={!hasText}
            aria-label="Enviar"
            className="w-8 h-8 rounded-[10px] flex items-center justify-center transition-all disabled:opacity-30"
            style={{
              background: hasText ? 'var(--color-accent)' : 'transparent',
              color: hasText ? '#0a0a0a' : 'var(--color-accent)',
              border: '1px solid color-mix(in srgb, var(--color-accent) 35%, transparent)',
            }}
          >
            <svg style={{ width: '13px', height: '13px' }} fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  // ─── UI: estado error ─────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div
        className="flex items-center gap-2 w-full rounded-[16px] px-3 py-2"
        style={{
          background: 'color-mix(in srgb, var(--color-danger) 10%, var(--color-bg-hover))',
          border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)',
        }}
      >
        <svg style={{ width: '14px', height: '14px', color: 'var(--color-danger)', flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <span className="text-xs flex-1" style={{ color: 'var(--color-danger)' }}>{errorMsg}</span>
        <button
          type="button"
          onClick={() => setState('idle')}
          className="text-[10px] px-2 py-1 rounded-lg"
          style={{ color: 'var(--color-text-muted)', background: 'var(--color-bg-hover)' }}
        >
          OK
        </button>
      </div>
    )
  }

  // ─── UI: estado idle ──────────────────────────────────────────────────
  return (
    <button
      type="button"
      onClick={handleClick}
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
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round" />
        <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round" />
      </svg>
    </button>
  )
})

export default VoiceInput
