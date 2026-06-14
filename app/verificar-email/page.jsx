'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense, useState } from 'react'
import Link from 'next/link'

function VerificarEmailContent() {
  const params = useSearchParams()
  const router = useRouter()
  const success = params.get('success')
  const error = params.get('error')
  const emailParam = params.get('email') || ''

  const [email, setEmail]         = useState(emailParam)
  const [codigo, setCodigo]       = useState('')
  const [loading, setLoading]     = useState(false)
  const [errorMsg, setErrorMsg]   = useState('')
  const [verificado, setVerificado] = useState(!!success)
  const [reenviando, setReenviando] = useState(false)
  const [reenviado, setReenviado]   = useState(false)

  async function handleVerificar() {
    if (!email || codigo.length !== 6 || loading) return
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/auth/verificar-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), codigo: codigo.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error || 'Código inválido'); return }
      setVerificado(true)
    } catch {
      setErrorMsg('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  async function handleReenviar() {
    if (!email || reenviando || reenviado) return
    setReenviando(true)
    try {
      await fetch('/api/auth/reenviar-verificacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      setReenviado(true)
      setCodigo('')
      setErrorMsg('')
      setTimeout(() => setReenviado(false), 30000)
    } finally {
      setReenviando(false)
    }
  }

  // Verificado exitosamente
  if (verificado) {
    return (
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-5"
          style={{ background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.3)' }}>
          <svg className="w-8 h-8 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Correo verificado</h1>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">Tu cuenta esta activa. Ya puedes ingresar.</p>
        <Link href="/login"
          className="inline-flex items-center justify-center h-11 px-8 rounded-[12px] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-primary)] font-semibold text-sm transition-all">
          Iniciar sesión
        </Link>
      </div>
    )
  }

  // Token invalido (link viejo)
  if (error === 'token_invalido') {
    return (
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-5"
          style={{ background: 'rgba(239,68,68,0.12)', border: '2px solid rgba(239,68,68,0.2)' }}>
          <svg className="w-8 h-8 text-[var(--color-danger)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Link inválido</h1>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">Ahora usamos codigos de verificación. Ingresa tu email para recibir uno nuevo.</p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          className="w-full h-11 px-4 rounded-[12px] text-sm mb-3 outline-none"
          style={{ background: 'var(--color-bg-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
        />
        <button onClick={handleReenviar} disabled={reenviando || reenviado || !email}
          className="w-full h-11 rounded-[12px] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-primary)] font-semibold text-sm transition-all disabled:opacity-50">
          {reenviado ? 'Código enviado — revisa tu correo' : reenviando ? 'Enviando...' : 'Enviar código'}
        </button>
      </div>
    )
  }

  // Formulario principal: ingresar email + codigo
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-5"
        style={{ background: 'rgba(245,197,24,0.1)', border: '2px solid rgba(245,197,24,0.2)' }}>
        <svg className="w-8 h-8 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Verifica tu correo</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-5">
        {email
          ? <>Ingresa el código que enviamos a <span className="text-[var(--color-text-primary)] font-semibold">{email}</span></>
          : 'Ingresa tu email y el código de verificación'}
      </p>

      {errorMsg && (
        <div className="flex items-center justify-center gap-2 text-sm rounded-[10px] px-4 py-2.5 mb-4"
          style={{ background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.30)', color: '#f87171' }}>
          {errorMsg}
        </div>
      )}

      {!email && (
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          className="w-full h-11 px-4 rounded-[12px] text-sm mb-3 outline-none"
          style={{ background: 'var(--color-bg-hover)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
        />
      )}

      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={codigo}
        onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
        onKeyDown={(e) => e.key === 'Enter' && handleVerificar()}
        placeholder="Código de 6 dígitos"
        className="w-full h-11 px-4 rounded-[12px] text-sm text-center font-mono font-bold tracking-[0.3em] mb-4 outline-none"
        style={{ background: 'var(--color-bg-hover)', border: `1px solid ${codigo.length === 6 ? 'var(--color-accent)' : 'var(--color-border)'}`, color: 'var(--color-text-primary)' }}
      />

      <button
        onClick={handleVerificar}
        disabled={loading || codigo.length !== 6 || !email}
        className="w-full h-11 rounded-[12px] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-primary)] font-semibold text-sm transition-all disabled:opacity-50 mb-4"
      >
        {loading ? 'Verificando...' : 'Verificar'}
      </button>

      <div className="flex flex-col items-center gap-2.5">
        {email && (
          <button onClick={handleReenviar} disabled={reenviando || reenviado}
            className="text-sm font-medium transition-colors disabled:opacity-50"
            style={{ color: reenviado ? 'var(--color-success)' : 'var(--color-accent)' }}>
            {reenviado ? 'Código reenviado' : reenviando ? 'Reenviando...' : 'Reenviar código'}
          </button>
        )}
        <Link href="/login" className="text-sm hover:underline" style={{ color: 'var(--color-text-muted)' }}>
          Ir a iniciar sesión
        </Link>
      </div>

      <p className="text-[11px] mt-5 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
        Revisa tu bandeja de entrada y la carpeta de spam. El código expira en 30 minutos.
      </p>
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
