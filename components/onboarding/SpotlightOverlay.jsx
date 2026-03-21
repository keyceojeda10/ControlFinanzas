'use client'

import { useState, useEffect, useCallback } from 'react'

export default function SpotlightOverlay({ spotlight, onClose }) {
  const [rect, setRect] = useState(null)
  const [tooltipStyle, setTooltipStyle] = useState({})

  const updatePosition = useCallback(() => {
    if (!spotlight?.selector) return
    const el = document.querySelector(spotlight.selector)
    if (!el) {
      // Element not on this page, close spotlight
      onClose?.()
      return
    }
    const r = el.getBoundingClientRect()
    const pad = 8
    setRect({
      top: r.top - pad,
      left: r.left - pad,
      width: r.width + pad * 2,
      height: r.height + pad * 2,
    })

    // Position tooltip below or above target
    const posBelow = r.bottom + 16
    const posAbove = r.top - 80

    if (spotlight.posicion === 'top' || posBelow + 80 > window.innerHeight) {
      setTooltipStyle({
        top: posAbove,
        left: Math.max(16, Math.min(r.left, window.innerWidth - 280)),
      })
    } else {
      setTooltipStyle({
        top: posBelow,
        left: Math.max(16, Math.min(r.left, window.innerWidth - 280)),
      })
    }
  }, [spotlight, onClose])

  useEffect(() => {
    if (!spotlight) return
    // Small delay so element renders
    const timer = setTimeout(updatePosition, 100)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [spotlight, updatePosition])

  if (!spotlight || !rect) return null

  // Build clip-path polygon: full screen with a rectangular cutout
  const { top, left, width, height } = rect
  const clipPath = `polygon(
    0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
    ${left}px ${top}px,
    ${left}px ${top + height}px,
    ${left + width}px ${top + height}px,
    ${left + width}px ${top}px,
    ${left}px ${top}px
  )`

  return (
    <div className="fixed inset-0 z-[90]" onClick={onClose}>
      {/* Dark overlay with cutout */}
      <div
        className="absolute inset-0 bg-black/70 transition-all duration-300"
        style={{ clipPath }}
      />

      {/* Glow border around cutout */}
      <div
        className="absolute border-2 border-[#f5c518] rounded-[12px] spotlight-pulse pointer-events-none"
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        }}
      />

      {/* Tooltip */}
      <div
        className="absolute z-[91] bg-[#1a1a1a] border border-[#f5c518] rounded-[12px] px-4 py-3 max-w-[260px] shadow-lg shadow-[rgba(245,197,24,0.1)] onboarding-fadein"
        style={tooltipStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm text-white font-medium mb-1.5">{spotlight.mensaje}</p>
        <button
          onClick={onClose}
          className="text-[11px] text-[#f5c518] hover:text-[#f0b800] font-medium transition-colors"
        >
          Entendido
        </button>
        {/* Arrow */}
        <div
          className="absolute -top-1.5 left-6 w-3 h-3 bg-[#1a1a1a] border-l border-t border-[#f5c518] rotate-45"
          style={spotlight.posicion === 'top' ? { top: 'auto', bottom: -6, transform: 'rotate(225deg)' } : {}}
        />
      </div>
    </div>
  )
}
