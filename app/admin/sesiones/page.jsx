'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SkeletonCard } from '@/components/ui/Skeleton'

const PERIODOS = [
  { key: '1', label: '1h' },
  { key: '6', label: '6h' },
  { key: '24', label: '24h' },
  { key: '72', label: '3d' },
  { key: '168', label: '7d' },
]

function haceTiempo(fecha) {
  const ms = Date.now() - new Date(fecha).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'Ahora'
  if (min < 60) return `${min}min`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `${hrs}h`
  const dias = Math.floor(hrs / 24)
  return `${dias}d`
}

export default function SesionesPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [horas, setHoras] = useState('24')
  const [verTodos, setVerTodos] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/sesiones?horas=${horas}&sospechosos=${!verTodos}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [horas, verTodos])

  if (loading) return <div className="max-w-5xl mx-auto"><SkeletonCard /><SkeletonCard /></div>
  if (!data) return <p className="text-sm text-[#888] text-center py-12">Error cargando datos</p>

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-white">Sesiones Multi-dispositivo</h1>
        <p className="text-xs text-[#888]">Detecta usuarios con actividad desde multiples IPs o dispositivos</p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <Card>
          <p className="text-[10px] text-[#888] uppercase tracking-wide">Usuarios activos</p>
          <p className="text-2xl font-bold text-[#f5c518]">{data.totalUsuariosActivos}</p>
          <p className="text-[10px] text-[#555]">ultimas {horas}h</p>
        </Card>
        <Card>
          <p className="text-[10px] text-[#888] uppercase tracking-wide">Sospechosos</p>
          <p className="text-2xl font-bold" style={{ color: data.totalSospechosos > 0 ? '#ef4444' : '#22c55e' }}>
            {data.totalSospechosos}
          </p>
          <p className="text-[10px] text-[#555]">2+ IPs o 3+ dispositivos</p>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <p className="text-[10px] text-[#888] uppercase tracking-wide">Periodo</p>
          <p className="text-sm text-white mt-1">{data.periodo}</p>
          <p className="text-[10px] text-[#555]">desde {new Date(data.desde).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex gap-1 bg-[#111] rounded-[10px] p-1">
          {PERIODOS.map(p => (
            <button
              key={p.key}
              onClick={() => setHoras(p.key)}
              className={`px-3 py-1.5 rounded-[8px] text-xs font-medium transition-all ${
                horas === p.key
                  ? 'bg-[rgba(245,197,24,0.15)] text-[#f5c518]'
                  : 'text-[#888] hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setVerTodos(v => !v)}
          className={`px-3 py-1.5 rounded-[8px] text-xs font-medium border transition-all ${
            verTodos
              ? 'border-[#f5c518] text-[#f5c518] bg-[rgba(245,197,24,0.08)]'
              : 'border-[#333] text-[#888] hover:border-[#555]'
          }`}
        >
          {verTodos ? 'Mostrando todos' : 'Solo sospechosos'}
        </button>
      </div>

      {/* Lista */}
      {data.usuarios.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <svg className="w-10 h-10 mx-auto mb-3 text-[#22c55e]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-[#888]">
              {verTodos ? 'No hay sesiones activas en este periodo' : 'No se detectaron sesiones sospechosas'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.usuarios.map(u => (
            <Card key={u.user.id}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white truncate">{u.user.nombre}</p>
                    <Badge variant={u.user.rol === 'owner' ? 'blue' : 'gray'}>
                      {u.user.rol}
                    </Badge>
                    {u.sospechoso && (
                      <Badge variant="red">Sospechoso</Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-[#888] truncate">{u.user.email}</p>
                  {u.user.organization && (
                    <p className="text-[10px] text-[#555] truncate">
                      {u.user.organization.nombre} · {u.user.organization.plan}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1" title="IPs distintas">
                      <svg className="w-3.5 h-3.5 text-[#888]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                      </svg>
                      <span className={u.totalIps >= 2 ? 'text-[#ef4444] font-semibold' : 'text-[#888]'}>
                        {u.totalIps} IP{u.totalIps !== 1 ? 's' : ''}
                      </span>
                    </span>
                    <span className="flex items-center gap-1" title="Dispositivos distintos">
                      <svg className="w-3.5 h-3.5 text-[#888]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                      </svg>
                      <span className={u.totalDispositivos >= 3 ? 'text-[#ef4444] font-semibold' : 'text-[#888]'}>
                        {u.totalDispositivos}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Detalle de sesiones */}
              <div className="space-y-1.5">
                {u.sesiones.map(s => (
                  <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-[8px] bg-[#111] text-[11px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{
                        background: (Date.now() - new Date(s.lastActivityAt).getTime()) < 10 * 60 * 1000
                          ? '#22c55e' : '#555'
                      }} />
                      <span className="text-[#ccc] truncate">{s.dispositivo}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[#555] font-mono">{s.ip}</span>
                      <span className="text-[#888]">{haceTiempo(s.lastActivityAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
