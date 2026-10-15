'use client'

/* LA FECHA, A LA VISTA (15 oct 2026).
 *
 * Un prestamista renovaba y no encontraba cómo poner la fecha: «el renove lo
 * dejé ayer, se me olvidó entrar al sistema». El campo existía, pero dentro de
 * «Más opciones», y por defecto dice hoy. Ahora va encima del botón de
 * entregar: «Hoy» y «Ayer» a un toque, y «Otra fecha» abre el calendario.
 *
 * `valor` y `hoy` son 'YYYY-MM-DD' (día local del negocio). No deja fechas
 * futuras: un préstamo no se entrega mañana. */

import { useRef } from 'react'

const sumarDias = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const corta = (iso) => new Date(`${iso}T12:00:00Z`)
  .toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  .replace(/\.$/, '').replace(' de ', ' ')

export default function FechaALaVista({ rotulo = 'Fecha', valor, hoy, onCambiar }) {
  const campo = useRef(null)
  const ayer = sumarDias(hoy, -1)
  const otra = valor && valor !== hoy && valor !== ayer
  const chip = (activo) => ({
    height: 34, padding: '0 12px', borderRadius: 999, cursor: 'pointer', font: 'inherit',
    fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
    border: `1px solid ${activo ? 'var(--cf-gold-border)' : 'var(--cf-border)'}`,
    background: activo ? 'var(--cf-gold-tint)' : 'var(--cf-card)',
    color: activo ? 'var(--cf-gold-text)' : 'var(--cf-ink-2)',
  })
  const abrirCalendario = () => {
    const el = campo.current
    if (!el) return
    try { el.showPicker() } catch { el.focus(); el.click() }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cf-ink-3)', marginRight: 2 }}>{rotulo}</span>
      <button type="button" style={chip(valor === hoy)} onClick={() => onCambiar(hoy)}>Hoy</button>
      <button type="button" style={chip(valor === ayer)} onClick={() => onCambiar(ayer)}>Ayer</button>
      <button type="button" style={chip(otra)} onClick={abrirCalendario}>
        {otra ? corta(valor) : 'Otra fecha'}
      </button>
      <input
        ref={campo}
        type="date"
        aria-label={rotulo}
        value={valor || ''}
        max={hoy}
        onChange={(e) => { if (e.target.value) onCambiar(e.target.value > hoy ? hoy : e.target.value) }}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />
    </div>
  )
}
