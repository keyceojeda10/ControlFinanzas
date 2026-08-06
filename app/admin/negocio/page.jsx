'use client'

import { useState, useEffect, useRef } from 'react'
import { Card }    from '@/components/ui/Card'
import { Badge }   from '@/components/ui/Badge'
import { formatMoney } from '@/lib/i18n'
import { PLANES_CONFIG } from '@/lib/planes'

const PRECIO_PLAN = Object.fromEntries(Object.entries(PLANES_CONFIG).map(([k, v]) => [k, v.precio]))

// Mini sparkline SVG (sin dependencias)
function Sparkline({ datos, color = 'var(--color-accent)', height = 32 }) {
  if (!datos?.length) return null
  const vals = datos.map(d => d.total)
  const max = Math.max(...vals, 1)
  const w = 120, h = height
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * w
    const y = h - (v / max) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-80">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {vals.map((v, i) => {
        if (i !== vals.length - 1) return null
        const x = (i / (vals.length - 1)) * w
        const y = h - (v / max) * h
        return <circle key={i} cx={x} cy={y} r="2.5" fill={color} />
      })}
    </svg>
  )
}

const TABS = [
  { key: 'pagantes',     label: 'Pagando',        color: 'var(--color-success)' },
  { key: 'vencimientos', label: 'Vencimientos',   color: 'var(--color-accent)' },
  { key: 'trials',       label: 'Trials',         color: '#a78bfa' },
  { key: 'muertos',      label: 'Sin actividad',  color: '#6b7280' },
  { key: 'churneados',   label: 'Churn',          color: 'var(--color-danger)' },
]

const SCORE_COLOR = (s) => s >= 70 ? 'var(--color-success)' : s >= 40 ? 'var(--color-accent)' : '#6b7280'
const SCORE_LABEL = (s) => s >= 70 ? 'Alto' : s >= 40 ? 'Medio' : 'Bajo'

function hace(date) {
  if (!date) return 'Nunca'
  const dias = Math.floor((Date.now() - new Date(date)) / 86400000)
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  if (dias < 30) return `${dias}d`
  return `${Math.floor(dias / 30)}mes`
}

function waLink(tel, nombre, texto) {
  if (!tel) return null
  const num = tel.replace(/\D/g, '')
  return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`
}

export default function NegocioPage() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState('pagantes')
  const [q,       setQ]       = useState('')
  const [ordenPagantes, setOrdenPagantes] = useState('vencimiento') // vencimiento | precio | actividad | antiguedad
  const timerRef = useRef(null)

  const cargar = (silencioso = false) => {
    if (!silencioso) setLoading(true)
    fetch('/api/admin/negocio')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => { if (!silencioso) setLoading(false) })
  }

  useEffect(() => {
    cargar()
    // Refresca activos cada 2 minutos en silencio (sin spinner)
    timerRef.current = setInterval(() => cargar(true), 2 * 60 * 1000)
    return () => clearInterval(timerRef.current)
  }, [])

  if (loading) return (
    <div className="max-w-6xl mx-auto space-y-4">
      {[1,2,3].map(i => (
        <div key={i} className="h-20 rounded-[20px] bg-[var(--color-bg-surface)] animate-pulse" />
      ))}
    </div>
  )

  if (!data) return (
    <p className="text-sm text-[var(--color-text-muted)] text-center py-12">Error cargando datos</p>
  )

  const { resumen } = data
  const listaRaw = (data[tab] ?? []).filter(u => {
    if (!q) return true
    const hay = (s) => (s ?? '').toLowerCase().includes(q.toLowerCase())
    return hay(u.nombre) || hay(u.ownerNombre) || hay(u.ownerEmail)
  })

  const lista = tab === 'pagantes' ? [...listaRaw].sort((a, b) => {
    if (ordenPagantes === 'vencimiento') {
      return new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento)
    }
    if (ordenPagantes === 'precio') return b.precio - a.precio
    if (ordenPagantes === 'actividad') return (a.diasSinActividad ?? 999) - (b.diasSinActividad ?? 999)
    if (ordenPagantes === 'antiguedad') return (b.mesesPagando ?? 0) - (a.mesesPagando ?? 0)
    return 0
  }) : listaRaw

  const diasRestantes = (fv) => {
    if (!fv) return null
    return Math.ceil((new Date(fv) - new Date()) / 86400000)
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[25px] font-semibold text-[var(--color-text-primary)]">Estado del negocio</h1>
        <p className="text-xs text-[var(--color-text-muted)]">Usuarios pagando, trials con potencial, churn y muertos</p>
      </div>

      {/* Fila 1: Activos ahora + MRR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        {/* Activos ahora — el único KPI "tiempo real" */}
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Activos (últ. 15 min)</p>
              <p className="text-2xl font-bold text-[var(--color-success)]">{resumen.activosAhora}</p>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{resumen.activosHoy30min} en últimos 30 min</p>
            </div>
            {/* Punto pulsante verde */}
            <span className="relative flex h-2.5 w-2.5 mt-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
          </div>
        </Card>
        <Card>
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1">MRR actual</p>
          <p className="text-xl font-bold text-[var(--color-success)] font-mono-display">{formatMoney(resumen.mrrActual, 'co')}</p>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
            {resumen.pagantes} pagando · ticket {resumen.pagantes > 0 ? formatMoney(Math.round(resumen.mrrActual / resumen.pagantes), 'co') : '—'}
          </p>
          {(() => {
            const porVencer = (data.pagantes ?? []).filter(p => {
              const dr = diasRestantes(p.fechaVencimiento)
              return dr != null && dr <= 7
            }).length
            return porVencer > 0 ? (
              <p className="text-[10px] font-semibold text-[#f59e0b] mt-1">
                {porVencer} vence{porVencer > 1 ? 'n' : ''} en 7 dias
              </p>
            ) : null
          })()}
        </Card>
        <Card>
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Potencial adicional</p>
          <p className="text-xl font-bold text-[var(--color-accent)] font-mono-display">
            +{formatMoney(resumen.mrrProyectado - resumen.mrrActual, 'co')}
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
            {resumen.trialsCalientes} trials calientes · si todos convierten
          </p>
          <p className="text-[10px] font-semibold text-[var(--color-text-primary)] mt-1.5 pt-1.5 border-t border-[var(--color-border)]">
            = {formatMoney(resumen.mrrProyectado, 'co')} total proyectado
          </p>
        </Card>
        <Card>
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Churn / Muertos</p>
          <p className="text-xl font-bold text-[var(--color-danger)]">{resumen.churneados} <span className="text-sm font-normal text-[var(--color-text-muted)]">/ {resumen.muertos}</span></p>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">a recuperar / a desechar</p>
        </Card>
      </div>

      {/* Fila 2: Registros por período + sparkline */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card>
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Registros hoy / ayer</p>
          <p className="text-xl font-bold text-[var(--color-text-primary)]">
            {resumen.registrosHoy}
            <span className="text-sm font-normal text-[var(--color-text-muted)]"> / {resumen.registrosAyer}</span>
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">nuevos en el sistema</p>
        </Card>
        <Card>
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Esta semana / mes</p>
          <p className="text-xl font-bold text-[var(--color-text-primary)]">
            {resumen.registrosSemana}
            <span className="text-sm font-normal text-[var(--color-text-muted)]"> / {resumen.registrosMes}</span>
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">registros acumulados</p>
        </Card>
        <Card className="sm:col-span-2">
          <div className="flex items-start justify-between mb-1">
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Registros últimos 30 días</p>
            <p className="text-[10px] font-bold text-[var(--color-accent)]">
              {data.registrosPorDia?.reduce((a, d) => a + d.total, 0) ?? 0} total
            </p>
          </div>
          <Sparkline datos={data.registrosPorDia} color="var(--color-accent)" height={36} />
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {TABS.map(t => {
          const count = t.key === 'vencimientos'
            ? (data.calendario ?? []).length
            : (data[t.key] ?? []).length
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                tab === t.key
                  ? 'bg-[var(--color-accent)] text-[#1a1a2e]'
                  : 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: tab === t.key ? '#1a1a2e' : t.color }}
              />
              {t.label}
              <span className={`rounded-full px-1 text-[10px] font-bold ${tab === t.key ? 'bg-black/20 text-[#1a1a2e]' : 'bg-[var(--color-bg-card)] text-[var(--color-text-muted)]'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Tab Vencimientos */}
      {tab === 'vencimientos' && (
        <CalendarioVencimientos calendario={data.calendario ?? []} />
      )}

      {/* Tabs de tabla — solo cuando NO es vencimientos */}
      {tab !== 'vencimientos' && <>
      {/* Buscador + Ordenamiento */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar por nombre, email..."
          className="w-full max-w-xs px-3 py-1.5 text-xs rounded-[8px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
        />
        {tab === 'pagantes' && (
          <select
            value={ordenPagantes}
            onChange={e => setOrdenPagantes(e.target.value)}
            className="px-2 py-1.5 text-[11px] rounded-[8px] border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
          >
            <option value="vencimiento">Vence primero</option>
            <option value="precio">Mayor ingreso</option>
            <option value="actividad">Menos activo</option>
            <option value="antiguedad">Mas antiguo</option>
          </select>
        )}
      </div>

      {/* Tabla */}
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-text-muted)]">
                <th className="text-left px-4 py-3 font-medium">Usuario / Org</th>
                <th className="text-center px-3 py-3 font-medium hidden sm:table-cell">Clientes</th>
                <th className="text-center px-3 py-3 font-medium hidden sm:table-cell">Préstamos</th>
                {tab === 'pagantes' && <>
                  <th className="text-center px-3 py-3 font-medium">Plan</th>
                  <th className="text-right px-3 py-3 font-medium">$/mes</th>
                  <th className="text-center px-3 py-3 font-medium">Vence en</th>
                  <th className="text-center px-3 py-3 font-medium hidden sm:table-cell">Actividad</th>
                  <th className="text-center px-3 py-3 font-medium hidden sm:table-cell">Antigüedad</th>
                </>}
                {tab === 'trials' && <>
                  <th className="text-center px-3 py-3 font-medium">Score</th>
                  <th className="text-center px-3 py-3 font-medium">Trial</th>
                  <th className="text-center px-3 py-3 font-medium hidden sm:table-cell">Última act.</th>
                </>}
                {tab === 'muertos' && <>
                  <th className="text-center px-3 py-3 font-medium">Registro</th>
                  <th className="text-center px-3 py-3 font-medium">Sin actividad</th>
                </>}
                {tab === 'churneados' && <>
                  <th className="text-center px-3 py-3 font-medium">Plan</th>
                  <th className="text-center px-3 py-3 font-medium">Venció</th>
                  <th className="text-right px-3 py-3 font-medium hidden sm:table-cell">MRR perdido</th>
                </>}
                <th className="text-right px-4 py-3 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-[var(--color-text-muted)]">
                    Sin resultados
                  </td>
                </tr>
              ) : lista.map(u => {
                const waPagante = waLink(u.ownerTelefono, u.ownerNombre,
                  `Hola ${u.ownerNombre}, gracias por usar Control Finanzas. ¿Cómo te ha ido con la plataforma?`)
                const waTrialCaliente = waLink(u.ownerTelefono, u.ownerNombre,
                  `Hola ${u.ownerNombre}, veo que estás usando bien Control Finanzas. ¿Tienes alguna duda antes de que venza tu prueba?`)
                const waChurn = waLink(u.ownerTelefono, u.ownerNombre,
                  `Hola ${u.ownerNombre}, notamos que tu suscripción venció. ¿Podemos ayudarte a continuar? Tenemos una oferta especial para ti.`)
                const waMuerto = waLink(u.ownerTelefono, u.ownerNombre,
                  `Hola ${u.ownerNombre}, te registraste en Control Finanzas pero no has creado clientes aún. ¿Puedo ayudarte a empezar en 2 minutos?`)

                const waFinal = tab === 'pagantes' ? waPagante
                  : tab === 'trials' ? waTrialCaliente
                  : tab === 'churneados' ? waChurn
                  : waMuerto

                return (
                  <tr key={u.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-card)] transition-colors">
                    {/* Usuario */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--color-text-primary)] truncate max-w-[170px]">
                        {u.ownerNombre || u.nombre}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-muted)] truncate max-w-[170px]">
                        {u.ownerEmail}
                      </p>
                    </td>

                    {/* Clientes */}
                    <td className="px-3 py-3 text-center hidden sm:table-cell">
                      <span className={`font-bold ${u.clientes > 0 ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                        {u.clientes}
                      </span>
                    </td>

                    {/* Préstamos */}
                    <td className="px-3 py-3 text-center hidden sm:table-cell">
                      <span className={`font-bold ${u.prestamos > 0 ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                        {u.prestamos}
                      </span>
                    </td>

                    {/* Columnas específicas por tab */}
                    {tab === 'pagantes' && (() => {
                      const dr = diasRestantes(u.fechaVencimiento)
                      const venceColor = dr != null && dr <= 3 ? 'var(--color-danger)' : dr != null && dr <= 7 ? '#f59e0b' : dr != null && dr <= 14 ? 'var(--color-accent)' : 'var(--color-success)'
                      return <>
                      <td className="px-3 py-3 text-center">
                        <Badge variant={u.plan === 'professional' ? 'green' : u.plan === 'standard' ? 'purple' : u.plan === 'growth' ? 'yellow' : 'blue'}>
                          {u.planNombre}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-[var(--color-success)] font-mono-display">
                        {formatMoney(u.precio, u.country ?? 'co')}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {dr != null ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-bold text-[11px]" style={{ color: venceColor }}>
                              {dr <= 0 ? 'Vencido' : `${dr}d`}
                            </span>
                            <span className="text-[11px] text-[var(--color-text-muted)]">
                              {new Date(u.fechaVencimiento).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-3 text-center hidden sm:table-cell">
                        <span className={`font-medium text-[11px] ${
                          (u.diasSinActividad ?? 0) <= 1 ? 'text-[var(--color-success)]'
                          : (u.diasSinActividad ?? 0) <= 3 ? 'text-[var(--color-text-primary)]'
                          : (u.diasSinActividad ?? 0) <= 7 ? 'text-[var(--color-accent)]'
                          : 'text-[var(--color-danger)]'
                        }`}>
                          {hace(u.ultimaActividad)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center hidden sm:table-cell">
                        <span className="text-[var(--color-text-muted)]">
                          {u.mesesPagando ?? 0} {(u.mesesPagando ?? 0) === 1 ? 'mes' : 'meses'}
                        </span>
                      </td>
                    </>})()}

                    {tab === 'trials' && <>
                      <td className="px-3 py-3 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="font-bold text-sm" style={{ color: SCORE_COLOR(u.score) }}>
                            {u.score}
                          </span>
                          <span className="text-[11px]" style={{ color: SCORE_COLOR(u.score) }}>
                            {SCORE_LABEL(u.score)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`font-bold text-[11px] ${
                          u.diasRestantesTrial <= 3 ? 'text-[var(--color-danger)]'
                          : u.diasRestantesTrial <= 7 ? 'text-[var(--color-warning)]'
                          : 'text-[var(--color-text-muted)]'
                        }`}>
                          {u.diasRestantesTrial}d
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center text-[var(--color-text-muted)] hidden sm:table-cell">
                        {hace(u.ultimaActividad)}
                      </td>
                    </>}

                    {tab === 'muertos' && <>
                      <td className="px-3 py-3 text-center text-[var(--color-text-muted)]">
                        {hace(u.createdAt)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-[var(--color-danger)] font-medium">
                          {u.diasSinActividad}d
                        </span>
                      </td>
                    </>}

                    {tab === 'churneados' && <>
                      <td className="px-3 py-3 text-center">
                        <Badge variant="gray">{u.planNombre}</Badge>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`font-medium ${
                          u.diasSinPagar <= 7 ? 'text-[var(--color-warning)]' : 'text-[var(--color-danger)]'
                        }`}>
                          hace {u.diasSinPagar}d
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-[var(--color-danger)] font-bold font-mono-display hidden sm:table-cell">
                        {formatMoney(PRECIO_PLAN[u.plan] ?? 0, u.country ?? 'co')}
                      </td>
                    </>}

                    {/* Acciones */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {waFinal && (
                          <a
                            href={waFinal}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="WhatsApp"
                            className="p-1.5 rounded-[8px] bg-[var(--color-success)]/10 text-[var(--color-success)] hover:bg-[var(--color-success)]/20 transition-all"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                              <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.243-1.212l-.304-.18-2.867.852.852-2.867-.18-.304A8 8 0 1112 20z" />
                            </svg>
                          </a>
                        )}
                        <a
                          href={`/admin/organizaciones/${u.id}`}
                          title="Ver detalle"
                          className="p-1.5 rounded-[8px] bg-[rgba(245,197,24,0.1)] text-[var(--color-accent)] hover:bg-[rgba(245,197,24,0.2)] transition-all"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </a>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
      </>}
    </div>
  )
}

// Componente separado para el calendario de vencimientos
function CalendarioVencimientos({ calendario }) {
  const mrrTotal    = calendario.reduce((a, d) => a + d.mrrPotencial, 0)
  const mrrCaliente = calendario.reduce((a, d) => a + d.mrrCaliente, 0)

  if (!calendario.length) return (
    <p className="text-sm text-[var(--color-text-muted)] text-center py-12">
      No hay vencimientos en los próximos 30 días
    </p>
  )

  return (
    <div>
      {/* Resumen de potencial */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="px-4 py-3 rounded-[20px] border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Potencial caliente (score ≥ 60)</p>
          <p className="text-xl font-bold text-[var(--color-success)] font-mono-display">{formatMoney(mrrCaliente, 'co')}</p>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">activos, con prestamos y entrando seguido</p>
        </div>
        <div className="px-4 py-3 rounded-[20px] border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Potencial total (todos)</p>
          <p className="text-xl font-bold text-[var(--color-text-muted)] font-mono-display">{formatMoney(mrrTotal, 'co')}</p>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">incluyendo inactivos y sin clientes</p>
        </div>
      </div>

      <div className="space-y-2">
        {calendario.map(dia => {
          const fecha = new Date(dia.dia + 'T12:00:00')
          const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
          const diffDias = Math.round((fecha - hoy) / 86400000)
          const esHoy     = diffDias === 0
          const esMañana  = diffDias === 1
          const esVencido = diffDias < 0
          const labelDia  = esVencido ? `Venció hace ${Math.abs(diffDias)}d`
            : esHoy    ? 'Hoy'
            : esMañana ? 'Mañana'
            : fecha.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })

          return (
            <div
              key={dia.dia}
              className="rounded-[12px] border overflow-hidden"
              style={{
                borderColor: esHoy ? 'var(--color-accent)' : esVencido ? 'var(--color-danger)' : 'var(--color-border)',
                background:  esHoy ? 'rgba(245,197,24,0.05)' : 'var(--color-bg-surface)',
              }}
            >
              {/* Header del día */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${esVencido ? 'text-[var(--color-danger)]' : esHoy ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}>
                    {labelDia}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {dia.usuarios.length} usuario{dia.usuarios.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {dia.mrrCaliente > 0 && (
                    <span className="text-[10px] font-bold text-[var(--color-success)]">
                      caliente: {formatMoney(dia.mrrCaliente, 'co')}
                    </span>
                  )}
                  <span className={`text-xs font-bold ${esVencido ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'}`}>
                    total: {formatMoney(dia.mrrPotencial, 'co')}
                  </span>
                </div>
              </div>
              {/* Usuarios del día */}
              <div className="divide-y divide-[var(--color-border)]">
                {dia.usuarios.map(u => {
                  const wa = waLink(u.ownerTelefono, u.ownerNombre,
                    esVencido
                      ? `Hola ${u.ownerNombre}, tu período de prueba de Control Finanzas venció. ¿Te ayudo a activar tu plan para seguir sin interrupciones?`
                      : esHoy
                      ? `Hola ${u.ownerNombre}, hoy vence tu período de prueba de Control Finanzas. ¿Te ayudo a activar tu plan y seguir sin interrupciones?`
                      : `Hola ${u.ownerNombre}, en ${u.diasRestantes} día${u.diasRestantes > 1 ? 's' : ''} vence tu período de prueba de Control Finanzas. ¿Tienes alguna duda antes de continuar?`)
                  const esCaliente = u.score >= 60 && ((u.clientes ?? 0) >= 3 || (u.prestamos ?? 0) >= 3)
                  return (
                    <div key={u.id} className={`flex items-center justify-between px-4 py-2.5 ${esCaliente ? '' : 'opacity-60'}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: SCORE_COLOR(u.score) }} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">{u.ownerNombre || u.nombre}</p>
                          <p className="text-[10px] text-[var(--color-text-muted)]">
                            {u.planNombre} · {u.clientes}c · {u.prestamos ?? 0}p · score {u.score}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className={`text-xs font-bold font-mono-display ${esCaliente ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'}`}>
                          {formatMoney(PRECIO_PLAN[u.plan] ?? 0, 'co')}
                        </span>
                        {wa && (
                          <a href={wa} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded-[8px] bg-[var(--color-success)]/10 text-[var(--color-success)] hover:bg-[var(--color-success)]/20 transition-all"
                            title="WhatsApp"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                              <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.243-1.212l-.304-.18-2.867.852.852-2.867-.18-.304A8 8 0 1112 20z" />
                            </svg>
                          </a>
                        )}
                        <a href={`/admin/organizaciones/${u.id}`}
                          className="p-1.5 rounded-[8px] bg-[rgba(245,197,24,0.1)] text-[var(--color-accent)] hover:bg-[rgba(245,197,24,0.2)] transition-all"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
