'use client'
// components/caja/CuadrarCuentas.jsx — «CUADRAR CON LO QUE TENGO».
//
// El dueño escribe cuánto tiene hoy en cada cuenta (lo que dice su app del banco,
// lo que cuenta en la mano) y cada una queda en esa cifra. La diferencia sale del
// capital sin repartir o vuelve a él: el capital del negocio no cambia. Ver
// lib/dinero/sin-repartir.js y /api/caja/cuentas/cuadrar.

import { useState, useEffect } from 'react'
import { useCountry } from '@/hooks/useCountry'
import HojaInferior from '@/components/cf/HojaInferior'
import MoneyInput from '@/components/ui/MoneyInput'
import { BotonPrimario, EtiquetaCampo, AyudaCampo, Aviso } from '@/components/cf/primitivos'
import { cuentasElegibles } from '@/lib/adaptadores/cuentas'
import { capitalSinRepartir } from '@/lib/dinero/sin-repartir'

const soloDigitos = (v) => Math.round(Number(String(v ?? '').replace(/[^0-9]/g, '')) || 0)

export default function CuadrarCuentas({ abierta, onCerrar, onHecho }) {
  const { formatMoney } = useCountry()
  const [cuentas, setCuentas] = useState(null)
  const [sinRepartir, setSinRepartir] = useState(0)
  const [tiene, setTiene] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!abierta) return
    let vivo = true
    setTiene({}); setError(''); setCuentas(null)
    fetch('/api/caja/cuentas?periodo=todo', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('error'))))
      .then((d) => {
        if (!vivo) return
        setCuentas(cuentasElegibles(d.cuentas))
        setSinRepartir(capitalSinRepartir(d.cuentas))
      })
      .catch(() => { if (vivo) setError('No pude cargar tus cuentas.') })
    return () => { vivo = false }
  }, [abierta])

  const escritas = (cuentas ?? []).filter((c) => String(tiene[c.key] ?? '').trim() !== '')
  const mueve = escritas.reduce((a, c) => a + (soloDigitos(tiene[c.key]) - Math.round(c.neto)), 0)
  const quedaSin = sinRepartir - mueve
  const listo = escritas.length > 0 && !enviando

  const guardar = async () => {
    if (!listo) return
    setEnviando(true)
    setError('')
    try {
      const res = await fetch('/api/caja/cuentas/cuadrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuentas: escritas.map((c) => ({ key: c.key, tiene: soloDigitos(tiene[c.key]) })) }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'No se pudo guardar')
      onHecho?.(escritas.length === 1 ? `${escritas[0].nombre} quedó en lo que tienes` : 'Tus cuentas quedaron en lo que tienes')
      onCerrar?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <HojaInferior
      abierta={abierta}
      onCerrar={onCerrar}
      titulo="Cuadrar con lo que tengo"
      subtitulo="Escribe cuánto hay hoy en cada cuenta. Tu capital no cambia."
      accion={
        <BotonPrimario onClick={guardar} disabled={!listo} style={{ opacity: listo ? 1 : 0.5 }}>
          {enviando ? 'Guardando…' : 'Guardar'}
        </BotonPrimario>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 8 }}>
        {!cuentas && !error && <AyudaCampo>Cargando tus cuentas…</AyudaCampo>}

        {cuentas && (
          <>
            <AyudaCampo>
              Mira la app de tu banco y cuenta el efectivo. Las cuentas que dejes en blanco no cambian.
            </AyudaCampo>

            {cuentas.map((c) => {
              const escrito = String(tiene[c.key] ?? '').trim() !== ''
              return (
                <div key={c.key} data-cuenta={c.key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                    <EtiquetaCampo>{c.nombre === 'Efectivo' ? 'Efectivo en la mano' : `En ${c.nombre}`}</EtiquetaCampo>
                    <span className="cf-num" style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>
                      {escrito ? `antes ${formatMoney(Math.round(c.neto))}` : `la app dice ${formatMoney(Math.round(c.neto))}`}
                    </span>
                  </div>
                  <MoneyInput value={tiene[c.key] ?? ''} placeholder="¿Cuánto tienes?"
                    onChange={(e) => setTiene((t) => ({ ...t, [c.key]: e.target.value }))} />
                </div>
              )
            })}

            <div style={{
              display: 'flex', flexDirection: 'column', gap: 6, padding: '14px 16px',
              borderRadius: 14, background: 'var(--cf-fill)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cf-ink-2)' }}>Capital sin repartir</span>
                <span className="cf-num" style={{ fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)', textAlign: 'right' }}>
                  {escritas.length ? `${formatMoney(sinRepartir)} → ${formatMoney(quedaSin)}` : formatMoney(sinRepartir)}
                </span>
              </div>
              <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--cf-ink-3)' }}>
                {!escritas.length
                  ? 'Es plata de tu negocio que aún no está en ninguna cuenta. Al escribir lo que tienes, se reparte sola.'
                  : quedaSin > 0
                    ? 'Lo que queda es plata que tu capital cuenta y no está en las cuentas que escribiste.'
                    : quedaSin < 0
                      ? `Lo que escribiste suma ${formatMoney(-quedaSin)} más que tu capital. Si metiste plata de tu bolsillo, regístrala como aporte en Capital.`
                      : 'Todo tu capital queda repartido en tus cuentas.'}
              </span>
            </div>
          </>
        )}

        {error && <Aviso tono="rojo">{error}</Aviso>}
      </div>
    </HojaInferior>
  )
}
