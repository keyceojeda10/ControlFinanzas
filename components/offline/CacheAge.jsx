'use client'

import { useEffect, useState } from 'react'
import { useOffline } from '@/components/providers/OfflineProvider'

// Muestra "Actualizado hace X" usando syncMeta.syncedAt. Cambia de color
// a amarillo tras 2h y rojo tras 24h para que el usuario sepa si sus datos
// offline son recientes o ya estan viejos.
function formatRelativo(ms) {
  if (ms < 60_000) return 'hace segundos'
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  return `hace ${d} d`
}

export default function CacheAge({ className = '', compact = false }) {
  const { syncMeta, isOnline } = useOffline()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  if (!syncMeta?.syncedAt) return null
  const diff = now - new Date(syncMeta.syncedAt).getTime()
  const horas = diff / 3_600_000
  const stale = horas >= 24
  const warn = !stale && horas >= 2
  const color = stale
    ? 'text-[var(--color-danger)]'
    : warn
      ? 'text-[var(--color-warning)]'
      : 'text-[var(--color-text-muted)]'

  const label = compact
    ? formatRelativo(diff)
    : `${isOnline ? 'Actualizado' : 'Datos de'} ${formatRelativo(diff)}`

  return (
    <span
      title={`Última sincronización: ${new Date(syncMeta.syncedAt).toLocaleString()}`}
      className={`inline-flex items-center gap-1 text-[10px] ${color} ${className}`}
    >
      <svg className="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {label}
    </span>
  )
}
