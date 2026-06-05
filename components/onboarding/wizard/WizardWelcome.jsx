'use client'

import Mascota from '@/components/ui/Mascota'

const ITEMS = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    text: 'Registra un cliente y su préstamo',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
    text: 'Organiza tus cobros con rutas',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    text: 'Cobra desde el celular con GPS',
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
        En 2 minutos tienes tu primer préstamo registrado y listo para cobrar
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
