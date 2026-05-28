'use client'
// components/layout/SuscripcionBanner.jsx
// Aviso GLOBAL critico de vencimiento (sale en todas las paginas).
// Solo aparece en estados criticos: vencida o ≤1 dia para vencer.
// Para rangos de aviso (2-30 dias) se delega al banner del dashboard
// (BandaSuscripcion en app/(dashboard)/dashboard/page.jsx) que muestra
// info detallada con barra de progreso.
//
// Comportamiento:
// - No se muestra si hay suscripcion recurrente autorizada activa.
// - Descartable por sesion via sessionStorage.
// - Mensaje accionable (sin dias, sin barra) → diferente al del dashboard.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'

function nivelCritico(estado) {
  if (estado.vencida) return 'vencida'
  if (estado.diasRestantes <= 1) return 'critico'
  return null
}

const ESTILOS = {
  vencida: {
    color: 'var(--color-danger)',
    titulo: 'Tu plan vencio',
    detalle: 'Renueva para no perder acceso',
    cta: 'Renovar ahora',
  },
  critico: {
    color: 'var(--color-warning)',
    titulo: 'Tu plan vence pronto',
    detalle: 'Activalo antes de que se suspenda',
    cta: 'Renovar',
  },
}

export default function SuscripcionBanner() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [estado, setEstado] = useState(null)
  const [cerrado, setCerrado] = useState(null)

  const rol = session?.user?.rol
  const orgId = session?.user?.organizationId

  useEffect(() => {
    if (!orgId || rol === 'superadmin') return
    let cancelado = false
    fetch('/api/pagos/estado')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelado && d) setEstado(d) })
      .catch(() => {})
    return () => { cancelado = true }
  }, [orgId, rol, pathname])

  if (!session?.user || rol === 'superadmin' || !estado) return null
  if (!estado.fechaVencimiento) return null

  // No molestar si hay recurrente autorizada activa (MP cobra solo)
  const esRecurrenteOk =
    estado.tipo === 'recurrente' &&
    estado.mpStatus === 'authorized' &&
    !estado.canceladaAt

  const vencida = estado.diasRestantes < 0 || estado.estado === 'vencida'
  const contexto = { ...estado, vencida }
  const nivel = nivelCritico(contexto)

  if (!nivel) return null
  if (esRecurrenteOk && !vencida) return null

  // Dismiss persiste por sesion + nivel
  const storageKey = `cf:sub-banner:${nivel}`
  if (cerrado === storageKey) return null
  if (typeof window !== 'undefined' && sessionStorage.getItem(storageKey) === '1') return null

  const config = ESTILOS[nivel]

  const cerrar = () => {
    try { sessionStorage.setItem(storageKey, '1') } catch {}
    setCerrado(storageKey)
  }

  return (
    <div
      className="border-b"
      style={{
        background: `color-mix(in srgb, ${config.color} 8%, var(--color-bg-card))`,
        borderColor: `color-mix(in srgb, ${config.color} 25%, var(--color-border))`,
      }}
    >
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3">
        {/* Icono SVG (sin emojis) */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: `color-mix(in srgb, ${config.color} 18%, transparent)` }}
        >
          {nivel === 'vencida' ? (
            <svg className="w-4 h-4" style={{ color: config.color }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" style={{ color: config.color }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>

        {/* Mensaje */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold leading-tight" style={{ color: config.color }}>{config.titulo}</p>
          <p className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--color-text-muted)' }}>{config.detalle}</p>
        </div>

        {/* CTA */}
        <Link
          href="/configuracion/plan"
          className="shrink-0 h-8 px-3 rounded-[10px] text-[12px] font-semibold inline-flex items-center gap-1 transition-all"
          style={{
            background: config.color,
            color: nivel === 'vencida' ? '#fff' : '#0a0a0a',
            boxShadow: `0 2px 8px color-mix(in srgb, ${config.color} 30%, transparent)`,
          }}
        >
          {config.cta}
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>

        {/* Descartar */}
        <button
          onClick={cerrar}
          aria-label="Cerrar aviso"
          className="h-8 w-8 rounded-[10px] flex items-center justify-center transition-colors shrink-0"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
