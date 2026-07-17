'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org') || ''

  const [identificador, setIdentificador] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!identificador.trim() || !pin.trim()) {
      setError('Ingresa tu documento o teléfono y tu PIN')
      return
    }
    if (!orgId) {
      setError('Link de acceso no válido. Solicita uno nuevo a tu prestamista.')
      return
    }

    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/portal/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador: identificador.trim(), pin, organizationId: orgId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al iniciar sesión')
        return
      }
      router.push('/portal')
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-[16px] bg-[var(--color-accent)] mx-auto flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-[22px] font-bold tracking-tight text-[var(--color-text-primary)]">Portal de clientes</h1>
          <p className="text-[13px] text-[var(--color-text-muted)] mt-1">Consulta el estado de tus préstamos</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5">
              Documento o teléfono
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={identificador}
              onChange={e => setIdentificador(e.target.value)}
              placeholder="Cédula o número de celular"
              className="w-full h-11 px-3.5 rounded-[12px] bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-[14px] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5">
              PIN de acceso
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="Tu PIN de 4 dígitos"
              maxLength={6}
              className="w-full h-11 px-3.5 rounded-[12px] bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-[14px] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors font-mono tracking-[0.3em]"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-[12px] text-[var(--color-danger)] bg-[var(--color-danger-dim)] px-3 py-2 rounded-[10px]">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-[12px] bg-[var(--color-accent)] text-black font-bold text-[14px] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="text-center text-[11px] text-[var(--color-text-muted)] mt-6">
          Si no tienes acceso, solicita tu PIN a tu prestamista
        </p>
      </div>
    </div>
  )
}

export default function PortalLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse w-14 h-14 rounded-[16px] bg-[var(--color-bg-hover)]" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
