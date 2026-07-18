'use client'

import { useState } from 'react'
import { useCountry } from '@/hooks/useCountry'
import { PLANES_CONFIG } from '@/lib/planes'

const PLANES_SOLO   = ['starter', 'basic']
const PLANES_EQUIPO = ['growth', 'standard', 'professional']

export default function WizardWelcome({ nombre, plan = 'starter', onSelect, onMinimize }) {
  const firstName = nombre ? nombre.split(' ')[0] : null
  const { formatMoney } = useCountry()
  const [showPlanPicker, setShowPlanPicker] = useState(null) // 'solo' | 'equipo' | null
  const [upgrading, setUpgrading] = useState(false)
  const [error, setError] = useState('')

  const handleUpgrade = async (nuevoPlan, tipo) => {
    if (nuevoPlan === plan) {
      onSelect(tipo)
      return
    }
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
      onSelect(tipo, nuevoPlan)
    } catch {
      setError('Error de conexion. Intenta de nuevo.')
    } finally {
      setUpgrading(false)
    }
  }

  // Sub-pantalla: seleccion de plan
  if (showPlanPicker) {
    const esSolo = showPlanPicker === 'solo'
    const planes = esSolo ? PLANES_SOLO : PLANES_EQUIPO
    const recomendado = esSolo ? 'starter' : 'growth'

    return (
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-[14px] flex items-center justify-center mx-auto mb-4"
            style={{
              background: esSolo ? 'rgba(245,197,24,0.12)' : 'rgba(139,92,246,0.12)',
              color: esSolo ? 'var(--color-accent)' : 'var(--color-purple)',
            }}>
            {esSolo ? (
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            ) : (
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
                  d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            )}
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            {esSolo ? 'Elige tu plan' : 'Elige tu plan de equipo'}
          </h2>
          <p className="text-[13px] max-w-[300px] mx-auto leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {esSolo
              ? 'Selecciona el plan que mejor se adapte a tu cartera.'
              : 'Para trabajar con cobradores necesitas un plan de equipo.'
            }
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm rounded-[12px] px-4 py-3 mb-4"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--color-danger)' }}>
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        <div className="flex items-center gap-2 px-3 py-2.5 rounded-[10px] mb-4"
          style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="var(--color-success)" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            14 dias gratis. No se cobra hasta que termine tu periodo de prueba.
          </p>
        </div>

        <div className="space-y-2.5">
          {planes.map((key) => {
            const p = PLANES_CONFIG[key]
            const esRecomendado = key === recomendado
            const accentColor = esSolo ? 'var(--color-accent)' : 'var(--color-purple)'
            return (
              <button
                key={key}
                onClick={() => handleUpgrade(key, esSolo ? 'solo' : 'equipo')}
                disabled={upgrading}
                className="group w-full rounded-[14px] p-4 text-left transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: esRecomendado
                    ? (esSolo ? 'rgba(245,197,24,0.06)' : 'rgba(139,92,246,0.06)')
                    : 'var(--color-bg-card)',
                  border: `1px solid ${esRecomendado
                    ? (esSolo ? 'rgba(245,197,24,0.25)' : 'rgba(139,92,246,0.25)')
                    : 'var(--color-border)'}`,
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[15px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
                        {p.nombre}
                      </p>
                      {esRecomendado && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                          style={{
                            background: esSolo ? 'rgba(245,197,24,0.15)' : 'rgba(139,92,246,0.15)',
                            color: accentColor,
                          }}>
                          Recomendado
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                      {!esSolo && <span>{p.maxUsuarios} usuarios</span>}
                      {!esSolo && <span>{p.maxRutas} rutas</span>}
                      <span>{p.maxClientes.toLocaleString()} clientes</span>
                    </div>
                    <p className="text-[13px] font-bold mt-1 font-mono-display" style={{ color: esRecomendado ? accentColor : 'var(--color-text-secondary)' }}>
                      {formatMoney(p.precio)}<span className="text-[10px] font-normal" style={{ color: 'var(--color-text-muted)' }}>/mes</span>
                    </p>
                  </div>
                  <svg className="w-5 h-5 shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" stroke={esRecomendado ? accentColor : 'var(--color-text-muted)'} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            )
          })}
        </div>

        <button
          onClick={() => { setShowPlanPicker(null); setError('') }}
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
          style={{ background: 'rgba(245,197,24,0.1)', color: 'var(--color-accent)', border: '1px solid rgba(245,197,24,0.18)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse inline-block" />
          Tu periodo de prueba esta activo
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
          ¿Como trabajas?
        </p>

        {/* Solo */}
        <button
          onClick={() => setShowPlanPicker('solo')}
          className="group w-full rounded-[16px] p-5 text-left transition-all active:scale-[0.98] cursor-pointer"
          style={{ background: 'rgba(245,197,24,0.06)', border: '1px solid rgba(245,197,24,0.22)' }}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-[12px] flex items-center justify-center shrink-0"
              style={{ background: 'rgba(245,197,24,0.15)', color: 'var(--color-accent)' }}>
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
            <svg className="w-5 h-5 shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" stroke="var(--color-accent)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        {/* Con equipo */}
        <button
          onClick={() => setShowPlanPicker('equipo')}
          className="group w-full rounded-[16px] p-5 text-left transition-all active:scale-[0.98] cursor-pointer"
          style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.22)' }}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-[12px] flex items-center justify-center shrink-0"
              style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--color-purple)' }}>
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
                Tengo personas que cobran por mi. Necesito crear sus cuentas y asignarles rutas.
              </p>
            </div>
            <svg className="w-5 h-5 shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" stroke="var(--color-purple)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        {/* Nota de tranquilidad */}
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-[10px] mt-1"
          style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.12)' }}>
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="var(--color-success)" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            Todo lo que crees aqui puedes editarlo o borrarlo despues.
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
