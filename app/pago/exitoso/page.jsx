'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function PagoExitoso() {
  const [dots, setDots] = useState([])

  // Confetti simple
  useEffect(() => {
    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444']
    const items = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 6,
    }))
    setDots(items)
  }, [])

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[#0f1117] px-4 relative overflow-hidden">
      {/* Confetti */}
      {dots.map((d) => (
        <div
          key={d.id}
          className="absolute rounded-full animate-bounce"
          style={{
            left: `${d.left}%`,
            top: '-10px',
            width: d.size,
            height: d.size,
            background: d.color,
            animationDelay: `${d.delay}s`,
            animationDuration: `${d.duration}s`,
            opacity: 0.8,
          }}
        />
      ))}

      <div className="w-full max-w-sm text-center z-10">
        <div
          className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6"
          style={{ background: 'rgba(16,185,129,0.15)', border: '2px solid rgba(16,185,129,0.3)' }}
        >
          <svg className="w-10 h-10 text-[#10b981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-[#f1f5f9] mb-2">
          ¡Pago exitoso!
        </h1>
        <p className="text-sm text-[#94a3b8] mb-2">
          Tu suscripción ha sido activada correctamente.
        </p>
        <p className="text-xs text-[#64748b] mb-8">
          Tu plan estará activo por 30 días a partir de hoy.
        </p>

        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center h-11 px-8 rounded-[10px] bg-[#10b981] hover:bg-[#059669] text-white font-semibold text-sm transition-all"
        >
          Ir al dashboard
        </Link>
      </div>
    </div>
  )
}
