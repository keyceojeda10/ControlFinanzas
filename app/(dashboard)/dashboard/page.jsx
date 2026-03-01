'use client'
// app/(dashboard)/dashboard/page.jsx

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatCOP } from '@/lib/calculos'

// ── Skeleton ────────────────────────────────────────────────────
function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-[#2a3245] rounded-[10px] ${className}`} />
}

// ── KPI Card ────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = '#f1f5f9', icon }) {
  return (
    <div className="bg-[#1c2333] border border-[#2a3245] rounded-[14px] px-4 py-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[11px] text-[#64748b] leading-tight">{label}</p>
        {icon && (
          <div className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0"
            style={{ background: `${color}18` }}>
            <span style={{ color }} className="text-sm">{icon}</span>
          </div>
        )}
      </div>
      <p className="text-xl font-bold leading-tight" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] text-[#64748b] mt-1">{sub}</p>}
    </div>
  )
}

// ── Acceso rápido ───────────────────────────────────────────────
function QuickLink({ href, label, desc, color }) {
  return (
    <Link href={href}
      className="bg-[#1c2333] border border-[#2a3245] hover:border-[#3b82f6]/40 hover:bg-[#1a2235] rounded-[14px] px-4 py-4 transition-all group flex items-center gap-3">
      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
        style={{ background: `${color}18` }}>
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#f1f5f9] group-hover:text-white truncate">{label}</p>
        <p className="text-[10px] text-[#64748b] truncate">{desc}</p>
      </div>
    </Link>
  )
}

// ── Formato fecha corta ─────────────────────────────────────────
function fechaCorta(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

// ── Página principal ────────────────────────────────────────────
export default function DashboardPage() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    fetch('/api/dashboard/resumen')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError('No se pudo cargar el resumen.'))
      .finally(() => setLoading(false))
  }, [])

  const moraPct = data
    ? data.clientes.total > 0
      ? Math.round((data.clientes.enMora / data.clientes.total) * 100)
      : 0
    : 0

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[#f1f5f9]">Dashboard</h1>
        <p className="text-sm text-[#64748b] mt-0.5">Resumen de tu cartera hoy</p>
      </div>

      {error && (
        <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm rounded-[10px] px-4 py-3">
          {error}
        </div>
      )}

      {/* ── KPIs fila 1 ─── */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard
            label="Clientes activos"
            value={data.clientes.total}
            sub={data.clientes.enMora > 0 ? `${data.clientes.enMora} en mora` : 'Sin mora'}
            color="#3b82f6"
            icon="👥"
          />
          <KpiCard
            label="Préstamos activos"
            value={data.prestamos.activos}
            sub={`${data.prestamos.completados} completados`}
            color="#10b981"
            icon="📋"
          />
          <KpiCard
            label="Cartera activa"
            value={formatCOP(data.prestamos.carteraActiva)}
            sub={`Capital: ${formatCOP(data.prestamos.capitalPrestado)}`}
            color="#f59e0b"
            icon="💰"
          />
          <KpiCard
            label="Cuota diaria total"
            value={formatCOP(data.prestamos.cuotaDiariaTotal)}
            sub="Esperado por día"
            color="#8b5cf6"
            icon="📅"
          />
        </div>
      )}

      {/* ── KPIs cobros ─── */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24" /><Skeleton className="h-24" />
        </div>
      ) : data && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#1c2333] border border-[#2a3245] rounded-[14px] px-4 py-4">
            <p className="text-[11px] text-[#64748b] mb-1">Recaudado hoy</p>
            <p className="text-2xl font-bold text-[#10b981]">{formatCOP(data.cobros.hoy)}</p>
            <p className="text-[10px] text-[#64748b] mt-1">{data.cobros.cantidadHoy} pagos registrados</p>
            <div className="mt-2 h-1.5 bg-[#2a3245] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-[#10b981] transition-all"
                style={{
                  width: data.prestamos.cuotaDiariaTotal > 0
                    ? `${Math.min(100, Math.round((data.cobros.hoy / data.prestamos.cuotaDiariaTotal) * 100))}%`
                    : '0%',
                }}
              />
            </div>
            <p className="text-[10px] text-[#64748b] mt-1">
              {data.prestamos.cuotaDiariaTotal > 0
                ? `${Math.min(100, Math.round((data.cobros.hoy / data.prestamos.cuotaDiariaTotal) * 100))}% de la cuota diaria`
                : 'Sin cuotas esperadas'}
            </p>
          </div>
          <div className="bg-[#1c2333] border border-[#2a3245] rounded-[14px] px-4 py-4">
            <p className="text-[11px] text-[#64748b] mb-1">Recaudado este mes</p>
            <p className="text-2xl font-bold text-[#3b82f6]">{formatCOP(data.cobros.mes)}</p>
            <p className="text-[10px] text-[#64748b] mt-1">{data.cobros.cantidadMes} pagos en el mes</p>
            {data.clientes.enMora > 0 && (
              <div className="mt-2 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#ef4444]" />
                <p className="text-[10px] text-[#ef4444]">{moraPct}% de clientes en mora</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Últimos pagos ─── */}
      {loading ? (
        <Skeleton className="h-44" />
      ) : data && data.ultimosPagos.length > 0 && (
        <div className="bg-[#1c2333] border border-[#2a3245] rounded-[14px] px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wide">Últimos pagos</p>
            <Link href="/prestamos" className="text-[11px] text-[#3b82f6] hover:underline">
              Ver todos →
            </Link>
          </div>
          <div className="space-y-0 divide-y divide-[#2a3245]">
            {data.ultimosPagos.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#f1f5f9] truncate">{p.cliente}</p>
                  <p className="text-[10px] text-[#64748b]">{fechaCorta(p.fecha)} · {p.tipo}</p>
                </div>
                <p className="text-sm font-bold text-[#10b981] shrink-0 ml-3">
                  +{formatCOP(p.monto)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Accesos rápidos ─── */}
      <div>
        <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wide mb-3">Accesos rápidos</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <QuickLink href="/clientes/nuevo"  label="Nuevo cliente"  desc="Registrar cliente"        color="#3b82f6" />
          <QuickLink href="/prestamos/nuevo" label="Nuevo préstamo" desc="Crear préstamo"            color="#10b981" />
          <QuickLink href="/caja"            label="Cierre de caja" desc="Registrar cierre del día"  color="#f59e0b" />
          <QuickLink href="/clientes"        label="Clientes"       desc="Ver cartera completa"      color="#8b5cf6" />
          <QuickLink href="/rutas"           label="Rutas"          desc="Gestionar rutas"            color="#06b6d4" />
          <QuickLink href="/configuracion"   label="Configuración"  desc="Perfil y organización"     color="#64748b" />
        </div>
      </div>
    </div>
  )
}
