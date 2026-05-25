'use client'
// components/ui/AiTipBanner.jsx — Reusable AI tip banner for any page

import { useState, useEffect } from 'react'

export default function AiTipBanner({ tip, pageKey }) {
  const [dismissed, setDismissed] = useState(false)

  // Reset dismiss when tip changes
  useEffect(() => { setDismissed(false) }, [tip])

  // Check sessionStorage for dismiss state
  useEffect(() => {
    if (pageKey && typeof window !== 'undefined') {
      const key = `ai-tip-dismiss-${pageKey}`
      if (sessionStorage.getItem(key) === tip) setDismissed(true)
    }
  }, [tip, pageKey])

  if (!tip || dismissed) return null

  const handleDismiss = () => {
    setDismissed(true)
    if (pageKey && typeof window !== 'undefined') {
      sessionStorage.setItem(`ai-tip-dismiss-${pageKey}`, tip)
    }
  }

  return (
    <div
      className="rounded-[12px] px-4 py-3 flex items-start gap-3"
      style={{
        background: 'rgba(245,197,24,0.04)',
        borderLeft: '2px solid var(--color-accent)',
      }}
    >
      <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--color-accent)' }}>
        <path d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z" />
      </svg>
      <p className="text-xs flex-1 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
        {tip}
      </p>
      <button
        onClick={handleDismiss}
        className="shrink-0 w-5 h-5 flex items-center justify-center rounded transition-colors"
        style={{ color: 'var(--color-text-muted)' }}
        aria-label="Cerrar tip"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
