'use client'

import Link from 'next/link'

export default function PagoFallido() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-sm text-center">
        <div
          className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6"
          style={{ background: 'rgba(239,68,68,0.15)', border: '2px solid rgba(239,68,68,0.3)' }}
        >
          <svg className="w-10 h-10 text-[#ef4444]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-[white] mb-2">
          Pago no completado
        </h1>
        <p className="text-sm text-[#888888] mb-8">
          No pudimos procesar tu pago. Esto puede pasar si cancelaste el proceso o si hubo un problema con tu medio de pago.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/configuracion/plan"
            className="inline-flex items-center justify-center h-11 px-8 rounded-[12px] bg-[#f5c518] hover:bg-[#f0b800] text-white font-semibold text-sm transition-all"
          >
            Intentar de nuevo
          </Link>
          <a
            href="mailto:soporte@control-finanzas.com"
            className="inline-flex items-center justify-center h-11 px-8 rounded-[12px] bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222222] text-[#888888] font-medium text-sm transition-all"
          >
            Contactar soporte
          </a>
        </div>
      </div>
    </div>
  )
}
