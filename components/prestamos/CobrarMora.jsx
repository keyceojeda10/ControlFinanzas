'use client'

/* ══ COBRAR MORA SIN HABERLA CONFIGURADO (21 nov 2026) ═══════════════════════
 *
 * Un prestamista veía «62 días en mora» y $170.000, y preguntaba cuánto debía el
 * cliente «en peso, por todo». La mora no salía porque nunca puso una tasa en
 * Configuración (de 181 negocios activos, solo 6 la tienen). Aquí se cobra desde
 * la ficha, de las dos formas que se usan (lib/dinero/mora-a-mano.js):
 *   · «% al mes»: el interés moratorio de siempre, con la tasa que se elija.
 *   · «Otra quincena»: el interés pactado de una cuota por cada período de más.
 * Se apunta como recargo por el mismo API que el moratorio; la nota es la llave
 * que impide cobrar dos veces lo mismo. Solo el dueño la ve (la API la manda
 * solo a él) y solo si NO tiene tasa configurada: con tasa, sale la tarjeta de
 * siempre.
 */
import { useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Checkbox } from '@/components/ui/Checkbox'
import DeslizarParaConfirmar from '@/components/cf/DeslizarParaConfirmar'
import MoneyInput from '@/components/ui/MoneyInput'
import { formatMoney } from '@/lib/i18n'
import { montoMoratorioCon, notaPeriodos } from '@/lib/dinero/mora-a-mano'

const TASAS = [5, 10, 15, 20]

function Opciones({ opciones, activo, onElegir }) {
  return (
    <div style={{ display: 'flex', gap: 7 }}>
      {opciones.map((o) => {
        const on = o.id === activo
        return (
          <button key={o.id} type="button" onClick={() => onElegir(o.id)} aria-pressed={on} style={{
            flex: 1, minWidth: 0, minHeight: 46, borderRadius: 12, cursor: 'pointer', padding: '6px 8px',
            font: 'inherit', fontSize: 13, fontWeight: on ? 700 : 600, lineHeight: 1.25, textAlign: 'center',
            ...(on
              ? { background: 'var(--cf-ink)', color: 'var(--cf-surface)', border: 'none' }
              : { background: 'var(--cf-card)', color: 'var(--cf-ink-2)', border: '1px solid var(--cf-border)' }),
          }}>{o.etiqueta}</button>
        )
      })}
    </div>
  )
}

function Fila({ etiqueta, valor, fuerte = false }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
      <span style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>{etiqueta}</span>
      <span className="cf-num" style={{ fontSize: fuerte ? 19 : 15, fontWeight: fuerte ? 700 : 600, color: 'var(--cf-ink)', textAlign: 'right' }}>{valor}</span>
    </div>
  )
}

export default function CobrarMora({ prestamoId, moraAMano, saldoPendiente = 0, diasMora = 0, tactil = false, onListo }) {
  const { porTasa, periodos, diasGracia } = moraAMano || {}
  const hayTasa = !!porTasa
  const hayPeriodos = !!periodos?.disponible
  const [abierta, setAbierta] = useState(false)
  const [modo, setModo] = useState(hayPeriodos ? 'periodos' : 'tasa')
  const [tasa, setTasa] = useState(10)
  const [n, setN] = useState(Math.max(1, periodos?.porCobrar || 1))
  const [montoEditado, setMontoEditado] = useState(null)
  const [paraTodos, setParaTodos] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const [uno, varios] = periodos?.nombre ?? ['quincena', 'quincenas']
  const calculado = useMemo(() => (modo === 'tasa'
    ? montoMoratorioCon(porTasa, Number(tasa) || 0)
    : Math.round((periodos?.interesPorPeriodo || 0) * n)), [modo, porTasa, tasa, periodos, n])
  const monto = montoEditado ?? calculado
  const maxPeriodos = Math.max(1, (periodos?.porCobrar || 0) + 1)

  if (!moraAMano || (!hayTasa && !hayPeriodos)) return null

  const abrir = () => {
    setMontoEditado(null); setError(''); setParaTodos(false)
    setModo(hayPeriodos ? 'periodos' : 'tasa'); setN(Math.max(1, periodos?.porCobrar || 1))
    setAbierta(true)
  }
  const cambiarModo = (m) => { setModo(m); setMontoEditado(null) }

  const nota = () => {
    const base = modo === 'tasa'
      ? `Interés moratorio: ${tasa} % al mes · ${porTasa.diasMoraEfectivos} días sobre ${formatMoney(porTasa.montoBase)}`
      : notaPeriodos(n, periodos.frecuencia, periodos.vencio)
    return montoEditado != null && montoEditado !== calculado
      ? `${base} (calculado: ${formatMoney(calculado)}, aplicado: ${formatMoney(montoEditado)})`
      : base
  }

  const confirmar = async () => {
    if (!(monto > 0)) return
    setEnviando(true); setError('')
    try {
      const res = await fetch(`/api/prestamos/${prestamoId}/pagos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // `montoPagado`, como todo el que registra contra este API (8 sep 2026).
        body: JSON.stringify({ montoPagado: Math.round(monto), tipo: 'recargo', nota: nota() }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'No se pudo aplicar la mora')
      if (modo === 'tasa' && paraTodos) {
        // Desde aquí la tarjeta de siempre sale sola en todos los préstamos en mora.
        await fetch('/api/configuracion/organizacion', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tasaMoratorio: Number(tasa), diasGraciaMoratorio: Number(diasGracia ?? 5) }),
        }).catch(() => null)
      }
      setAbierta(false)
      await onListo?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

  const titulo = periodos?.diasDesdeFin > 0 ? `Venció hace ${periodos.diasDesdeFin} días` : `${diasMora} días en mora`

  return (
    <>
      <div className="rounded-[20px] cf-card-shadow p-4" style={{ background: 'color-mix(in srgb, var(--cf-red) 6%, var(--cf-card))', border: '1px solid color-mix(in srgb, var(--cf-red) 22%, transparent)' }}>
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--cf-red-dark)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--cf-red-dark)' }}>{titulo}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--cf-ink-3)' }}>
              No tienes mora configurada, así que no se le está sumando. Puedes cobrarla aquí.
            </p>
          </div>
        </div>
        <button type="button" onClick={abrir} className="w-full mt-3 rounded-[12px] text-sm font-semibold transition-all"
          style={{ minHeight: 44, color: 'var(--cf-red-dark)', background: 'color-mix(in srgb, var(--cf-red) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--cf-red) 30%, transparent)' }}>
          Cobrar mora
        </button>
      </div>

      <Modal open={abierta} onClose={() => setAbierta(false)} title="Cobrar mora" subtitle={titulo}>
        <div className="space-y-4">
          {hayTasa && hayPeriodos && (
            <Opciones activo={modo} onElegir={cambiarModo} opciones={[
              { id: 'periodos', etiqueta: `Otra ${uno} de interés` },
              { id: 'tasa', etiqueta: '% al mes sobre lo atrasado' },
            ]} />
          )}

          {modo === 'tasa' ? (
            <div className="space-y-3">
              <p className="text-xs" style={{ color: 'var(--cf-ink-3)' }}>
                Un porcentaje al mes sobre {formatMoney(porTasa.montoBase)} atrasados, por {porTasa.diasMoraEfectivos} días de mora
                {diasGracia > 0 ? ` (después de ${diasGracia} días de gracia)` : ''}.
              </p>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                {TASAS.map((t) => (
                  <button key={t} type="button" onClick={() => { setTasa(t); setMontoEditado(null) }} aria-pressed={Number(tasa) === t}
                    className="cf-num" style={{
                      minWidth: 56, height: 40, borderRadius: 12, cursor: 'pointer', font: 'inherit', fontSize: 14, fontWeight: 700,
                      ...(Number(tasa) === t
                        ? { background: 'var(--cf-ink)', color: 'var(--cf-surface)', border: 'none' }
                        : { background: 'var(--cf-card)', color: 'var(--cf-ink-2)', border: '1px solid var(--cf-border)' }),
                    }}>{t} %</button>
                ))}
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--cf-ink-3)' }}>
                  Otro
                  <input type="text" inputMode="decimal" value={tasa} aria-label="Porcentaje al mes"
                    onChange={(e) => { setTasa(e.target.value.replace(',', '.').replace(/[^0-9.]/g, '')); setMontoEditado(null) }}
                    className="cf-num" style={{ width: 64, height: 40, borderRadius: 12, border: '1px solid var(--cf-border)', background: 'var(--cf-surface)', padding: '0 10px', fontSize: 16, color: 'var(--cf-ink)' }} />
                  %
                </label>
              </div>
              {porTasa.yaAplicado > 0 && (
                <p className="text-xs" style={{ color: 'var(--cf-ink-3)' }}>Ya le cobraste {formatMoney(porTasa.yaAplicado)} de mora en este atraso: se descuenta.</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs" style={{ color: 'var(--cf-ink-3)' }}>
                Cada {uno} de más le cobra el interés de una cuota de este préstamo: {formatMoney(periodos.interesPorPeriodo)}.
                {' '}Desde que venció pasaron {periodos.cumplidos} {periodos.cumplidos === 1 ? uno : varios}
                {periodos.yaCobrados > 0 ? ` y ya le cobraste ${periodos.yaCobrados}` : ''}.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button type="button" aria-label={`Una ${uno} menos`} onClick={() => { setN((x) => Math.max(1, x - 1)); setMontoEditado(null) }}
                  style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid var(--cf-border)', background: 'var(--cf-card)', fontSize: 20, fontWeight: 700, color: 'var(--cf-ink)', cursor: 'pointer' }}>−</button>
                <span className="cf-num" style={{ fontSize: 17, fontWeight: 700, color: 'var(--cf-ink)', minWidth: 120, textAlign: 'center' }}>{n} {n === 1 ? uno : varios}</span>
                <button type="button" aria-label={`Una ${uno} más`} onClick={() => { setN((x) => Math.min(maxPeriodos, x + 1)); setMontoEditado(null) }}
                  style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid var(--cf-border)', background: 'var(--cf-card)', fontSize: 20, fontWeight: 700, color: 'var(--cf-ink)', cursor: 'pointer' }}>+</button>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <MoneyInput label="Mora a cobrar" value={monto ? Math.round(monto) : ''}
              onChange={(e) => { const v = Number(e.target.value); setMontoEditado(Number.isFinite(v) ? v : 0) }} />
            {montoEditado != null && montoEditado !== calculado && (
              <p className="text-xs" style={{ color: 'var(--cf-ink-3)' }}>El sistema calculó {formatMoney(calculado)}.</p>
            )}
          </div>

          <div className="rounded-[12px] p-3 space-y-2" style={{ background: 'var(--cf-fill)' }}>
            <Fila etiqueta="Debe hoy" valor={formatMoney(saldoPendiente)} />
            <Fila etiqueta="Mora" valor={`+${formatMoney(monto || 0)}`} />
            <Fila etiqueta="Para saldar hoy" valor={formatMoney(saldoPendiente + (monto || 0))} fuerte />
          </div>

          {modo === 'tasa' && (
            <Checkbox checked={paraTodos} onChange={setParaTodos}
              label="Cobrar así en todos mis préstamos en mora"
              description={`Guarda ${tasa} % al mes en tu configuración: desde ahí el sistema te la calcula sola en cada préstamo atrasado.`} />
          )}

          {error && <p className="text-xs" style={{ color: 'var(--cf-red-dark)' }}>{error}</p>}

          {tactil ? (
            <DeslizarParaConfirmar texto={`Cobrar ${formatMoney(monto || 0)} de mora`} cifra={monto > 0 ? formatMoney(monto) : null}
              confirmando={enviando} deshabilitado={!(monto > 0)} onConfirmar={confirmar} />
          ) : (
            <button type="button" onClick={confirmar} disabled={enviando || !(monto > 0)}
              className="w-full rounded-[12px] text-sm font-bold disabled:opacity-50"
              style={{ minHeight: 48, background: 'var(--cf-ink)', color: 'var(--cf-surface)', border: 'none', cursor: 'pointer' }}>
              {enviando ? 'Aplicando…' : `Cobrar ${formatMoney(monto || 0)} de mora`}
            </button>
          )}
        </div>
      </Modal>
    </>
  )
}
