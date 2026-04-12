'use client'
// components/gastos/ListaGastos.jsx

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { formatCOP } from '@/lib/calculos'
import { useAuth } from '@/hooks/useAuth'

const ESTADO_COLORS = {
  pendiente: 'bg-[rgba(245,158,11,0.15)] text-[#f59e0b] border-[rgba(245,158,11,0.3)]',
  aprobado: 'bg-[rgba(34,197,94,0.15)] text-[#22c55e] border-[rgba(34,197,94,0.3)]',
  rechazado: 'bg-[rgba(239,68,68,0.15)] text-[#ef4444] border-[rgba(239,68,68,0.3)]',
}

export default function ListaGastos({ soloPendientes = false, onCountChange, fecha }) {
  const { session } = useAuth()
  const esOwner = session?.user?.rol === 'owner'
  const [gastos, setGastos] = useState([])
  const [loading, setLoading] = useState(true)
  const [eliminando, setEliminando] = useState(null)

  const fetchGastos = async () => {
    setLoading(true)
    try {
      const fechaParam = fecha || ''
      const url = fechaParam ? `/api/gastos?fecha=${fechaParam}` : '/api/gastos'
      const res = await fetch(url)
      if (!res.ok) {
        setGastos([])
        return
      }
      const text = await res.text()
      if (!text) {
        setGastos([])
        return
      }
      const data = JSON.parse(text)
      const filtered = soloPendientes 
        ? data.filter(g => g.estado === 'pendiente')
        : data
      setGastos(filtered)
      if (onCountChange) onCountChange(data.filter(g => g.estado === 'pendiente').length)
    } catch (e) {
      console.error('Error fetching gastos:', e)
      setGastos([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchGastos() }, [fecha])

  const handleAprobar = async (id, estado) => {
    await fetch(`/api/gastos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    })
    fetchGastos()
  }

  const handleEliminar = async (g) => {
    const msg = g.estado === 'aprobado'
      ? `Eliminar "${g.description}" por ${formatCOP(g.monto)}? Se revertirá el egreso en capital.`
      : `Eliminar "${g.description}" por ${formatCOP(g.monto)}?`
    if (!confirm(msg)) return
    setEliminando(g.id)
    try {
      const res = await fetch(`/api/gastos/${g.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'No se pudo eliminar el gasto')
        return
      }
      fetchGastos()
    } finally {
      setEliminando(null)
    }
  }

  if (loading) {
    return <p className="text-sm text-[#888888]">Cargando...</p>
  }

  if (gastos.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-[#888888]">
          {soloPendientes ? 'No hay gastos pendientes' : 'No hay gastos reportados'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {gastos.map((g) => (
        <div key={g.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-medium text-white">{g.description}</p>
              <p className="text-xs text-[#888888]">
                {g.cobradorNombre} • {new Date(g.fecha).toLocaleDateString('es-CO')}
              </p>
            </div>
            <p className="text-sm font-bold text-white font-mono-display">{formatCOP(g.monto)}</p>
          </div>
          
          <div className="flex items-center justify-between gap-2">
            <span className={[
              'text-xs px-2 py-1 rounded-full border',
              ESTADO_COLORS[g.estado] || ESTADO_COLORS.pendiente
            ]}>
              {g.estado.charAt(0).toUpperCase() + g.estado.slice(1)}
            </span>

            <div className="flex items-center gap-2">
              {g.estado === 'pendiente' && (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleAprobar(g.id, 'rechazado')}
                  >
                    Rechazar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAprobar(g.id, 'aprobado')}
                  >
                    Aprobar
                  </Button>
                </>
              )}
              {esOwner && (
                <button
                  type="button"
                  onClick={() => handleEliminar(g)}
                  disabled={eliminando === g.id}
                  title="Eliminar gasto"
                  className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)] disabled:opacity-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
