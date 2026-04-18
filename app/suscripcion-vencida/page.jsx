'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function SuscripcionVencida() {
  const [estado, setEstado] = useState(null)

  useEffect(() => {
    fetch('/api/pagos/estado')
      .then((r) => r.json())
      .then(setEstado)
      .catch(() => {})
  }, [])

  const fechaVencimiento = estado?.fechaVencimiento
    ? new Date(estado.fechaVencimiento).toLocaleDateString('es-CO', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[var(--color-bg-base)] px-4">
      <div className="w-full max-w-sm text-center">
        <div
          className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6"
          style={{ background: 'rgba(239,68,68,0.15)', border: '2px solid rgba(239,68,68,0.3)' }}
        >
          <svg className="w-10 h-10 text-[var(--color-danger)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-[white] mb-2">
          Suscripción vencida
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mb-2">
          {fechaVencimiento
            ? `Tu suscripción venció el ${fechaVencimiento}.`
            : 'Tu suscripción ha vencido.'}
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mb-8">
          Renueva tu plan para seguir usando Control Finanzas. Tus datos están seguros y disponibles cuando renueves.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/configuracion/plan"
            className="inline-flex items-center justify-center h-12 px-8 rounded-[12px] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-primary)] font-bold text-sm transition-all"
          >
            Renovar ahora
          </Link>
          <a
            href="mailto:soporte@control-finanzas.com"
            className="inline-flex items-center justify-center h-10 px-8 rounded-[12px] bg-[var(--color-bg-surface)] border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] font-medium text-sm transition-all"
          >
            Contactar soporte
          </a>
        </div>
      </div>
    </div>
  )
}
