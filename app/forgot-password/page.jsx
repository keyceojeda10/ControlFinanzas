'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

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
      <div className="min-h-dvh flex flex-col items-center justify-center bg-[#0a0a0a] px-4">
        <div className="w-full max-w-sm text-center">
          <Image src="/logo-icon.svg" alt="Control Finanzas" width={56} height={56} className="mx-auto mb-5" priority />
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[24px] p-8">
            <div className="w-14 h-14 rounded-full bg-[rgba(16,185,129,0.12)] flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[#22c55e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Revisa tu correo</h2>
            <p className="text-sm text-[#888888] mb-4">
              Si existe una cuenta con <strong className="text-white">{email}</strong>, recibirás un enlace para restablecer tu contraseña.
            </p>
            <p className="text-xs text-[#555555]">
              El enlace expira en 1 hora. Revisa también tu carpeta de spam.
            </p>
          </div>
          <Link href="/login" className="inline-block mt-6 text-sm text-[#f5c518] hover:underline font-medium">
            Volver al login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image src="/logo-icon.svg" alt="Control Finanzas" width={56} height={56} className="mx-auto mb-5" priority />
          <h1 className="text-2xl font-bold text-white tracking-tight">Recuperar contraseña</h1>
          <p className="text-sm text-[#888888] mt-1">Te enviaremos un enlace a tu correo</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[24px] p-8 space-y-4">
          {error && (
            <div className="flex items-center gap-2.5 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm rounded-[10px] px-4 py-3">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-[11px] font-medium text-[#888888] uppercase tracking-[0.05em]">
              Correo electrónico
            </label>
            <input
              id="email" type="email" autoComplete="email" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
              className="w-full h-10 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#111111] text-sm text-white placeholder-[#555555] focus:outline-none focus:border-[#f5c518] focus:ring-1 focus:ring-[rgba(245,197,24,0.2)] transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 mt-1 rounded-[12px] bg-[#f5c518] hover:bg-[#f0b800] disabled:opacity-60 text-[#0a0a0a] font-bold text-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer hover:shadow-[0_0_20px_rgba(245,197,24,0.3)]"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Enviando...
              </>
            ) : 'Enviar enlace de recuperación'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#888888]">
          <Link href="/login" className="text-[#f5c518] hover:underline font-medium">
            Volver al login
          </Link>
        </p>
      </div>
    </div>
  )
}
