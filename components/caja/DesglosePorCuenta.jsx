'use client'
// components/caja/DesglosePorCuenta.jsx
// Vista "Cuentas": cuanto dinero ENTRO / SALIO / NETO por cada cuenta usada
// (efectivo, Nequi, Daviplata...). No usa saldo inicial: es movimiento del periodo.

import { useState, useEffect } from 'react'
import { useCountry } from '@/hooks/useCountry'
import { getPlataformaInfo, PlataformaIcon } from '@/components/ui/LogoPlataforma'

const PERIODOS = [
  { key: 'hoy',  label: 'Hoy' },
  { key: 'mes',  label: 'Este mes' },
  { key: 'todo', label: 'Todo' },
]

const ICON_EFECTIVO = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
  </svg>
)

export default function DesglosePorCuenta() {
  const { formatMoney } = useCountry()
  const [periodo, setPeriodo] = useState('todo')
  const [cuentas, setCuentas] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    setError('')
    fetch(`/api/caja/cuentas?periodo=${periodo}`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('error')))
      .then((d) => { if (!cancelado) setCuentas(d.cuentas || []) })
      .catch(() => { if (!cancelado) setError('No se pudo cargar el desglose por cuenta.') })
      .finally(() => { if (!cancelado) setLoading(false) })
    return () => { cancelado = true }
  }, [periodo])

  const conMovimiento = (cuentas || []).filter((c) => c.entradas !== 0 || c.salidas !== 0)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>Dinero por cuenta</h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          Cuánto entró y salió por cada cuenta (efectivo, Nequi, Daviplata...). Es el movimiento del período, no un saldo de banco.
        </p>
      </div>

      {/* Toggle de periodo */}
      <div className="flex gap-1 p-1 rounded-[12px]" style={{ background: 'var(--color-bg-hover)', border: '1px solid var(--color-border)' }}>
        {PERIODOS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriodo(p.key)}
            className="flex-1 py-1.5 text-xs font-semibold rounded-[8px] transition-all"
            style={periodo === p.key
              ? { background: 'var(--color-bg-card)', color: 'var(--color-accent)', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }
              : { color: 'var(--color-text-muted)' }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-32">
          <svg className="animate-spin w-5 h-5" style={{ color: 'var(--color-accent)' }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {!loading && error && (
        <p className="text-sm text-center py-8" style={{ color: 'var(--color-danger)' }}>{error}</p>
      )}

      {!loading && !error && conMovimiento.length === 0 && (
        <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
          Sin movimientos en este período. Cuando cobres o prestes eligiendo la cuenta, aparecerá aquí.
        </p>
      )}

      {!loading && !error && conMovimiento.map((c) => {
        const platInfo = c.tipoCuenta === 'transferencia' ? getPlataformaInfo(c.nombre) : null
        const acento = platInfo?.color || (c.tipoCuenta === 'efectivo' ? 'var(--color-success)' : 'var(--color-info)')
        const netoColor = c.neto > 0 ? 'var(--color-success)' : c.neto < 0 ? 'var(--color-danger)' : 'var(--color-text-primary)'
        return (
          <div
            key={c.key}
            className="rounded-[16px] p-4"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div
                className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                style={{ background: `color-mix(in srgb, ${acento} 15%, transparent)`, color: acento }}
              >
                {platInfo ? <PlataformaIcon plataforma={c.nombre} size={22} /> : ICON_EFECTIVO}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>{c.nombre}</p>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                  {c.tipoCuenta === 'efectivo' ? 'Efectivo' : c.tipoCuenta === 'transferencia' ? 'Transferencia' : 'Sin cuenta asignada'}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Neto</p>
                <p className="text-base font-bold font-mono-display" style={{ color: netoColor }}>
                  {c.neto >= 0 ? '' : '−'}{formatMoney(Math.abs(c.neto))}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-[10px] px-3 py-2" style={{ background: 'color-mix(in srgb, var(--color-success) 8%, transparent)' }}>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Entró</p>
                <p className="text-sm font-bold font-mono-display" style={{ color: 'var(--color-success)' }}>{formatMoney(c.entradas)}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  Cobros {formatMoney(c.recaudado)}{c.inyectado > 0 ? ` · Aportes ${formatMoney(c.inyectado)}` : ''}
                </p>
              </div>
              <div className="rounded-[10px] px-3 py-2" style={{ background: 'color-mix(in srgb, var(--color-danger) 8%, transparent)' }}>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Salió</p>
                <p className="text-sm font-bold font-mono-display" style={{ color: 'var(--color-danger)' }}>{formatMoney(c.salidas)}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  Préstamos {formatMoney(c.prestado)}{c.gastos > 0 ? ` · Gastos ${formatMoney(c.gastos)}` : ''}{c.retirado > 0 ? ` · Retiros ${formatMoney(c.retirado)}` : ''}
                </p>
              </div>
            </div>
          </div>
        )
      })}

      {!loading && !error && conMovimiento.some((c) => c.tipoCuenta === 'sin_registrar') && (
        <p className="text-[11px] px-1" style={{ color: 'var(--color-text-muted)' }}>
          "Sin cuenta asignada" son movimientos viejos o cobros donde no se eligió cuenta. De ahora en adelante, al elegir la cuenta en cada cobro se clasifican solos.
        </p>
      )}
    </div>
  )
}
