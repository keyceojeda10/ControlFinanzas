'use client'

import { useOffline } from '@/components/providers/OfflineProvider'

// Badge compacto que muestra el estado de sincronizacion. Click abre drawer.
// Props:
//   onClick: handler para abrir el drawer
//   variant: 'full' (texto + icono) | 'compact' (solo icono + dot)
export default function SyncStatusBadge({ onClick, variant = 'full' }) {
  const { isOnline, pendingCount, bulkSyncing, failedDetails } = useOffline()
  const failedTotal =
    (failedDetails?.pagos?.length || 0) +
    (failedDetails?.clientes?.length || 0) +
    (failedDetails?.prestamos?.length || 0) +
    (failedDetails?.mutaciones?.length || 0)

  let color, label, dot
  if (bulkSyncing) {
    color = 'info'; label = 'Sincronizando...'; dot = 'spin'
  } else if (!isOnline) {
    color = 'warning'; label = pendingCount > 0 ? `Offline - ${pendingCount}` : 'Offline'; dot = 'pulse'
  } else if (failedTotal > 0) {
    color = 'danger'; label = `${failedTotal} fallidos`; dot = 'static'
  } else if (pendingCount > 0) {
    color = 'info'; label = `${pendingCount} pendientes`; dot = 'pulse'
  } else {
    color = 'success'; label = 'Online'; dot = 'static'
  }

  const base = 'inline-flex items-center gap-1.5 rounded-full font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]'
  const colorClass = {
    success: 'bg-[var(--color-success-dim)] text-[var(--color-success)] border border-[color-mix(in_srgb,var(--color-success)_30%,transparent)]',
    info:    'bg-[var(--color-info-dim)] text-[var(--color-info)] border border-[color-mix(in_srgb,var(--color-info)_30%,transparent)]',
    warning: 'bg-[var(--color-warning-dim)] text-[var(--color-warning)] border border-[color-mix(in_srgb,var(--color-warning)_30%,transparent)]',
    danger:  'bg-[var(--color-danger-dim)] text-[var(--color-danger)] border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)]',
  }[color]
  const dotClass = {
    success: 'bg-[var(--color-success)]',
    info:    'bg-[var(--color-info)]',
    warning: 'bg-[var(--color-warning)]',
    danger:  'bg-[var(--color-danger)]',
  }[color]

  if (variant === 'compact') {
    return (
      <button
        onClick={onClick}
        aria-label={label}
        className={`${base} ${colorClass} w-9 h-9 justify-center relative`}
      >
        <span className={`w-2 h-2 rounded-full ${dotClass} ${dot === 'pulse' ? 'animate-pulse' : ''}`} />
        {pendingCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--color-accent)] text-[10px] font-bold text-black flex items-center justify-center">
            {pendingCount > 99 ? '99+' : pendingCount}
          </span>
        )}
      </button>
    )
  }

  return (
    <button onClick={onClick} className={`${base} ${colorClass} px-3 h-8 text-xs`}>
      {dot === 'spin' ? (
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <span className={`w-1.5 h-1.5 rounded-full ${dotClass} ${dot === 'pulse' ? 'animate-pulse' : ''}`} />
      )}
      <span>{label}</span>
    </button>
  )
}
