'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatCOP } from '@/lib/calculos'

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-[#2a2a2a] rounded-[12px] ${className}`} />
}

function KpiCard({ label, value, sub, color = '#ffffff', icon }) {
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px] px-4 py-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[11px] text-[#555555] leading-tight">{label}</p>
        {icon && (
          <div className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
            <span style={{ color }} className="text-sm">{icon}</span>
          </div>
        )}
      </div>
      <p className="text-xl font-bold leading-tight" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] text-[#555555] mt-1">{sub}</p>}
    </div>
  )
}

function QuickLink({ href, label, desc, color }) {
  return (
    <Link href={href} className="bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#3a3a3a] hover:bg-[#222222] rounded-[16px] px-4 py-4 transition-all group flex items-center gap-3">
      <div className="w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-white truncate">{label}</p>
        <p className="text-[10px] text-[#555555] truncate">{desc}</p>
      </div>
    </Link>
  )
}

function fechaCorta(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [moraData, setMoraData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/dashboard/resumen')
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setData(d) })
      .catch(() => setError('No se pudo cargar el resumen.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetch('/api/mora')
      .then((r) => r.json())
      .then((d) => setMoraData(d))
      .catch(() => {})
  }, [])

  const moraPct = data ? (data.clientes.total > 0 ? Math.round((data.clientes.enMora / data.clientes.total) * 100) : 0) : 0

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-[#555555] mt-0.5">Resumen de tu cartera hoy</p>
      </div>
      {error && <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm rounded-[12px] px-4 py-3">{error}</div>}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Clientes activos" value={data.clientes.total} sub={data.clientes.enMora > 0 ? `${data.clientes.enMora} en mora` : 'Sin mora'} color="#3b82f6" icon="👥" />
          <KpiCard label="Prestamos activos" value={data.prestamos.activos} sub={`${data.prestamos.completados} completados`} color="#22c55e" icon="📋" />
          <KpiCard label="Cartera activa" value={formatCOP(data.prestamos.carteraActiva)} sub={`Capital: ${formatCOP(data.prestamos.capitalPrestado)}`} color="#f59e0b" icon="💰" />
          <KpiCard label="Cuota diaria total" value={formatCOP(data.prestamos.cuotaDiariaTotal)} sub="Esperado por dia" color="#a855f7" icon="📅" />
        </div>
      )}
      {loading ? (
        <div className="grid grid-cols-2 gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : data && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px] px-4 py-4">
            <p className="text-[11px] text-[#555555] mb-1">Recaudado hoy</p>
            <p className="text-2xl font-bold text-[#22c55e]">{formatCOP(data.cobros.hoy)}</p>
            <p className="text-[10px] text-[#555555] mt-1">{data.cobros.cantidadHoy} pagos registrados</p>
            <div className="mt-2 h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-[#22c55e] transition-all" style={{ width: data.prestamos.cuotaDiariaTotal > 0 ? `${Math.min(100, Math.round((data.cobros.hoy / data.prestamos.cuotaDiariaTotal) * 100))}%` : '0%' }} />
            </div>
            <p className="text-[10px] text-[#555555] mt-1">{data.prestamos.cuotaDiariaTotal > 0 ? `${Math.min(100, Math.round((data.cobros.hoy / data.prestamos.cuotaDiariaTotal) * 100))}% de la cuota diaria` : 'Sin cuotas esperadas'}</p>
          </div>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px] px-4 py-4">
            <p className="text-[11px] text-[#555555] mb-1">Recaudado este mes</p>
            <p className="text-2xl font-bold text-[#3b82f6]">{formatCOP(data.cobros.mes)}</p>
            <p className="text-[10px] text-[#555555] mt-1">{data.cobros.cantidadMes} pagos en el mes</p>
            {data.clientes.enMora > 0 && (<div className="mt-2 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#ef4444]" /><p className="text-[10px] text-[#ef4444]">{moraPct}% de clientes en mora</p></div>)}
          </div>
        </div>
      )}
      {loading ? <Skeleton className="h-44" /> : data && data.ultimosPagos.length > 0 && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px] px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide">Ultimos pagos</p>
            <Link href="/prestamos" className="text-[11px] text-[#f5c518] hover:underline">Ver todos →</Link>
          </div>
          <div className="space-y-0 divide-y divide-[#2a2a2a]">
            {data.ultimosPagos.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{p.cliente}</p>
                  <p className="text-[10px] text-[#555555]">{fechaCorta(p.fecha)} · {p.tipo}</p>
                </div>
                <p className="text-sm font-bold text-[#22c55e] shrink-0 ml-3">+{formatCOP(p.monto)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {!loading && moraData && moraData.total > 0 && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px] px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide">Alertas de mora</p>
            <span className="text-[11px] bg-[#ef4444] text-white px-2 py-0.5 rounded-full">{moraData.total} clientes</span>
          </div>
          <div className="space-y-2">
            {moraData.agrupado.mora31plus.length > 0 && (
              <div className="bg-[#7f1d1d] border border-[#991b1b] rounded-[12px] p-3">
                <p className="text-[11px] text-[#fca5a5] font-medium mb-2">Más de 30 días ({moraData.agrupado.mora31plus.length})</p>
                {moraData.agrupado.mora31plus.slice(0, 3).map((c) => (
                  <Link key={c.prestamoId} href={`/clientes/${c.cliente.id}`} className="flex items-center justify-between py-1.5 hover:bg-[#991b1b] rounded px-1 -mx-1">
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{c.cliente.nombre}</p>
                      <p className="text-[10px] text-[#fca5a5]">{c.diasMora} días de mora</p>
                    </div>
                    <p className="text-sm font-bold text-[#fca5a5] shrink-0 ml-2">{formatCOP(c.saldoPendiente)}</p>
                  </Link>
                ))}
              </div>
            )}
            {moraData.agrupado.mora16a30.length > 0 && (
              <div className="bg-[#78350f] border border-[#92400e] rounded-[12px] p-3">
                <p className="text-[11px] text-[#fcd34d] font-medium mb-2">16-30 días ({moraData.agrupado.mora16a30.length})</p>
                {moraData.agrupado.mora16a30.slice(0, 3).map((c) => (
                  <Link key={c.prestamoId} href={`/clientes/${c.cliente.id}`} className="flex items-center justify-between py-1.5 hover:bg-[#92400e] rounded px-1 -mx-1">
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{c.cliente.nombre}</p>
                      <p className="text-[10px] text-[#fcd34d]">{c.diasMora} días de mora</p>
                    </div>
                    <p className="text-sm font-bold text-[#fcd34d] shrink-0 ml-2">{formatCOP(c.saldoPendiente)}</p>
                  </Link>
                ))}
              </div>
            )}
            {moraData.agrupado.mora8a15.length > 0 && (
              <div className="bg-[#713f12] border border-[#854d0e] rounded-[12px] p-3">
                <p className="text-[11px] text-[#fde047] font-medium mb-2">8-15 días ({moraData.agrupado.mora8a15.length})</p>
                {moraData.agrupado.mora8a15.slice(0, 3).map((c) => (
                  <Link key={c.prestamoId} href={`/clientes/${c.cliente.id}`} className="flex items-center justify-between py-1.5 hover:bg-[#854d0e] rounded px-1 -mx-1">
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{c.cliente.nombre}</p>
                      <p className="text-[10px] text-[#fde047]">{c.diasMora} días de mora</p>
                    </div>
                    <p className="text-sm font-bold text-[#fde047] shrink-0 ml-2">{formatCOP(c.saldoPendiente)}</p>
                  </Link>
                ))}
              </div>
            )}
            {moraData.agrupado.mora1a7.length > 0 && (
              <div className="bg-[#365314] border border-[#3f6212] rounded-[12px] p-3">
                <p className="text-[11px] text-[#a3e635] font-medium mb-2">1-7 días ({moraData.agrupado.mora1a7.length})</p>
                {moraData.agrupado.mora1a7.slice(0, 3).map((c) => (
                  <Link key={c.prestamoId} href={`/clientes/${c.cliente.id}`} className="flex items-center justify-between py-1.5 hover:bg-[#3f6212] rounded px-1 -mx-1">
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{c.cliente.nombre}</p>
                      <p className="text-[10px] text-[#a3e635]">{c.diasMora} días de mora</p>
                    </div>
                    <p className="text-sm font-bold text-[#a3e635] shrink-0 ml-2">{formatCOP(c.saldoPendiente)}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <div>
        <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide mb-3">Accesos rapidos</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <QuickLink href="/clientes/nuevo" label="Nuevo cliente" desc="Registrar cliente" color="#3b82f6" />
          <QuickLink href="/prestamos/nuevo" label="Nuevo prestamo" desc="Crear prestamo" color="#22c55e" />
          <QuickLink href="/caja" label="Cierre de caja" desc="Registrar cierre del dia" color="#f59e0b" />
          <QuickLink href="/clientes" label="Clientes" desc="Ver cartera completa" color="#a855f7" />
          <QuickLink href="/rutas" label="Rutas" desc="Gestionar rutas" color="#06b6d4" />
          <QuickLink href="/configuracion" label="Configuracion" desc="Perfil y organizacion" color="#555555" />
        </div>
      </div>
    </div>
  )
}
