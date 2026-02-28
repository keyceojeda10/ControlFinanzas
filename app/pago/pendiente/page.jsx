'use client'

import Link from 'next/link'

export default function PagoPendiente() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[#0f1117] px-4">
      <div className="w-full max-w-sm text-center">
        <div
          className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6"
          style={{ background: 'rgba(245,158,11,0.15)', border: '2px solid rgba(245,158,11,0.3)' }}
        >
          <svg className="w-10 h-10 text-[#f59e0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-[#f1f5f9] mb-2">
          Pago en proceso
        </h1>
        <p className="text-sm text-[#94a3b8] mb-2">
          Tu pago está siendo procesado por MercadoPago.
        </p>
        <p className="text-xs text-[#64748b] mb-8">
          Puede tardar hasta 2 días hábiles. Te notificaremos cuando se confirme y tu plan se activará automáticamente.
        </p>

        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center h-11 px-8 rounded-[10px] bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold text-sm transition-all"
        >
          Ir al dashboard
        </Link>
      </div>
    </div>
  )
}
