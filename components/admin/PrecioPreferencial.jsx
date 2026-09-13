'use client'
// components/admin/PrecioPreferencial.jsx — el precio de un negocio, en su ficha.
//
// «Que en la plataforma de superadmin se pudiera gestionar y que avisara qué
//  clientes tienen precio preferencial, y si es por algún tiempo limitado, para
//  que el ajuste se haga automático al pasar el tiempo, o el valor que se le dio
//  fue definitivo.» — el dueño, 12 sep 2026.
//
// ⚠ Aquí no se decide ningún precio: la ficha enseña `org.precio`, que el API
// saca de lib/precio-plan.js, la misma función que usa el cron que cobra. La
// vista previa del formulario usa también esa librería, con el borrador.

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Pastilla } from '@/components/cf/primitivos'
import { formatMoney } from '@/lib/i18n'
import { PLANES_CONFIG, getPrecioPlan } from '@/lib/planes'
import { proximosCobros, finDelDiaBogota, hastaPorCobros, diaBogota } from '@/lib/precio-plan'

const PLANES_VENTA = ['starter', 'basic', 'growth', 'standard', 'professional']
const CAMPO = 'h-12 px-3 rounded-[12px] border border-[var(--cf-border)] bg-[var(--cf-card)] text-[15px] text-[var(--cf-ink)] focus:outline-none focus:border-[var(--cf-gold)]'
const ETIQUETA = 'text-[12px] font-semibold text-[var(--cf-ink-3)]'

export const fechaLarga = (d) => d
  ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' })
  : ''

export const nombrePlan = (plan) => PLANES_CONFIG[plan]?.nombre ?? plan

/** La duración del formulario → la fecha en que termina (o null si definitivo). */
export function hastaDeDuracion(duracion, inicio) {
  if (duracion.modo === 'cobros') {
    const n = parseInt(duracion.cobros, 10)
    return n >= 1 ? finDelDiaBogota(hastaPorCobros(inicio, n)) : null
  }
  if (duracion.modo === 'fecha') return finDelDiaBogota(duracion.hasta)
  return null
}

/** La duración del formulario → lo que espera el API. */
export function duracionParaApi(duracion) {
  if (duracion.modo === 'cobros') return { cobros: duracion.cobros }
  if (duracion.modo === 'fecha') return { hasta: duracion.hasta }
  return {}
}

export function describirDuracion(duracion, inicio) {
  if (duracion.modo === 'definitivo') return 'definitivo'
  const hasta = hastaDeDuracion(duracion, inicio)
  if (!hasta) return 'sin fecha elegida'
  if (duracion.modo === 'cobros') {
    const n = parseInt(duracion.cobros, 10)
    return `${n} cobro${n === 1 ? '' : 's'}, hasta el ${fechaLarga(hasta)}`
  }
  return `hasta el ${fechaLarga(hasta)}`
}

/** ¿Cuánto dura? Definitivo, un número de cobros o hasta una fecha. */
export function CamposDuracion({ duracion, onChange, inicio }) {
  const modos = [
    { value: 'definitivo', label: 'Definitivo' },
    { value: 'cobros',     label: 'Por cobros' },
    { value: 'fecha',      label: 'Hasta una fecha' },
  ]
  const hasta = hastaDeDuracion(duracion, inicio)
  return (
    <div className="flex flex-col gap-2">
      <span className={ETIQUETA}>Cuánto dura</span>
      <div role="radiogroup" aria-label="Cuánto dura" className="flex flex-wrap gap-2">
        {modos.map(m => {
          const activo = duracion.modo === m.value
          return (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => onChange({ ...duracion, modo: m.value })}
              className="h-10 px-4 rounded-[10px] text-[14px] font-semibold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf-gold)]"
              style={activo
                ? { background: 'var(--cf-ink)', color: 'var(--cf-surface)', borderColor: 'var(--cf-ink)' }
                : { background: 'var(--cf-card)', color: 'var(--cf-ink-2)', borderColor: 'var(--cf-border)' }}
            >
              {m.label}
            </button>
          )
        })}
      </div>
      {duracion.modo === 'cobros' && (
        <label className="flex items-center gap-2 flex-wrap">
          <span className="text-[14px] text-[var(--cf-ink-2)]">Los próximos</span>
          <input
            type="number" min="1" max="36" inputMode="numeric"
            value={duracion.cobros}
            onChange={(e) => onChange({ ...duracion, cobros: e.target.value })}
            className={`${CAMPO} w-20`}
          />
          <span className="text-[14px] text-[var(--cf-ink-2)]">cobros mensuales</span>
        </label>
      )}
      {duracion.modo === 'fecha' && (
        <input
          type="date"
          min={diaBogota(inicio)}
          value={duracion.hasta}
          onChange={(e) => onChange({ ...duracion, hasta: e.target.value })}
          className={`${CAMPO} w-fit`}
        />
      )}
      <p className="text-[13px] text-[var(--cf-ink-3)]">
        {duracion.modo === 'definitivo'
          ? 'Se queda con este precio hasta que alguien lo cambie aquí.'
          : hasta
            ? `Se aplica a los cobros que empiecen hasta el ${fechaLarga(hasta)}. El siguiente ya va a lista, sin tocar nada.`
            : 'Elige hasta cuándo.'}
      </p>
    </div>
  )
}

/** Los próximos cobros con el borrador puesto: dónde cambia el precio. */
export function VistaPreviaCobros({ country, plan, precio, hasta, inicio, cobroAutomatico }) {
  const borrador = {
    country,
    precioPreferencial: parseInt(precio, 10) || null,
    precioPreferencialPlan: plan,
    precioPreferencialHasta: hasta,
  }
  const filas = proximosCobros(borrador, plan, inicio, 4)
  return (
    <div className="rounded-[12px] border border-[var(--cf-border)] overflow-hidden">
      <div className="px-3 py-2 flex items-center justify-between gap-2 flex-wrap" style={{ background: 'var(--cf-fill)' }}>
        <span className={ETIQUETA}>Así quedan los próximos cobros</span>
        <span className="text-[12px] text-[var(--cf-ink-3)]">
          {cobroAutomatico ? 'Se cobran solos con Nequi' : 'Paga a mano'}
        </span>
      </div>
      {filas.map((f, i) => (
        <div key={i} className="px-3 py-2.5 flex items-center justify-between gap-3" style={{ borderTop: i ? '1px solid var(--cf-hairline)' : 'none' }}>
          <span className="text-[14px] text-[var(--cf-ink-2)]">{fechaLarga(f.fecha)}</span>
          <span className="flex items-center gap-2">
            <Pastilla tono={f.preferencial ? 'aldia' : 'neutro'}>{f.preferencial ? 'Preferencial' : 'Lista'}</Pastilla>
            <span className="cf-num text-[15px] font-bold text-[var(--cf-ink)]">{formatMoney(f.monto, country)}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

function porcentajeBajoLista(precio, lista) {
  const p = parseInt(precio, 10)
  if (!(p > 0) || !(lista > 0) || p >= lista) return null
  return Math.round((1 - p / lista) * 100)
}

export default function PrecioPreferencial({ org, accionando, ejecutarAccion }) {
  const country = org.country || 'co'
  const resumen = org.precio ?? {}
  const pref = resumen.preferencial
  const cobro = resumen.proximoCobro
  /* El cobro automático cobra `monto`; a mano, el checkout cobra `aMano`. Solo
     difieren con un pago por revisar. */
  const montoVisible = cobro && !org.cobroAutomaticoPuesto ? (cobro.aMano ?? cobro.monto) : cobro?.monto
  const inicio = cobro?.fecha ? new Date(cobro.fecha) : new Date()
  const planActual = resumen.plan ?? org.plan

  const [abierto, setAbierto] = useState(false)
  const [form, setForm] = useState(null)

  const abrir = (valores = {}) => {
    const plan = valores.plan ?? pref?.plan ?? planActual ?? 'starter'
    setForm({
      plan: PLANES_VENTA.includes(plan) || plan === 'test' ? plan : 'starter',
      precio: String(valores.precio ?? pref?.monto ?? ''),
      nota: pref?.nota ?? '',
      duracion: pref?.hasta && resumen.estado !== 'terminado'
        ? { modo: 'fecha', cobros: '3', hasta: diaBogota(pref.hasta) }
        : { modo: valores.modo ?? 'definitivo', cobros: '3', hasta: '' },
    })
    setAbierto(true)
  }

  const listaForm = form ? getPrecioPlan(form.plan, country) : 0
  const pctForm = form ? porcentajeBajoLista(form.precio, listaForm) : null
  const hastaForm = form ? hastaDeDuracion(form.duracion, inicio) : null

  const guardar = async () => {
    const precio = parseInt(form.precio, 10)
    if (!(precio > 0)) { alert('Escribe el precio por mes'); return }
    if (precio >= listaForm) { alert(`Eso no es preferencial: la lista de ${nombrePlan(form.plan)} es ${formatMoney(listaForm, country)}`); return }
    if (form.duracion.modo !== 'definitivo' && !hastaForm) { alert('Elige hasta cuándo dura'); return }
    const texto = `${nombrePlan(form.plan)} a ${formatMoney(precio, country)}/mes, ${describirDuracion(form.duracion, inicio)}`
    if (!confirm(`¿Precio preferencial para "${org.nombre}"?\n\n${texto}`)) return
    await ejecutarAccion('precioPreferencial', {
      plan: form.plan,
      precio,
      nota: form.nota,
      ...duracionParaApi(form.duracion),
    })
    setAbierto(false)
  }

  const quitar = () => {
    const msg = pref
      ? `¿Quitar el precio preferencial de "${org.nombre}"? Desde el próximo cobro paga la lista.`
      : `¿Cobrarle la lista a "${org.nombre}" desde el próximo cobro?`
    if (confirm(msg)) ejecutarAccion('quitarPrecioPreferencial')
  }

  /* El estado, de un vistazo. */
  let pastilla
  if (resumen.porRevisar) pastilla = <Pastilla tono="atraso">Por revisar</Pastilla>
  else if (resumen.estado === 'definitivo') pastilla = <Pastilla tono="aldia">Preferencial definitivo</Pastilla>
  else if (resumen.estado === 'temporal') pastilla = <Pastilla tono="aldia">Preferencial hasta el {fechaLarga(pref.hasta)}</Pastilla>
  else if (resumen.estado === 'terminado') pastilla = <Pastilla>Preferencial terminado</Pastilla>
  else pastilla = <Pastilla>Precio de lista</Pastilla>

  const prefDeOtroPlan = pref && planActual && pref.plan !== planActual && resumen.estado !== 'terminado'
  const pctPref = pref ? porcentajeBajoLista(pref.monto, getPrecioPlan(pref.plan, country)) : null

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <p className="text-xs font-semibold text-[var(--cf-ink-3)] uppercase tracking-wide">Precio</p>
        {pastilla}
      </div>

      <div className="flex flex-col gap-4">
        {/* ── Lo que se va a cobrar ── */}
        {cobro ? (
          <div className="flex flex-col gap-1">
            <span className={ETIQUETA}>
              {org.cobroAutomaticoPuesto ? 'Próximo cobro' : 'Próximo pago'} · {nombrePlan(planActual)} · {fechaLarga(cobro.fecha)}
            </span>
            <span className="flex items-baseline gap-2 flex-wrap">
              <span className="cf-num text-[25px] font-bold text-[var(--cf-ink)]">{formatMoney(montoVisible, country)}</span>
              <span className="text-[14px] text-[var(--cf-ink-3)]">/mes</span>
              {montoVisible < cobro.lista && (
                <span className="cf-num text-[14px] text-[var(--cf-ink-3)] line-through">{formatMoney(cobro.lista, country)}</span>
              )}
            </span>
            <span className="text-[13px] text-[var(--cf-ink-3)]">
              {org.cobroAutomaticoPuesto
                ? 'Tiene el cobro automático puesto: esto se le cobra solo.'
                : 'No tiene cobro automático: es lo que verá al pagar.'}
              {cobro.preferencial && cobro.hasta && ` Después del ${fechaLarga(cobro.hasta)}, ${formatMoney(cobro.lista, country)}/mes.`}
            </span>
          </div>
        ) : (
          <p className="text-[14px] text-[var(--cf-ink-3)]">Todavía no ha pagado ningún plan.</p>
        )}

        {/* ── Pago que nadie ha revisado ── */}
        {resumen.porRevisar && resumen.ultimoPago && (
          <div className="rounded-[12px] px-4 py-3 flex flex-col gap-3" style={{ background: 'var(--cf-gold-bg)', border: '1px solid var(--cf-gold-border)' }}>
            <p className="text-[14px] leading-snug text-[var(--cf-ink)]">
              El último pago fue de <b className="cf-num">{formatMoney(resumen.ultimoPago.montoCOP, country)}</b> ({nombrePlan(resumen.ultimoPago.plan)}),
              que queda por debajo de {cobro?.preferencial ? 'su precio preferencial' : 'la lista'}. Nadie ha dicho si es un precio preferencial.
              {/* Solo el cobro automático mira el último pago; a mano sale lo del checkout. */}
              {cobro && (org.cobroAutomaticoPuesto
                ? ` Mientras tanto el cobro automático le cobra ${formatMoney(cobro.monto, country)}/mes en vez de ${formatMoney(cobro.aMano ?? cobro.lista, country)}.`
                : ` Pagando a mano paga ${formatMoney(cobro.aMano ?? cobro.lista, country)}; si activa el cobro automático, se le cobrarían ${formatMoney(cobro.monto, country)}/mes.`)}
            </p>
            <div className="flex gap-2 flex-wrap">
              {cobro && (
                <Button size="sm" variant="secondary" onClick={() => abrir({ plan: resumen.ultimoPago.plan, precio: cobro.monto })}>
                  Dejar {formatMoney(cobro.monto, country)}/mes como preferencial
                </Button>
              )}
              <Button size="sm" variant="secondary" loading={accionando === 'quitarPrecioPreferencial'} onClick={quitar}>
                Cobrar lista
              </Button>
            </div>
          </div>
        )}

        {/* ── El preferencial que tiene ── */}
        {pref && !abierto && (
          <div className="rounded-[12px] border border-[var(--cf-border)] px-4 py-3 flex flex-col gap-1">
            <span className="text-[15px] text-[var(--cf-ink)]">
              <b>{nombrePlan(pref.plan)}</b> a <b className="cf-num">{formatMoney(pref.monto, country)}</b>/mes
              {pctPref != null && <span className="text-[var(--cf-ink-3)]"> · {pctPref}% bajo lista</span>}
            </span>
            <span className="text-[13px] text-[var(--cf-ink-3)]">
              {resumen.estado === 'definitivo' && 'Definitivo: no termina solo.'}
              {resumen.estado === 'temporal' && `Hasta el ${fechaLarga(pref.hasta)}. Después, lista.`}
              {resumen.estado === 'terminado' && `Terminó el ${fechaLarga(pref.hasta)}. Ya paga lista.`}
            </span>
            {pref.nota && <span className="text-[13px] text-[var(--cf-ink-2)]">Nota: {pref.nota}</span>}
            {prefDeOtroPlan && (
              <span className="text-[13px] text-[var(--cf-red-dark)]">
                Es para {nombrePlan(pref.plan)} y hoy paga {nombrePlan(planActual)}: no se le aplica.
              </span>
            )}
          </div>
        )}

        {/* ── El formulario ── */}
        {abierto && form ? (
          <div className="flex flex-col gap-4 rounded-[12px] border border-[var(--cf-border)] p-4">
            <div className="flex gap-3 flex-wrap">
              <label className="flex flex-col gap-1">
                <span className={ETIQUETA}>Plan</span>
                <select value={form.plan} onChange={(e) => setForm(f => ({ ...f, plan: e.target.value }))} className={CAMPO}>
                  {PLANES_VENTA.map(k => (
                    <option key={k} value={k}>{nombrePlan(k)} · lista {formatMoney(getPrecioPlan(k, country), country)}</option>
                  ))}
                  {country === 'co' && <option value="test">{nombrePlan('test')} · lista {formatMoney(getPrecioPlan('test', country), country)}</option>}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className={ETIQUETA}>Precio por mes</span>
                <input
                  type="number" min="1" inputMode="numeric"
                  value={form.precio}
                  onChange={(e) => setForm(f => ({ ...f, precio: e.target.value }))}
                  placeholder={String(listaForm)}
                  className={`${CAMPO} w-40`}
                />
              </label>
            </div>
            <p className="text-[13px] -mt-2" style={{ color: parseInt(form.precio, 10) >= listaForm ? 'var(--cf-red-dark)' : 'var(--cf-ink-3)' }}>
              {parseInt(form.precio, 10) >= listaForm
                ? `Tiene que ser menos que la lista (${formatMoney(listaForm, country)}).`
                : pctForm != null ? `${pctForm}% bajo la lista de ${formatMoney(listaForm, country)}.` : `La lista es ${formatMoney(listaForm, country)}.`}
            </p>

            <CamposDuracion duracion={form.duracion} onChange={(d) => setForm(f => ({ ...f, duracion: d }))} inicio={inicio} />

            <label className="flex flex-col gap-1">
              <span className={ETIQUETA}>Por qué (opcional)</span>
              <input
                type="text" maxLength={191}
                value={form.nota}
                onChange={(e) => setForm(f => ({ ...f, nota: e.target.value }))}
                placeholder="Ej.: cliente fundador, precio de lanzamiento"
                className={CAMPO}
              />
            </label>

            {parseInt(form.precio, 10) > 0 && parseInt(form.precio, 10) < listaForm && (
              <VistaPreviaCobros
                country={country}
                plan={form.plan}
                precio={form.precio}
                hasta={form.duracion.modo === 'definitivo' ? null : hastaForm}
                inicio={inicio}
                cobroAutomatico={org.cobroAutomaticoPuesto}
              />
            )}

            <div className="flex gap-2 flex-wrap">
              <Button size="sm" loading={accionando === 'precioPreferencial'} onClick={guardar}>Guardar precio</Button>
              <Button size="sm" variant="ghost" onClick={() => setAbierto(false)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={() => abrir()}>
              {pref ? 'Cambiar precio preferencial' : 'Poner precio preferencial'}
            </Button>
            {pref && (
              <Button size="sm" variant="ghost" loading={accionando === 'quitarPrecioPreferencial'} onClick={quitar}>
                Quitar
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
