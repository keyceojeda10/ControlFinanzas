'use client'
// components/ui/CardActionMenu.jsx
// Menu de acciones rapidas para cards (reemplaza swipe-to-reveal).
// Kebab (tres puntos) + dropdown flotante con glass effect.
// Funciona en movil y desktop. Previene navegacion del Link padre.

import { useState, useRef, useEffect } from 'react'

export default function CardActionMenu({ actions = [] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const t = setTimeout(() => document.addEventListener('pointerdown', close), 0)
    return () => { clearTimeout(t); document.removeEventListener('pointerdown', close) }
  }, [open])

  if (!actions.length) return null

  // Interceptar clicks para que no navegue el Link padre
  const stop = (e) => { e.preventDefault(); e.stopPropagation() }

  return (
    <div ref={ref} className="relative shrink-0 ml-1" onClick={stop} onMouseDown={stop}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-[var(--color-bg-hover)] active:scale-90 cursor-pointer"
        style={{ color: 'var(--color-text-muted)' }}
        aria-label="Acciones rápidas"
      >
        <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 min-w-[170px] rounded-[12px] overflow-hidden shadow-2xl p-1.5 z-50 glass-strong"
          style={{ border: '1px solid var(--color-border)' }}
        >
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={(e) => { stop(e); setOpen(false); a.onClick?.(e) }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-[13px] font-medium transition-colors hover:bg-[var(--color-bg-hover)] active:scale-[0.97] cursor-pointer"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: `${a.color}18`, color: a.color }}
              >
                <span className="w-3.5 h-3.5">{a.icon}</span>
              </span>
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
