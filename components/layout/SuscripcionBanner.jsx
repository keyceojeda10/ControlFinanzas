'use client'
// components/layout/SuscripcionBanner.jsx
// Aviso GLOBAL de vencimiento de suscripcion.
//
// - Quedan ≤24h → modal grande con countdown en vivo (hh:mm:ss).
//   Se cierra con boton pero reaparece cada vez que abra la app.
// - Ya vencida → banner fijo (no descartable) con enlace a renovar.
// - Recurrente activa autorizada → no se muestra.

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'

function calcularTiempoRestante(fechaVencimiento) {
  const diff = new Date(fechaVencimiento) - new Date()
  if (diff <= 0) return null
  const horas = Math.floor(diff / (1000 * 60 * 60))
  const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const segundos = Math.floor((diff % (1000 * 60)) / 1000)
  return { horas, minutos, segundos, total: diff }
}

function formatDos(n) {
  return String(n).padStart(2, '0')
}

export default function SuscripcionBanner() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [estado, setEstado] = useState(null)
  const [modalCerrado, setModalCerrado] = useState(false)
  const [countdown, setCountdown] = useState(null)
  const intervalRef = useRef(null)

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

  // Countdown tick cada segundo cuando quedan ≤24h
  useEffect(() => {
    if (!estado?.fechaVencimiento) return
    const esRecurrenteOk =
      estado.tipo === 'recurrente' &&
      estado.mpStatus === 'authorized' &&
      !estado.canceladaAt
    if (esRecurrenteOk) return

    const diasRestantes = estado.diasRestantes ?? 999
    if (diasRestantes > 1 || diasRestantes < 0) return

    const tick = () => {
      const t = calcularTiempoRestante(estado.fechaVencimiento)
      setCountdown(t)
      if (!t && intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [estado])

  if (!session?.user || rol === 'superadmin' || !estado) return null
  if (!estado.fechaVencimiento) return null

  const esRecurrenteOk =
    estado.tipo === 'recurrente' &&
    estado.mpStatus === 'authorized' &&
    !estado.canceladaAt

  const vencida = estado.diasRestantes < 0 || estado.estado === 'vencida'
  const critico = !vencida && estado.diasRestantes <= 1

  if (esRecurrenteOk && !vencida) return null
  if (!vencida && !critico) return null

  // ── VENCIDA: banner fijo arriba ──
  if (vencida) {
    return (
      <div
        className="border-b"
        style={{
          background: 'color-mix(in srgb, var(--cf-red-dark) 8%, var(--cf-card))',
          borderColor: 'color-mix(in srgb, var(--cf-red-dark) 25%, var(--cf-border))',
        }}
      >
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'color-mix(in srgb, var(--cf-red-dark) 18%, transparent)' }}
          >
            <svg className="w-4 h-4" style={{ color: 'var(--cf-red-dark)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--cf-red-dark)' }}>Tu plan vencio</p>
            <p className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--cf-ink-3)' }}>Renueva para no perder acceso</p>
          </div>
          <Link
            href="/configuracion/plan"
            className="shrink-0 h-8 px-3 rounded-[10px] text-[12px] font-semibold inline-flex items-center gap-1 transition-all"
            style={{
              background: 'var(--cf-red-dark)',
              color: '#fff',
              boxShadow: '0 2px 8px color-mix(in srgb, var(--cf-red-dark) 30%, transparent)',
            }}
          >
            Renovar ahora
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    )
  }

  // ── CRITICO (≤24h): modal grande con countdown ──
  if (!countdown || modalCerrado) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4"
      style={{ backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-[20px] overflow-hidden"
        style={{
          background: 'var(--cf-card)',
          border: '1.5px solid color-mix(in srgb, var(--cf-gold-dark) 35%, var(--cf-border))',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
        }}>

        {/* Header con icono */}
        <div className="px-5 pt-6 pb-3 text-center">
          <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center"
            style={{ background: 'color-mix(in srgb, var(--cf-gold-dark) 15%, transparent)' }}>
            <svg className="w-7 h-7" style={{ color: 'var(--cf-gold-dark)' }} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--cf-ink)' }}>
            Tu plan esta por vencer
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--cf-ink-3)' }}>
            El acceso al sistema se suspendera cuando el tiempo llegue a cero. Renueva ahora para no perder el acceso.
          </p>
        </div>

        {/* Countdown */}
        <div className="px-5 py-4">
          <div className="rounded-[12px] px-4 py-4"
            style={{
              background: 'color-mix(in srgb, var(--cf-gold-dark) 6%, var(--cf-surface))',
              border: '1px solid color-mix(in srgb, var(--cf-gold-dark) 20%, var(--cf-border))',
            }}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-center mb-2"
              style={{ color: 'var(--cf-gold-dark)' }}>
              Tiempo restante
            </p>
            <div className="flex items-center justify-center gap-2">
              {[
                { valor: formatDos(countdown.horas), label: 'horas' },
                { valor: formatDos(countdown.minutos), label: 'min' },
                { valor: formatDos(countdown.segundos), label: 'seg' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-[12px] flex items-center justify-center"
                      style={{
                        background: 'var(--cf-card)',
                        border: '1px solid var(--cf-border)',
                      }}>
                      <span className="text-2xl font-bold tabular-nums"
                        style={{ color: countdown.total < 3600000 ? 'var(--cf-red-dark)' : 'var(--cf-gold-dark)' }}>
                        {item.valor}
                      </span>
                    </div>
                    <p className="text-[10px] mt-1 uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>
                      {item.label}
                    </p>
                  </div>
                  {i < 2 && (
                    <span className="text-xl font-bold mb-4" style={{ color: 'var(--cf-ink-3)' }}>:</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="px-5 pb-5 space-y-2">
          <Link
            href="/configuracion/plan"
            className="w-full h-12 rounded-[12px] text-sm font-bold flex items-center justify-center gap-2 transition-all"
            style={{
              background: 'var(--cf-gold-dark)',
              color: '#000',
              boxShadow: '0 2px 12px color-mix(in srgb, var(--cf-gold-dark) 40%, transparent)',
            }}
          >
            Renovar mi plan
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <button
            type="button"
            onClick={() => setModalCerrado(true)}
            className="w-full h-10 rounded-[12px] text-sm font-medium transition-colors"
            style={{ color: 'var(--cf-ink-3)', background: 'var(--cf-surface)' }}
          >
            Entendido, seguir usando
          </button>
        </div>
      </div>
    </div>
  )
}
