'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { SkeletonCard } from '@/components/ui/Skeleton'

const ESTADO_COLORS = {
  pendiente: '#f5c518',
  contactado: '#3b82f6',
  interesado: '#10b981',
  no_interesado: '#888888',
  cerrado: '#8b5cf6',
  bloqueado: '#ef4444',
}

export default function WhatsAppBotDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [toggleando, setToggleando] = useState(false)

  useEffect(() => {
    fetch('/api/admin/whatsapp-bot')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function toggleBot() {
    if (!data) return
    setToggleando(true)
    try {
      const res = await fetch('/api/admin/whatsapp-bot/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botActivo: !data.botActivo }),
      })
      if (res.ok) {
        setData(d => ({ ...d, botActivo: !d.botActivo }))
      }
    } catch {} finally {
      setToggleando(false)
    }
  }

  async function ejecutarFollowup() {
    setEnviando(true)
    try {
      const res = await fetch('/api/admin/whatsapp-bot/followup', { method: 'POST' })
      const r = await res.json()
      alert(`Enviados: ${r.enviados || 0}, Perdidos: ${r.perdidos || 0}, Fallidos: ${r.fallidos || 0}`)
    } catch {
      alert('Error ejecutando seguimientos')
    } finally {
      setEnviando(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
    )
  }

  if (!data) return <p className="text-[var(--color-danger)] text-sm">Error cargando datos</p>

  const cloud = data.whatsappCloud || {}
  const cloudOk = cloud.ok === true
  const cloudLabel = cloudOk
    ? `Cloud API${cloud.phone ? ` · ${cloud.phone}` : ''}`
    : (cloud.status === 'no_configurado' ? 'Sin configurar' : (cloud.status || 'Desconectado'))

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[white]">WhatsApp Bot</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Bot comercial (WhatsApp Cloud API · Meta) para leads de Facebook Ads</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${cloudOk ? 'bg-[#10b981]' : 'bg-[#ef4444]'}`} />
          <span className="text-xs text-[var(--color-text-muted)]" title={cloud.tier ? `Tier: ${cloud.tier}${cloud.qualityRating ? ` · Calidad: ${cloud.qualityRating}` : ''}` : ''}>
            {cloudLabel}
          </span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Leads hoy', value: data.leadsHoy, color: '#3b82f6' },
          { label: 'Total leads', value: data.totalLeads, color: '#10b981' },
          { label: 'Tasa respuesta', value: `${data.tasaRespuesta}%`, color: '#f5c518' },
          { label: 'Gasto hoy', value: `$${data.gastoHoy}`, color: '#8b5cf6' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="border border-[var(--color-border)] rounded-[12px] px-3 py-3 text-center"
            style={{
              background: `linear-gradient(135deg, ${color}0A 0%, var(--color-bg-card) 40%, var(--color-bg-card) 70%, ${color}05 100%)`,
              boxShadow: `0 0 30px ${color}08, 0 1px 2px rgba(0,0,0,0.3)`,
            }}
          >
            <p className="text-[10px] text-[var(--color-text-muted)]">{label}</p>
            <p className="text-base font-bold mt-0.5" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Acciones rapidas */}
      <div className="flex gap-3">
        <button
          onClick={toggleBot}
          disabled={toggleando}
          className={`px-4 py-2 rounded-[10px] text-sm font-medium transition-all ${
            data.botActivo
              ? 'bg-[rgba(239,68,68,0.12)] text-[#ef4444] hover:bg-[rgba(239,68,68,0.2)]'
              : 'bg-[rgba(16,185,129,0.12)] text-[#10b981] hover:bg-[rgba(16,185,129,0.2)]'
          }`}
        >
          {toggleando ? '...' : data.botActivo ? 'Apagar bot' : 'Encender bot'}
        </button>
        <button
          onClick={ejecutarFollowup}
          disabled={enviando}
          className="px-4 py-2 rounded-[10px] text-sm font-medium bg-[rgba(59,130,246,0.12)] text-[#3b82f6] hover:bg-[rgba(59,130,246,0.2)] transition-all"
        >
          {enviando ? 'Enviando...' : 'Ejecutar seguimientos'}
        </button>
        <Link
          href="/admin/whatsapp-bot/config"
          className="px-4 py-2 rounded-[10px] text-sm font-medium bg-[rgba(136,136,136,0.12)] text-[#888888] hover:bg-[rgba(136,136,136,0.2)] transition-all"
        >
          Configuracion
        </Link>
      </div>

      {/* Leads por estado */}
      <div className="border border-[var(--color-border)] rounded-[12px] p-4 bg-[var(--color-bg-card)]">
        <h2 className="text-sm font-semibold text-[white] mb-3">Leads por estado</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {Object.entries(ESTADO_COLORS).map(([estado, color]) => (
            <div key={estado} className="text-center">
              <p className="text-lg font-bold" style={{ color }}>{data.estados?.[estado] || 0}</p>
              <p className="text-[10px] text-[var(--color-text-muted)] capitalize">{estado.replace('_', ' ')}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Ultimos leads */}
      <div className="border border-[var(--color-border)] rounded-[12px] bg-[var(--color-bg-card)]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <h2 className="text-sm font-semibold text-[white]">Ultimos leads</h2>
          <Link href="/admin/whatsapp-bot/leads" className="text-xs text-[#3b82f6] hover:underline">
            Ver todos
          </Link>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {(data.ultimosLeads || []).map(lead => (
            <Link
              key={lead.id}
              href={`/admin/whatsapp-bot/leads/${lead.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-[rgba(255,255,255,0.03)] transition-all"
            >
              <div className="min-w-0">
                <p className="text-sm text-[white] font-medium truncate">{lead.nombre}</p>
                <p className="text-[11px] text-[var(--color-text-muted)]">{lead.telefono}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize"
                  style={{
                    color: ESTADO_COLORS[lead.estado] || '#888',
                    background: `${ESTADO_COLORS[lead.estado] || '#888'}1a`,
                  }}
                >
                  {lead.estado?.replace('_', ' ')}
                </span>
                {lead.botActivo && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" title="Bot activo" />
                )}
              </div>
            </Link>
          ))}
          {(!data.ultimosLeads || data.ultimosLeads.length === 0) && (
            <p className="px-4 py-6 text-sm text-[var(--color-text-muted)] text-center">Sin leads aun</p>
          )}
        </div>
      </div>

      {/* Gasto API total */}
      <div className="border border-[var(--color-border)] rounded-[12px] p-4 bg-[var(--color-bg-card)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-[var(--color-text-muted)]">Gasto API total</p>
            <p className="text-lg font-bold text-[#8b5cf6] font-mono-display">US${data.gastoTotal}</p>
          </div>
          <Link href="/admin/whatsapp-bot/config" className="text-xs text-[var(--color-text-muted)] hover:text-white transition-all">
            Limite: US${data.limiteGastoUsd || '5.00'}
          </Link>
        </div>
      </div>
    </div>
  )
}
