'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { SkeletonCard } from '@/components/ui/Skeleton'

const ESTADO_COLORS = {
  pendiente: 'var(--cf-gold)',
  contactado: 'var(--cf-blue)',
  interesado: 'var(--cf-green-dark)',
  no_interesado: 'var(--cf-ink-3)',
  cerrado: 'var(--cf-blue)',
  bloqueado: 'var(--cf-red-dark)',
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

  if (!data) return <p className="text-[var(--cf-red-dark)] text-sm">Error cargando datos</p>

  const cloud = data.whatsappCloud || {}
  const cloudOk = cloud.ok === true
  const cloudLabel = cloudOk
    ? `Cloud API${cloud.phone ? ` · ${cloud.phone}` : ''}`
    : (cloud.status === 'no_configurado' ? 'Sin configurar' : (cloud.status || 'Desconectado'))

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[25px] font-semibold text-[var(--cf-ink)]">WhatsApp Bot</h1>
          <p className="text-sm text-[var(--cf-ink-3)] mt-0.5">Bot comercial (WhatsApp Cloud API · Meta) para leads de Facebook Ads</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${cloudOk ? 'bg-[var(--cf-green-dark)]' : 'bg-[var(--cf-red-dark)]'}`} />
          <span className="text-xs text-[var(--cf-ink-3)]" title={cloud.tier ? `Tier: ${cloud.tier}${cloud.qualityRating ? ` · Calidad: ${cloud.qualityRating}` : ''}` : ''}>
            {cloudLabel}
          </span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Leads hoy', value: data.leadsHoy, color: 'var(--cf-blue)' },
          { label: 'Total leads', value: data.totalLeads, color: 'var(--cf-green-dark)' },
          { label: 'Tasa respuesta', value: `${data.tasaRespuesta}%`, color: 'var(--cf-gold)' },
          { label: 'Gasto hoy', value: `$${data.gastoHoy}`, color: 'var(--cf-blue)' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="border border-[var(--cf-border)] rounded-[20px] px-3 py-3 text-center"
            style={{
              background: `var(--cf-card) 70%, color-mix(in srgb, ${color} 2%, transparent) 100%)`,
              boxShadow: `0 0 30px color-mix(in srgb, ${color} 3%, transparent), 0 1px 2px rgba(0,0,0,0.3)`,
            }}
          >
            <p className="text-[10px] text-[var(--cf-ink-3)]">{label}</p>
            <p className="text-base font-bold mt-0.5" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* KPIs de conversion */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Leads calientes', value: data.leadsCalientes ?? 0, color: 'var(--cf-red-dark)', href: '/admin/whatsapp-bot/chats?filtro=calientes' },
          { label: 'Clientes registrados', value: data.registrados ?? 0, color: 'var(--cf-green-dark)' },
          { label: 'Conversion', value: `${data.tasaConversion ?? 0}%`, color: 'var(--cf-gold)' },
        ].map(({ label, value, color, href }) => {
          const inner = (
            <>
              <p className="text-[10px] text-[var(--cf-ink-3)]">{label}</p>
              <p className="text-base font-bold mt-0.5" style={{ color }}>{value}</p>
            </>
          )
          return href ? (
            <Link key={label} href={href} className="border border-[var(--cf-border)] rounded-[20px] px-3 py-3 text-center hover:bg-[rgba(255,255,255,0.03)] transition-all">
              {inner}
            </Link>
          ) : (
            <div key={label} className="border border-[var(--cf-border)] rounded-[20px] px-3 py-3 text-center">
              {inner}
            </div>
          )
        })}
      </div>

      {/* Acciones rapidas */}
      <div className="flex gap-3 flex-wrap">
        <Link
          href="/admin/whatsapp-bot/chats"
          className="px-4 py-2 rounded-[10px] text-sm font-medium bg-[rgba(16,185,129,0.15)] text-[var(--cf-green-dark)] hover:bg-[rgba(16,185,129,0.25)] transition-all"
        >
          Ver chats
        </Link>
        {/* ⚠ AQUÍ Y NO EN EL MENÚ PRINCIPAL. El menú se dejó en nueve entradas
            a propósito —«un montón de paneles con datos iguales que se
            duplican»— y esto es de WhatsApp, así que su sitio es éste. */}
        <Link
          href="/admin/whatsapp-bot/envios"
          className="px-4 py-2 rounded-[10px] text-sm font-medium bg-[rgba(59,130,246,0.12)] text-[var(--cf-blue)] hover:bg-[rgba(59,130,246,0.2)] transition-all"
        >
          Qué se ha enviado
        </Link>
        <button
          onClick={toggleBot}
          disabled={toggleando}
          className={`px-4 py-2 rounded-[10px] text-sm font-medium transition-all ${
            data.botActivo
              ? 'bg-[rgba(239,68,68,0.12)] text-[var(--cf-red-dark)] hover:bg-[rgba(239,68,68,0.2)]'
              : 'bg-[rgba(16,185,129,0.12)] text-[var(--cf-green-dark)] hover:bg-[rgba(16,185,129,0.2)]'
          }`}
        >
          {toggleando ? '...' : data.botActivo ? 'Apagar bot' : 'Encender bot'}
        </button>
        <button
          onClick={ejecutarFollowup}
          disabled={enviando}
          className="px-4 py-2 rounded-[10px] text-sm font-medium bg-[rgba(59,130,246,0.12)] text-[var(--cf-blue)] hover:bg-[rgba(59,130,246,0.2)] transition-all"
        >
          {enviando ? 'Enviando...' : 'Ejecutar seguimientos'}
        </button>
        <Link
          href="/admin/whatsapp-bot/config"
          className="px-4 py-2 rounded-[10px] text-sm font-medium bg-[rgba(136,136,136,0.12)] text-[var(--cf-ink-3)] hover:bg-[rgba(136,136,136,0.2)] transition-all"
        >
          Configuración
        </Link>
      </div>

      {/* Leads por estado */}
      <div className="border border-[var(--cf-border)] rounded-[20px] p-4 bg-[var(--cf-card)]">
        <h2 className="text-sm font-semibold text-[var(--cf-ink)] mb-3">Leads por estado</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {Object.entries(ESTADO_COLORS).map(([estado, color]) => (
            <div key={estado} className="text-center">
              <p className="text-lg font-bold" style={{ color }}>{data.estados?.[estado] || 0}</p>
              <p className="text-[10px] text-[var(--cf-ink-3)] capitalize">{estado.replace('_', ' ')}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Ultimos leads */}
      <div className="border border-[var(--cf-border)] rounded-[20px] bg-[var(--cf-card)]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--cf-border)]">
          <h2 className="text-sm font-semibold text-[var(--cf-ink)]">Últimos leads</h2>
          <Link href="/admin/whatsapp-bot/leads" className="text-xs text-[var(--cf-blue)] hover:underline">
            Ver todos
          </Link>
        </div>
        <div className="divide-y divide-[var(--cf-border)]">
          {(data.ultimosLeads || []).map(lead => (
            <Link
              key={lead.id}
              href={`/admin/whatsapp-bot/leads/${lead.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-[rgba(255,255,255,0.03)] transition-all"
            >
              <div className="min-w-0">
                <p className="text-sm text-[var(--cf-ink)] font-medium truncate">{lead.nombre}</p>
                <p className="text-[11px] text-[var(--cf-ink-3)]">{lead.telefono}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium capitalize"
                  style={{
                    color: ESTADO_COLORS[lead.estado] || 'var(--cf-ink-3)',
                    background: `color-mix(in srgb, ${ESTADO_COLORS[lead.estado] || 'var(--cf-ink-3)'} 10%, transparent)`,
                  }}
                >
                  {lead.estado?.replace('_', ' ')}
                </span>
                {lead.botActivo && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--cf-green-dark)]" title="Bot activo" />
                )}
              </div>
            </Link>
          ))}
          {(!data.ultimosLeads || data.ultimosLeads.length === 0) && (
            <p className="px-4 py-6 text-sm text-[var(--cf-ink-3)] text-center">Sin leads aún</p>
          )}
        </div>
      </div>

      {/* Gasto API total */}
      <div className="border border-[var(--cf-border)] rounded-[20px] p-4 bg-[var(--cf-card)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-[var(--cf-ink-3)]">Gasto API total</p>
            <p className="text-lg font-bold text-[var(--cf-blue)] font-mono-display">US${data.gastoTotal}</p>
          </div>
          <Link href="/admin/whatsapp-bot/config" className="text-xs text-[var(--cf-ink-3)] hover:text-white transition-all">
            Límite: US${data.limiteGastoUsd || '5.00'}
          </Link>
        </div>
      </div>
    </div>
  )
}
