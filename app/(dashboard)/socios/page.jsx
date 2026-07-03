'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { SkeletonCard } from '@/components/ui/Skeleton'
import SocioCard from '@/components/socios/SocioCard'
import { formatMoney } from '@/lib/i18n'
import { useCountry } from '@/hooks/useCountry'

export default function SociosPage() {
  const { esOwner } = useAuth()
  const { country } = useCountry()
  const [socios, setSocios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fmt = (v) => formatMoney(v, country)

  const cargar = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/socios')
      if (!res.ok) throw new Error('Error al cargar socios')
      const data = await res.json()
      setSocios(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  if (!esOwner) {
    return (
      <div className="p-4 text-center" style={{ color: 'var(--color-text-muted)' }}>
        No tienes acceso a esta seccion.
      </div>
    )
  }

  const totalAportes = socios.reduce((acc, s) => acc + s.totalAportes, 0)
  const totalEnCalle = socios.reduce((acc, s) => acc + s.capitalEnCalle, 0)
  const totalIntereses = socios.reduce((acc, s) => acc + s.interesesCobrados, 0)

  return (
    <div className="pb-28">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Socios
        </h1>
        <Link href="/socios/nuevo">
          <Button>Nuevo socio</Button>
        </Link>
      </div>

      {!loading && socios.length > 0 && (
        <div
          className="rounded-[16px] p-4 mb-4 grid grid-cols-3 gap-3"
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              Total aportes
            </p>
            <p className="text-[16px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {fmt(totalAportes)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              Capital en calle
            </p>
            <p className="text-[16px] font-bold" style={{ color: 'var(--color-accent)' }}>
              {fmt(totalEnCalle)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              Intereses cobrados
            </p>
            <p className="text-[16px] font-bold" style={{ color: 'var(--color-success)' }}>
              {fmt(totalIntereses)}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-[12px] p-3 mb-4 text-sm" style={{ background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : socios.length === 0 ? (
        <div
          className="rounded-[16px] p-8 text-center"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        >
          <p className="text-[15px] font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
            No hay socios registrados
          </p>
          <p className="text-[13px] mb-4" style={{ color: 'var(--color-text-muted)' }}>
            Los socios son los inversores que aportan al fondo y respaldan prestamos.
          </p>
          <Link href="/socios/nuevo">
            <Button>Crear primer socio</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {socios.map((s) => <SocioCard key={s.id} socio={s} />)}
        </div>
      )}
    </div>
  )
}
