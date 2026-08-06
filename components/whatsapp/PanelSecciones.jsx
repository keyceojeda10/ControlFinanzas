'use client'

/* El panel de secciones del mensaje, EN UN SOLO SITIO.
 *
 * Vivía dentro de `ModalWhatsAppTemplates` y por eso la hoja nueva no podía
 * ofrecerlo: quien quería encender o apagar una sección tenía que saltar al
 * modal viejo. El dueño lo dijo claro — «todas esas opciones deberían estar
 * integradas en el nuevo modal; el viejo no debería existir ya».
 *
 * Se extrae tal cual, sin reescribirlo: es la pieza que los usuarios ya conocen
 * y funciona. Reescribirla sería repetir el error que empezó todo esto —hacer
 * de cero lo que ya existía— solo que con las secciones en vez de con los
 * mensajes.
 */

import { useState } from 'react'

export default function PanelSecciones({ secciones, activas, onChange, guardado, onGuardar, extras, onExtrasChange }) {
  const [agregando, setAgregando] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoValor, setNuevoValor] = useState('')

  if (!secciones?.length) return null
  const toggleables = secciones.filter(s => !s.locked)
  if (!toggleables.length) return null

  const agregarCampo = () => {
    if (!nuevoNombre.trim() || !nuevoValor.trim()) return
    onExtrasChange([...(extras || []), { nombre: nuevoNombre.trim(), valor: nuevoValor.trim() }])
    setNuevoNombre('')
    setNuevoValor('')
    setAgregando(false)
  }

  const eliminarCampo = (idx) => {
    const copia = [...(extras || [])]
    copia.splice(idx, 1)
    onExtrasChange(copia)
  }

  return (
    <div className="rounded-[12px] overflow-hidden" style={{ border: '1px solid var(--cf-border)', background: 'var(--cf-surface)' }}>
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--cf-border)' }}>
        <p className="text-[10px] font-extrabold uppercase tracking-[.07em]" style={{ color: 'var(--cf-ink-3)' }}>
          Secciones del mensaje
        </p>
        <button
          type="button"
          onClick={onGuardar}
          className="flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[10px] font-medium transition-all"
          style={{
            background: guardado ? 'color-mix(in srgb, var(--cf-green-dark) 15%, transparent)' : 'var(--cf-card)',
            color: guardado ? 'var(--cf-green-dark)' : 'var(--cf-gold)',
            border: `1px solid ${guardado ? 'var(--cf-green-dark)' : 'var(--cf-border)'}`,
          }}
        >
          {guardado ? (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
          )}
          {guardado ? 'Guardado' : 'Guardar'}
        </button>
      </div>

      <div className="divide-y divide-[var(--cf-border)]">
        {toggleables.map(sec => {
          const checked = activas.has(sec.key)
          return (
            <button
              key={sec.key}
              type="button"
              onClick={() => onChange(sec.key)}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-left transition-colors"
              style={{ background: checked ? 'color-mix(in srgb, var(--cf-gold) 4%, transparent)' : 'transparent' }}
            >
              {checked ? (
                <span className="flex items-center justify-center w-[18px] h-[18px] rounded-[5px] shrink-0 transition-all" style={{ background: 'var(--cf-gold)' }}>
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              ) : (
                <span className="flex items-center justify-center w-[18px] h-[18px] rounded-[5px] shrink-0 transition-all" style={{ border: '2px solid var(--cf-border)' }} />
              )}
              <span className={`text-[11px] font-medium transition-colors ${checked ? 'text-[var(--cf-ink)]' : 'text-[var(--cf-ink-3)]'}`}>
                {sec.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Campos personalizados */}
      <div style={{ borderTop: '1px solid var(--cf-border)' }}>
        {Array.isArray(extras) && extras.length > 0 && (
          <div className="px-3 pt-2 pb-1 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[.06em]" style={{ color: 'var(--cf-ink-3)' }}>
              Campos adicionales
            </p>
            {extras.map((e, idx) => (
              <div key={idx} className="flex items-center gap-2 text-[11px]">
                <span className="flex-1 truncate" style={{ color: 'var(--cf-ink-2)' }}>
                  {e.nombre}: {e.valor}
                </span>
                <button
                  type="button"
                  onClick={() => eliminarCampo(idx)}
                  className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full hover:bg-[color-mix(in_srgb,var(--cf-red-dark)_10%,transparent)] transition-colors"
                  style={{ color: 'var(--cf-red-dark)' }}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {agregando ? (
          <div className="px-3 py-2 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nombre"
                value={nuevoNombre}
                onChange={e => setNuevoNombre(e.target.value)}
                className="flex-1 h-8 px-2 rounded-[8px] text-[11px] focus:outline-none focus:ring-1 focus:ring-[var(--cf-gold)]"
                style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)', color: 'var(--cf-ink)' }}
                autoFocus
              />
              <input
                type="text"
                placeholder="Valor"
                value={nuevoValor}
                onChange={e => setNuevoValor(e.target.value)}
                className="flex-1 h-8 px-2 rounded-[8px] text-[11px] focus:outline-none focus:ring-1 focus:ring-[var(--cf-gold)]"
                style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)', color: 'var(--cf-ink)' }}
                onKeyDown={e => e.key === 'Enter' && agregarCampo()}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setAgregando(false); setNuevoNombre(''); setNuevoValor('') }}
                className="flex-1 h-7 rounded-[6px] text-[10px] font-medium"
                style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)', color: 'var(--cf-ink-3)' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={agregarCampo}
                disabled={!nuevoNombre.trim() || !nuevoValor.trim()}
                className="flex-1 h-7 rounded-[6px] text-[10px] font-medium disabled:opacity-40"
                style={{ background: 'var(--cf-gold)', color: '#3a2900' }}
              >
                Agregar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAgregando(true)}
            className="flex items-center gap-1.5 w-full px-3 py-2 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--cf-gold)_4%,transparent)]"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="var(--cf-gold)" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-[11px] font-medium" style={{ color: 'var(--cf-gold)' }}>
              Agregar campo personalizado
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
