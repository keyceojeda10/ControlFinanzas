'use client'
// components/ui/Modal.jsx

import { useEffect, useRef } from 'react'

export function Modal({ open, onClose, title, children, size = 'md', footer }) {
  const overlayRef = useRef(null)
  const dialogRef = useRef(null)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.()
      // Focus trap simple: Tab cicla dentro del modal
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Mover foco al modal al abrir, devolverlo al cerrar
  useEffect(() => {
    if (!open) return
    previousFocusRef.current = document.activeElement
    // Enfocar el primer elemento interactivo del modal
    setTimeout(() => {
      const first = dialogRef.current?.querySelector(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled])'
      )
      first?.focus()
    }, 0)
    return () => {
      try { previousFocusRef.current?.focus?.() } catch {}
    }
  }, [open])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const sizes = {
    sm:   'max-w-sm',
    md:   'max-w-lg',
    lg:   'max-w-2xl',
    xl:   'max-w-4xl',
    full: 'max-w-full mx-4',
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose?.() }}
    >
      <div className="absolute inset-0 bg-[rgba(0,0,5,0.85)] backdrop-blur-md" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'cf-modal-title' : undefined}
        className={[
          'relative w-full',
          'rounded-t-[20px] sm:rounded-[20px] shadow-2xl',
          'max-h-[90dvh] flex flex-col',
          sizes[size] ?? sizes.md,
        ].join(' ')}
        style={{
          background: 'linear-gradient(135deg, rgba(245,197,24,0.02) 0%, #111115 40%, #111115 70%, rgba(245,197,24,0.01) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
        }}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.06)] shrink-0">
            <h2 id="cf-modal-title" className="text-base font-semibold text-white">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="w-10 h-10 flex items-center justify-center rounded-lg text-[#666] hover:text-white hover:bg-[rgba(255,255,255,0.08)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <div className="shrink-0 px-5 py-4 border-t border-[rgba(255,255,255,0.06)] flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
