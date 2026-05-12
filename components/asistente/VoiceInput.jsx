'use client'

/**
 * VoiceInput — entrada de voz para Lucas.
 *
 * Modo dual:
 * - Android PWA (o cuando SpeechRecognition falla): MediaRecorder + Groq Whisper
 * - iOS / Chrome desktop: SpeechRecognition nativa (síncrona, requiere user gesture)
 *
 * El onClick SIEMPRE es síncrono para preservar el user gesture context en iOS.
 */

import {
  useState, useRef, useEffect, useCallback,
  forwardRef, useImperativeHandle,
} from 'react'

// ─── Detección de entorno ────────────────────────────────────────────────────
function isAndroidPWA() {
  if (typeof window === 'undefined') return false
  const android = /android/i.test(navigator.userAgent)
  const standalone = window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  return android && standalone
}

function isAndroid() {
  if (typeof window === 'undefined') return false
  return /android/i.test(navigator.userAgent)
}

function hasSpeechRecognition() {
  if (typeof window === 'undefined') return false
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

// iOS = SpeechRecognition (funciona perfecto, modal nativo del sistema).
// Android + PC/desktop = Whisper via getUserMedia (evita el problema de permisos
// de SpeechRecognition que no muestra modal en Chrome cuando fue denegado antes).
function checkWhisperMode() {
  if (typeof window === 'undefined') return false
  const isIOS = /ipad|iphone|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return !isIOS
}

// ─── Waveform canvas ────────────────────────────────────────────────────────
const BAR_COUNT = 40

function Waveform({ active, streamRef }) {
  const canvasRef   = useRef(null)
  const rafRef      = useRef(null)
  const barsRef     = useRef(new Float32Array(BAR_COUNT).fill(0.05))
  const analyserRef = useRef(null)
  const ctxRef      = useRef(null)

  useEffect(() => {
    if (!active) return
    let cancelled = false

    async function init() {
      try {
        // Intentar usar el stream ya abierto (Whisper mode) o pedir uno nuevo
        const stream = streamRef?.current ?? await navigator.mediaDevices.getUserMedia({ audio: true })
        if (cancelled) return
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
      const c  = canvas.getContext('2d')
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
  }, [active, streamRef])

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
  const [supported,    setSupported]    = useState(false)
  const [whisperMode,  setWhisperMode]  = useState(false)
  const [state,        setState]        = useState('idle') // idle | recording | processing | error
  const [errorMsg,     setErrorMsg]     = useState('')
  const [transcript,   setTranscript]   = useState('')
  const [showPermHint, setShowPermHint] = useState(false)

  // SpeechRecognition refs
  const recRef         = useRef(null)
  const accRef         = useRef('')
  const activeRef      = useRef(false)
  const failRef        = useRef(0)
  const restartTimerRef = useRef(null)
  const safetyTimerRef  = useRef(null)
  const startedAtRef    = useRef(0)

  // Whisper / MediaRecorder refs
  const mediaRecRef    = useRef(null)
  const streamRef      = useRef(null)
  const chunksRef      = useRef([])
  const whisperActiveRef = useRef(false)

  const cbRef = useRef({ onRecordingStart, onInterimUpdate, onRecordingEnd, onConfirm, onCancel, onSend })
  useEffect(() => {
    cbRef.current = { onRecordingStart, onInterimUpdate, onRecordingEnd, onConfirm, onCancel, onSend }
  })

  useEffect(() => {
    const sr = hasSpeechRecognition()
    const wm = checkWhisperMode()
    setSupported(sr || wm)
    setWhisperMode(wm)

    if (!wm && typeof navigator !== 'undefined' && navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' }).then(status => {
        if (status.state === 'granted') {
          try { localStorage.setItem('voice_perm_granted', '1') } catch {}
        }
      }).catch(() => {})
    }

    return () => {
      clearTimeout(restartTimerRef.current)
      clearTimeout(safetyTimerRef.current)
      try { recRef.current?.abort() } catch {}
      stopWhisperStream()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Whisper mode helpers ────────────────────────────────────────────────

  function stopWhisperStream() {
    try { mediaRecRef.current?.stop() } catch {}
    try { streamRef.current?.getTracks().forEach(t => t.stop()) } catch {}
    mediaRecRef.current = null
    streamRef.current   = null
    chunksRef.current   = []
  }

  async function startWhisperRecording() {
    whisperActiveRef.current = true
    chunksRef.current = []

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      whisperActiveRef.current = false
      setState('error')
      const isPWA = window.matchMedia('(display-mode: standalone)').matches
      const isMobile = isAndroid()
      let msg
      if (isPWA) {
        msg = 'Micrófono bloqueado. Ve a Ajustes → Apps → Chrome → Permisos → Micrófono → Permitir, luego vuelve a la app.'
      } else if (isMobile) {
        msg = 'Micrófono bloqueado. Toca el candado junto a la URL → Permisos del sitio → Micrófono → Permitir.'
      } else {
        msg = 'Micrófono bloqueado. Haz clic en el ícono de micrófono o candado en la barra de URL de Chrome → Permitir siempre.'
      }
      setErrorMsg(msg)
      cbRef.current.onRecordingEnd?.()
      cbRef.current.onCancel?.()
      return
    }

    streamRef.current = stream

    // Elegir formato compatible
    const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
    const mime = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || ''

    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : {})
    mediaRecRef.current = mr

    mr.ondataavailable = (e) => {
      if (e.data?.size > 0) chunksRef.current.push(e.data)
    }

    mr.onstop = async () => {
      if (!whisperActiveRef.current) return
      const blob = new Blob(chunksRef.current, { type: mime || 'audio/webm' })
      stopWhisperStream()

      if (blob.size < 1000) {
        // Muy corto, probablemente silencio
        setState('idle')
        cbRef.current.onRecordingEnd?.()
        return
      }

      setState('processing')

      try {
        const fd = new FormData()
        fd.append('audio', blob, `audio.${mime.includes('mp4') ? 'm4a' : 'webm'}`)
        const res = await fetch('/api/voz/transcribir', { method: 'POST', body: fd })
        const data = await res.json()
        const texto = data.texto?.trim() ?? ''
        if (texto) {
          setTranscript(texto)
          setState('done')
        } else {
          setState('idle')
          cbRef.current.onRecordingEnd?.()
        }
      } catch {
        setState('error')
        setErrorMsg('Error al transcribir. Intenta de nuevo.')
        cbRef.current.onRecordingEnd?.()
      }
    }

    mr.start()
    cbRef.current.onRecordingStart?.()

    // Safety: máximo 60 segundos
    safetyTimerRef.current = setTimeout(() => {
      if (whisperActiveRef.current && mediaRecRef.current?.state === 'recording') {
        mediaRecRef.current.stop()
      }
    }, 60000)
  }

  function stopWhisperRecording() {
    clearTimeout(safetyTimerRef.current)
    if (mediaRecRef.current?.state === 'recording') {
      mediaRecRef.current.stop()
    } else {
      whisperActiveRef.current = false
      stopWhisperStream()
      setState('idle')
      cbRef.current.onRecordingEnd?.()
    }
  }

  function cancelWhisper() {
    whisperActiveRef.current = false
    clearTimeout(safetyTimerRef.current)
    stopWhisperStream()
    setState('idle')
    setTranscript('')
    cbRef.current.onRecordingEnd?.()
    cbRef.current.onCancel?.()
  }

  // ─── SpeechRecognition helpers ───────────────────────────────────────────

  function getSR() {
    return window.SpeechRecognition || window.webkitSpeechRecognition
  }

  function stopAll(reason) {
    activeRef.current = false
    clearTimeout(restartTimerRef.current)
    clearTimeout(safetyTimerRef.current)
    try { recRef.current?.abort() } catch {}
    recRef.current  = null
    accRef.current  = ''
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
    rec.lang           = 'es-CO'
    rec.interimResults = true
    rec.maxAlternatives = 1
    rec.continuous     = false

    rec.onstart = () => {
      failRef.current = 0
      try { localStorage.setItem('voice_perm_granted', '1') } catch {}
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
        const yaConociaPerm = (() => { try { return !!localStorage.getItem('voice_perm_granted') } catch { return false } })()
        const msg = yaConociaPerm
          ? 'Micrófono bloqueado. Toca el candado en la barra del navegador → Micrófono → Permitir.'
          : 'Acepta el permiso de micrófono en la barra de tu navegador y vuelve a intentar.'
        setErrorMsg(msg)
        cbRef.current.onRecordingEnd?.()
        cbRef.current.onCancel?.()
        return
      }
      if (['no-speech', 'audio-capture', 'network'].includes(e.error)) {
        if (activeRef.current) scheduleRestart(400)
        return
      }
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

    recRef.current    = rec
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

  // ─── Ref API ─────────────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    cancel() {
      if (whisperMode) cancelWhisper()
      else stopAll('cancel')
    },
    confirm(text) {
      const final = text ?? accRef.current.trim()
      stopAll('confirm')
      if (final) cbRef.current.onConfirm?.(final)
    },
  }))

  // ─── CLICK HANDLER ────────────────────────────────────────────────────────
  // Síncrono siempre para preservar user gesture en iOS.
  // En Whisper mode, getUserMedia se llama en async function DENTRO del click
  // pero sin await en el handler principal.
  const handleClick = useCallback(() => {
    if (disabled) return

    if (whisperMode) {
      if (state === 'recording') {
        stopWhisperRecording()
        return
      }
      // Lanzar async sin await para mantener sincronía del handler
      startWhisperRecording()
      setState('recording')
      setTranscript('')
      setErrorMsg('')
      return
    }

    // SpeechRecognition mode
    if (activeRef.current) return
    const SR = getSR()
    if (!SR) {
      setState('error')
      setErrorMsg('Tu navegador no soporta entrada de voz. Usa Chrome o Safari.')
      setTimeout(() => setState('idle'), 4000)
      return
    }

    activeRef.current = true
    accRef.current    = ''
    failRef.current   = 0
    setState('recording')
    setTranscript('')
    setErrorMsg('')

    clearTimeout(safetyTimerRef.current)
    safetyTimerRef.current = setTimeout(() => stopAll('cancel'), 60000)

    try {
      if (!localStorage.getItem('voice_perm_granted')) {
        setShowPermHint(true)
        setTimeout(() => setShowPermHint(false), 3000)
      }
    } catch {}

    cbRef.current.onRecordingStart?.()
    startSession()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, whisperMode, state])

  if (!supported) return null

  // ─── UI: processing (Whisper transcribiendo) ──────────────────────────
  if (state === 'processing') {
    return (
      <div
        className="flex items-center gap-2 w-full rounded-[16px] px-3"
        style={{
          height: '48px',
          background: 'var(--color-bg-hover)',
          border: '1px solid var(--color-border-hover)',
        }}
      >
        <span className="w-4 h-4 shrink-0 animate-spin rounded-full border-2" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        <span className="text-xs italic flex-1" style={{ color: 'var(--color-text-muted)' }}>Transcribiendo...</span>
      </div>
    )
  }

  // ─── UI: done (Whisper — mostrar resultado para confirmar/editar) ──────
  if (state === 'done') {
    return (
      <div
        className="flex items-center gap-2 w-full rounded-[16px] px-3"
        style={{
          height: '48px',
          background: 'var(--color-bg-hover)',
          border: '1px solid var(--color-border-hover)',
        }}
      >
        <span className="text-xs flex-1 truncate" style={{ color: 'var(--color-text-primary)' }} title={transcript}>
          {transcript}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={() => { setTranscript(''); setState('idle'); cbRef.current.onRecordingEnd?.(); cbRef.current.onCancel?.() }}
            className="w-8 h-8 rounded-[10px] flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-muted)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <svg style={{ width: '13px', height: '13px' }} fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button type="button" onClick={() => { const t = transcript; setState('idle'); setTranscript(''); cbRef.current.onConfirm?.(t) }}
            className="w-8 h-8 rounded-[10px] flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-muted)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <svg style={{ width: '13px', height: '13px' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487a2.25 2.25 0 013.182 3.182L7.5 20.213l-4 1 1-4L16.862 4.487z" />
            </svg>
          </button>
          <button type="button" onClick={() => { const t = transcript; setState('idle'); setTranscript(''); if (cbRef.current.onSend) cbRef.current.onSend(t); else cbRef.current.onConfirm?.(t) }}
            className="w-8 h-8 rounded-[10px] flex items-center justify-center"
            style={{ background: 'var(--color-accent)', color: '#0a0a0a', border: 'none' }}>
            <svg style={{ width: '13px', height: '13px' }} fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  // ─── UI: recording ────────────────────────────────────────────────────
  if (state === 'recording') {
    const hasText = !!transcript
    return (
      <div
        className="flex items-center gap-2 w-full rounded-[16px] px-3"
        style={{
          height: '48px',
          background: 'var(--color-bg-hover)',
          border: '1px solid var(--color-border-hover)',
        }}
      >
        <span
          className="shrink-0 w-2 h-2 rounded-full"
          style={{ background: '#ef4444', animation: 'voice-pulse 1.4s ease-in-out infinite' }}
        />

        <span
          className="text-xs shrink-0 truncate"
          style={{
            minWidth: '44px',
            maxWidth: '110px',
            color: showPermHint ? 'var(--color-warning)' : (hasText ? 'var(--color-text-primary)' : 'var(--color-text-muted)'),
            fontStyle: hasText && !showPermHint ? 'normal' : 'italic',
          }}
          title={transcript}
        >
          {showPermHint
            ? 'Acepta el permiso...'
            : whisperMode
              ? (hasText ? transcript : 'Grabando...')
              : (transcript || 'Escuchando...')}
        </span>

        <Waveform active={true} streamRef={streamRef} />

        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={() => { if (whisperMode) cancelWhisper(); else stopAll('cancel') }}
            aria-label="Cancelar"
            className="w-8 h-8 rounded-[10px] flex items-center justify-center transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-muted)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <svg style={{ width: '13px', height: '13px' }} fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* En Whisper mode: botón de stop para terminar grabación y transcribir */}
          {whisperMode ? (
            <button type="button" onClick={stopWhisperRecording}
              aria-label="Detener y transcribir"
              className="w-8 h-8 rounded-[10px] flex items-center justify-center transition-all"
              style={{ background: 'var(--color-accent)', color: '#0a0a0a', border: 'none' }}>
              <svg style={{ width: '13px', height: '13px' }} fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          ) : (
            <>
              <button type="button"
                onClick={() => { const final = accRef.current.trim() || transcript.trim(); stopAll('confirm'); if (final) cbRef.current.onConfirm?.(final) }}
                disabled={!hasText} aria-label="Editar texto"
                className="w-8 h-8 rounded-[10px] flex items-center justify-center transition-all disabled:opacity-30"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-muted)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <svg style={{ width: '13px', height: '13px' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487a2.25 2.25 0 013.182 3.182L7.5 20.213l-4 1 1-4L16.862 4.487z" />
                </svg>
              </button>
              <button type="button"
                onClick={() => { const final = accRef.current.trim() || transcript.trim(); stopAll('confirm'); if (final) { if (cbRef.current.onSend) cbRef.current.onSend(final); else cbRef.current.onConfirm?.(final) } }}
                disabled={!hasText} aria-label="Enviar"
                className="w-8 h-8 rounded-[10px] flex items-center justify-center transition-all disabled:opacity-30"
                style={{ background: hasText ? 'var(--color-accent)' : 'transparent', color: hasText ? '#0a0a0a' : 'var(--color-accent)', border: '1px solid rgba(245,197,24,0.35)' }}>
                <svg style={{ width: '13px', height: '13px' }} fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  // ─── UI: error ────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div
        className="flex items-center gap-2 w-full rounded-[16px] px-3 py-2"
        style={{
          background: 'rgba(248,113,113,0.10)',
          border: '1px solid rgba(248,113,113,0.30)',
        }}
      >
        <svg style={{ width: '14px', height: '14px', color: 'var(--color-danger)', flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <span className="text-xs flex-1" style={{ color: 'var(--color-danger)' }}>{errorMsg}</span>
        <button type="button" onClick={() => setState('idle')}
          className="text-[10px] px-2 py-1 rounded-lg"
          style={{ color: 'var(--color-text-muted)', background: 'var(--color-bg-hover)' }}>
          OK
        </button>
      </div>
    )
  }

  // ─── UI: idle ─────────────────────────────────────────────────────────
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
