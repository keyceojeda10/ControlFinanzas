'use client'
// components/layout/VerificarEmailBanner.jsx
// Banner persistente que aparece cuando el usuario no ha verificado su email.
// Consulta la DB para verificar el estado real (no confiar en el JWT estático).

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

export default function VerificarEmailBanner() {
  const { data: session } = useSession()
  const [verificado, setVerificado] = useState(null) // null = loading, true/false
  const [enviando, setEnviando]   = useState(false)
  const [reenviado, setReenviado] = useState(false)

  const email = session?.user?.email
  const rol   = session?.user?.rol

  // Consultar estado real de verificación
  useEffect(() => {
    if (!email || rol === 'superadmin') return
    // Si el JWT ya dice verificado, confiar y no consultar
    if (session?.user?.emailVerificado === true) {
      setVerificado(true)
      return
    }
    // Consultar la DB
    fetch('/api/auth/estado-verificacion')
      .then(r => r.json())
      .then(d => setVerificado(d.verificado === true))
      .catch(() => setVerificado(true)) // en caso de error, no bloquear
  }, [email, rol, session?.user?.emailVerificado])

  // No mostrar mientras carga, si ya está verificado, o si es superadmin
  if (!session?.user || verificado !== false || rol === 'superadmin') return null

  const handleReenviar = async () => {
    if (enviando || reenviado) return
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

  return (
    <div className="bg-[rgba(245,197,24,0.1)] border-b border-[rgba(245,197,24,0.2)] px-4 py-3">
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <svg className="w-5 h-5 text-[#f5c518] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <div>
            <p className="text-sm text-[#f5c518] font-semibold">Verifica tu correo</p>
            <p className="text-xs text-[#888888] mt-0.5 leading-relaxed">
              Te enviamos un link a <span className="text-white font-medium">{email}</span>.
              Tienes 24 horas para verificar o tu cuenta sera bloqueada.
            </p>
          </div>
        </div>
        <button
          onClick={handleReenviar}
          disabled={enviando || reenviado}
          className="shrink-0 h-8 px-4 rounded-[10px] text-xs font-semibold transition-all disabled:opacity-60 cursor-pointer"
          style={{
            background: reenviado ? 'rgba(34,197,94,0.15)' : 'rgba(245,197,24,0.15)',
            color: reenviado ? '#22c55e' : '#f5c518',
            border: `1px solid ${reenviado ? 'rgba(34,197,94,0.3)' : 'rgba(245,197,24,0.3)'}`,
          }}
        >
          {reenviado ? 'Enviado' : enviando ? 'Enviando...' : 'Reenviar email'}
        </button>
      </div>
    </div>
  )
}
