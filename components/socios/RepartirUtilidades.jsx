'use client'
// components/socios/RepartirUtilidades.jsx
//
// Reparte una utilidad entre los socios segun su % de participacion y la deja
// registrada. Pedido por dos negocios distintos: cuando el capital es una bolsa
// comun no se puede decir "este prestamo es de Fulano", que era lo unico que
// sabia hacer el modulo de socios.
//
// El monto lo decide el dueño. El sistema SUGIERE la utilidad neta del mes
// (intereses cobrados - gastos aprobados) pero no la impone: que gastos entran y
// si se aparta reserva son criterios del negocio.

import { useState, useEffect, useCallback } from 'react'
import { useCountry } from '@/hooks/useCountry'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import MoneyInput from '@/components/ui/MoneyInput'
import { soloDecimal } from '@/lib/i18n'

export default function RepartirUtilidades({ open, onClose, onListo }) {
  const { formatMoney } = useCountry()
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [monto, setMonto] = useState('')
  const [fondoPct, setFondoPct] = useState('')
  const [nota, setNota] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const res = await fetch('/api/socios/repartir')
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'No se pudo cargar')
      const d = await res.json()
      setDatos(d)
      setMonto(d.sugerido?.utilidadNeta > 0 ? String(d.sugerido.utilidadNeta) : '')
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { if (open) cargar() }, [open, cargar])

  const montoNum = Math.round(Number(monto) || 0)
  const pctNum = Math.min(99, Math.max(0, Number(fondoPct) || 0))
  const fondo = Math.round(montoNum * (pctNum / 100))
  const aRepartir = montoNum - fondo

  // Mismo calculo que el servidor, para que el preview no mienta.
  const base = datos?.base || 0
  const totalBalances = datos?.totalBalances || 0
  const totalSocios = base > 0 && totalBalances > 0
    ? Math.round(aRepartir * (Math.min(totalBalances, base) / base))
    : 0
  const restanteNegocio = aRepartir - totalSocios

  const preview = (datos?.socios || []).map((s) => ({
    ...s,
    monto: totalBalances > 0 ? Math.round((totalSocios * s.balanceNeto) / totalBalances) : 0,
  }))

  const confirmar = async () => {
    setEnviando(true)
    setError('')
    try {
      const res = await fetch('/api/socios/repartir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto: montoNum, fondoPerdidasPct: pctNum, nota: nota.trim() || undefined }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'No se pudo repartir')
      onListo?.(d)
      onClose?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

  const sinAportes = datos && datos.totalBalances <= 0
  const puedeRepartir = montoNum > 0 && !sinAportes && !enviando

  return (
    <Modal open={open} onClose={onClose} title="Repartir utilidades" size="md">
      {cargando ? (
        <p className="text-sm py-6 text-center" style={{ color: 'var(--cf-ink-3)' }}>Cargando…</p>
      ) : (
        <div className="space-y-4">
          {/* Sugerencia del periodo */}
          {datos?.sugerido && (
            <div className="rounded-[12px] p-3" style={{ background: 'var(--cf-surface)', border: '1px solid var(--cf-border)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--cf-ink-3)' }}>
                Utilidad de {datos.periodo}
              </p>
              <div className="space-y-1 text-[12px]">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--cf-ink-3)' }}>Intereses cobrados</span>
                  <span className="font-mono-display">{formatMoney(datos.sugerido.interesesMes)}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--cf-ink-3)' }}>Gastos aprobados</span>
                  <span className="font-mono-display" style={{ color: 'var(--cf-red-dark)' }}>−{formatMoney(datos.sugerido.gastosMes)}</span>
                </div>
                <div className="flex justify-between pt-1 font-semibold" style={{ borderTop: '1px solid var(--cf-border)' }}>
                  <span>Utilidad neta</span>
                  <span className="font-mono-display" style={{ color: datos.sugerido.utilidadNeta >= 0 ? 'var(--cf-green-dark)' : 'var(--cf-red-dark)' }}>
                    {formatMoney(datos.sugerido.utilidadNeta)}
                  </span>
                </div>
              </div>
              {datos.repartosEnElPeriodo > 0 && (
                <p className="text-[11px] mt-2 pt-2" style={{ color: 'var(--cf-gold-dark)', borderTop: '1px solid var(--cf-border)' }}>
                  Ya repartiste {formatMoney(datos.yaRepartidoEnElPeriodo)} en este mes.
                </p>
              )}
            </div>
          )}

          {/* Monto y fondo */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>Monto a repartir</label>
              <div className="mt-1.5">
                <MoneyInput value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>Fondo pérdidas</label>
              <div className="mt-1.5 relative">
                <input
                  type="text" inputMode="decimal" value={fondoPct}
                  onChange={(e) => setFondoPct(soloDecimal(e.target.value))}
                  placeholder="0"
                  className="cf-input w-full pr-7 text-right"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: 'var(--cf-ink-3)' }}>%</span>
              </div>
            </div>
          </div>

          {sinAportes && (
            <p className="text-[12px] rounded-[10px] p-2.5" style={{ background: 'color-mix(in srgb, var(--cf-gold-dark) 12%, transparent)', color: 'var(--cf-gold-dark)' }}>
              Los socios no tienen aportes registrados, así que no hay porcentajes con los cuales repartir. Registra primero el capital que puso cada uno.
            </p>
          )}

          {/* Preview */}
          {montoNum > 0 && !sinAportes && (
            <div className="space-y-2">
              {fondo > 0 && (
                <div className="flex justify-between text-[12px] px-1">
                  <span style={{ color: 'var(--cf-ink-3)' }}>Fondo de pérdidas ({pctNum}%) — queda en el negocio</span>
                  <span className="font-mono-display font-semibold" style={{ color: 'var(--cf-gold-dark)' }}>{formatMoney(fondo)}</span>
                </div>
              )}
              {preview.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-[10px] px-3 py-2" style={{ background: 'var(--cf-surface)', border: '1px solid var(--cf-border)' }}>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--cf-ink)' }}>{s.nombre}</p>
                    <p className="text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>{s.porcentaje}% de participación</p>
                  </div>
                  <span className="text-[14px] font-bold font-mono-display shrink-0" style={{ color: 'var(--cf-green-dark)' }}>{formatMoney(s.monto)}</span>
                </div>
              ))}
              {restanteNegocio > 0 && (
                <div className="flex justify-between text-[12px] px-1">
                  <span style={{ color: 'var(--cf-ink-3)' }}>
                    Queda en el negocio{datos?.metaSociedad ? ' (parte no cubierta por los socios)' : ''}
                  </span>
                  <span className="font-mono-display font-semibold">{formatMoney(restanteNegocio)}</span>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>Nota (opcional)</label>
            <input
              type="text" value={nota} onChange={(e) => setNota(e.target.value)}
              placeholder="Ej: utilidades de julio"
              className="cf-input w-full mt-1.5"
            />
          </div>

          <p className="text-[10px] leading-snug" style={{ color: 'var(--cf-ink-3)' }}>
            Lo repartido se suma al balance de cada socio como utilidad reinvertida, así que su porcentaje de
            participación se recalcula. No sale plata de la caja: ese dinero ya entró cuando cobraste los intereses.
            Si un socio quiere sacarlo, se registra como retiro.
          </p>

          {error && (
            <p className="text-[12px] rounded-[10px] p-2.5" style={{ background: 'color-mix(in srgb, var(--cf-red-dark) 12%, transparent)', color: 'var(--cf-red-dark)' }}>
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" onClick={onClose} className="flex-1" disabled={enviando}>Cancelar</Button>
            <Button variant="primary" onClick={confirmar} className="flex-1" disabled={!puedeRepartir}>
              {enviando ? 'Repartiendo…' : 'Repartir'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
