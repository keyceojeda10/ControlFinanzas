'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { SkeletonCard } from '@/components/ui/Skeleton'

export default function WhatsAppBotConfig() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/admin/whatsapp-bot/config')
      .then(r => r.json())
      .then(setConfig)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function guardar() {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/admin/whatsapp-bot/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (res.ok) {
        const updated = await res.json()
        setConfig(updated)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch {} finally {
      setSaving(false)
    }
  }

  function set(key, value) {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return <div className="max-w-3xl mx-auto space-y-4"><SkeletonCard /><SkeletonCard /></div>
  }

  if (!config) return <p className="text-[var(--color-danger)] text-sm">Error cargando configuración</p>

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/admin/whatsapp-bot" className="text-[var(--color-text-muted)] hover:text-white transition-all">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-[white]">Configuración del Bot</h1>
      </div>

      {/* Bot activo toggle */}
      <div className="border border-[var(--color-border)] rounded-[12px] p-4 bg-[var(--color-bg-card)]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Bot activo</h2>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
              Cuando esta apagado, los mensajes se guardan pero no se responden
            </p>
          </div>
          <button
            onClick={() => set('botActivo', !config.botActivo)}
            className={`relative w-12 h-6 rounded-full transition-all ${
              config.botActivo ? 'bg-[#10b981]' : 'bg-[#333]'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                config.botActivo ? 'left-[26px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Modo prueba */}
      <div className="border border-[var(--color-border)] rounded-[12px] p-4 bg-[var(--color-bg-card)]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Modo prueba</h2>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
              Solo responde a tu WhatsApp personal
            </p>
          </div>
          <button
            onClick={() => set('modoPrueba', !config.modoPrueba)}
            className={`relative w-12 h-6 rounded-full transition-all ${
              config.modoPrueba ? 'bg-[#f5c518]' : 'bg-[#333]'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                config.modoPrueba ? 'left-[26px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Modelo */}
      <div className="border border-[var(--color-border)] rounded-[12px] p-4 bg-[var(--color-bg-card)]">
        <h2 className="text-sm font-semibold text-white mb-2">Modelo Claude</h2>
        <select
          value={config.modelo || 'claude-sonnet-4-6'}
          onChange={e => set('modelo', e.target.value)}
          className="w-full px-3 py-2 rounded-[8px] bg-[#0a0a0a] border border-[var(--color-border)] text-sm text-white focus:outline-none"
        >
          <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (recomendado)</option>
          <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (mas barato)</option>
          <option value="claude-opus-4-6">Claude Opus 4.6 (mas inteligente)</option>
        </select>
      </div>

      {/* System prompt */}
      <div className="border border-[var(--color-border)] rounded-[12px] p-4 bg-[var(--color-bg-card)]">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-white">System prompt</h2>
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {(config.systemPrompt || '').length} caracteres
          </span>
        </div>
        <textarea
          value={config.systemPrompt || ''}
          onChange={e => set('systemPrompt', e.target.value)}
          rows={12}
          className="w-full px-3 py-2 rounded-[8px] bg-[#0a0a0a] border border-[var(--color-border)] text-xs text-white font-mono placeholder-[#555] focus:outline-none focus:border-[#f5c518] resize-y"
        />
      </div>

      {/* Delays y limites */}
      <div className="border border-[var(--color-border)] rounded-[12px] p-4 bg-[var(--color-bg-card)]">
        <h2 className="text-sm font-semibold text-white mb-3">Seguimientos y límites</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'limiteDiario', label: 'Limite diario mensajes', type: 'number' },
            { key: 'limiteGastoUsd', label: 'Limite gasto USD/dia', type: 'number', step: '0.5' },
            { key: 'delayMinMs', label: 'Delay minimo (ms)', type: 'number' },
            { key: 'delayMaxMs', label: 'Delay maximo (ms)', type: 'number' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-[10px] text-[var(--color-text-muted)] mb-1 block">{f.label}</label>
              <input
                type={f.type}
                step={f.step}
                value={config[f.key] ?? ''}
                onChange={e => set(f.key, f.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
                className="w-full px-3 py-2 rounded-[8px] bg-[#0a0a0a] border border-[var(--color-border)] text-sm text-white focus:outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      {/* WhatsApp personal */}
      <div className="border border-[var(--color-border)] rounded-[12px] p-4 bg-[var(--color-bg-card)]">
        <h2 className="text-sm font-semibold text-white mb-2">WhatsApp personal (alertas)</h2>
        <input
          type="text"
          value={config.whatsappPersonal || ''}
          onChange={e => set('whatsappPersonal', e.target.value)}
          placeholder="573001234567"
          className="w-full px-3 py-2 rounded-[8px] bg-[#0a0a0a] border border-[var(--color-border)] text-sm text-white placeholder-[#555] focus:outline-none"
        />
        <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
          Número con indicativo. Recibe alertas de leads calientes y reportes.
        </p>
      </div>

      {/* Guardar */}
      <div className="flex gap-3">
        <button
          onClick={guardar}
          disabled={saving}
          className="px-6 py-2.5 rounded-[10px] text-sm font-medium bg-[rgba(245,197,24,0.15)] text-[#f5c518] hover:bg-[rgba(245,197,24,0.25)] transition-all"
        >
          {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}
