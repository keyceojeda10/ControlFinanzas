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
            href={`https://wa.me/573011993001?text=${encodeURIComponent('Hola, mi suscripcion de Control Finanzas vencio. Necesito ayuda para renovar.')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 h-10 px-8 rounded-[12px] bg-[var(--color-bg-surface)] border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] font-medium text-sm transition-all"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
            </svg>
            Hablar con soporte por WhatsApp
          </a>
        </div>
      </div>
    </div>
  )
}
