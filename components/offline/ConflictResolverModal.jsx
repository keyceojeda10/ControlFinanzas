'use client'

import { useMemo } from 'react'

// Modal que muestra lado a lado los cambios locales vs servidor para una
// mutacion que dio 412. Permite: usar mis cambios (forzar) | usar servidor (descartar).
export default function ConflictResolverModal({ mutacion, onResolve, onClose }) {
  const tipoLabel = useMemo(() => {
    if (!mutacion) return ''
    if (mutacion.tipo === 'cliente.update') return 'Cliente'
    if (mutacion.tipo === 'prestamo.update') return 'Prestamo'
    if (mutacion.tipo === 'prestamo.cerrar') return 'Prestamo (cerrar)'
    return mutacion.tipo
  }, [mutacion])

  if (!mutacion) return null

  const payload = mutacion.payload || {}
  const servidor = mutacion.servidorSnapshot || {}
  const campos = Object.keys(payload).filter(k => payload[k] !== undefined)

  const fmt = (v) => {
    if (v == null || v === '') return <span className="italic text-[var(--color-text-muted)]">(vacio)</span>
    if (typeof v === 'number') return v.toLocaleString('es-CO')
    if (typeof v === 'boolean') return v ? 'si' : 'no'
    return String(v)
  }

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto bg-[var(--color-bg-surface)] border border-[var(--color-danger)] rounded-2xl shadow-2xl">
        <div className="sticky top-0 bg-[var(--color-bg-surface)] border-b border-[var(--color-border)] px-4 py-3">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-[var(--color-danger)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
            </svg>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Conflicto de edicion</h2>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                {tipoLabel} - tu cambio choco con una modificacion en el servidor.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {!mutacion.servidorSnapshot && (
            <p className="text-[11px] text-[var(--color-text-muted)] italic">
              No se pudo cargar el estado del servidor. Puedes forzar tus cambios o descartarlos.
            </p>
          )}

          {campos.length === 0 && (
            <p className="text-xs text-[var(--color-text-muted)]">Sin campos para comparar.</p>
          )}

          {campos.map((k) => {
            const local = payload[k]
            const remoto = servidor[k]
            const distinto = String(local) !== String(remoto)
            return (
              <div key={k} className="rounded-lg border border-[var(--color-border)] overflow-hidden">
                <div className="px-3 py-1.5 bg-[var(--color-bg-card)] border-b border-[var(--color-border)]">
                  <p className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">{k}</p>
                </div>
                <div className="grid grid-cols-2 divide-x divide-[var(--color-border)]">
                  <div className={`p-2.5 text-xs ${distinto ? 'bg-[var(--color-info)]/10' : ''}`}>
                    <p className="text-[10px] font-bold text-[var(--color-info)] uppercase mb-0.5">Tus cambios</p>
                    <p className="text-[var(--color-text-primary)] break-words">{fmt(local)}</p>
                  </div>
                  <div className={`p-2.5 text-xs ${distinto ? 'bg-[var(--color-warning)]/10' : ''}`}>
                    <p className="text-[10px] font-bold text-[var(--color-warning)] uppercase mb-0.5">Servidor</p>
                    <p className="text-[var(--color-text-primary)] break-words">{fmt(remoto)}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="sticky bottom-0 bg-[var(--color-bg-surface)] border-t border-[var(--color-border)] p-3 flex flex-col gap-2">
          <button
            onClick={() => onResolve('local')}
            className="w-full h-10 rounded-lg bg-[var(--color-info)] text-black text-xs font-bold"
          >
            Usar mis cambios (pisa servidor)
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => onResolve('servidor')}
              className="flex-1 h-9 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-primary)]"
            >
              Descartar (usar servidor)
            </button>
            <button
              onClick={onClose}
              className="flex-1 h-9 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-muted)]"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
