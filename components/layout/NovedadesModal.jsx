'use client'
// components/layout/NovedadesModal.jsx
// Muestra UNA vez por versión las novedades del sistema. Persiste la última
// versión vista en localStorage (cf:novedades:visto). Sin backend.

import { useEffect, useState } from 'react'
import { NOVEDADES, NOVEDADES_VERSION } from '@/lib/novedades'

const LS_KEY = 'cf:novedades:visto'

const ICONS = {
  calculator: 'M9 7h6m-6 4h6m-2 5h2M5 3h14a1 1 0 011 1v16a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z',
  printer: 'M6 9V2h12v7m-12 0h12m-12 0a2 2 0 00-2 2v5a2 2 0 002 2h1m11-9a2 2 0 012 2v5a2 2 0 01-2 2h-1m-10 0v4h8v-4m-8 0h8',
  calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  filter: 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L14 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 018 21v-7.586L3.293 6.707A1 1 0 013 6V4z',
  sparkles: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
}

export default function NovedadesModal() {
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    try {
      const visto = Number(localStorage.getItem(LS_KEY) || 0)
      if (NOVEDADES_VERSION > visto) {
        // pequeño delay para no competir con el render inicial / otros modales
        const t = setTimeout(() => setAbierto(true), 600)
        return () => clearTimeout(t)
      }
    } catch {}
  }, [])

  const cerrar = () => {
    try { localStorage.setItem(LS_KEY, String(NOVEDADES_VERSION)) } catch {}
    setAbierto(false)
  }

  if (!abierto) return null

  const entrada = NOVEDADES[0]
  if (!entrada) return null

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Novedades del sistema"
    >
      {/* Backdrop */}
      <button
        aria-label="Cerrar"
        onClick={cerrar}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        style={{ animation: 'cf-nov-fade 180ms ease-out' }}
      />

      {/* Panel */}
      <div
        className="relative w-full sm:max-w-md max-h-[88vh] overflow-y-auto rounded-t-[20px] sm:rounded-[20px] border border-[var(--color-border)] bg-[var(--color-bg-card)]"
        style={{ animation: 'cf-nov-up 260ms cubic-bezier(0.22,1,0.36,1)' }}
      >
        {/* Encabezado con acento */}
        <div
          className="px-5 pt-5 pb-4 border-b border-[var(--color-border)]"
          style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 10%, transparent) 0%, transparent 100%)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 18%, transparent)', color: 'var(--color-accent)' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={ICONS.sparkles} />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-[white] leading-tight">¡Tenemos novedades!</h2>
              <p className="text-[11px] text-[var(--color-text-muted)]">Esto es lo nuevo en Control Finanzas</p>
            </div>
          </div>
        </div>

        {/* Lista de novedades */}
        <div className="px-5 py-4 space-y-3">
          {entrada.items.map((it, i) => (
            <div key={i} className="flex gap-3">
              <div
                className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-accent)' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[it.icon] || ICONS.sparkles} />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[white] leading-snug">{it.titulo}</p>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mt-0.5">{it.texto}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Acción */}
        <div className="px-5 pb-5 pt-1">
          <button
            onClick={cerrar}
            className="w-full h-11 rounded-[12px] text-sm font-semibold transition-all"
            style={{ background: 'var(--color-accent)', color: '#1a1a1a' }}
          >
            Entendido
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes cf-nov-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cf-nov-up { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
        @media (prefers-reduced-motion: reduce) {
          .fixed [style*="cf-nov-up"], .fixed [style*="cf-nov-fade"] { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
