'use client'
// components/onboarding/CobradorOnboarding.jsx
// Guia de primeros pasos para cobradores nuevos.
// Dismiss persistente en backend (User.onboardingCompletado) para que se
// sincronice entre dispositivos. localStorage se usa como fallback optimista.

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { InstallGuideModal } from '@/components/layout/InstallButton'

const LS_KEY = 'cf_cobrador_onboarding_dismissed'

const PASOS = [
  {
    titulo: 'Revisa tu ruta de cobro',
    descripcion: 'Tu administrador te asigno una ruta con clientes. Entra y mira quienes te tocan hoy.',
    href: '/rutas',
    icono: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    titulo: 'Registra un pago',
    descripcion: 'Entra al prestamo del cliente y toca "Registrar pago". Puedes hacerlo sin internet.',
    href: '/prestamos',
    icono: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    titulo: 'Registra gastos menores',
    descripcion: 'Si tienes gastos de transporte o gasolina, registralos para que el admin los vea.',
    href: '/caja',
    icono: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    titulo: 'Instala la app',
    descripcion: 'Instala la app en tu celular para acceder más rápido y usarla sin internet.',
    isInstall: true,
    icono: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
  },
]

export default function CobradorOnboarding({ userId }) {
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [showInstallGuide, setShowInstallGuide] = useState(false)

  useEffect(() => {
    const key = userId ? `${LS_KEY}_${userId}` : LS_KEY

    // Fast path: si ya fue descartado en este dispositivo, no mostrar.
    // Evita flash del banner mientras llega la respuesta del API.
    if (localStorage.getItem(key)) {
      setVisible(false)
      return
    }

    // Source of truth: backend. Sincroniza entre dispositivos y sobrevive
    // a limpiezas de localStorage/navegadores distintos.
    let cancelled = false
    fetch('/api/onboarding/cobrador')
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        if (data?.dismissed) {
          localStorage.setItem(key, '1')
          setVisible(false)
        } else {
          setVisible(true)
        }
      })
      .catch(() => {
        // Si el API falla, mostrar el banner (fail-open para no perder la guia)
        if (!cancelled) setVisible(true)
      })

    return () => { cancelled = true }
  }, [userId])

  const handleDismiss = async () => {
    const key = userId ? `${LS_KEY}_${userId}` : LS_KEY
    localStorage.setItem(key, '1')
    setVisible(false)
    // Persistir en backend para que sobreviva a limpieza de localStorage
    try {
      await fetch('/api/onboarding/cobrador', { method: 'POST' })
    } catch {}
  }

  if (!visible) return null

  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[16px] overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-4 px-4 py-4 hover:bg-[var(--color-bg-hover)] transition-colors"
      >
        <div className="w-10 h-10 rounded-full bg-[rgba(59,130,246,0.12)] border border-[rgba(59,130,246,0.25)] flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-[var(--color-info)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-bold text-[var(--color-text-primary)]">Primeros pasos como cobrador</p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Aprende lo basico para empezar a cobrar</p>
        </div>
        <svg
          className={`w-5 h-5 text-[var(--color-text-muted)] transition-transform duration-200 shrink-0 ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-2 pb-3 border-t border-[var(--color-border)]">
          <div className="space-y-0.5 mt-2">
            {PASOS.map((paso, i) => {
              if (paso.isInstall) {
                return (
                  <button
                    key={i}
                    onClick={() => setShowInstallGuide(true)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] hover:bg-[var(--color-bg-hover)] transition-all group text-left"
                  >
                    <div className="w-7 h-7 rounded-full border-2 border-[var(--color-border-hover)] flex items-center justify-center shrink-0 text-[var(--color-text-muted)] group-hover:border-[#3b82f6] group-hover:text-[var(--color-info)] transition-colors">
                      {paso.icono}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-info)] transition-colors">{paso.titulo}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">{paso.descripcion}</p>
                    </div>
                    <svg className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-info)] transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )
              }
              return (
                <Link
                  key={i}
                  href={paso.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] hover:bg-[var(--color-bg-hover)] transition-all group"
                >
                  <div className="w-7 h-7 rounded-full border-2 border-[var(--color-border-hover)] flex items-center justify-center shrink-0 text-[var(--color-text-muted)] group-hover:border-[#3b82f6] group-hover:text-[var(--color-info)] transition-colors">
                    {paso.icono}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-info)] transition-colors">{paso.titulo}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">{paso.descripcion}</p>
                  </div>
                  <svg className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-info)] transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              )
            })}
          </div>
          {showInstallGuide && <InstallGuideModal onClose={() => setShowInstallGuide(false)} />}

          <div className="flex justify-center mt-3 mb-1">
            <button
              onClick={handleDismiss}
              className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-muted)] transition-colors"
            >
              Ya entendi, ocultar guia
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
