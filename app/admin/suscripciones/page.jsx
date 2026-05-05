'use client'

import { useState, useEffect, useCallback } from 'react'
import Link                    from 'next/link'
import { Badge }               from '@/components/ui/Badge'
import { SkeletonTable }       from '@/components/ui/Skeleton'
import { formatCOP }           from '@/lib/calculos'

const planBadge = { starter: 'gray', basic: 'blue', growth: 'yellow', standard: 'purple', professional: 'green', test: 'yellow' }
const tabs = [
  { key: '',               label: 'Todas'             },
  { key: 'activa',         label: 'Activas'           },
  { key: 'porVencer',      label: 'Por vencer (7d)'   },
  { key: 'trialPorVencer', label: 'Trials por vencer' },
  { key: 'vencida',        label: 'Vencidas'          },
  { key: 'cancelada',      label: 'Canceladas'        },
]

const hace = (date) => {
  if (!date) return 'Nunca'
  const ms = Date.now() - new Date(date).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'Ahora'
  if (min < 60) return `${min}m`
  const horas = Math.floor(min / 60)
  if (horas < 24) return `${horas}h`
  const dias = Math.floor(horas / 24)
  if (dias < 30) return `${dias}d`
  return `${Math.floor(dias / 30)}mes`
}

const colorActividad = (date) => {
  if (!date) return 'var(--color-text-muted)'
  const horas = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60)
  if (horas <= 24) return '#22c55e'
  if (horas <= 168) return '#f59e0b'
  return 'var(--color-danger)'
}

export default function SuscripcionesPage() {
  const [subs,    setSubs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState('')
  const [accionando, setAccionando] = useState('')

  const fetchSubs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/suscripciones${tab ? `?estado=${tab}` : ''}`)
      const data = await res.json()
      setSubs(Array.isArray(data) ? data : [])
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { fetchSubs() }, [fetchSubs])

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
  const activas       = subs.filter((s) => s.estado === 'activa' && s.diasRestantes > 7).length
  const porVencer     = subs.filter((s) => s.estado === 'activa' && s.diasRestantes <= 7 && s.diasRestantes > 0).length
  const trialsPorVencer = subs.filter((s) => s.estado === 'activa' && s.esTrial && s.diasRestantes <= 7 && s.diasRestantes > 0).length
  const vencidas      = subs.filter((s) => s.estado === 'vencida' || s.diasRestantes <= 0).length

  const waUrlVencer = (s) => {
    const tel = s.ownerTelefono ? s.ownerTelefono.replace(/\D/g, '') : ''
    if (!tel) return null
    const numero = tel.startsWith('57') ? tel : `57${tel}`
    const msg = encodeURIComponent(
      `Hola! Soy del equipo de Control Finanzas. Vi que tu prueba gratis del plan ${s.plan} vence en ${s.diasRestantes} dia${s.diasRestantes !== 1 ? 's' : ''}. Ya tienes ${s.clientes} cliente${s.clientes !== 1 ? 's' : ''} y ${s.prestamos} prestamo${s.prestamos !== 1 ? 's' : ''} en la app. Quieres que te ayudemos a activar tu plan para no perder el acceso?`
    )
    return `https://wa.me/${numero}?text=${msg}`
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[white]">Suscripciones</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Gestión de suscripciones de la plataforma</p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border border-[var(--color-border)] rounded-[12px] px-3 py-3 text-center"
          style={{ background: 'linear-gradient(135deg, #22c55e0A 0%, var(--color-bg-card) 40%, var(--color-bg-card) 70%, #22c55e05 100%)' }}
        >
          <p className="text-[10px] text-[var(--color-text-muted)]">Activas</p>
          <p className="text-lg font-bold text-[var(--color-success)]">{activas}</p>
        </div>
        <div className="border border-[var(--color-border)] rounded-[12px] px-3 py-3 text-center"
          style={{ background: 'linear-gradient(135deg, #f59e0b0A 0%, var(--color-bg-card) 40%, var(--color-bg-card) 70%, #f59e0b05 100%)' }}
        >
          <p className="text-[10px] text-[var(--color-text-muted)]">Por vencer</p>
          <p className="text-lg font-bold text-[var(--color-warning)]">{porVencer}</p>
        </div>
        <div className="border border-[var(--color-border)] rounded-[12px] px-3 py-3 text-center"
          style={{ background: 'linear-gradient(135deg, #3b82f60A 0%, var(--color-bg-card) 40%, var(--color-bg-card) 70%, #3b82f605 100%)' }}
        >
          <p className="text-[10px] text-[var(--color-text-muted)]">Trials por vencer</p>
          <p className="text-lg font-bold text-[var(--color-info)]">{trialsPorVencer}</p>
        </div>
        <div className="border border-[var(--color-border)] rounded-[12px] px-3 py-3 text-center"
          style={{ background: 'linear-gradient(135deg, #ef44440A 0%, var(--color-bg-card) 40%, var(--color-bg-card) 70%, #ef444405 100%)' }}
        >
          <p className="text-[10px] text-[var(--color-text-muted)]">Vencidas</p>
          <p className="text-lg font-bold text-[var(--color-danger)]">{vencidas}</p>
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
                ? 'bg-[#3b82f6] text-[var(--color-text-primary)]'
                : 'bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[white]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Banner de oportunidad si estoy en trial por vencer */}
      {tab === 'trialPorVencer' && subs.length > 0 && (
        <div className="rounded-[12px] p-3 flex items-start gap-3"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, #3b82f6 10%, transparent), color-mix(in srgb, #3b82f6 4%, transparent))',
            border: '1px solid color-mix(in srgb, #3b82f6 25%, transparent)',
          }}
        >
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"
            style={{ color: '#3b82f6' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
          </svg>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {subs.length} trial{subs.length !== 1 ? 's' : ''} por vencer en los próximos 7 días
            </p>
            <p className="text-xs leading-snug" style={{ color: 'var(--color-text-muted)' }}>
              Estos son tus prospectos más calientes. Llámalos o escríbeles por WhatsApp antes de que pierdan el acceso.
            </p>
          </div>
        </div>
      )}

      {/* Tabla */}
      {loading ? <SkeletonTable rows={5} /> : subs.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-8">No hay suscripciones</p>
      ) : (
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[16px] overflow-hidden">
          <div className="hidden sm:grid grid-cols-[2fr_0.7fr_0.8fr_1fr_0.8fr_1.4fr] gap-2 px-4 py-2.5 text-[10px] text-[var(--color-text-muted)] font-medium uppercase border-b border-[var(--color-border)]">
            <span>Organización</span>
            <span className="text-center">Plan</span>
            <span className="text-center">Uso</span>
            <span className="text-center">Vencimiento</span>
            <span className="text-center">Última act.</span>
            <span className="text-right">Acciones</span>
          </div>

          {subs.map((s) => {
            const wa = waUrlVencer(s)
            return (
            <div key={s.id} className="grid grid-cols-2 sm:grid-cols-[2fr_0.7fr_0.8fr_1fr_0.8fr_1.4fr] gap-2 px-4 py-3 border-b border-[var(--color-border)] last:border-0 items-center">
              <div>
                <Link href={`/admin/organizaciones/${s.organizacionId}`} className="text-sm font-medium text-[white] hover:text-[var(--color-info)]">
                  {s.organizacion}
                </Link>
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  {s.esTrial ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-[4px]"
                      style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}
                    >
                      TRIAL
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-[4px]"
                      style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}
                    >
                      PAGADO · {formatCOP(s.montoCOP)}
                    </span>
                  )}
                  {s.ownerEmail && (
                    <p className="text-[10px] text-[var(--color-text-muted)] truncate">{s.ownerEmail}</p>
                  )}
                </div>
              </div>
              <div className="text-center">
                <Badge variant={planBadge[s.plan]}>{s.plan}</Badge>
              </div>
              <div className="text-center">
                <p className="text-[11px] text-[var(--color-text-primary)] font-medium">{s.clientes}</p>
                <p className="text-[9px] text-[var(--color-text-muted)]">{s.prestamos} préstamo{s.prestamos !== 1 ? 's' : ''}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-[var(--color-text-muted)]">
                  {new Date(s.fechaVencimiento).toLocaleDateString('es-CO')}
                </p>
                <p className={`text-[10px] font-bold ${s.diasRestantes > 7 ? 'text-[var(--color-success)]' : s.diasRestantes > 0 ? 'text-[var(--color-warning)]' : 'text-[var(--color-danger)]'}`}>
                  {s.diasRestantes > 0 ? `${s.diasRestantes}d` : `${Math.abs(s.diasRestantes)}d vencida`}
                </p>
              </div>
              <div className="text-center">
                <span className="text-[11px] font-medium" style={{ color: colorActividad(s.ownerLastLoginAt) }}>
                  {hace(s.ownerLastLoginAt)}
                </span>
              </div>
              <div className="flex gap-1.5 justify-end flex-wrap">
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-[6px] text-[10px] font-medium transition-all"
                    style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}
                    title="Contactar por WhatsApp"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                    </svg>
                    WA
                  </a>
                )}
                <button
                  onClick={() => ejecutar(s.id, 'renovar')}
                  disabled={!!accionando}
                  className="px-2 py-1 rounded-[6px] text-[10px] font-medium bg-[rgba(16,185,129,0.12)] text-[var(--color-success)] hover:bg-[rgba(16,185,129,0.2)] transition-all disabled:opacity-50"
                >
                  {accionando === `${s.id}-renovar` ? '…' : '+30d'}
                </button>
                <button
                  onClick={() => ejecutar(s.id, 'gracia')}
                  disabled={!!accionando}
                  className="px-2 py-1 rounded-[6px] text-[10px] font-medium bg-[rgba(245,158,11,0.12)] text-[var(--color-warning)] hover:bg-[rgba(245,158,11,0.2)] transition-all disabled:opacity-50"
                >
                  {accionando === `${s.id}-gracia` ? '…' : '+7d'}
                </button>
                <button
                  onClick={() => {
                    if (confirm(`¿Cancelar suscripción de "${s.organizacion}"?`)) ejecutar(s.id, 'cancelar')
                  }}
                  disabled={!!accionando || s.estado === 'cancelada'}
                  className="px-2 py-1 rounded-[6px] text-[10px] font-medium bg-[rgba(239,68,68,0.12)] text-[var(--color-danger)] hover:bg-[rgba(239,68,68,0.2)] transition-all disabled:opacity-50"
                >
                  {accionando === `${s.id}-cancelar` ? '…' : 'Cancelar'}
                </button>
              </div>
            </div>
          )})}
        </div>
      )}
    </div>
  )
}
