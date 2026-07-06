'use client'

import { useState } from 'react'
import { useCountry } from '@/hooks/useCountry'
import { PLANES_CONFIG } from '@/lib/planes'

const PLANES_EQUIPO = ['growth', 'standard', 'professional']

export default function WizardWelcome({ nombre, plan = 'basic', onSelect, onMinimize }) {
  const firstName = nombre ? nombre.split(' ')[0] : null
  const { formatMoney } = useCountry()
  const config = PLANES_CONFIG[plan]
  const soportaEquipo = config ? config.maxUsuarios > 1 : false
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const [error, setError] = useState('')

  const handleEquipo = () => {
    if (soportaEquipo) {
      onSelect('equipo')
    } else {
      setShowUpgrade(true)
    }
  }

  const handleUpgrade = async (nuevoPlan) => {
    setUpgrading(true)
    setError('')
    try {
      const res = await fetch('/api/onboarding/cambiar-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: nuevoPlan }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al cambiar de plan')
        return
      }
      onSelect('equipo', nuevoPlan)
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setUpgrading(false)
    }
  }

  // Sub-pantalla: upgrade de plan para equipo
  if (showUpgrade) {
    return (
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-[14px] flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Tu plan actual no incluye cobradores
          </h2>
          <p className="text-[13px] max-w-[300px] mx-auto leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            Estás en el plan <strong style={{ color: 'var(--color-text-primary)' }}>{config?.nombre ?? plan}</strong> que
            es para uso individual. Para trabajar con cobradores necesitas un plan de equipo.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm rounded-[12px] px-4 py-3 mb-4"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        <div className="flex items-center gap-2 px-3 py-2.5 rounded-[10px] mb-4"
          style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="#22c55e" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            Estás en período de prueba. El cambio de plan es inmediato y no se cobra hasta que termine tu trial.
          </p>
        </div>

        <div className="space-y-2.5">
          {PLANES_EQUIPO.map((key) => {
            const p = PLANES_CONFIG[key]
            return (
              <button
                key={key}
                onClick={() => handleUpgrade(key)}
                disabled={upgrading}
                className="group w-full rounded-[14px] p-4 text-left transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: key === 'growth' ? 'rgba(139,92,246,0.06)' : 'var(--color-bg-card)',
                  border: `1px solid ${key === 'growth' ? 'rgba(139,92,246,0.25)' : 'var(--color-border)'}`,
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[15px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
                        {p.nombre}
                      </p>
                      {key === 'growth' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>
                          Recomendado
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                      <span>{p.maxUsuarios} usuarios</span>
                      <span>{p.maxRutas} rutas</span>
                      <span>{p.maxClientes.toLocaleString()} clientes</span>
                    </div>
                    <p className="text-[13px] font-bold mt-1" style={{ color: key === 'growth' ? '#8b5cf6' : 'var(--color-text-secondary)' }}>
                      {formatMoney(p.precio)}<span className="text-[10px] font-normal" style={{ color: 'var(--color-text-muted)' }}>/mes</span>
                    </p>
                  </div>
                  <svg className="w-5 h-5 shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" stroke={key === 'growth' ? '#8b5cf6' : 'var(--color-text-muted)'} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            )
          })}
        </div>

        <button
          onClick={() => setShowUpgrade(false)}
          disabled={upgrading}
          className="w-full text-[12px] text-center transition-colors cursor-pointer py-3 mt-3"
          style={{ color: 'var(--color-text-muted)' }}>
          Volver a elegir
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ minHeight: '70vh' }}>

      {/* Hero */}
      <div className="text-center pt-1 pb-5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-widest mb-5"
          style={{ background: 'rgba(245,197,24,0.1)', color: '#f5c518', border: '1px solid rgba(245,197,24,0.18)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#f5c518] animate-pulse inline-block" />
          Tu período de prueba está activo
        </div>

        <h1 className="text-[28px] font-bold leading-[1.15] mb-3"
          style={{ color: 'var(--color-text-primary)', fontFamily: "Georgia, 'Times New Roman', serif" }}>
          {firstName ? (
            <>{firstName}, bienvenido a<br /><em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>Control Finanzas</em></>
          ) : (
            <>Bienvenido a<br /><em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>Control Finanzas</em></>
          )}
        </h1>
        <p className="text-[14px] max-w-[300px] mx-auto leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          En 3 minutos vas a tener tu cartera configurada y lista para cobrar.
        </p>
      </div>

      {/* Pregunta principal: solo o equipo */}
      <div className="flex-1 flex flex-col justify-start gap-3 pb-2">

        <p className="text-[13px] font-bold text-center mb-1" style={{ color: 'var(--color-text-secondary)' }}>
          ¿Cómo trabajas?
        </p>

        {/* Solo */}
        <button
          onClick={() => onSelect('solo')}
          className="group w-full rounded-[16px] p-5 text-left transition-all active:scale-[0.98] cursor-pointer"
          style={{ background: 'rgba(245,197,24,0.06)', border: '1px solid rgba(245,197,24,0.22)' }}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-[12px] flex items-center justify-center shrink-0"
              style={{ background: 'rgba(245,197,24,0.15)', color: '#f5c518' }}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7}
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-bold mb-0.5" style={{ color: 'var(--color-text-primary)' }}>
                Cobro solo
              </p>
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                Yo manejo mi cartera directamente. No tengo cobradores.
              </p>
            </div>
            <svg className="w-5 h-5 shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" stroke="#f5c518" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        {/* Con equipo */}
        <button
          onClick={handleEquipo}
          className="group w-full rounded-[16px] p-5 text-left transition-all active:scale-[0.98] cursor-pointer"
          style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.22)' }}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-[12px] flex items-center justify-center shrink-0"
              style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7}
                  d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-bold mb-0.5" style={{ color: 'var(--color-text-primary)' }}>
                Tengo cobradores
              </p>
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                Tengo personas que cobran por mí. Necesito crear sus cuentas y asignarles rutas.
              </p>
            </div>
            <svg className="w-5 h-5 shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" stroke="#8b5cf6" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        {/* Nota de tranquilidad */}
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-[10px] mt-1"
          style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.12)' }}>
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="#22c55e" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            Todo lo que crees aquí puedes editarlo o borrarlo después.
          </p>
        </div>

        <button
          onClick={onMinimize}
          className="mt-1 text-[11px] text-center w-full transition-colors cursor-pointer"
          style={{ color: 'var(--color-text-muted)' }}>
          Ya conozco el sistema
        </button>
      </div>
    </div>
  )
}
