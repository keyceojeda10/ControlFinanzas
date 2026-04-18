'use client'
// components/layout/SinRutaBanner.jsx — Aviso para cobradores sin ruta asignada
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'

export default function SinRutaBanner() {
  const { esCobrador, rutaId, loading } = useAuth()

  if (loading || !esCobrador || rutaId) return null

  return (
    <div className="mx-4 lg:mx-6 mt-4 flex items-center gap-3 bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.3)] rounded-[14px] px-4 py-3">
      <svg className="w-5 h-5 text-[var(--color-warning)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <div>
        <p className="text-sm font-semibold text-[var(--color-warning)]">No tienes una ruta asignada</p>
        <p className="text-xs text-[var(--color-text-muted)]">Contacta al administrador para que te asigne una ruta de cobro.</p>
      </div>
    </div>
  )
}
