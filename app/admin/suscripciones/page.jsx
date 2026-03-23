'use client'

import { useState, useEffect } from 'react'
import Link                    from 'next/link'
import { Badge }               from '@/components/ui/Badge'
import { Button }              from '@/components/ui/Button'
import { SkeletonTable }       from '@/components/ui/Skeleton'
import { formatCOP }           from '@/lib/calculos'

const planBadge = { basic: 'gray', standard: 'blue', professional: 'purple' }
const tabs = [
  { key: '',          label: 'Todas'     },
  { key: 'activa',    label: 'Activas'   },
  { key: 'porVencer', label: 'Por vencer' },
  { key: 'vencida',   label: 'Vencidas'  },
  { key: 'cancelada', label: 'Canceladas' },
]

export default function SuscripcionesPage() {
  const [subs,    setSubs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState('')
  const [accionando, setAccionando] = useState('')

  const fetchSubs = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/suscripciones${tab ? `?estado=${tab}` : ''}`)
      const data = await res.json()
      setSubs(Array.isArray(data) ? data : [])
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSubs() }, [tab])

  const ejecutar = async (subId, accion) => {
    setAccionando(`${subId}-${accion}`)
    try {
      const res = await fetch(`/api/admin/suscripciones/${subId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
      })
      if (res.ok) await fetchSubs()
      else alert((await res.json()).error ?? 'Error')
    } catch { alert('Error') } finally {
      setAccionando('')
    }
  }

  // Contadores
  const activas   = subs.filter((s) => s.estado === 'activa' && s.diasRestantes > 7).length
  const porVencer = subs.filter((s) => s.estado === 'activa' && s.diasRestantes <= 7 && s.diasRestantes > 0).length
  const vencidas  = subs.filter((s) => s.estado === 'vencida' || s.diasRestantes <= 0).length

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[white]">Suscripciones</h1>
        <p className="text-sm text-[#555555] mt-0.5">Gestión de suscripciones de la plataforma</p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <div
          className="border border-[#2a2a2a] rounded-[12px] px-3 py-3 text-center"
          style={{
            background: 'linear-gradient(135deg, #22c55e0A 0%, #1a1a1a 40%, #1a1a1a 70%, #22c55e05 100%)',
            boxShadow: '0 0 30px #22c55e08, 0 1px 2px rgba(0,0,0,0.3)',
          }}
        >
          <p className="text-[10px] text-[#555555]">Activas</p>
          <p className="text-lg font-bold text-[#22c55e]">{activas}</p>
        </div>
        <div
          className="border border-[#2a2a2a] rounded-[12px] px-3 py-3 text-center"
          style={{
            background: 'linear-gradient(135deg, #f59e0b0A 0%, #1a1a1a 40%, #1a1a1a 70%, #f59e0b05 100%)',
            boxShadow: '0 0 30px #f59e0b08, 0 1px 2px rgba(0,0,0,0.3)',
          }}
        >
          <p className="text-[10px] text-[#555555]">Por vencer</p>
          <p className="text-lg font-bold text-[#f59e0b]">{porVencer}</p>
        </div>
        <div
          className="border border-[#2a2a2a] rounded-[12px] px-3 py-3 text-center"
          style={{
            background: 'linear-gradient(135deg, #ef44440A 0%, #1a1a1a 40%, #1a1a1a 70%, #ef444405 100%)',
            boxShadow: '0 0 30px #ef444408, 0 1px 2px rgba(0,0,0,0.3)',
          }}
        >
          <p className="text-[10px] text-[#555555]">Vencidas</p>
          <p className="text-lg font-bold text-[#ef4444]">{vencidas}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-[8px] text-xs font-medium whitespace-nowrap transition-all ${
              tab === t.key
                ? 'bg-[#3b82f6] text-white'
                : 'bg-[#2a2a2a] text-[#555555] hover:text-[white]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tabla */}
      {loading ? <SkeletonTable rows={5} /> : subs.length === 0 ? (
        <p className="text-sm text-[#555555] text-center py-8">No hay suscripciones</p>
      ) : (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px] overflow-hidden">
          <div className="hidden sm:grid grid-cols-6 gap-2 px-4 py-2.5 text-[10px] text-[#555555] font-medium uppercase border-b border-[#2a2a2a]">
            <span className="col-span-2">Organización</span>
            <span className="text-center">Plan</span>
            <span className="text-center">Vencimiento</span>
            <span className="text-center">Estado</span>
            <span className="text-right">Acciones</span>
          </div>

          {subs.map((s) => (
            <div key={s.id} className="grid grid-cols-2 sm:grid-cols-6 gap-2 px-4 py-3 border-b border-[#2a2a2a] last:border-0 items-center">
              <div className="col-span-2">
                <Link href={`/admin/organizaciones/${s.organizacionId}`} className="text-sm font-medium text-[white] hover:text-[#3b82f6]">
                  {s.organizacion}
                </Link>
                <p className="text-[10px] text-[#555555]"><span className="font-mono-display">{formatCOP(s.montoCOP)}</span>/mes</p>
              </div>
              <div className="text-center">
                <Badge variant={planBadge[s.plan]}>{s.plan}</Badge>
              </div>
              <div className="text-center">
                <p className="text-xs text-[#888888]">
                  {new Date(s.fechaVencimiento).toLocaleDateString('es-CO')}
                </p>
                <p className={`text-[10px] font-bold ${s.diasRestantes > 7 ? 'text-[#22c55e]' : s.diasRestantes > 0 ? 'text-[#f59e0b]' : 'text-[#ef4444]'}`}>
                  {s.diasRestantes > 0 ? `${s.diasRestantes}d` : `${Math.abs(s.diasRestantes)}d vencida`}
                </p>
              </div>
              <div className="text-center">
                <Badge variant={s.estado === 'activa' ? 'green' : s.estado === 'vencida' ? 'red' : 'gray'}>
                  {s.estado}
                </Badge>
              </div>
              <div className="flex gap-1.5 justify-end flex-wrap">
                <button
                  onClick={() => ejecutar(s.id, 'renovar')}
                  disabled={!!accionando}
                  className="px-2 py-1 rounded-[6px] text-[10px] font-medium bg-[rgba(16,185,129,0.12)] text-[#22c55e] hover:bg-[rgba(16,185,129,0.2)] transition-all disabled:opacity-50"
                >
                  {accionando === `${s.id}-renovar` ? '…' : '+30d'}
                </button>
                <button
                  onClick={() => ejecutar(s.id, 'gracia')}
                  disabled={!!accionando}
                  className="px-2 py-1 rounded-[6px] text-[10px] font-medium bg-[rgba(245,158,11,0.12)] text-[#f59e0b] hover:bg-[rgba(245,158,11,0.2)] transition-all disabled:opacity-50"
                >
                  {accionando === `${s.id}-gracia` ? '…' : '+7d'}
                </button>
                <button
                  onClick={() => {
                    if (confirm(`¿Cancelar suscripción de "${s.organizacion}"?`)) ejecutar(s.id, 'cancelar')
                  }}
                  disabled={!!accionando || s.estado === 'cancelada'}
                  className="px-2 py-1 rounded-[6px] text-[10px] font-medium bg-[rgba(239,68,68,0.12)] text-[#ef4444] hover:bg-[rgba(239,68,68,0.2)] transition-all disabled:opacity-50"
                >
                  {accionando === `${s.id}-cancelar` ? '…' : 'Cancelar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
