'use client'
// components/socios/ParticipacionSocios.jsx
// Desglose de PARTICIPACION estilo SAS: % de cada socio segun su aporte vs la
// meta de la sociedad. Es una VISTA — no cambia como se reparte hoy la ganancia
// (que va por prestamo asignado). Muestra, si se fija una meta, cuanto le tocaria
// a cada socio si la ganancia se repartiera por su %.

import { useState, useEffect } from 'react'
import { useCountry } from '@/hooks/useCountry'
import MoneyInput from '@/components/ui/MoneyInput'
import { Button } from '@/components/ui/Button'

export default function ParticipacionSocios({ socios = [], totalIntereses = 0 }) {
  const { formatMoney } = useCountry()
  const [meta, setMeta] = useState(null)
  const [editando, setEditando] = useState(false)
  const [metaInput, setMetaInput] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    fetch('/api/socios/meta')
      .then((r) => r.ok ? r.json() : { metaSociedad: null })
      .then((d) => setMeta(d.metaSociedad ?? null))
      .catch(() => {})
  }, [])

  const totalAportado = socios.reduce((acc, s) => acc + (s.balanceNeto || 0), 0)
  const base = meta && meta > 0 ? meta : totalAportado
  const capitalLibre = meta && meta > totalAportado ? meta - totalAportado : 0

  const filas = socios
    .map((s) => {
      const pct = base > 0 ? (s.balanceNeto / base) * 100 : 0
      return {
        id: s.id,
        nombre: s.nombre,
        aporte: s.balanceNeto || 0,
        pct,
        reparto: Math.round(totalIntereses * (pct / 100)),
      }
    })
    .sort((a, b) => b.aporte - a.aporte)

  const guardarMeta = async () => {
    setGuardando(true)
    try {
      const res = await fetch('/api/socios/meta', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metaSociedad: metaInput === '' ? null : Number(metaInput) }),
      })
      if (res.ok) {
        const d = await res.json()
        setMeta(d.metaSociedad ?? null)
        setEditando(false)
      }
    } finally {
      setGuardando(false)
    }
  }

  if (socios.length === 0) return null

  return (
    <div
      className="rounded-[20px] overflow-hidden mb-4"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5"
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
            style={{ background: 'color-mix(in srgb, var(--color-purple) 15%, transparent)', color: 'var(--color-purple)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
            </svg>
          </div>
          <div className="text-left">
            <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Participación de socios</p>
            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>% según aporte vs meta</p>
          </div>
        </div>
        <svg className="w-4 h-4 transition-transform" style={{ color: 'var(--color-text-muted)', transform: abierto ? 'rotate(180deg)' : 'none' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {abierto && (
        <div className="px-4 pb-4 space-y-3">
          {/* Meta de la sociedad */}
          <div
            className="rounded-[12px] p-3"
            style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}
          >
            {editando ? (
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                  Meta de la sociedad
                </label>
                <MoneyInput value={metaInput} onChange={(e) => setMetaInput(e.target.value)} placeholder="Ej: 10.000.000" />
                <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                  Déjalo vacío para que el % se calcule sobre el total aportado.
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setEditando(false)} className="flex-1">Cancelar</Button>
                  <Button onClick={guardarMeta} loading={guardando} className="flex-1">Guardar</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Meta de la sociedad</p>
                  <p className="text-base font-bold font-mono-display" style={{ color: 'var(--color-text-primary)' }}>
                    {meta && meta > 0 ? formatMoney(meta) : 'Sin meta (usa el total aportado)'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setMetaInput(meta ? String(Math.round(meta)) : ''); setEditando(true) }}
                  className="text-xs font-semibold px-3 h-8 rounded-[8px]"
                  style={{ color: 'var(--color-purple)', background: 'color-mix(in srgb, var(--color-purple) 12%, transparent)' }}
                >
                  {meta && meta > 0 ? 'Cambiar' : 'Fijar meta'}
                </button>
              </div>
            )}
          </div>

          {capitalLibre > 0 && (
            <div className="flex items-center justify-between text-xs px-1">
              <span style={{ color: 'var(--color-text-muted)' }}>Capital libre (falta para la meta)</span>
              <span className="font-semibold font-mono-display" style={{ color: 'var(--color-warning)' }}>{formatMoney(capitalLibre)}</span>
            </div>
          )}

          {/* Filas por socio */}
          <div className="space-y-2">
            {filas.map((f) => (
              <div key={f.id} className="rounded-[12px] p-3" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{f.nombre}</span>
                  <span className="text-sm font-bold font-mono-display" style={{ color: 'var(--color-purple)' }}>{f.pct.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: 'var(--color-bg-hover)' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, f.pct)}%`, background: 'var(--color-purple)' }} />
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span style={{ color: 'var(--color-text-muted)' }}>Aporte neto {formatMoney(f.aporte)}</span>
                  {totalIntereses > 0 && (
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      Por % le tocaría <span className="font-semibold" style={{ color: 'var(--color-success)' }}>{formatMoney(f.reparto)}</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <p className="text-[10px] leading-snug px-1" style={{ color: 'var(--color-text-muted)' }}>
            Esto es una vista de participación. Hoy la ganancia se atribuye por préstamo asignado a cada socio.
            El "por % le tocaría" es referencial (reparto de {formatMoney(totalIntereses)} de intereses según el %).
          </p>
        </div>
      )}
    </div>
  )
}
