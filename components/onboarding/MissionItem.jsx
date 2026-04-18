'use client'

import { useState } from 'react'
import Link from 'next/link'
import { InstallGuideModal } from '@/components/layout/InstallButton'

const ICONOS = {
  cliente: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  prestamo: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  pago: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  ruta: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  ),
  caja: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  cobrador: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  instalar: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  ),
}

export default function MissionItem({ mision, onSpotlight }) {
  const [showInstallGuide, setShowInstallGuide] = useState(false)
  const icono = ICONOS[mision.icono] || ICONOS.cliente
  const isInstallMission = mision.id === 'instalar-app'

  if (mision.completada) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] bg-[rgba(34,197,94,0.06)]">
        {/* Check animado */}
        <div className="w-7 h-7 rounded-full bg-[var(--color-success)] flex items-center justify-center shrink-0 onboarding-check">
          <svg className="w-3.5 h-3.5 text-[var(--color-text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--color-success)] line-through opacity-70">{mision.titulo}</p>
        </div>
      </div>
    )
  }

  // Install mission opens the smart guide modal instead of navigating
  if (isInstallMission) {
    return (
      <>
        <button
          onClick={() => setShowInstallGuide(true)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] hover:bg-[var(--color-bg-hover)] transition-all group text-left"
        >
          <div className="w-7 h-7 rounded-full border-2 border-[var(--color-border-hover)] flex items-center justify-center shrink-0 text-[var(--color-text-muted)] group-hover:border-[#f5c518] group-hover:text-[var(--color-accent)] transition-colors">
            {icono}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">{mision.titulo}</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">{mision.descripcion}</p>
          </div>
          <svg className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        {showInstallGuide && <InstallGuideModal onClose={() => setShowInstallGuide(false)} />}
      </>
    )
  }

  return (
    <Link
      href={mision.href}
      onClick={() => onSpotlight?.(mision.id)}
      className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] hover:bg-[var(--color-bg-hover)] transition-all group"
    >
      {/* Icon circle */}
      <div className="w-7 h-7 rounded-full border-2 border-[var(--color-border-hover)] flex items-center justify-center shrink-0 text-[var(--color-text-muted)] group-hover:border-[#f5c518] group-hover:text-[var(--color-accent)] transition-colors">
        {icono}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">{mision.titulo}</p>
        <p className="text-[10px] text-[var(--color-text-muted)]">{mision.descripcion}</p>
      </div>
      {/* Arrow */}
      <svg className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}
