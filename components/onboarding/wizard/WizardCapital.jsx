'use client'

import { useState } from 'react'
import { useCountry } from '@/hooks/useCountry'

export default function WizardCapital({ onComplete, alreadyDone, savedMonto = 0 }) {
  const { formatMoney, currencySymbol } = useCountry()
  const [monto, setMonto] = useState(savedMonto > 0 ? String(savedMonto) : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const montoNum = Number(monto.replace(/\D/g, '')) || 0

  const handleChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '')
    setMonto(raw)
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (montoNum <= 0) {
      setError('Ingresa un monto mayor a 0')
      return
    }

    // Si ya se registró capital antes (volvió atrás), solo avanzar
    if (alreadyDone) {
      onComplete({ monto: montoNum })
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/capital', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'capital_inicial',
          monto: montoNum,
          descripcion: 'Capital inicial registrado en el onboarding',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al registrar el capital')
        return
      }
      onComplete({ monto: montoNum })
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = () => {
    onComplete({ monto: 0, skipped: true })
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-[14px] flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--color-success)' }}>
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
              d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
          ¿Con cuánto dinero arrancas?
        </h2>
        <p className="text-[13px] max-w-[300px] mx-auto leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          Registra el dinero que tienes disponible para prestar. Así la caja siempre te va a cuadrar.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 text-sm rounded-[12px] px-4 py-3"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--color-danger)' }}>
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        <div className="rounded-[16px] p-5"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <label className="block text-[12px] font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            Capital disponible para prestar
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
              {currencySymbol || '$'}
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={montoNum > 0 ? montoNum.toLocaleString('es-CO') : ''}
              onChange={handleChange}
              placeholder="0"
              autoFocus
              className="w-full h-14 rounded-[12px] pl-9 pr-4 text-[22px] font-bold font-mono-display transition-all outline-none"
              style={{
                background: 'var(--color-bg-surface)',
                border: '1.5px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>
          {montoNum > 0 && (
            <p className="text-[11px] mt-2 font-medium" style={{ color: 'var(--color-success)' }}>
              {formatMoney(montoNum)} disponibles para prestar
            </p>
          )}
        </div>

        {alreadyDone ? (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-[10px]"
            style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="var(--color-success)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Ya registraste tu capital. Si quieres cambiarlo, puedes hacerlo después desde la sección Capital.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-[10px]"
            style={{ background: 'rgba(245,197,24,0.06)', border: '1px solid rgba(245,197,24,0.15)' }}>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="var(--color-accent)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
            </svg>
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Si no registras el capital, cada préstamo que crees se va a restar de $0 y la caja te va a salir en negativo.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || montoNum <= 0}
          className="w-full h-12 rounded-[12px] text-base font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
          style={{ background: 'var(--color-accent)', color: '#111' }}>
          {loading ? (
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : alreadyDone ? 'Continuar' : 'Registrar capital'}
        </button>

        <button
          type="button"
          onClick={handleSkip}
          className="w-full text-[11px] text-center transition-colors cursor-pointer py-1"
          style={{ color: 'var(--color-text-muted)' }}>
          Omitir por ahora
        </button>
      </form>
    </div>
  )
}
