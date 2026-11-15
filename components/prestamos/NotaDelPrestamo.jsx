'use client'

/**
 * LA NOTA DEL CRÉDITO, EN EL PRÉSTAMO (15 nov 2026).
 *
 * «Cuando se mete a uno a gestión y mire uno pago, si mire la nota. Ah, es que
 * este paciente paga cada tanto» (soporte de un cliente). Va justo debajo de los
 * botones de acción: es lo primero que hay que leer antes de cobrar.
 *
 * Sin nota no ocupa nada para quien no puede escribirla; quien puede ve una
 * línea discreta para agregarla.
 */
import { useState } from 'react'
import { NOTA_MAX } from '@/lib/prestamos/nota'

const IconoNota = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 mt-0.5">
    <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
    <path d="M19.5 7.125L16.862 4.487M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg>
)

export default function NotaDelPrestamo({ prestamoId, nota, puedeEditar = false, onGuardada }) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(nota || '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  if (!nota && !puedeEditar) return null

  const guardar = async () => {
    setGuardando(true); setError('')
    try {
      const r = await fetch(`/api/prestamos/${prestamoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: 'nota', nota: texto }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d?.error || 'No se pudo guardar la nota.')
      setEditando(false)
      onGuardada?.(d?.nota ?? null)
    } catch (e) {
      setError(e?.message || 'No se pudo guardar la nota. Revisa la señal.')
    } finally {
      setGuardando(false)
    }
  }

  if (editando) {
    return (
      <div className="rounded-[16px] p-3 space-y-2" style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
        <label htmlFor="nota-del-prestamo" className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>
          Nota del préstamo
        </label>
        <textarea id="nota-del-prestamo" value={texto} autoFocus rows={3} maxLength={NOTA_MAX}
          onChange={(e) => setTexto(e.target.value.slice(0, NOTA_MAX))}
          placeholder="Ej: paga los 20. Diciembre no paga, está fuera del país."
          className="w-full rounded-xl px-3 py-2.5 text-base resize-none focus:outline-none"
          style={{ background: 'var(--cf-fill)', border: '1px solid var(--cf-border)', color: 'var(--cf-ink)' }} />
        {error && <p className="text-[12px]" style={{ color: 'var(--cf-red-dark)' }}>{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={() => { setEditando(false); setTexto(nota || ''); setError('') }}
            className="flex-1 h-11 rounded-[12px] text-sm font-semibold"
            style={{ background: 'var(--cf-fill)', border: '1px solid var(--cf-border)', color: 'var(--cf-ink-2)' }}>
            Cancelar
          </button>
          <button type="button" onClick={guardar} disabled={guardando}
            className="flex-1 h-11 rounded-[12px] text-sm font-bold disabled:opacity-60"
            style={{ background: 'var(--cf-ink)', color: 'var(--cf-card)' }}>
            {guardando ? 'Guardando…' : 'Guardar nota'}
          </button>
        </div>
      </div>
    )
  }

  if (!nota) {
    return (
      <button type="button" onClick={() => setEditando(true)}
        className="w-full flex items-center gap-2 h-11 px-3 rounded-[12px] text-sm font-semibold"
        style={{ background: 'transparent', border: '1px dashed var(--cf-border-strong)', color: 'var(--cf-ink-3)' }}>
        {IconoNota}
        Agregar una nota a este préstamo
      </button>
    )
  }

  return (
    /* Neutro: el dorado es del monto, la acción primaria y el foco (DESIGN.md). */
    <div className="rounded-[16px] px-3 py-2.5 flex items-start gap-2.5"
      style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)', color: 'var(--cf-ink)' }}>
      <span style={{ color: 'var(--cf-ink-3)' }}>{IconoNota}</span>
      <p className="flex-1 min-w-0 text-sm leading-snug whitespace-pre-wrap break-words">{nota}</p>
      {puedeEditar && (
        <button type="button" onClick={() => { setTexto(nota); setEditando(true) }}
          className="shrink-0 text-[13px] font-bold min-h-[44px] -my-2.5 px-1 underline underline-offset-2"
          style={{ color: 'var(--cf-ink-2)' }}>
          Editar
        </button>
      )}
    </div>
  )
}
