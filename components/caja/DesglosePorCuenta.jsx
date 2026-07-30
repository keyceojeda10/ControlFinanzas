'use client'

import { Cuentas } from '@/components/pantallas/Caja'
import { adaptarCuentas } from '@/lib/adaptadores/cuentas'
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

  return (
    <div className="space-y-4">
      <div>
        <h2 style={{
          fontFamily: 'var(--font-space-grotesk), system-ui',
          fontSize: 18, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)', margin: 0,
        }}>Dinero por cuenta</h2>
        <p style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--cf-ink-3)', margin: '4px 0 0' }}>
          Cuánto entró y salió por cada cuenta (efectivo, Nequi, Daviplata...). Es el movimiento del período, no un saldo de banco.
        </p>
      </div>

      {/* TERCER CARRIL DE LA MISMA PANTALLA, y era el ultimo con la gramatica
          vieja. En /caja hay tres controles de esta forma —el periodo de arriba,
          las pestañas, y este— y hasta ahora dos decian «estas aqui» con una
          pastilla blanca y el otro con texto dorado. Tres carriles iguales que no
          se comportan igual se leen como tres cosas distintas. */}
      <div style={{
        display: 'flex', gap: 5, padding: 4, borderRadius: 14,
        background: 'var(--cf-fill-2)',
      }}>
        {PERIODOS.map((p) => {
          const on = periodo === p.key
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriodo(p.key)}
              aria-pressed={on}
              style={{
                flex: 1, minWidth: 0, height: 36, borderRadius: 11, border: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', font: 'inherit',
                fontSize: 13, fontWeight: on ? 700 : 600,
                color: on ? 'var(--cf-ink)' : 'var(--cf-ink-3)',
                background: on ? 'var(--cf-card)' : 'transparent',
                boxShadow: on ? '0 1px 3px rgba(20,20,28,.1)' : 'none',
              }}
            >
              {p.label}
            </button>
          )
        })}
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

      {/* El vacío es para cuando NO HAY NI CUENTAS, no para cuando no hubo
          movimientos: el efectivo se enseña siempre —aunque esté en cero— y su
          propia fila ya dice «sin movimientos». Con la condición vieja
          (`conMovimiento.length === 0`) se pintaban las dos cosas a la vez: el
          texto de vacío y debajo el bloque con el efectivo en $0. */}
      {!loading && !error && (!cuentas || cuentas.length === 0) && (
        <p style={{ fontSize: 14, textAlign: 'center', padding: '32px 0', color: 'var(--cf-ink-3)' }}>
          Sin movimientos en este período. Cuando cobres o prestes eligiendo la cuenta, aparecerá aquí.
        </p>
      )}

      {/* LA LISTA PASA AL COMPONENTE DEL REDISEÑO (T20-01).
          Lo que cambia y por qué:

          · LO QUE SE ENSEÑA GRANDE ES EL NETO, no las entradas. «Entró $500.000
            por Nequi» no dice cuánto hay: si salieron $480.000 desembolsando,
            quedan $20.000. Entró y salió bajan a la línea pequeña, que es lo que
            explica de dónde sale el neto.
          · LA BARRA PARTIDA arriba dice de un vistazo cuánto del total está en la
            mano y cuánto en una cuenta. El pie de la lámina: «si todo entra como
            efectivo, el conteo físico nunca cuadra».
          · EL EFECTIVO VA PRIMERO Y SIEMPRE, aunque esté en cero — es la única
            que se cuenta con la mano, y su ausencia se leería como «no hay
            efectivo» en vez de «hoy no entró efectivo».

          El fetch, el estado y el endpoint no se tocan. */}
      {!loading && !error && cuentas && cuentas.length > 0 && (
        <Cuentas {...adaptarCuentas(cuentas, formatMoney)} />
      )}
    </div>
  )
}
