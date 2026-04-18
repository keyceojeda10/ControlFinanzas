'use client'

import { useState, useEffect, useRef } from 'react'

export default function TourStep({ target, message, onNext, onDismiss, step, totalSteps }) {
  const [pos, setPos] = useState(null)
  const tooltipRef = useRef(null)

  useEffect(() => {
    if (!target) return
    const el = document.querySelector(target)
    if (!el) return

    const updatePos = () => {
      const rect = el.getBoundingClientRect()
      setPos({
        top: rect.bottom + 12,
        left: Math.max(16, Math.min(rect.left + rect.width / 2 - 140, window.innerWidth - 296)),
      })
      // Scroll into view if needed
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    updatePos()
    window.addEventListener('resize', updatePos)
    return () => window.removeEventListener('resize', updatePos)
  }, [target])

  if (!pos) return null

  return (
    <>
      {/* Backdrop with hole */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onDismiss} />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-50 w-72 bg-[var(--color-bg-surface)] border border-[color-mix(in_srgb,var(--color-accent)_30%,transparent)] rounded-2xl p-4 shadow-xl tour-tooltip-enter"
        style={{ top: `${pos.top}px`, left: `${pos.left}px` }}
      >
        {/* Arrow */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[var(--color-bg-surface)] border-l border-t border-[color-mix(in_srgb,var(--color-accent)_30%,transparent)] rotate-45" />

        <p className="text-sm text-[var(--color-text-primary)] relative z-10">{message}</p>

        <div className="flex items-center justify-between mt-3 relative z-10">
          <span className="text-[10px] text-[#666]">{step}/{totalSteps}</span>
          <div className="flex gap-2">
            <button
              onClick={onDismiss}
              className="text-xs text-[#666] hover:text-[var(--color-text-muted)] transition-colors"
            >
              Saltar
            </button>
            <button
              onClick={onNext}
              className="text-xs font-semibold text-[#0a0a0a] bg-[var(--color-accent)] px-3 py-1.5 rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              {step === totalSteps ? 'Listo' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .tour-tooltip-enter {
          animation: tour-enter 0.3s ease-out;
        }
        @keyframes tour-enter {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
