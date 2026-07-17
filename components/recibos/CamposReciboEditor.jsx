'use client'

import { useState } from 'react'

export const CAMPOS_DATO_OPTIONS = [
  { value: 'saldoPendiente',   label: 'Saldo pendiente' },
  { value: 'totalPagado',      label: 'Total pagado' },
  { value: 'totalAPagar',      label: 'Total a pagar' },
  { value: 'montoPrestado',    label: 'Monto prestado' },
  { value: 'cuota',            label: 'Cuota' },
  { value: 'progreso',         label: 'Progreso (%)' },
  { value: 'frecuencia',       label: 'Frecuencia de pago' },
  { value: 'fechaVencimiento', label: 'Fecha de vencimiento' },
  { value: 'numeroCuota',      label: 'Numero de cuota actual' },
  { value: 'diasMora',         label: 'Dias en mora' },
  { value: 'clienteCedula',    label: 'Cedula del cliente' },
  { value: 'clienteTelefono',  label: 'Telefono del cliente' },
  { value: 'ruta',             label: 'Ruta' },
  { value: 'cobrador',         label: 'Cobrador' },
]

export const CAMPOS_DATO_LABELS = Object.fromEntries(CAMPOS_DATO_OPTIONS.map(o => [o.value, o.label]))

const inputClass = 'cf-input w-full h-11 px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-hover)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] transition-all disabled:opacity-50 disabled:cursor-not-allowed'

export function AgregarCampoRecibo({ onAdd }) {
  const [abierto, setAbierto] = useState(false)
  const [tipo, setTipo] = useState('texto')
  const [nombre, setNombre] = useState('')
  const [valor, setValor] = useState('')
  const [campo, setCampo] = useState('saldoPendiente')

  const reset = () => { setNombre(''); setValor(''); setCampo('saldoPendiente'); setTipo('texto'); setAbierto(false) }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-[10px] border border-dashed border-[var(--color-border)] text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] transition-all cursor-pointer"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
        Agregar campo
      </button>
    )
  }

  return (
    <div className="p-3 rounded-[10px] border border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_5%,var(--color-bg-surface))] space-y-3">
      <div className="flex gap-2">
        {['texto', 'dato'].map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTipo(t)}
            className={`flex-1 py-1.5 rounded-[8px] text-xs font-medium transition-all cursor-pointer ${tipo === t ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
          >
            {t === 'texto' ? 'Texto fijo' : 'Dato del prestamo'}
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder="Nombre del campo (ej: Disponible, Asesor, Ruta)"
        value={nombre}
        onChange={e => setNombre(e.target.value)}
        maxLength={30}
        className={inputClass}
        style={{ height: '36px', fontSize: '12px' }}
      />

      {tipo === 'texto' ? (
        <input
          type="text"
          placeholder="Valor fijo (ej: Tel: 3185034909)"
          value={valor}
          onChange={e => setValor(e.target.value)}
          maxLength={60}
          className={inputClass}
          style={{ height: '36px', fontSize: '12px' }}
        />
      ) : (
        <select
          value={campo}
          onChange={e => setCampo(e.target.value)}
          className={inputClass}
          style={{ height: '36px', fontSize: '12px' }}
        >
          {CAMPOS_DATO_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="flex-1 py-2 rounded-[8px] text-xs font-medium bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!nombre.trim() || (tipo === 'texto' && !valor.trim())}
          onClick={() => {
            const c = tipo === 'texto'
              ? { nombre: nombre.trim(), tipo: 'texto', valor: valor.trim() }
              : { nombre: nombre.trim(), tipo: 'dato', campo }
            onAdd(c)
            reset()
          }}
          className="flex-1 py-2 rounded-[8px] text-xs font-medium bg-[var(--color-accent)] text-white disabled:opacity-40 transition-all cursor-pointer"
        >
          Agregar
        </button>
      </div>
    </div>
  )
}

export function CamposReciboList({ campos, onRemove }) {
  if (!Array.isArray(campos) || campos.length === 0) return null

  return (
    <div className="space-y-2">
      {campos.map((campo, i) => (
        <div key={i} className="flex items-center gap-2 p-2.5 rounded-[10px] bg-[var(--color-bg-hover)] border border-[var(--color-border)]">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">{campo.nombre}</p>
            <p className="text-[10px] text-[var(--color-text-muted)] truncate">
              {campo.tipo === 'texto' ? `Texto fijo: ${campo.valor}` : `Dato: ${CAMPOS_DATO_LABELS[campo.campo] || campo.campo}`}
            </p>
          </div>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="shrink-0 p-1.5 rounded-[8px] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-dim)] transition-all cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
