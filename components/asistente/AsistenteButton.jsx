'use client'
// components/asistente/AsistenteButton.jsx — Boton flotante + drawer del asistente Fin
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import AsistenteChat from './AsistenteChat'

export default function AsistenteButton() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Cerrar al navegar
  useEffect(() => { setOpen(false) }, [pathname])

  // Bloquear scroll del body en mobile cuando esta abierto
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* Boton flotante — esquina inferior derecha, sobre BottomNav en mobile */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Abrir asistente IA"
        className="fixed bottom-[88px] right-4 lg:bottom-[90px] lg:right-6 z-40 w-12 h-12 lg:w-auto lg:h-auto lg:px-4 lg:py-2.5 rounded-full lg:rounded-[14px] flex items-center justify-center lg:gap-2 transition-all active:scale-95 shadow-lg"
        style={{
          background: open
            ? 'var(--color-accent)'
            : 'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 20%, var(--color-surface)), var(--color-surface))',
          border: '1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px color-mix(in srgb, var(--color-accent) 20%, transparent)',
          color: open ? '#0a0a0a' : 'var(--color-accent)',
        }}
      >
        <svg
          className="w-5 h-5 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
          />
        </svg>
        <span className="hidden lg:inline text-sm font-semibold">Fin IA</span>
      </button>

      {/* Backdrop solo en mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Panel del chat: slide-up en mobile, panel lateral en desktop */}
      <div
        className="fixed z-50 transition-all duration-300"
        style={{
          bottom: 0,
          left: 0,
          right: 0,
          height: open ? '85vh' : '0',
          overflow: 'hidden',
          borderRadius: '24px 24px 0 0',
          background: 'var(--color-background)',
          border: open ? '1px solid var(--color-border)' : 'none',
          borderBottom: 'none',
          boxShadow: open ? '0 -8px 40px rgba(0,0,0,0.4)' : 'none',
        }}
      >
        {open && (
          <div className="h-full flex flex-col">
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div
                className="w-10 h-1 rounded-full"
                style={{ background: 'var(--color-border-hover)' }}
              />
            </div>
            <div className="flex-1 overflow-hidden">
              <AsistenteChat onClose={() => setOpen(false)} />
            </div>
          </div>
        )}
      </div>
    </>
  )
}
