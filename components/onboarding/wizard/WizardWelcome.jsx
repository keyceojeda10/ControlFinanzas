'use client'

import Mascota from '@/components/ui/Mascota'

const ITEMS = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    text: 'Registrar tu primer cliente',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    text: 'Crear tu primer prestamo',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    text: 'Ver tu cartera funcionando',
  },
]

export default function WizardWelcome({ nombre, onNext, onDismiss }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      {/* Mascota */}
      <div className="mb-6 animate-[bounce_2s_ease-in-out_infinite]">
        <Mascota variant="happy" size={120} />
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
        {nombre ? `Hola, ${nombre.split(' ')[0]}!` : 'Bienvenido!'}
      </h1>
      <p className="text-base text-[var(--color-text-muted)] mb-8 max-w-xs">
        Vamos a configurar tu cartera en 2 minutos
      </p>

      {/* Steps preview */}
      <div className="w-full max-w-xs space-y-3 mb-10">
        {ITEMS.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-3 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[12px] px-4 py-3"
          >
            <div className="w-9 h-9 rounded-full bg-[rgba(245,197,24,0.12)] flex items-center justify-center shrink-0 text-[var(--color-accent)]">
              {item.icon}
            </div>
            <p className="text-sm text-[var(--color-text-primary)] font-medium text-left">{item.text}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={onNext}
        className="w-full max-w-xs h-12 rounded-[12px] bg-[var(--color-accent)] text-[#111111] text-base font-bold transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98] cursor-pointer"
      >
        Empezar
      </button>

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        className="mt-4 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-muted)] transition-colors cursor-pointer"
      >
        Ya conozco el sistema, saltar guia
      </button>
    </div>
  )
}
