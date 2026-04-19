'use client'

import { useEffect, useState } from 'react'
import { useOffline } from '@/components/providers/OfflineProvider'
import ConflictResolverModal from '@/components/offline/ConflictResolverModal'

// Drawer lateral que lista todos los items pendientes y fallidos con acciones.
export default function SyncDrawer({ open, onClose }) {
  const {
    isOnline, pendingCount, bulkSyncing, pendingDetails, failedDetails,
    conflictos, resolverConflicto,
    descartarItem, reintentarItem, manualSync, syncMeta, lastSyncedAt,
  } = useOffline()

  const [conflictoActivo, setConflictoActivo] = useState(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const failedTotal =
    (failedDetails?.pagos?.length || 0) +
    (failedDetails?.clientes?.length || 0) +
    (failedDetails?.prestamos?.length || 0) +
    (failedDetails?.mutaciones?.length || 0)

  const fmtDate = (iso) => {
    if (!iso) return ''
    try { return new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) } catch { return '' }
  }

  const descripcionMutacion = (m) => {
    if (m.tipo === 'cliente.update') return `Editar cliente: ${Object.keys(m.payload || {}).join(', ')}`
    if (m.tipo === 'prestamo.update') return `Editar prestamo: ${Object.keys(m.payload || {}).join(', ')}`
    if (m.tipo === 'prestamo.cerrar') return `Cerrar prestamo`
    return m.tipo
  }

  return (
    <div className="fixed inset-0 z-[10000] flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-[var(--color-bg-base)] border-l border-[var(--color-border)] shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 bg-[var(--color-bg-base)] border-b border-[var(--color-border)] px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[var(--color-text-primary)]">Sincronizacion</h2>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              {isOnline ? 'Online' : 'Offline'}
              {syncMeta?.syncedAt && ` - ultima descarga ${fmtDate(syncMeta.syncedAt)}`}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-[var(--color-bg-hover)] flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Resumen + boton forzar sync */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Pendientes</p>
              <p className="text-xl font-bold text-[var(--color-text-primary)]">{pendingCount}</p>
              {failedTotal > 0 && <p className="text-[11px] text-[var(--color-danger)] mt-0.5">{failedTotal} fallidos</p>}
            </div>
            <button
              onClick={() => manualSync?.()}
              disabled={!isOnline || bulkSyncing}
              className="px-3 h-9 rounded-lg bg-[var(--color-accent)] text-black text-xs font-bold disabled:opacity-50"
            >
              {bulkSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}
            </button>
          </div>

          {/* Conflictos (prioritario) */}
          {conflictos && conflictos.length > 0 && (
            <div className="rounded-xl border-2 border-[var(--color-danger)] bg-[var(--color-danger)]/5 p-3">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-[var(--color-danger)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                </svg>
                <p className="text-[11px] uppercase tracking-wide text-[var(--color-danger)] font-bold">
                  Conflictos ({conflictos.length})
                </p>
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)] mb-2">
                Alguien modifico estos registros mientras editabas offline. Revisa y decide.
              </p>
              <ul className="space-y-1.5">
                {conflictos.map((m) => (
                  <li key={m.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">{descripcionMutacion(m)}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate">{fmtDate(m.createdAt)}</p>
                    </div>
                    <button
                      onClick={() => setConflictoActivo(m)}
                      className="text-[11px] px-2.5 h-7 rounded-md bg-[var(--color-danger)] text-white font-semibold whitespace-nowrap"
                    >
                      Resolver
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Pendientes por tipo */}
          <Section title="Pagos pendientes" items={pendingDetails?.pagos} render={(p) => ({
            main: `Pago de $${Number(p.montoPagado || 0).toLocaleString('es-CO')}`,
            sub: fmtDate(p.createdAt),
          })} onDiscard={(p) => descartarItem('pago', p.id)} failed={false} />

          <Section title="Clientes pendientes" items={pendingDetails?.clientes} render={(c) => ({
            main: c.payload?.nombre || 'Cliente',
            sub: `Cedula ${c.payload?.cedula || ''} - ${fmtDate(c.createdAt)}`,
          })} onDiscard={(c) => descartarItem('cliente', c.tempId)} failed={false} />

          <Section title="Prestamos pendientes" items={pendingDetails?.prestamos} render={(p) => ({
            main: `Prestamo $${Number(p.payload?.montoPrestado || 0).toLocaleString('es-CO')}`,
            sub: fmtDate(p.createdAt),
          })} onDiscard={(p) => descartarItem('prestamo', p.tempId)} failed={false} />

          <Section title="Ediciones pendientes" items={pendingDetails?.mutaciones} render={(m) => ({
            main: descripcionMutacion(m),
            sub: fmtDate(m.createdAt),
          })} onDiscard={(m) => descartarItem('mutacion', m.id)} failed={false} />

          {/* Fallidos por tipo */}
          {failedTotal > 0 && (
            <>
              <div className="pt-2 border-t border-[var(--color-border)]">
                <p className="text-[11px] uppercase tracking-wide text-[var(--color-danger)] font-semibold mb-2">Fallidos</p>
              </div>

              <Section title="Pagos fallidos" items={failedDetails?.pagos} render={(p) => ({
                main: `Pago de $${Number(p.montoPagado || 0).toLocaleString('es-CO')}`,
                sub: p.errorMsg || 'Error',
              })} onDiscard={(p) => descartarItem('pago', p.id)} failed={true} />

              <Section title="Clientes fallidos" items={failedDetails?.clientes} render={(c) => ({
                main: c.payload?.nombre || 'Cliente',
                sub: c.errorMsg || 'Error',
              })} onDiscard={(c) => descartarItem('cliente', c.tempId)} failed={true} />

              <Section title="Prestamos fallidos" items={failedDetails?.prestamos} render={(p) => ({
                main: `Prestamo $${Number(p.payload?.montoPrestado || 0).toLocaleString('es-CO')}`,
                sub: p.errorMsg || 'Error',
              })} onDiscard={(p) => descartarItem('prestamo', p.tempId)} failed={true} />

              <Section title="Ediciones fallidas" items={failedDetails?.mutaciones} render={(m) => ({
                main: descripcionMutacion(m),
                sub: m.error || 'Error',
              })}
                onDiscard={(m) => descartarItem('mutacion', m.id)}
                onRetry={(m) => reintentarItem('mutacion', m.id)}
                failed={true} />
            </>
          )}

          {pendingCount === 0 && failedTotal === 0 && (!conflictos || conflictos.length === 0) && (
            <div className="text-center py-8 text-[var(--color-text-muted)] text-sm">
              {isOnline ? 'Todo sincronizado' : 'Sin cambios pendientes'}
            </div>
          )}
        </div>
      </div>

      {conflictoActivo && (
        <ConflictResolverModal
          mutacion={conflictoActivo}
          onClose={() => setConflictoActivo(null)}
          onResolve={async (accion) => {
            await resolverConflicto?.(conflictoActivo.id, accion)
            setConflictoActivo(null)
          }}
        />
      )}
    </div>
  )
}

function Section({ title, items, render, onDiscard, onRetry, failed }) {
  if (!items || items.length === 0) return null
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] font-semibold mb-2">{title} ({items.length})</p>
      <ul className="space-y-1.5">
        {items.map((it, idx) => {
          const { main, sub } = render(it)
          return (
            <li key={it.id || it.tempId || idx} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">{main}</p>
                <p className={`text-[11px] truncate ${failed ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'}`}>{sub}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {onRetry && (
                  <button onClick={() => onRetry(it)} className="text-[11px] px-2 h-7 rounded-md bg-[var(--color-accent)] text-black font-semibold">
                    Reintentar
                  </button>
                )}
                <button onClick={() => onDiscard(it)} className="text-[11px] px-2 h-7 rounded-md border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">
                  Descartar
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
