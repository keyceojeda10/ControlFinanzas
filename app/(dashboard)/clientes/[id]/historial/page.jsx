'use client'
// app/(dashboard)/clientes/[id]/historial/page.jsx - Historial de pagos del cliente

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { obtenerClienteOffline } from '@/lib/offline'
import { Card } from '@/components/ui/Card'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { formatCOP } from '@/lib/calculos'
import ListadoPagos from '@/components/pagos/ListadoPagos'

export default function HistorialPage() {
  const params = useParams()
  const router = useRouter()
  const { session, loading: authLoading } = useAuth()
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroFecha, setFiltroFecha] = useState('')

  useEffect(() => {
    if (authLoading) return
    fetch(`/api/clientes/${params.id}/historial`)
      .then((res) => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then((data) => {
        setHistorial(Array.isArray(data) ? data : [])
      })
      .catch(async () => {
        // Offline fallback: extract pagos from cached client data
        try {
          const cliente = await obtenerClienteOffline(params.id)
          if (cliente?.prestamos) {
            const allPagos = cliente.prestamos.flatMap((p) =>
              (p.pagos || []).map((pago) => ({
                ...pago,
                prestamoMonto: p.montoPrestado,
              }))
            )
            allPagos.sort((a, b) => new Date(b.fechaPago) - new Date(a.fechaPago))
            setHistorial(allPagos)
          }
        } catch { /* ignore */ }
      })
      .finally(() => setLoading(false))
  }, [authLoading, params.id])

  if (authLoading || loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  const historialFiltrado = filtroFecha
    ? historial.filter((h) => {
        const d = new Date(new Date(h.fechaPago).getTime() - 5 * 60 * 60 * 1000)
          .toISOString().slice(0, 10)
        return d === filtroFecha
      })
    : historial

  const totalPagado = historialFiltrado.reduce((a, h) => a + h.montoPagado, 0)
  const totalPagos = historialFiltrado.length

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[white] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver al cliente
      </button>

      <div className="mb-4">
        <h1 className="text-xl font-bold text-[white]">Historial de Pagos</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
          Todos los pagos de todos los préstamos
        </p>
      </div>

      {/* Filtro por fecha + export */}
      <div className="flex items-center gap-2">
        <label
          className="relative flex-1 h-9 flex items-center gap-2 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 cursor-pointer hover:border-[#3b82f6] transition-colors"
        >
          <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm text-[var(--color-text-primary)]">
            {filtroFecha || 'Filtrar por fecha'}
          </span>
          <input
            type="date"
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
        {filtroFecha && (
          <button
            type="button"
            onClick={() => setFiltroFecha('')}
            className="px-3 h-9 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-[10px]"
          >
            Limpiar
          </button>
        )}
        {historial.length > 0 && (
          <button
            type="button"
            onClick={() => {
              const qs = new URLSearchParams({ cliente: params.id })
              if (filtroFecha) {
                qs.set('desde', filtroFecha)
                qs.set('hasta', filtroFecha)
              }
              window.location.href = `/api/pagos/export?${qs.toString()}`
            }}
            title="Descargar CSV"
            aria-label="Descargar CSV"
            className="h-9 w-9 flex items-center justify-center rounded-[10px] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
          </button>
        )}
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3">
        <Card style={{
          background: `linear-gradient(135deg, #22c55e0A 0%, var(--color-bg-card) 40%, var(--color-bg-card) 70%, #22c55e05 100%)`,
          boxShadow: `0 0 30px #22c55e08, 0 1px 2px rgba(0,0,0,0.3)`,
        }}>
          <p className="text-[10px] text-[var(--color-text-muted)]">Total pagado</p>
          <p className="text-xl font-bold text-[white] mt-1 font-mono-display">{formatCOP(totalPagado)}</p>
        </Card>
        <Card>
          <p className="text-[10px] text-[var(--color-text-muted)]">Cantidad de pagos</p>
          <p className="text-xl font-bold text-[white] mt-1 font-mono-display">{totalPagos}</p>
        </Card>
      </div>

      {/* Lista de pagos */}
      <Card>
        <ListadoPagos
          pagos={historialFiltrado}
          mostrarCliente={false}
          mostrarCobrador
          mostrarLinkPrestamo
          emptyLabel={filtroFecha ? 'Sin pagos en esta fecha' : 'No hay pagos registrados'}
        />
      </Card>
    </div>
  )
}
