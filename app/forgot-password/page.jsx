'use client'

import { useState } from 'react'
import Link from 'next/link'
import AuthShell  from '@/components/auth/AuthShell'
import AuthInput  from '@/components/auth/AuthInput'
import AuthButton from '@/components/auth/AuthButton'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) { setError('Ingresa tu correo electrónico'); return }
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al enviar'); return }
      setEnviado(true)
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  if (enviado) {
    return (
      <AuthShell
        title="Revisa tu correo"
        subtitle="Te enviamos un enlace para recuperar tu contraseña"
        footer={
          <Link href="/login" className="font-medium hover:underline" style={{ color: 'var(--color-accent)' }}>
            Volver al login
          </Link>
        }
      >
        <div className="text-center py-2">
          <div className="relative inline-block mb-4">
            <div className="absolute inset-0 rounded-full blur-2xl opacity-50"
              style={{ background: 'radial-gradient(circle, #22c55e 0%, transparent 70%)' }}
            />
            <div className="relative w-14 h-14 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, color-mix(in srgb, #22c55e 30%, transparent), color-mix(in srgb, #22c55e 10%, transparent))',
                border: '1px solid color-mix(in srgb, #22c55e 35%, transparent)',
              }}
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                style={{ color: '#22c55e' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <p className="text-sm mb-3" style={{ color: 'var(--color-text-primary)' }}>
            Si existe una cuenta con <strong style={{ color: 'var(--color-accent)' }}>{email}</strong>, recibirás un enlace para restablecer tu contraseña.
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            El enlace expira en 1 hora. Revisa también tu carpeta de spam.
          </p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Recuperar contraseña"
      subtitle="Te enviaremos un enlace a tu correo"
      footer={
        <Link href="/login" className="font-medium hover:underline" style={{ color: 'var(--color-accent)' }}>
          Volver al login
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2.5 text-sm rounded-[10px] px-4 py-3"
            style={{
              background: 'var(--color-danger-dim)',
              border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)',
              color: 'var(--color-danger)',
            }}
          >
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        <AuthInput
          id="email"
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="usuario@ejemplo.com"
          icon={
            <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          }
        />

        <AuthButton loading={loading} loadingLabel="Enviando...">
          Enviar enlace
        </AuthButton>
      </form>
    </AuthShell>
  )
}
