'use client'

import { useState } from 'react'

export const CAMPOS_PREDEFINIDOS = [
  { campo: 'totalPagado',      nombre: 'Total pagado',         porDefecto: true },
  { campo: 'saldoPendiente',   nombre: 'Saldo pendiente',      porDefecto: true },
  { campo: 'totalAPagar',      nombre: 'Total a pagar',        porDefecto: true },
  { campo: 'cuota',            nombre: 'Cuota',                porDefecto: true },
  { campo: 'progreso',         nombre: 'Progreso',             porDefecto: true },
  { campo: 'montoPrestado',    nombre: 'Monto prestado',       porDefecto: false },
  { campo: 'frecuencia',       nombre: 'Frecuencia de pago',   porDefecto: false },
  { campo: 'fechaVencimiento', nombre: 'Fecha de vencimiento', porDefecto: false },
  { campo: 'numeroCuota',      nombre: 'Cuota actual',         porDefecto: false },
  { campo: 'diasMora',         nombre: 'Días en mora',         porDefecto: false },
  { campo: 'clienteCedula',    nombre: 'Cédula',               porDefecto: false },
  { campo: 'clienteTelefono',  nombre: 'Teléfono',             porDefecto: false },
  { campo: 'ruta',             nombre: 'Ruta',                 porDefecto: false },
  { campo: 'cobrador',         nombre: 'Cobrador',             porDefecto: false },
]

export function getDefaultCampos() {
  return CAMPOS_PREDEFINIDOS
    .filter(c => c.porDefecto)
    .map(c => ({ tipo: 'dato', campo: c.campo, nombre: c.nombre }))
}

export const CAMPOS_DATO_LABELS = Object.fromEntries(
  CAMPOS_PREDEFINIDOS.map(c => [c.campo, c.nombre])
)

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
      <div className="rounded-[12px] border border-[var(--color-border)] overflow-hidden divide-y divide-[var(--color-border)]">
        {CAMPOS_PREDEFINIDOS.map(def => {
          const checked = isChecked(def.campo)
          const editing = editandoTitulo === def.campo

          return (
            <div
              key={def.campo}
              className="flex items-center gap-3 px-3 py-2.5 transition-colors"
              style={{ background: checked ? 'color-mix(in srgb, var(--color-accent) 4%, var(--color-bg-surface))' : 'var(--color-bg-surface)' }}
            >
              <button
                type="button"
                onClick={() => toggle(def.campo)}
                className="shrink-0 cursor-pointer"
                aria-label={`${checked ? 'Quitar' : 'Agregar'} ${def.nombre}`}
              >
                {checked ? (
                  <span className="flex items-center justify-center w-5 h-5 rounded-[6px] bg-[var(--color-accent)] transition-all">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                ) : (
                  <span className="flex items-center justify-center w-5 h-5 rounded-[6px] border-2 border-[var(--color-border)] transition-all" />
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
                    className="w-full text-xs font-medium bg-transparent text-[var(--color-text-primary)] border-b border-[var(--color-accent)] outline-none py-0.5"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => toggle(def.campo)}
                    className="text-left w-full cursor-pointer"
                  >
                    <span className={`text-xs font-medium transition-colors ${checked ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                      {getNombre(def.campo)}
                    </span>
                  </button>
                )}
              </div>

              {checked && !editing && (
                <button
                  type="button"
                  onClick={() => setEditandoTitulo(def.campo)}
                  className="shrink-0 p-1 rounded-[6px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors cursor-pointer"
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
          <p className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Campos personalizados</p>
          {textosCampos.map((c, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-[10px] bg-[var(--color-bg-hover)] border border-[var(--color-border)]">
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-[var(--color-text-primary)]">{c.nombre}: </span>
                <span className="text-xs text-[var(--color-text-muted)]">{c.valor}</span>
              </div>
              <button
                type="button"
                onClick={() => quitarTexto(i)}
                className="shrink-0 p-1 rounded-[6px] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors cursor-pointer"
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
        <div className="p-3 rounded-[10px] border border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_5%,var(--color-bg-surface))] space-y-2.5">
          <input
            type="text"
            placeholder="Nombre (ej: Asesor, Sucursal)"
            value={textoNombre}
            onChange={e => setTextoNombre(e.target.value)}
            maxLength={30}
            autoFocus
            className="w-full h-9 px-3 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-bg-hover)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] transition-all"
          />
          <input
            type="text"
            placeholder="Valor (ej: Juan Pérez, Tel: 300 1234567)"
            value={textoValor}
            onChange={e => setTextoValor(e.target.value)}
            maxLength={60}
            className="w-full h-9 px-3 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-bg-hover)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] transition-all"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => { setAddTexto(false); setTextoNombre(''); setTextoValor('') }}
              className="flex-1 py-2 rounded-[8px] text-xs font-medium bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] cursor-pointer">
              Cancelar
            </button>
            <button type="button" disabled={!textoNombre.trim() || !textoValor.trim()} onClick={agregarTexto}
              className="flex-1 py-2 rounded-[8px] text-xs font-medium bg-[var(--color-accent)] text-white disabled:opacity-40 cursor-pointer">
              Agregar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddTexto(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-[10px] border border-dashed border-[var(--color-border)] text-[10px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] transition-all cursor-pointer"
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
