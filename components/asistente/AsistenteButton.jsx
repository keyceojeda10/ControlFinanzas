'use client'
// components/asistente/AsistenteButton.jsx — Boton flotante + drawer del asistente Lucas
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
        className="fixed bottom-[88px] right-4 lg:bottom-6 lg:right-6 z-40 w-12 h-12 lg:w-auto lg:h-auto lg:px-4 lg:py-2.5 rounded-full lg:rounded-[14px] transition-all active:scale-95"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          background: open ? 'var(--color-accent)' : '#1a1a22',
          border: '1px solid color-mix(in srgb, var(--color-accent) 50%, transparent)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px color-mix(in srgb, var(--color-accent) 25%, transparent)',
          color: open ? '#0a0a0a' : 'var(--color-accent)',
        }}
      >
        <svg
          style={{ width: '20px', height: '20px', flexShrink: 0, display: 'block' }}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z" />
        </svg>
        <span className="hidden lg:inline text-sm font-semibold">Lucas IA</span>
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
          background: '#13131a',
          border: open ? '1px solid rgba(255,255,255,0.08)' : 'none',
          borderBottom: 'none',
          boxShadow: open ? '0 -8px 60px rgba(0,0,0,0.7)' : 'none',
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
