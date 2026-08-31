'use client'

import { useMemo } from 'react'

// Modal que muestra lado a lado los cambios locales vs servidor para una
// mutacion que dio 412. Permite: usar mis cambios (forzar) | usar servidor (descartar).
export default function ConflictResolverModal({ mutacion, onResolve, onClose }) {
  const tipoLabel = useMemo(() => {
    if (!mutacion) return ''
    if (mutacion.tipo === 'cliente.update') return 'Cliente'
    if (mutacion.tipo === 'prestamo.update') return 'Préstamo'
    if (mutacion.tipo === 'prestamo.cerrar') return 'Préstamo (cerrar)'
    return mutacion.tipo
  }, [mutacion])

  if (!mutacion) return null

  const payload = mutacion.payload || {}
  const servidor = mutacion.servidorSnapshot || {}
  const campos = Object.keys(payload).filter(k => payload[k] !== undefined)

  const fmt = (v) => {
    if (v == null || v === '') return <span className="italic text-[var(--cf-ink-3)]">(vacío)</span>
    if (typeof v === 'number') return v.toLocaleString('es-CO')
    if (typeof v === 'boolean') return v ? 'si' : 'no'
    return String(v)
  }

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85dvh] overflow-y-auto bg-[var(--cf-surface)] border border-[var(--cf-red-dark)] rounded-2xl shadow-2xl">
        <div className="sticky top-0 bg-[var(--cf-surface)] border-b border-[var(--cf-border)] px-4 py-3">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-[var(--cf-red-dark)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
            </svg>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-[var(--cf-ink)]">Conflicto de edición</h2>
              <p className="text-[11px] text-[var(--cf-ink-3)]">
                {tipoLabel} - tu cambio chocó con una modificación en el servidor.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {!mutacion.servidorSnapshot && (
            <p className="text-[11px] text-[var(--cf-ink-3)] italic">
              No se pudo cargar el estado del servidor. Puedes forzar tus cambios o descartarlos.
            </p>
          )}

          {campos.length === 0 && (
            <p className="text-xs text-[var(--cf-ink-3)]">Sin campos para comparar.</p>
          )}

          {campos.map((k) => {
            const local = payload[k]
            const remoto = servidor[k]
            const distinto = String(local) !== String(remoto)
            return (
              <div key={k} className="rounded-lg border border-[var(--cf-border)] overflow-hidden">
                <div className="px-3 py-1.5 bg-[var(--cf-card)] border-b border-[var(--cf-border)]">
                  <p className="text-[11px] font-semibold text-[var(--cf-ink-2)] uppercase tracking-wide">{k}</p>
                </div>
                <div className="grid grid-cols-2 divide-x divide-[var(--cf-border)]">
                  <div className={`p-2.5 text-xs ${distinto ? 'bg-[var(--cf-ink-2)]/10' : ''}`}>
                    <p className="text-[10px] font-bold text-[var(--cf-ink-2)] uppercase mb-0.5">Tus cambios</p>
                    <p className="text-[var(--cf-ink)] break-words">{fmt(local)}</p>
                  </div>
                  <div className={`p-2.5 text-xs ${distinto ? 'bg-[var(--cf-gold-dark)]/10' : ''}`}>
                    <p className="text-[10px] font-bold text-[var(--cf-gold-dark)] uppercase mb-0.5">Servidor</p>
                    <p className="text-[var(--cf-ink)] break-words">{fmt(remoto)}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="sticky bottom-0 bg-[var(--cf-surface)] border-t border-[var(--cf-border)] p-3 flex flex-col gap-2">
          <button
            onClick={() => onResolve('local')}
            className="w-full h-10 rounded-lg bg-[var(--cf-ink-2)] text-black text-xs font-bold"
          >
            Usar mis cambios (pisa servidor)
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => onResolve('servidor')}
              className="flex-1 h-9 rounded-lg bg-[var(--cf-card)] border border-[var(--cf-border)] text-xs font-semibold text-[var(--cf-ink)]"
            >
              Descartar (usar servidor)
            </button>
            <button
              onClick={onClose}
              className="flex-1 h-9 rounded-lg border border-[var(--cf-border)] text-xs text-[var(--cf-ink-3)]"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
