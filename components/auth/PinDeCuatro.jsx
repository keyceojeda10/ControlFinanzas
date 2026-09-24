'use client'
/* Cuatro números. Un solo input (no cuatro cajitas: con cuatro, iOS pierde el foco
   entre una y otra), teclado numérico, 20px para que iOS no haga zoom, y se envía
   solo al completar el cuarto número. */
import { useState, useEffect, useRef } from 'react'

export default function PinDeCuatro({ titulo, onCompleto, error, cargando = false }) {
  const [pin, setPin] = useState('')
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])
  useEffect(() => { if (error) setPin('') }, [error])

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] font-semibold" style={{ color: 'var(--cf-ink)' }}>{titulo}</p>
      <input
        ref={ref}
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d*"
        maxLength={4}
        disabled={cargando}
        value={pin}
        aria-label={titulo}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 4)
          setPin(v)
          if (v.length === 4) onCompleto(v)
        }}
        style={{
          height: 56, borderRadius: 'var(--cf-r-control)', border: '1px solid var(--cf-border-strong)',
          background: 'var(--cf-card)', color: 'var(--cf-ink)', fontSize: 27, letterSpacing: '.6em',
          textAlign: 'center', fontFamily: 'var(--font-space-grotesk)',
        }}
      />
      {error && <p className="text-[13px]" style={{ color: 'var(--cf-red-darker)' }}>{error}</p>}
    </div>
  )
}
