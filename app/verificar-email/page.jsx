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
          <svg className="w-8 h-8 text-[#22c55e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-white mb-2">¡Email verificado!</h1>
        <p className="text-sm text-[#888888] mb-6">Tu cuenta está activa. Ya puedes ingresar.</p>
        <Link href="/login"
          className="inline-flex items-center justify-center h-11 px-8 rounded-[12px] bg-[#f5c518] hover:bg-[#f0b800] text-white font-semibold text-sm transition-all">
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
        <h1 className="text-xl font-bold text-white mb-2">Link expirado</h1>
        <p className="text-sm text-[#888888] mb-6">El link de verificación expiró. Te enviamos uno nuevo.</p>
        {reenviado ? (
          <p className="text-sm text-[#22c55e]">¡Listo! Revisa tu correo.</p>
        ) : (
          <button onClick={handleReenviar} disabled={enviando}
            className="inline-flex items-center justify-center h-11 px-8 rounded-[12px] bg-[#f5c518] hover:bg-[#f0b800] text-white font-semibold text-sm transition-all disabled:opacity-50">
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
        <h1 className="text-xl font-bold text-white mb-2">Link inválido</h1>
        <p className="text-sm text-[#888888] mb-6">El link no es válido. Intenta registrarte de nuevo.</p>
        <Link href="/registro"
          className="inline-flex items-center justify-center h-11 px-8 rounded-[12px] bg-[#f5c518] hover:bg-[#f0b800] text-white font-semibold text-sm transition-all">
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
        <span className="text-2xl">📧</span>
      </div>
      <h1 className="text-xl font-bold text-white mb-2">Verifica tu correo</h1>
      <p className="text-sm text-[#888888] mb-2">
        Te enviamos un link de verificación. Revisa tu bandeja de entrada.
      </p>
      <p className="text-xs text-[#555555] mb-6">Si no lo ves, revisa la carpeta de spam.</p>
      <Link href="/login" className="text-sm text-[#f5c518] hover:underline">
        Ya verifiqué → Iniciar sesión
      </Link>
    </div>
  )
}

export default function VerificarEmailPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-[20px] p-8">
        <Suspense>
          <VerificarEmailContent />
        </Suspense>
      </div>
    </div>
  )
}
