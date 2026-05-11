'use client'
import CapitalTab from '@/components/capital/CapitalTab'
import { useAuth } from '@/hooks/useAuth'

export default function CapitalPage() {
  const { esOwner, loading: authLoading } = useAuth()

  if (authLoading) return null
  if (!esOwner) {
    return (
      <div className="max-w-3xl mx-auto py-10 text-center">
        <p className="text-[var(--color-text-muted)]">No tienes acceso a esta seccion.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Capital</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Control de tu capital disponible</p>
      </div>
      <CapitalTab />
    </div>
  )
}
