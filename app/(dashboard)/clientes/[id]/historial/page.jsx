'use client'
// app/(dashboard)/clientes/[id]/historial/page.jsx - Historial de pagos del cliente

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { obtenerClienteOffline } from '@/lib/offline'
import { Card } from '@/components/ui/Card'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { formatCOP } from '@/lib/calculos'

const fmtFecha = (d) => d
  ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—'

export default function HistorialPage() {
  const params = useParams()
  const router = useRouter()
  const { session, loading: authLoading } = useAuth()
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)

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

  const totalPagado = historial.reduce((a, h) => a + h.montoPagado, 0)
  const totalPagos = historial.length

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-[#888888] hover:text-[white] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver al cliente
      </button>

      <div className="mb-4">
        <h1 className="text-xl font-bold text-[white]">Historial de Pagos</h1>
        <p className="text-sm text-[#888888] mt-0.5">
          Todos los pagos de todos los préstamos
        </p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3">
        <Card style={{
          background: `linear-gradient(135deg, #22c55e0A 0%, #1a1a1a 40%, #1a1a1a 70%, #22c55e05 100%)`,
          boxShadow: `0 0 30px #22c55e08, 0 1px 2px rgba(0,0,0,0.3)`,
        }}>
          <p className="text-[10px] text-[#888888]">Total pagado</p>
          <p className="text-xl font-bold text-[white] mt-1 font-mono-display">{formatCOP(totalPagado)}</p>
        </Card>
        <Card>
          <p className="text-[10px] text-[#888888]">Cantidad de pagos</p>
          <p className="text-xl font-bold text-[white] mt-1 font-mono-display">{totalPagos}</p>
        </Card>
      </div>

      {/* Lista de pagos */}
      {historial.length === 0 ? (
        <Card>
          <p className="text-sm text-[#888888] text-center py-6">
            No hay pagos registrados
          </p>
        </Card>
      ) : (
        <Card>
          <div className="space-y-0">
            <div className="grid grid-cols-4 gap-2 text-[10px] text-[#888888] font-medium uppercase pb-2 border-b border-[#2a2a2a]">
              <span>Fecha</span>
              <span className="text-right">Monto</span>
              <span className="text-right">Tipo</span>
              <span className="text-right">Cobrador</span>
            </div>
            {historial.map((h) => (
              <div key={h.id} className="grid grid-cols-4 gap-2 py-3 border-b border-[#2a2a2a] last:border-0 items-center">
                <span className="text-sm text-[white]">{fmtFecha(h.fechaPago)}</span>
                <span className="text-sm text-[white] text-right font-medium font-mono-display">
                  {formatCOP(h.montoPagado)}
                </span>
                <span className={[
                  'text-xs text-right',
                  h.tipo === 'completo' ? 'text-[#22c55e]' : 'text-[#f59e0b]'
                ]}>
                  {h.tipo === 'completo' ? 'Completo' : 'Parcial'}
                </span>
                <span className="text-xs text-[#888888] text-right truncate">
                  {h.cobrador || '—'}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
