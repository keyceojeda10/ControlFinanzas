'use client'
// components/ui/Stepper.jsx
// Stepper horizontal reusable para wizards. Muestra los pasos como circulos
// numerados conectados por una linea. El paso activo destaca con accent, los
// completados con check verde, los futuros en muted. Click opcional para saltar.

export default function Stepper({ steps, activeIndex, onChange, completedIndices }) {
  const completed = new Set(completedIndices ?? [])

  return (
    <div className="flex items-start gap-1 w-full">
      {steps.map((step, idx) => {
        const isActive = idx === activeIndex
        const isCompleted = completed.has(idx) && !isActive
        const isFuture = idx > activeIndex && !isCompleted
        const clickable = !!onChange && (isCompleted || idx <= activeIndex)

        const color = isActive
          ? 'var(--color-accent)'
          : isCompleted
            ? 'var(--color-success)'
            : 'var(--color-text-muted)'

        const bg = isActive
          ? 'color-mix(in srgb, var(--color-accent) 18%, transparent)'
          : isCompleted
            ? 'color-mix(in srgb, var(--color-success) 14%, transparent)'
            : 'transparent'

        return (
          <div key={idx} className="flex-1 flex items-center min-w-0">
            <button
              type="button"
              onClick={clickable ? () => onChange(idx) : undefined}
              disabled={!clickable}
              className="flex flex-col items-center gap-1 min-w-0 flex-1 transition-opacity"
              style={{ cursor: clickable ? 'pointer' : 'default', opacity: isFuture ? 0.55 : 1 }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors"
                style={{
                  background: bg,
                  color,
                  border: `1.5px solid ${color}`,
                }}
              >
                {isCompleted ? (
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.415l-7.997 8a1 1 0 01-1.414 0L3.296 10.71a1 1 0 011.415-1.415l3.29 3.29 7.288-7.295a1 1 0 011.415 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
              <span
                className="text-[10px] font-semibold truncate w-full text-center uppercase tracking-wide"
                style={{ color }}
              >
                {step.label}
              </span>
            </button>
            {idx < steps.length - 1 && (
              <div
                className="h-px flex-1 mx-1"
                style={{
                  background: idx < activeIndex || completed.has(idx)
                    ? 'color-mix(in srgb, var(--color-success) 40%, transparent)'
                    : 'var(--color-border)',
                  minWidth: '8px',
                  marginTop: '14px',
                  alignSelf: 'flex-start',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
