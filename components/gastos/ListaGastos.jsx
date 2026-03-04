'use client'
// components/gastos/ListaGastos.jsx

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { formatCOP } from '@/lib/calculos'

const ESTADO_COLORS = {
  pendiente: 'bg-[rgba(245,158,11,0.15)] text-[#f59e0b] border-[rgba(245,158,11,0.3)]',
  aprobado: 'bg-[rgba(34,197,94,0.15)] text-[#22c55e] border-[rgba(34,197,94,0.3)]',
  rechazado: 'bg-[rgba(239,68,68,0.15)] text-[#ef4444] border-[rgba(239,68,68,0.3)]',
}

export default function ListaGastos({ soloPendientes = false, onCountChange }) {
  const [gastos, setGastos] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchGastos = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/gastos')
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

  useEffect(() => { fetchGastos() }, [])

  const handleAprobar = async (id, estado) => {
    await fetch(`/api/gastos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    })
    fetchGastos()
  }

  if (loading) {
    return <p className="text-sm text-[#555555]">Cargando...</p>
  }

  if (gastos.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-[#555555]">
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
              <p className="text-xs text-[#555555]">
                {g.cobradorNombre} • {new Date(g.fecha).toLocaleDateString('es-CO')}
              </p>
            </div>
            <p className="text-sm font-bold text-white">{formatCOP(g.monto)}</p>
          </div>
          
          <div className="flex items-center justify-between">
            <span className={[
              'text-xs px-2 py-1 rounded-full border',
              ESTADO_COLORS[g.estado] || ESTADO_COLORS.pendiente
            ]}>
              {g.estado.charAt(0).toUpperCase() + g.estado.slice(1)}
            </span>
            
            {g.estado === 'pendiente' && (
              <div className="flex gap-2">
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
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
