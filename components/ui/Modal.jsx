'use client'
// components/ui/Modal.jsx

import { useEffect, useRef } from 'react'

export function Modal({ open, onClose, title, children, size = 'md', footer }) {
  const overlayRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className={[
          'relative w-full bg-[#1c2333] border border-[#2a3245]',
          'rounded-t-[18px] sm:rounded-[18px] shadow-2xl',
          'max-h-[90dvh] flex flex-col',
          sizes[size] ?? sizes.md,
        ].join(' ')}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a3245] shrink-0">
            <h2 className="text-base font-semibold text-[#f1f5f9]">{title}</h2>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[#64748b] hover:text-[#f1f5f9] hover:bg-[#2a3245] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <div className="shrink-0 px-5 py-4 border-t border-[#2a3245] flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
