'use client'
// app/(dashboard)/clavos/page.jsx - Contabilidad aparte de tarjetas clavo

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useCountry } from '@/hooks/useCountry'
import { SkeletonCard } from '@/components/ui/Skeleton'

export default function ClavosPage() {
  const { formatMoney } = useCountry()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/clavos')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="max-w-3xl mx-auto space-y-3"><SkeletonCard /><SkeletonCard /></div>
  }
  if (!data || data.error) {
    return <p className="text-sm text-[var(--color-danger)]">No se pudieron cargar los préstamos perdidos</p>
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Préstamos perdidos</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
          Préstamos que separaste de tu cartera. Si el cliente paga algo, se registra aquí.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Clavos', value: data.total, color: '#ef4444' },
          { label: 'Dinero en riesgo', value: formatMoney(data.capitalEnClavos), color: '#f97316' },
          { label: 'Saldo en clavos', value: formatMoney(data.saldoEnClavos), color: '#f5c518' },
          { label: 'Recuperado', value: formatMoney(data.recuperado), color: '#22c55e' },
        ].map(({ label, value, color }) => (
          <div key={label} className="border border-[var(--color-border)] rounded-[12px] px-3 py-3 text-center bg-[var(--color-bg-card)]">
            <p className="text-[10px] text-[var(--color-text-muted)]">{label}</p>
            <p className="text-base font-bold mt-0.5" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Lista */}
      <div className="border border-[var(--color-border)] rounded-[12px] bg-[var(--color-bg-card)] divide-y divide-[var(--color-border)]">
        {data.items.length === 0 && (
          <p className="px-4 py-8 text-sm text-[var(--color-text-muted)] text-center">
            No tienes préstamos perdidos. Cuando apartes un préstamo de tu cartera, aparece aquí.
          </p>
        )}
        {data.items.map(it => (
          <Link
            key={it.id}
            href={`/prestamos/${it.id}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-[rgba(255,255,255,0.03)] transition-all"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{it.cliente}</p>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                {it.ruta} · prestó {formatMoney(it.montoPrestado)}
                {it.clavoPerdida ? ' · registrado como pérdida' : ''}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-[#f5c518]">{formatMoney(it.saldoPendiente)}</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">debe</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
