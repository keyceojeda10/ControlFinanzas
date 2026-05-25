'use client'
// components/asistente/AsistenteButton.jsx — Boton flotante + widget Messenger (desktop) / drawer (mobile)
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import AsistenteChat from './AsistenteChat'

export default function AsistenteButton() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Cerrar al navegar
  useEffect(() => { setOpen(false) }, [pathname])

  // Bloquear scroll solo en mobile cuando esta abierto
  useEffect(() => {
    const isMobile = window.innerWidth < 1024
    if (open && isMobile) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* Boton flotante */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Abrir asistente IA"
        className="fixed bottom-[88px] right-4 lg:bottom-6 lg:right-6 z-40 w-12 h-12 lg:w-auto lg:h-auto lg:px-4 lg:py-2.5 rounded-full lg:rounded-[14px] transition-[background-color,color,transform] duration-200 active:scale-95"
        style={{
          display: open ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          background: 'var(--color-bg-surface)',
          border: '1px solid rgba(245,197,24,0.35)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          color: 'var(--color-accent)',
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
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Mobile: slide-up sheet (85vh) ── */}
      <div
        className="lg:hidden fixed z-50 transition-[height] duration-300"
        style={{
          bottom: 0,
          left: 0,
          right: 0,
          height: open ? '85vh' : '0',
          overflow: 'hidden',
          borderRadius: '24px 24px 0 0',
          background: 'var(--color-bg-card)',
          border: open ? '1px solid var(--color-border)' : 'none',
          borderBottom: 'none',
          boxShadow: open ? '0 -4px 16px rgba(0,0,0,0.3)' : 'none',
          visibility: open ? 'visible' : 'hidden',
          pointerEvents: open ? 'auto' : 'none',
        }}
      >
        <div style={{ display: open ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full" style={{ background: 'var(--color-border-hover)' }} />
          </div>
          <div className="flex-1 overflow-hidden">
            <AsistenteChat onClose={() => setOpen(false)} />
          </div>
        </div>
      </div>

      {/* ── Desktop: widget Messenger flotante ── */}
      <div
        className="hidden lg:block fixed z-50"
        style={{
          bottom: '80px',
          right: '24px',
          width: '380px',
          height: '520px',
          borderRadius: '16px',
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          transform: open ? 'scale(1)' : 'scale(0.9)',
          opacity: open ? 1 : 0,
          visibility: open ? 'visible' : 'hidden',
          pointerEvents: open ? 'auto' : 'none',
          transition: 'transform 0.2s ease, opacity 0.2s ease, visibility 0.2s',
          transformOrigin: 'bottom right',
        }}
      >
        <div style={{ display: open ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <div className="flex-1 overflow-hidden">
            <AsistenteChat onClose={() => setOpen(false)} />
          </div>
        </div>
      </div>
    </>
  )
}
