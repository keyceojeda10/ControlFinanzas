'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { SkeletonTable } from '@/components/ui/Skeleton'

const planBadge = { starter: 'gray', basic: 'blue', growth: 'yellow', standard: 'purple', professional: 'green', test: 'yellow' }

const tabs = [
  { key: 'vencidos',      label: 'Vencidos' },
  { key: 'porVencer',     label: 'Por vencer (7d)' },
  { key: 'sinActividad',  label: 'Sin actividad' },
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
  const horas = (Date.now() - new Date(date).getTime()) / 3600000
  if (horas <= 24) return 'var(--color-success)'
  if (horas <= 168) return '#f59e0b'
  return 'var(--color-danger)'
}

function waUrl(tel, msg) {
  if (!tel) return null
  const numero = tel.replace(/\D/g, '')
  const full = numero.startsWith('57') ? numero : `57${numero}`
  return `https://wa.me/${full}?text=${encodeURIComponent(msg)}`
}

export default function RetencionPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('vencidos')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/retencion')
      const json = await res.json()
      setData(json)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const lista = data?.[tab] ?? []
  const resumen = data?.resumen ?? {}

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-[25px] font-semibold text-[white]">Retencion</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
          Usuarios vencidos, por vencer y sin activar
        </p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border border-[var(--color-border)] rounded-[20px] px-3 py-3 text-center"
          style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-danger) 4%, transparent) 0%, var(--color-bg-card) 40%, var(--color-bg-card) 70%, color-mix(in srgb, var(--color-danger) 2%, transparent) 100%)' }}
        >
          <p className="text-[10px] text-[var(--color-text-muted)]">Vencidos</p>
          <p className="text-lg font-bold text-[var(--color-danger)]">{resumen.totalVencidos ?? '-'}</p>
        </div>
        <div className="border border-[var(--color-border)] rounded-[20px] px-3 py-3 text-center"
          style={{ background: 'linear-gradient(135deg, #f59e0b0A 0%, var(--color-bg-card) 40%, var(--color-bg-card) 70%, #f59e0b05 100%)' }}
        >
          <p className="text-[10px] text-[var(--color-text-muted)]">Por vencer (7d)</p>
          <p className="text-lg font-bold text-[var(--color-warning)]">{resumen.totalPorVencer ?? '-'}</p>
        </div>
        <div className="border border-[var(--color-border)] rounded-[20px] px-3 py-3 text-center"
          style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-info) 4%, transparent) 0%, var(--color-bg-card) 40%, var(--color-bg-card) 70%, color-mix(in srgb, var(--color-info) 2%, transparent) 100%)' }}
        >
          <p className="text-[10px] text-[var(--color-text-muted)]">Sin actividad</p>
          <p className="text-lg font-bold text-[var(--color-info)]">{resumen.totalSinActividad ?? '-'}</p>
        </div>
        <div className="border border-[var(--color-border)] rounded-[20px] px-3 py-3 text-center"
          style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-success) 4%, transparent) 0%, var(--color-bg-card) 40%, var(--color-bg-card) 70%, color-mix(in srgb, var(--color-success) 2%, transparent) 100%)' }}
        >
          <p className="text-[10px] text-[var(--color-text-muted)]">Vencidos con uso</p>
          <p className="text-lg font-bold text-[var(--color-success)]">{resumen.vencidosConUso ?? '-'}</p>
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
                ? 'bg-[var(--color-info)] text-[var(--color-text-primary)]'
                : 'bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[white]'
            }`}
          >
            {t.label}
            {data && <span className="ml-1 opacity-70">({(data[t.key] ?? []).length})</span>}
          </button>
        ))}
      </div>

      {/* Banner contextual */}
      {tab === 'vencidos' && lista.filter(v => v.prestamos >= 3).length > 0 && (
        <div className="rounded-[12px] p-3 flex items-start gap-3"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-danger) 10%, transparent), color-mix(in srgb, var(--color-danger) 4%, transparent))',
            border: '1px solid color-mix(in srgb, var(--color-danger) 25%, transparent)',
          }}
        >
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"
            style={{ color: 'var(--color-danger)' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {lista.filter(v => v.prestamos >= 3).length} vencido{lista.filter(v => v.prestamos >= 3).length !== 1 ? 's' : ''} con uso real
            </p>
            <p className="text-xs leading-snug" style={{ color: 'var(--color-text-muted)' }}>
              Estos usuarios tienen prestamos activos y dejaron de pagar. Son los mas faciles de recuperar — contactalos hoy.
            </p>
          </div>
        </div>
      )}

      {tab === 'sinActividad' && lista.length > 0 && (
        <div className="rounded-[12px] p-3 flex items-start gap-3"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-info) 10%, transparent), color-mix(in srgb, var(--color-info) 4%, transparent))',
            border: '1px solid color-mix(in srgb, var(--color-info) 25%, transparent)',
          }}
        >
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"
            style={{ color: 'var(--color-info)' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {lista.length} registro{lista.length !== 1 ? 's' : ''} sin actividad
            </p>
            <p className="text-xs leading-snug" style={{ color: 'var(--color-text-muted)' }}>
              Se registraron hace mas de 24h y no han creado ningun prestamo. Necesitan ayuda para arrancar.
            </p>
          </div>
        </div>
      )}

      {/* Tabla */}
      {loading ? <SkeletonTable rows={5} /> : lista.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
          {tab === 'vencidos' ? 'No hay vencidos recientes' : tab === 'porVencer' ? 'Nadie vence en los proximos 7 dias' : 'Todos los registros recientes ya crearon prestamos'}
        </p>
      ) : (
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[16px] overflow-hidden">
          {/* Header desktop */}
          <div className="hidden sm:grid grid-cols-[2fr_0.7fr_0.8fr_0.8fr_0.8fr_1.2fr] gap-2 px-4 py-2.5 text-[10px] text-[var(--color-text-muted)] font-medium uppercase border-b border-[var(--color-border)]">
            <span>Organizacion</span>
            <span className="text-center">Plan</span>
            <span className="text-center">Uso</span>
            <span className="text-center">{tab === 'sinActividad' ? 'Registro' : 'Vencimiento'}</span>
            <span className="text-center">Ultima act.</span>
            <span className="text-right">Acciones</span>
          </div>

          {lista.map((org) => {
            const msgVencido = `Hola ${(org.ownerNombre || '').split(' ')[0] || 'amigo'}, soy del equipo de Control Finanzas. Vi que tu plan venció. Tus ${org.clientes} clientes y ${org.prestamos} préstamos siguen guardados. ¿Quieres que te ayude a renovar tu plan para no perder el acceso?`
            const msgPorVencer = `Hola ${(org.ownerNombre || '').split(' ')[0] || 'amigo'}, soy del equipo de Control Finanzas. Tu plan vence en ${Math.abs(org.diasVencido)} días. Ya tienes ${org.clientes} clientes y ${org.prestamos} préstamos. ¿Quieres que te ayude a renovar?`
            const msgSinActividad = `Hola ${(org.ownerNombre || '').split(' ')[0] || 'amigo'}, soy del equipo de Control Finanzas. Vi que se registró pero no ha podido configurar su primera operación. ¿Necesita ayuda? Puede escribirnos al 301 199 3001 y lo asistimos.`
            const msg = tab === 'vencidos' ? msgVencido : tab === 'porVencer' ? msgPorVencer : msgSinActividad
            const waLink = waUrl(org.ownerTelefono, msg)

            return (
              <div key={org.id} className="grid grid-cols-2 sm:grid-cols-[2fr_0.7fr_0.8fr_0.8fr_0.8fr_1.2fr] gap-2 px-4 py-3 border-b border-[var(--color-border)] last:border-0 items-center">
                <div>
                  <Link href={`/admin/organizaciones/${org.id}`} className="text-sm font-medium text-[white] hover:text-[var(--color-info)]">
                    {org.nombre}
                  </Link>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    {org.algunVezPago ? (
                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-[4px]"
                        style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--color-success)' }}
                      >
                        PAGANTE
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-[4px]"
                        style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--color-info)' }}
                      >
                        TRIAL
                      </span>
                    )}
                    {org.waChurnSent && (
                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-[4px]"
                        style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--color-warning)' }}
                      >
                        WA ENVIADO
                      </span>
                    )}
                    {org.ownerEmail && (
                      <p className="text-[10px] text-[var(--color-text-muted)] truncate">{org.ownerEmail}</p>
                    )}
                  </div>
                </div>
                <div className="text-center">
                  <Badge variant={planBadge[org.plan]}>{org.plan}</Badge>
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-[var(--color-text-primary)] font-medium">{org.clientes}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">{org.prestamos} prest.</p>
                </div>
                <div className="text-center">
                  {tab === 'sinActividad' ? (
                    <>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {new Date(org.createdAt).toLocaleDateString('es-CO')}
                      </p>
                      <p className="text-[10px] font-bold text-[var(--color-info)]">
                        hace {Math.floor((Date.now() - new Date(org.createdAt).getTime()) / 86400000)}d
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {new Date(org.fechaVencimiento).toLocaleDateString('es-CO')}
                      </p>
                      <p className={`text-[10px] font-bold ${org.diasVencido > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-warning)]'}`}>
                        {org.diasVencido > 0 ? `${org.diasVencido}d vencido` : `${Math.abs(org.diasVencido)}d restantes`}
                      </p>
                    </>
                  )}
                </div>
                <div className="text-center">
                  <span className="text-[11px] font-medium" style={{ color: colorActividad(org.lastLoginAt) }}>
                    {hace(org.lastLoginAt)}
                  </span>
                </div>
                <div className="flex gap-1.5 justify-end flex-wrap">
                  {waLink && (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-[6px] text-[10px] font-medium transition-all"
                      style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--color-success)' }}
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                      </svg>
                      WA
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
