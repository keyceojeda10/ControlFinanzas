'use client'
// components/ui/SegmentedControl.jsx

import { useRef, useState, useEffect } from 'react'

export default function SegmentedControl({ options, value, onChange, className = '' }) {
  const containerRef = useRef(null)
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })

  useEffect(() => {
    if (!containerRef.current) return
    const idx = options.findIndex(o => (typeof o === 'string' ? o : o.value) === value)
    if (idx < 0) return
    const btns = containerRef.current.querySelectorAll('button')
    const btn = btns[idx]
    if (!btn) return
    setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth })
  }, [value, options])

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex p-1 rounded-[14px] ${className}`}
      style={{ background: 'var(--cf-fill)' }}
    >
      <div
        className="absolute top-1 rounded-[11px] transition-all duration-200 ease-[cubic-bezier(.22,1,.36,1)]"
        style={{
          left: `${indicator.left}px`,
          width: `${indicator.width}px`,
          height: 'calc(100% - 8px)',
          background: 'var(--cf-surface)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      />
      {options.map((opt) => {
        const val = typeof opt === 'string' ? opt : opt.value
        const label = typeof opt === 'string' ? opt : opt.label
        const isActive = val === value
        return (
          <button
            key={val}
            type="button"
            onClick={() => onChange(val)}
            className={[
              'relative z-[1] px-3.5 py-2 text-[12.5px] font-semibold rounded-[11px]',
              'transition-colors duration-200 cursor-pointer select-none whitespace-nowrap',
            ].join(' ')}
            style={{ color: isActive ? 'var(--cf-gold)' : 'var(--cf-ink-3)' }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
