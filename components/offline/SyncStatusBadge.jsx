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

  // EN CASTELLANO, y diciendo qué pasa con el trabajo — no cómo está la red.
  //
  // Decía «Offline», «Online», «3 pendientes» y «2 fallidos». Cuatro problemas en
  // una pastilla de 8px de alto:
  //
  //   · Dos palabras en inglés en una app para prestamistas colombianos.
  //   · «Offline» describe la RED. Al cobrador no le importa la red: le importa
  //     si los cobros que acaba de meter están guardados. «Sin señal · 3 por
  //     subir» contesta eso.
  //   · «Fallidos» no dice qué hacer. «No subieron» sí, y lleva a tocar.
  //   · «Online» permanente es ruido: cuando todo va bien no hay nada que decir.
  //     Se queda «Al día», que confirma sin alarmar.
  let color, label, dot
  if (bulkSyncing) {
    color = 'info'; label = 'Subiendo…'; dot = 'spin'
  } else if (!isOnline) {
    color = 'warning'
    label = pendingCount > 0 ? `Sin señal · ${pendingCount} por subir` : 'Sin señal'
    dot = 'pulse'
  } else if (failedTotal > 0) {
    color = 'danger'
    label = `${failedTotal} no ${failedTotal === 1 ? 'subió' : 'subieron'}`
    dot = 'static'
  } else if (pendingCount > 0) {
    color = 'info'; label = `${pendingCount} por subir`; dot = 'pulse'
  } else {
    color = 'success'; label = 'Al día'; dot = 'static'
  }

  const base = 'inline-flex items-center gap-1.5 rounded-full font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--cf-gold)]'
  const colorClass = {
    success: 'bg-[var(--cf-green-pill-bg)] text-[var(--cf-green-dark)] border border-[color-mix(in_srgb,var(--cf-green-dark)_30%,transparent)]',
    info:    'bg-[var(--cf-fill)] text-[var(--cf-ink-2)] border border-[color-mix(in_srgb,var(--cf-ink-2)_30%,transparent)]',
    warning: 'bg-[var(--cf-gold-tint)] text-[var(--cf-gold-dark)] border border-[color-mix(in_srgb,var(--cf-gold-dark)_30%,transparent)]',
    danger:  'bg-[var(--cf-red-pill-bg)] text-[var(--cf-red-dark)] border border-[color-mix(in_srgb,var(--cf-red-dark)_30%,transparent)]',
  }[color]
  const dotClass = {
    success: 'bg-[var(--cf-green-dark)]',
    info:    'bg-[var(--cf-ink-2)]',
    warning: 'bg-[var(--cf-gold-dark)]',
    danger:  'bg-[var(--cf-red-dark)]',
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
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--cf-gold)] text-[10px] font-bold text-black flex items-center justify-center">
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
