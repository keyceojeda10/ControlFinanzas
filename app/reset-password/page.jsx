'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

function ResetForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)

  if (!token) {
    return (
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[24px] p-8 text-center">
        <p className="text-[var(--color-danger)] text-sm mb-4">Enlace inválido. Solicita un nuevo enlace de recuperación.</p>
        <Link href="/forgot-password" className="text-sm text-[var(--color-accent)] hover:underline font-medium">
          Solicitar nuevo enlace
        </Link>
      </div>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al restablecer'); return }
      setExito(true)
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  if (exito) {
    return (
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[24px] p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-[rgba(16,185,129,0.12)] flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">Contraseña actualizada</h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">Tu contraseña ha sido restablecida exitosamente.</p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center h-11 px-8 rounded-[12px] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[#0a0a0a] font-bold text-sm transition-all"
        >
          Ir al login
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[24px] p-8 space-y-4">
      {error && (
        <div className="flex items-center gap-2.5 bg-[var(--color-danger-dim)] border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[var(--color-danger)] text-sm rounded-[10px] px-4 py-3">
          <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-[0.05em]">
          Nueva contraseña
        </label>
        <input
          id="password" type="password" autoComplete="new-password" required
          value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres"
          className="w-full h-10 px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-sm text-[var(--color-text-primary)] placeholder-[#555555] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[rgba(245,197,24,0.2)] transition-all"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm" className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-[0.05em]">
          Confirmar contraseña
        </label>
        <input
          id="confirm" type="password" autoComplete="new-password" required
          value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Repite la contraseña"
          className="w-full h-10 px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-sm text-[var(--color-text-primary)] placeholder-[#555555] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[rgba(245,197,24,0.2)] transition-all"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full h-11 mt-1 rounded-[12px] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-60 text-[#0a0a0a] font-bold text-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer hover:shadow-[0_0_20px_rgba(245,197,24,0.3)]"
      >
        {loading ? (
          <>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Guardando...
          </>
        ) : 'Restablecer contraseña'}
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[var(--color-bg-base)] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image src="/logo-icon.svg" alt="Control Finanzas" width={56} height={56} className="mx-auto mb-5" priority />
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">Nueva contraseña</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Ingresa tu nueva contraseña</p>
        </div>

        <Suspense fallback={<div className="h-48 bg-[var(--color-bg-surface)] rounded-[24px] animate-pulse" />}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  )
}
