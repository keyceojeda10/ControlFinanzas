'use client'
// components/ui/BottomSheet.jsx

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function BottomSheet({ open, onClose, title, children, footer, className = '' }) {
  const overlayRef = useRef(null)
  const sheetRef = useRef(null)
  const previousFocusRef = useRef(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) return
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.()
      if (e.key === 'Tab' && sheetRef.current) {
        const focusables = sheetRef.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus()
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    previousFocusRef.current = document.activeElement
    setTimeout(() => {
      sheetRef.current?.querySelector('button:not([disabled]), input:not([disabled])')?.focus()
    }, 0)
    return () => { try { previousFocusRef.current?.focus?.() } catch {} }
  }, [open])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open || !mounted) return null

  const content = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[10001] flex items-end justify-center"
      onClick={(e) => { if (e.target === overlayRef.current) onClose?.() }}
    >
      <div className="absolute inset-0 animate-fadeBg" style={{ background: 'rgba(0,0,5,0.6)' }} />

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        className={[
          'relative w-full max-w-lg max-h-[90vh] flex flex-col',
          'rounded-t-[28px] animate-sheetUp',
          className,
        ].join(' ')}
        style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderBottom: 'none',
        }}
      >
        <div className="flex flex-col items-center pt-3 pb-2 shrink-0">
          <div className="w-9 h-1 rounded-full" style={{ background: 'var(--color-text-muted)', opacity: 0.35 }} />
        </div>

        {title && (
          <div className="flex items-center justify-between px-5 pb-3 shrink-0">
            <h2 className="text-[16px] font-bold" style={{ color: 'var(--color-text-primary)' }}>{title}</h2>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="w-9 h-9 flex items-center justify-center rounded-[10px] cursor-pointer transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>

        {footer && (
          <div className="shrink-0 px-5 py-4 flex items-center gap-3" style={{ borderTop: '1px solid var(--color-border)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
