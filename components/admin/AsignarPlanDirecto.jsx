'use client'
// components/admin/AsignarPlanDirecto.jsx — el pago que llega por fuera
// (transferencia, efectivo) y se apunta a mano.
//
// ⚠ UN PAGO POR DEBAJO DE LA LISTA OBLIGA A DECIR QUÉ PASA DESPUÉS. Hasta el
// 12 sep 2026 el cobro automático cobraba «lo último pagado»: un descuento de
// un mes quedaba para siempre sin que nadie lo decidiera, y la cuenta del dueño
// a $1.500 se iba a cobrar así cada mes. Ahora el panel no deja apuntar un pago
// bajo sin elegir: lista desde el próximo cobro, o precio preferencial con su
// duración. El API exige lo mismo (`requiereDecision`).

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatMoney } from '@/lib/i18n'
import { getPrecioPlan } from '@/lib/planes'
import { MESES_PERIODO, ofertaPublica, pagoCuadra } from '@/lib/precio-plan'
import { CamposDuracion, VistaPreviaCobros, describirDuracion, fechaLarga, hastaDeDuracion, nombrePlan } from './PrecioPreferencial'

const PLANES_VENTA = ['starter', 'basic', 'growth', 'standard', 'professional']
const DIAS_PERIODO = { mensual: 30, trimestral: 90, anual: 365 }
const NOMBRE_PERIODO = { mensual: 'Mensual', trimestral: 'Trimestral', anual: 'Anual' }
const CAMPO = 'h-12 px-3 rounded-[12px] border border-[var(--cf-border)] bg-[var(--cf-card)] text-[15px] text-[var(--cf-ink)] focus:outline-none focus:border-[var(--cf-gold)]'
const ETIQUETA = 'text-[12px] font-semibold text-[var(--cf-ink-3)]'

const VACIO = { plan: 'starter', periodo: 'mensual', monto: '', extender: false, proximos: '', precioPref: '', duracion: { modo: 'definitivo', cobros: '3', hasta: '' }, nota: '' }

function Opcion({ activo, onClick, titulo, detalle }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activo}
      onClick={onClick}
      className="flex-1 min-w-[220px] text-left rounded-[12px] px-4 py-3 border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf-gold)]"
      style={activo
        ? { background: 'var(--cf-card)', borderColor: 'var(--cf-ink)', boxShadow: 'inset 0 0 0 1px var(--cf-ink)' }
        : { background: 'var(--cf-card)', borderColor: 'var(--cf-border)' }}
    >
      <span className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="w-4 h-4 rounded-full flex-none"
          style={{ border: `1.5px solid ${activo ? 'var(--cf-ink)' : 'var(--cf-border-strong)'}`, boxShadow: activo ? 'inset 0 0 0 3px var(--cf-card), inset 0 0 0 8px var(--cf-ink)' : 'none' }}
        />
        <span className="text-[15px] font-semibold text-[var(--cf-ink)]">{titulo}</span>
      </span>
      <span className="block text-[13px] text-[var(--cf-ink-3)] mt-1 pl-6">{detalle}</span>
    </button>
  )
}

export default function AsignarPlanDirecto({ org, sub, diasRestantes, accionando, ejecutarAccion }) {
  const country = org.country || 'co'
  const [f, setF] = useState(VACIO)
  const set = (cambios) => setF(prev => ({ ...prev, ...cambios }))

  const monto = parseInt(f.monto, 10) || 0
  const meses = MESES_PERIODO[f.periodo]
  const lista = getPrecioPlan(f.plan, country)
  const oferta = ofertaPublica(f.plan, f.periodo, country)
  const cuadra = monto === 0 || pagoCuadra(org, f.plan, monto)
  const debajo = monto > 0 && !cuadra && monto < oferta - 1
  const sugerido = Math.round(monto / meses)

  const puedeExtender = !!sub && sub.estado === 'activa' && diasRestantes > 0 && sub.plan === f.plan
  /* La misma cuenta que el API: el preferencial empieza a contar en el cobro
     que sigue a este pago, es decir, en el vencimiento nuevo. */
  const vence = new Date(f.extender && puedeExtender ? new Date(sub.fechaVencimiento) : new Date())
  vence.setDate(vence.getDate() + DIAS_PERIODO[f.periodo])

  const precioPref = parseInt(f.precioPref, 10) || sugerido
  const hastaPref = f.duracion.modo === 'definitivo' ? null : hastaDeDuracion(f.duracion, vence)

  const asignar = async () => {
    if (!(monto > 0)) { alert('Escribe el monto que recibiste'); return }
    if (debajo && !f.proximos) { alert('Di cómo van los próximos cobros: a lista o con precio preferencial'); return }
    if (debajo && f.proximos === 'preferencial') {
      if (!(precioPref > 0) || precioPref >= lista) { alert(`El precio preferencial tiene que ser menos que la lista (${formatMoney(lista, country)})`); return }
      if (f.duracion.modo !== 'definitivo' && !hastaPref) { alert('Elige hasta cuándo dura el precio preferencial'); return }
    }

    const proximos = !debajo ? ''
      : f.proximos === 'lista'
        ? `\nPróximos cobros: a lista (${formatMoney(lista, country)}/mes).`
        : `\nPróximos cobros: ${formatMoney(precioPref, country)}/mes, ${describirDuracion(f.duracion, vence)}.`
    const desde = f.extender && puedeExtender ? 'Se extiende desde el vencimiento actual.' : 'Empieza hoy.'
    if (!confirm(`¿Asignar ${nombrePlan(f.plan)} (${NOMBRE_PERIODO[f.periodo]}) a "${org.nombre}" por ${formatMoney(monto, country)}?\n${desde} Vence el ${fechaLarga(vence)}.${proximos}\n\nLe llega el email de confirmación.`)) return

    const ok = await ejecutarAccion('asignarPlan', {
      plan: f.plan,
      periodo: f.periodo,
      monto: f.monto,
      extender: f.extender && puedeExtender,
      ...(debajo && { proximosCobros: f.proximos }),
      ...(debajo && f.proximos === 'preferencial' && {
        precioPreferencial: precioPref,
        notaPreferencial: f.nota,
        ...(f.duracion.modo === 'cobros' && { cobrosPreferencial: f.duracion.cobros }),
        ...(f.duracion.modo === 'fecha' && { hastaPreferencial: f.duracion.hasta }),
      }),
    })
    if (ok) setF(VACIO)
  }

  return (
    <Card>
      <p className="text-xs font-semibold text-[var(--cf-ink-3)] uppercase tracking-wide mb-4">Asignar plan (pago directo)</p>
      <p className="text-xs text-[var(--cf-ink-3)] mb-4">
        Para cuando te paga por fuera (transferencia, efectivo). Se activa igual que un pago en línea: suscripción, email de confirmación y referidos.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <label className="flex flex-col gap-1">
          <span className={ETIQUETA}>Plan</span>
          <select value={f.plan} onChange={(e) => set({ plan: e.target.value, extender: false })} className={CAMPO}>
            {PLANES_VENTA.map(k => (
              <option key={k} value={k}>{nombrePlan(k)} ({formatMoney(getPrecioPlan(k, country), country)}/mes)</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={ETIQUETA}>Periodo</span>
          <select value={f.periodo} onChange={(e) => set({ periodo: e.target.value })} className={CAMPO}>
            <option value="mensual">Mensual (30 días)</option>
            <option value="trimestral">Trimestral (90 días)</option>
            <option value="anual">Anual (365 días)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={ETIQUETA}>Monto recibido</span>
          <input
            type="number" min="0" inputMode="numeric"
            value={f.monto}
            onChange={(e) => set({ monto: e.target.value, precioPref: '' })}
            placeholder={String(oferta)}
            className={`${CAMPO} w-40`}
          />
        </label>
      </div>

      <p className="text-[13px] text-[var(--cf-ink-3)] mt-2">
        {NOMBRE_PERIODO[f.periodo]} de {nombrePlan(f.plan)} a precio de lista: <span className="cf-num">{formatMoney(oferta, country)}</span>.
        {monto > 0 && cuadra && ' El monto cuadra.'}
        {!cuadra && monto > oferta && ' Es más que la lista: los próximos cobros van a lista.'}
      </p>

      {puedeExtender && (
        <label className="mt-3 flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={f.extender}
            onChange={(e) => set({ extender: e.target.checked })}
            className="w-4 h-4 rounded border-[var(--cf-border)] bg-[var(--cf-card)] accent-[var(--cf-gold)]"
          />
          <span className="text-xs text-[var(--cf-ink-3)]">
            Extender desde el vencimiento actual ({fechaLarga(sub.fechaVencimiento)}) en vez de empezar hoy
          </span>
        </label>
      )}

      {/* ── Pagó menos: ¿y después? ── */}
      {debajo && (
        <div className="mt-4 flex flex-col gap-3 rounded-[12px] px-4 py-4" style={{ background: 'var(--cf-gold-bg)', border: '1px solid var(--cf-gold-border)' }}>
          <p className="text-[14px] leading-snug text-[var(--cf-ink)]">
            Recibiste <b className="cf-num">{formatMoney(monto, country)}</b> y el precio es <b className="cf-num">{formatMoney(oferta, country)}</b>.
            Antes de guardarlo, di cómo van los cobros que siguen, desde el {fechaLarga(vence)}.
          </p>
          <div role="radiogroup" aria-label="Próximos cobros" className="flex gap-2 flex-wrap">
            <Opcion
              activo={f.proximos === 'lista'}
              onClick={() => set({ proximos: 'lista' })}
              titulo="A precio de lista"
              detalle={`${formatMoney(lista, country)}/mes. Este pago fue un descuento de una vez.`}
            />
            <Opcion
              activo={f.proximos === 'preferencial'}
              onClick={() => set({ proximos: 'preferencial' })}
              titulo="Con precio preferencial"
              detalle={`${formatMoney(precioPref, country)}/mes, definitivo o por un tiempo.`}
            />
          </div>

          {f.proximos === 'preferencial' && (
            <div className="flex flex-col gap-4 rounded-[12px] p-4" style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
              <label className="flex flex-col gap-1">
                <span className={ETIQUETA}>Precio por mes</span>
                <input
                  type="number" min="1" inputMode="numeric"
                  value={f.precioPref}
                  onChange={(e) => set({ precioPref: e.target.value })}
                  placeholder={String(sugerido)}
                  className={`${CAMPO} w-40`}
                />
                <span className="text-[13px] text-[var(--cf-ink-3)]">
                  {meses > 1 ? `Lo pagado entre ${meses} meses da ${formatMoney(sugerido, country)}. ` : ''}La lista es {formatMoney(lista, country)}.
                </span>
              </label>
              <CamposDuracion duracion={f.duracion} onChange={(d) => set({ duracion: d })} inicio={vence} />
              <label className="flex flex-col gap-1">
                <span className={ETIQUETA}>Por qué (opcional)</span>
                <input
                  type="text" maxLength={191}
                  value={f.nota}
                  onChange={(e) => set({ nota: e.target.value })}
                  placeholder="Ej.: cliente fundador, precio de lanzamiento"
                  className={CAMPO}
                />
              </label>
              {precioPref > 0 && precioPref < lista && (
                <VistaPreviaCobros country={country} plan={f.plan} precio={precioPref} hasta={hastaPref} inicio={vence} cobroAutomatico={org.cobroAutomaticoPuesto} />
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-4">
        <Button size="sm" loading={accionando === 'asignarPlan'} onClick={asignar}>Asignar plan</Button>
      </div>

      {sub && (
        <p className="mt-3 text-[12px] text-[var(--cf-ink-3)]">
          Suscripción actual: {nombrePlan(sub.plan)} · vence el {fechaLarga(sub.fechaVencimiento)}
          {diasRestantes !== null && ` (${diasRestantes > 0 ? `${diasRestantes} días restantes` : `vencida hace ${Math.abs(diasRestantes)} días`})`}.
        </p>
      )}
    </Card>
  )
}
