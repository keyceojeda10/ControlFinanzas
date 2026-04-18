'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense, useState } from 'react'
import Link from 'next/link'

function VerificarEmailContent() {
  const params = useSearchParams()
  const router = useRouter()
  const success = params.get('success')
  const error = params.get('error')
  const email = params.get('email') || ''
  const [enviando, setEnviando] = useState(false)
  const [reenviado, setReenviado] = useState(false)

  async function handleReenviar() {
    if (!email || enviando) return
    setEnviando(true)
    try {
      await fetch('/api/auth/reenviar-verificacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setReenviado(true)
    } finally {
      setEnviando(false)
    }
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-5"
          style={{ background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.3)' }}>
          <svg className="w-8 h-8 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">¡Email verificado!</h1>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">Tu cuenta está activa. Ya puedes ingresar.</p>
        <Link href="/login"
          className="inline-flex items-center justify-center h-11 px-8 rounded-[12px] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-primary)] font-semibold text-sm transition-all">
          Iniciar sesión
        </Link>
      </div>
    )
  }

  if (error === 'token_expirado') {
    return (
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-5"
          style={{ background: 'rgba(245,158,11,0.12)', border: '2px solid rgba(245,158,11,0.2)' }}>
          <span className="text-2xl">⏳</span>
        </div>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Link expirado</h1>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">El link de verificación expiró. Te enviamos uno nuevo.</p>
        {reenviado ? (
          <p className="text-sm text-[var(--color-success)]">¡Listo! Revisa tu correo.</p>
        ) : (
          <button onClick={handleReenviar} disabled={enviando}
            className="inline-flex items-center justify-center h-11 px-8 rounded-[12px] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-primary)] font-semibold text-sm transition-all disabled:opacity-50">
            {enviando ? 'Enviando...' : 'Reenviar verificación'}
          </button>
        )}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-5"
          style={{ background: 'rgba(239,68,68,0.12)', border: '2px solid rgba(239,68,68,0.2)' }}>
          <span className="text-2xl">❌</span>
        </div>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Link inválido</h1>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">El link no es válido. Intenta registrarte de nuevo.</p>
        <Link href="/registro"
          className="inline-flex items-center justify-center h-11 px-8 rounded-[12px] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-primary)] font-semibold text-sm transition-all">
          Crear cuenta
        </Link>
      </div>
    )
  }

  // Estado por defecto: esperando verificación
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-5"
        style={{ background: 'rgba(245,197,24,0.1)', border: '2px solid rgba(245,197,24,0.2)' }}>
        <svg className="w-8 h-8 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Verifica tu correo</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-1">
        Te enviamos un link de verificacion{email ? ' a:' : '. Revisa tu bandeja de entrada.'}
      </p>
      {email && (
        <p className="text-sm text-[var(--color-text-primary)] font-semibold mb-3">{email}</p>
      )}
      <p className="text-xs text-[var(--color-text-muted)] mb-5">Revisa tu bandeja de entrada y la carpeta de spam.</p>

      {email && !reenviado && (
        <button onClick={handleReenviar} disabled={enviando}
          className="w-full h-10 rounded-[12px] text-sm font-medium text-[var(--color-accent)] bg-[rgba(245,197,24,0.1)] border border-[rgba(245,197,24,0.2)] hover:bg-[rgba(245,197,24,0.15)] transition-all disabled:opacity-50 mb-4">
          {enviando ? 'Enviando...' : 'Reenviar email de verificacion'}
        </button>
      )}
      {reenviado && (
        <p className="text-sm text-[var(--color-success)] mb-4">Email reenviado. Revisa tu correo.</p>
      )}

      <Link href="/login" className="text-sm text-[var(--color-accent)] hover:underline">
        Ya verifique → Iniciar sesion
      </Link>
    </div>
  )
}

export default function VerificarEmailPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-[var(--color-bg-base)] px-4">
      <div className="w-full max-w-sm bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[20px] p-8">
        <Suspense>
          <VerificarEmailContent />
        </Suspense>
      </div>
    </div>
  )
}
