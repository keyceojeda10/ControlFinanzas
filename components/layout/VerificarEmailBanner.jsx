'use client'
// components/layout/VerificarEmailBanner.jsx
// Banner amigable con input OTP inline para verificar email desde el dashboard.

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

export default function VerificarEmailBanner() {
  const { data: session, update } = useSession()
  const [verificado, setVerificado] = useState(null)
  const [codigo, setCodigo]         = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState(false)
  const [reenviado, setReenviado]   = useState(false)
  const [reenviando, setReenviando] = useState(false)

  const email = session?.user?.email
  const rol   = session?.user?.rol

  useEffect(() => {
    if (!email || rol === 'superadmin') return
    if (session?.user?.emailVerificado === true) {
      setVerificado(true)
      return
    }
    fetch('/api/auth/estado-verificacion')
      .then(r => r.json())
      .then(d => setVerificado(d.verificado === true))
      .catch(() => setVerificado(true))
  }, [email, rol, session?.user?.emailVerificado])

  if (!session?.user || verificado !== false || rol === 'superadmin' || success) return null

  const handleVerificar = async () => {
    if (loading || codigo.length !== 6) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/verificar-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, codigo: codigo.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Codigo invalido'); return }
      setSuccess(true)
      update?.()
    } catch {
      setError('Error de conexion')
    } finally {
      setLoading(false)
    }
  }

  const handleReenviar = async () => {
    if (reenviando || reenviado) return
    setReenviando(true)
    try {
      await fetch('/api/auth/reenviar-verificacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setReenviado(true)
      setCodigo('')
      setError('')
      setTimeout(() => setReenviado(false), 30000)
    } finally {
      setReenviando(false)
    }
  }

  return (
    <div className="bg-[rgba(245,197,24,0.08)] border-b border-[rgba(245,197,24,0.15)] px-4 py-3">
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-4">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <svg className="w-5 h-5 text-[var(--color-accent)] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          <div>
            <p className="text-sm text-[var(--color-accent)] font-semibold">Verifica tu correo para asegurar tu cuenta</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-relaxed">
              Ingresa el codigo de 6 digitos que enviamos a <span className="text-[var(--color-text-primary)] font-medium">{email}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => e.key === 'Enter' && handleVerificar()}
            placeholder="000000"
            className="w-[90px] h-8 px-2.5 text-center text-[13px] font-mono font-bold rounded-[8px] outline-none transition-all tracking-widest"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${codigo.length === 6 ? 'rgba(245,197,24,0.5)' : 'rgba(255,255,255,0.1)'}`,
              color: 'var(--color-text-primary)',
            }}
          />
          <button
            onClick={handleVerificar}
            disabled={loading || codigo.length !== 6}
            className="shrink-0 h-8 px-4 rounded-[8px] text-xs font-semibold transition-all disabled:opacity-40 cursor-pointer"
            style={{ background: 'rgba(245,197,24,0.15)', color: 'var(--color-accent)', border: '1px solid rgba(245,197,24,0.3)' }}
          >
            {loading ? '...' : 'Verificar'}
          </button>
          <button
            onClick={handleReenviar}
            disabled={reenviando || reenviado}
            className="shrink-0 text-[11px] font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
            style={{ color: reenviado ? 'var(--color-success)' : 'var(--color-text-muted)' }}
          >
            {reenviado ? 'Enviado' : reenviando ? '...' : 'Reenviar'}
          </button>
        </div>
      </div>

      {error && (
        <div className="max-w-3xl mx-auto mt-1.5">
          <p className="text-[11px] text-[var(--color-danger)]">{error}</p>
        </div>
      )}
    </div>
  )
}
