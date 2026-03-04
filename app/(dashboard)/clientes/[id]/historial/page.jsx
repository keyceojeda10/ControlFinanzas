'use client'
// app/(dashboard)/clientes/[id]/historial/page.jsx - Historial de pagos del cliente

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/Card'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { formatCOP } from '@/lib/calculos'

const fmtFecha = (d) => d
  ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—'

export default function HistorialPage() {
  const params = useParams()
  const { session, loading: authLoading } = useAuth()
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && session) {
      fetch(`/api/clientes/${params.id}/historial`)
        .then((res) => res.json())
        .then((data) => {
          setHistorial(Array.isArray(data) ? data : [])
        })
        .finally(() => setLoading(false))
    }
  }, [authLoading, session, params.id])

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
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[white]">Historial de Pagos</h1>
        <p className="text-sm text-[#555555] mt-0.5">
          Todos los pagos de todos los préstamos
        </p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-[10px] text-[#555555]">Total pagado</p>
          <p className="text-xl font-bold text-[white] mt-1">{formatCOP(totalPagado)}</p>
        </Card>
        <Card>
          <p className="text-[10px] text-[#555555]">Cantidad de pagos</p>
          <p className="text-xl font-bold text-[white] mt-1">{totalPagos}</p>
        </Card>
      </div>

      {/* Lista de pagos */}
      {historial.length === 0 ? (
        <Card>
          <p className="text-sm text-[#555555] text-center py-6">
            No hay pagos registrados
          </p>
        </Card>
      ) : (
        <Card>
          <div className="space-y-0">
            <div className="grid grid-cols-4 gap-2 text-[10px] text-[#555555] font-medium uppercase pb-2 border-b border-[#2a2a2a]">
              <span>Fecha</span>
              <span className="text-right">Monto</span>
              <span className="text-right">Tipo</span>
              <span className="text-right">Cobrador</span>
            </div>
            {historial.map((h) => (
              <div key={h.id} className="grid grid-cols-4 gap-2 py-3 border-b border-[#2a2a2a] last:border-0 items-center">
                <span className="text-sm text-[white]">{fmtFecha(h.fechaPago)}</span>
                <span className="text-sm text-[white] text-right font-medium">
                  {formatCOP(h.montoPagado)}
                </span>
                <span className={[
                  'text-xs text-right',
                  h.tipo === 'completo' ? 'text-[#22c55e]' : 'text-[#f59e0b]'
                ]}>
                  {h.tipo === 'completo' ? 'Completo' : 'Parcial'}
                </span>
                <span className="text-xs text-[#555555] text-right truncate">
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
