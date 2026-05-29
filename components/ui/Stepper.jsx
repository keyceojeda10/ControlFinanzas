'use client'
// components/ui/Stepper.jsx
// Stepper minimalista: dots pequeños arriba conectados por linea muy fina.
// Texto opcional debajo (sin truncar). Espaciado uniforme entre dots.
// El paso activo destaca con accent, los completados con relleno verde,
// los futuros vacios. Onclick opcional para saltar.

export default function Stepper({ steps, activeIndex, onChange, completedIndices }) {
  const completed = new Set(completedIndices ?? [])

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Fila de dots con linea uniforme */}
      <div className="relative flex items-center justify-between px-2">
        {/* Linea base que conecta todos los dots — pasa por detras */}
        <div
          className="absolute left-2 right-2 h-px"
          style={{
            background: 'var(--color-border)',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 0,
          }}
        />
        {/* Linea de progreso (verde hasta el paso completado) */}
        {activeIndex > 0 && (
          <div
            className="absolute h-px"
            style={{
              background: 'color-mix(in srgb, var(--color-success) 60%, transparent)',
              top: '50%',
              transform: 'translateY(-50%)',
              left: '0.5rem',
              width: `calc(${(activeIndex / (steps.length - 1)) * 100}% - 1rem)`,
              zIndex: 0,
              transition: 'width 220ms ease',
            }}
          />
        )}

        {steps.map((step, idx) => {
          const isActive = idx === activeIndex
          const isCompleted = completed.has(idx) && !isActive
          const clickable = !!onChange && (isCompleted || idx <= activeIndex)

          return (
            <button
              key={idx}
              type="button"
              onClick={clickable ? () => onChange(idx) : undefined}
              disabled={!clickable}
              className="relative z-10 w-7 h-7 rounded-full flex items-center justify-center transition-all"
              style={{
                background: isActive
                  ? 'var(--color-accent)'
                  : isCompleted
                    ? 'var(--color-success)'
                    : 'var(--color-bg-surface)',
                border: isActive
                  ? '2px solid var(--color-accent)'
                  : isCompleted
                    ? '2px solid var(--color-success)'
                    : '1.5px solid var(--color-border)',
                cursor: clickable ? 'pointer' : 'default',
                boxShadow: isActive ? '0 0 0 4px color-mix(in srgb, var(--color-accent) 18%, transparent)' : 'none',
              }}
            >
              {isCompleted ? (
                <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" style={{ color: '#fff' }}>
                  <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.415l-7.997 8a1 1 0 01-1.414 0L3.296 10.71a1 1 0 011.415-1.415l3.29 3.29 7.288-7.295a1 1 0 011.415 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <span
                  className="text-[11px] font-bold"
                  style={{ color: isActive ? '#0a0a0a' : 'var(--color-text-muted)' }}
                >
                  {idx + 1}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Texto del paso activo, centrado y completo (no truncar) */}
      <div className="mt-3 text-center">
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Paso {activeIndex + 1} de {steps.length}
        </p>
        <p
          className="text-base font-bold mt-0.5"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {steps[activeIndex]?.label}
        </p>
      </div>
    </div>
  )
}
