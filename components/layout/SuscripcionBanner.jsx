'use client'
// components/layout/SuscripcionBanner.jsx
// Aviso in-app de vencimiento de suscripcion. No spamea:
// - Solo aparece cuando quedan <=7 dias o ya vencio (en periodo de gracia).
// - Descartable por sesion: si el usuario cierra, no reaparece hasta que recargue el navegador
//   o cambie la ventana de alerta (ej: pasar de 7 dias a 3 dias).
// - No aparece si hay suscripcion recurrente autorizada activa (MP cobra solo).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'

function nivel(estado) {
  if (estado.vencida) return 'vencida'
  if (estado.diasRestantes <= 1) return 'critico'
  if (estado.diasRestantes <= 3) return 'urgente'
  if (estado.diasRestantes <= 7) return 'aviso'
  return null
}

const ESTILOS = {
  vencida: {
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.35)',
    fg: 'var(--color-danger)',
    icon: '⚠',
    titulo: 'Tu plan expiro',
  },
  critico: {
    bg: 'rgba(239, 68, 68, 0.10)',
    border: 'rgba(239, 68, 68, 0.30)',
    fg: 'var(--color-danger)',
    icon: '⏰',
    titulo: 'Tu plan vence manana',
  },
  urgente: {
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.30)',
    fg: 'var(--color-warning)',
    icon: '⏰',
    titulo: (d) => `Tu plan vence en ${d} dias`,
  },
  aviso: {
    bg: 'rgba(245, 197, 24, 0.10)',
    border: 'rgba(245, 197, 24, 0.25)',
    fg: 'var(--color-accent)',
    icon: '📅',
    titulo: (d) => `Tu plan vence en ${d} dias`,
  },
}

export default function SuscripcionBanner() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [estado, setEstado] = useState(null)
  const [cerrado, setCerrado] = useState(null) // key descartada en sessionStorage

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

  // Si tiene recurrente autorizada activa, MP cobra solo — no avisar salvo vencida
  const esRecurrenteOk =
    estado.tipo === 'recurrente' &&
    estado.mpStatus === 'authorized' &&
    !estado.canceladaAt

  const vencida = estado.diasRestantes < 0 || estado.estado === 'vencida'
  const contexto = { ...estado, vencida }
  const key = nivel(contexto)

  if (!key) return null
  if (esRecurrenteOk && !vencida) return null

  // Dismiss persiste por sesion + nivel. Cambia de nivel → reaparece.
  const storageKey = `cf:sub-banner:${key}:${Math.max(0, estado.diasRestantes)}`
  if (cerrado === storageKey) return null
  if (typeof window !== 'undefined' && sessionStorage.getItem(storageKey) === '1') return null

  const style = ESTILOS[key]
  const titulo = typeof style.titulo === 'function' ? style.titulo(estado.diasRestantes) : style.titulo
  const fecha = new Date(estado.fechaVencimiento).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long',
  })

  const mensaje = vencida
    ? `Renueva para seguir usando la app.`
    : estado.canceladaAt
      ? `Tu suscripcion se cancelo. Pierdes acceso el ${fecha}.`
      : `Renueva antes del ${fecha} para no perder acceso.`

  const cerrar = () => {
    try { sessionStorage.setItem(storageKey, '1') } catch {}
    setCerrado(storageKey)
  }

  return (
    <div
      className="border-b px-4 py-3"
      style={{ background: style.bg, borderColor: style.border }}
    >
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <span className="text-lg leading-none mt-0.5" style={{ color: style.fg }} aria-hidden>
            {style.icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color: style.fg }}>{titulo}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-relaxed">{mensaje}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <Link
            href="/configuracion/plan"
            className="h-8 px-4 rounded-[10px] text-xs font-semibold transition-all cursor-pointer inline-flex items-center"
            style={{
              background: `color-mix(in srgb, ${style.fg} 18%, transparent)`,
              color: style.fg,
              border: `1px solid color-mix(in srgb, ${style.fg} 35%, transparent)`,
            }}
          >
            {vencida ? 'Renovar ahora' : 'Renovar'}
          </Link>
          <button
            onClick={cerrar}
            aria-label="Cerrar aviso"
            className="h-8 w-8 rounded-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-all flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
