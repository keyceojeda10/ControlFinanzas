'use client'

import { useState } from 'react'

// La lista de campos vive en lib/campos-recibo.js: es dato, no interfaz, y asi
// se puede probar sin montar React. Se reexporta para no romper los imports que
// ya apuntaban aca.
import { CAMPOS_PREDEFINIDOS, getDefaultCampos, CAMPOS_DATO_LABELS } from '@/lib/campos-recibo'
export { CAMPOS_PREDEFINIDOS, getDefaultCampos, CAMPOS_DATO_LABELS }

export function ChecklistCamposRecibo({ campos, onChange }) {
  const [addTexto, setAddTexto] = useState(false)
  const [textoNombre, setTextoNombre] = useState('')
  const [textoValor, setTextoValor] = useState('')
  const [editandoTitulo, setEditandoTitulo] = useState(null)

  const datosCampos = campos.filter(c => c.tipo === 'dato')
  const textosCampos = campos.filter(c => c.tipo === 'texto')

  const isChecked = (key) => datosCampos.some(c => c.campo === key)

  const getNombre = (key) => {
    const saved = datosCampos.find(c => c.campo === key)
    if (saved) return saved.nombre
    return CAMPOS_PREDEFINIDOS.find(c => c.campo === key)?.nombre || key
  }

  const toggle = (key) => {
    if (isChecked(key)) {
      onChange(campos.filter(c => !(c.tipo === 'dato' && c.campo === key)))
    } else {
      const def = CAMPOS_PREDEFINIDOS.find(c => c.campo === key)
      onChange([...campos, { tipo: 'dato', campo: key, nombre: def?.nombre || key }])
    }
  }

  const renombrar = (key, nuevoNombre) => {
    if (!nuevoNombre.trim()) return
    onChange(campos.map(c =>
      c.tipo === 'dato' && c.campo === key ? { ...c, nombre: nuevoNombre.trim() } : c
    ))
    setEditandoTitulo(null)
  }

  const agregarTexto = () => {
    if (!textoNombre.trim() || !textoValor.trim()) return
    onChange([...campos, { tipo: 'texto', nombre: textoNombre.trim(), valor: textoValor.trim() }])
    setTextoNombre('')
    setTextoValor('')
    setAddTexto(false)
  }

  const quitarTexto = (i) => {
    const idxGlobal = campos.findIndex((c, j) => c.tipo === 'texto' && textosCampos.indexOf(c) === i)
    if (idxGlobal >= 0) onChange(campos.filter((_, j) => j !== idxGlobal))
  }

  return (
    <div className="space-y-3">
      <div className="rounded-[12px] border border-[var(--cf-border)] overflow-hidden divide-y divide-[var(--cf-border)]">
        {CAMPOS_PREDEFINIDOS.map(def => {
          const checked = isChecked(def.campo)
          const editing = editandoTitulo === def.campo

          return (
            <div
              key={def.campo}
              className="flex items-center gap-3 px-3 py-2.5 transition-colors"
              style={{ background: checked ? 'color-mix(in srgb, var(--cf-gold) 4%, var(--cf-surface))' : 'var(--cf-surface)' }}
            >
              <button
                type="button"
                onClick={() => toggle(def.campo)}
                className="shrink-0 cursor-pointer"
                aria-label={`${checked ? 'Quitar' : 'Agregar'} ${def.nombre}`}
              >
                {checked ? (
                  <span className="flex items-center justify-center w-5 h-5 rounded-[6px] bg-[var(--cf-gold)] transition-all">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                ) : (
                  <span className="flex items-center justify-center w-5 h-5 rounded-[6px] border-2 border-[var(--cf-border)] transition-all" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                {editing ? (
                  <input
                    type="text"
                    defaultValue={getNombre(def.campo)}
                    autoFocus
                    maxLength={30}
                    onBlur={(e) => renombrar(def.campo, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { renombrar(def.campo, e.target.value); e.target.blur() } }}
                    className="w-full text-xs font-medium bg-transparent text-[var(--cf-ink)] border-b border-[var(--cf-gold)] outline-none py-0.5"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => toggle(def.campo)}
                    className="text-left w-full cursor-pointer"
                  >
                    <span className={`text-xs font-medium transition-colors ${checked ? 'text-[var(--cf-ink)]' : 'text-[var(--cf-ink-3)]'}`}>
                      {getNombre(def.campo)}
                    </span>
                  </button>
                )}
              </div>

              {checked && !editing && (
                <button
                  type="button"
                  onClick={() => setEditandoTitulo(def.campo)}
                  className="shrink-0 p-1 rounded-[6px] text-[var(--cf-ink-3)] hover:text-[var(--cf-gold)] transition-colors cursor-pointer"
                  title="Editar nombre"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </div>
          )
        })}
      </div>

      {textosCampos.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-[var(--cf-ink-3)] uppercase tracking-wide">Campos personalizados</p>
          {textosCampos.map((c, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-[10px] bg-[var(--cf-fill)] border border-[var(--cf-border)]">
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-[var(--cf-ink)]">{c.nombre}: </span>
                <span className="text-xs text-[var(--cf-ink-3)]">{c.valor}</span>
              </div>
              <button
                type="button"
                onClick={() => quitarTexto(i)}
                className="shrink-0 p-1 rounded-[6px] text-[var(--cf-ink-3)] hover:text-[var(--cf-red-dark)] transition-colors cursor-pointer"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {addTexto ? (
        <div className="p-3 rounded-[10px] border border-[var(--cf-gold)] bg-[color-mix(in_srgb,var(--cf-gold)_5%,var(--cf-surface))] space-y-2.5">
          <input
            type="text"
            placeholder="Nombre (ej: Asesor, Sucursal)"
            value={textoNombre}
            onChange={e => setTextoNombre(e.target.value)}
            maxLength={30}
            autoFocus
            className="w-full h-9 px-3 rounded-[8px] border border-[var(--cf-border)] bg-[var(--cf-fill)] text-xs text-[var(--cf-ink)] focus:outline-none focus:border-[var(--cf-gold)] transition-all"
          />
          <input
            type="text"
            placeholder="Valor (ej: Juan Pérez, Tel: 300 1234567)"
            value={textoValor}
            onChange={e => setTextoValor(e.target.value)}
            maxLength={60}
            className="w-full h-9 px-3 rounded-[8px] border border-[var(--cf-border)] bg-[var(--cf-fill)] text-xs text-[var(--cf-ink)] focus:outline-none focus:border-[var(--cf-gold)] transition-all"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => { setAddTexto(false); setTextoNombre(''); setTextoValor('') }}
              className="flex-1 py-2 rounded-[8px] text-xs font-medium bg-[var(--cf-fill)] text-[var(--cf-ink-3)] cursor-pointer">
              Cancelar
            </button>
            <button type="button" disabled={!textoNombre.trim() || !textoValor.trim()} onClick={agregarTexto}
              className="flex-1 py-2 rounded-[8px] text-xs font-medium bg-[var(--cf-gold)] text-white disabled:opacity-40 cursor-pointer">
              Agregar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddTexto(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-[10px] border border-dashed border-[var(--cf-border)] text-[10px] font-medium text-[var(--cf-ink-3)] hover:text-[var(--cf-gold)] hover:border-[var(--cf-gold)] transition-all cursor-pointer"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Agregar campo personalizado
        </button>
      )}
    </div>
  )
}
