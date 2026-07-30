'use client'

import { useOffline } from '@/components/providers/OfflineProvider'

// Badge discreto para marcar cards de clientes/prestamos con cambios locales
// pendientes de subir. Solo se muestra si el id pasado esta en pendientesIds.
export default function OfflineBadge({ id, className = '' }) {
  const { pendientesIds } = useOffline()
  if (!id || !pendientesIds?.has(id)) return null
  return (
    <span
      title="Cambios pendientes de sincronizar"
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-[var(--cf-gold-tint)] text-[var(--cf-gold-dark)] border border-[color-mix(in_srgb,var(--cf-gold-dark)_30%,transparent)] ${className}`}
    >
      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Pendiente
    </span>
  )
}
