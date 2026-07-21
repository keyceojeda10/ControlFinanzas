'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { Toggle } from '@/components/ui/Toggle'

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
        <h1 className="text-[25px] font-semibold text-[white]">Configuración del Bot</h1>
      </div>

      {/* Bot activo toggle */}
      <div className="border border-[var(--color-border)] rounded-[20px] p-4 bg-[var(--color-bg-card)]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Bot activo</h2>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
              Cuando esta apagado, los mensajes se guardan pero no se responden
            </p>
          </div>
          <Toggle checked={!!config.botActivo} onChange={(v) => set('botActivo', v)} />
        </div>
      </div>

      {/* Aqui vivian cuatro controles mas —Modo prueba, Modelo Claude, System
          prompt y WhatsApp personal— que NO hacian nada: el bot v2 tiene el
          modelo fijo en lib/bot-v2/agente.js, los prompts en prompts.js, y las
          alertas usan WHATSAPP_ADMIN_NUMBER del .env. El panel daba la
          impresion de controlar el bot y no controlaba nada, que es peor que no
          tener panel. Las columnas siguen en BotConfig por si algun dia se
          conectan de verdad; lo que se quito es la promesa falsa. */}

      {/* Delays de seguimiento (estos SI se aplican, en lib/bot-v2/sender.js) */}
      <div className="border border-[var(--color-border)] rounded-[20px] p-4 bg-[var(--color-bg-card)]">
        <h2 className="text-sm font-semibold text-white mb-1">Espaciado entre seguimientos</h2>
        <p className="text-[11px] text-[var(--color-text-muted)] mb-3">
          Pausa aleatoria entre un seguimiento y el siguiente, para no enviarlos en rafaga.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'delayMinMs', label: 'Delay mínimo (ms)', type: 'number' },
            { key: 'delayMaxMs', label: 'Delay máximo (ms)', type: 'number' },
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

      {/* Guardar */}
      <div className="flex gap-3">
        <button
          onClick={guardar}
          disabled={saving}
          className="px-6 py-2.5 rounded-[10px] text-sm font-medium bg-[rgba(245,197,24,0.15)] text-[var(--color-accent)] hover:bg-[rgba(245,197,24,0.25)] transition-all"
        >
          {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}
