'use client'
// components/asistente/VoiceInput.jsx — Entrada de voz con waveform animado

import { useState, useRef, useEffect, useCallback } from 'react'

const BAR_COUNT = 5

export default function VoiceInput({ onTranscript, disabled }) {
  const [supported, setSupported] = useState(false)
  const [recording, setRecording] = useState(false)
  const [bars, setBars] = useState(Array(BAR_COUNT).fill(0.25))
  const recognitionRef = useRef(null)
  const animTimerRef = useRef(null)

  useEffect(() => {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
    setSupported(!!SR)
  }, [])

  const animateBars = useCallback(() => {
    setBars(Array(BAR_COUNT).fill(0).map(() => 0.2 + Math.random() * 0.8))
  }, [])

  useEffect(() => {
    if (!recording) return
    const tick = () => {
      animateBars()
      animTimerRef.current = setTimeout(tick, 110)
    }
    tick()
    return () => clearTimeout(animTimerRef.current)
  }, [recording, animateBars])

  const stopRecording = useCallback(() => {
    setRecording(false)
    setBars(Array(BAR_COUNT).fill(0.25))
    clearTimeout(animTimerRef.current)
    try { recognitionRef.current?.stop() } catch {}
    recognitionRef.current = null
  }, [])

  const startRecording = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const recognition = new SR()
    recognition.lang = 'es-CO'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onstart = () => { setRecording(true) }
    recognition.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript
      if (transcript) onTranscript(transcript)
      stopRecording()
    }
    recognition.onerror = stopRecording
    recognition.onend = stopRecording
    recognitionRef.current = recognition
    recognition.start()
  }, [onTranscript, stopRecording])

  useEffect(() => () => { clearTimeout(animTimerRef.current); try { recognitionRef.current?.stop() } catch {} }, [])

  if (!supported) return null

  return (
    <button
      type="button"
      onClick={recording ? stopRecording : startRecording}
      disabled={disabled}
      aria-label={recording ? 'Detener grabación' : 'Hablar con Lucas'}
      className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 transition-all disabled:opacity-40"
      style={{
        background: recording ? 'color-mix(in srgb, var(--color-danger) 15%, transparent)' : 'var(--color-bg-hover)',
        border: `1px solid ${recording ? 'var(--color-danger)' : 'var(--color-border)'}`,
        color: recording ? 'var(--color-danger)' : 'var(--color-text-muted)',
      }}
    >
      {recording ? (
        <div className="flex items-end justify-center gap-[2px]" style={{ width: '20px', height: '20px', padding: '2px 0' }}>
          {bars.map((h, i) => (
            <div
              key={i}
              style={{
                width: '3px',
                height: `${Math.round(h * 16)}px`,
                borderRadius: '2px',
                background: 'var(--color-danger)',
                transition: 'height 0.1s ease',
                minHeight: '3px',
              }}
            />
          ))}
        </div>
      ) : (
        <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round"/>
          <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round"/>
        </svg>
      )}
    </button>
  )
}
