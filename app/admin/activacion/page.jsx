'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SkeletonCard } from '@/components/ui/Skeleton'

const ESTADO_CONFIG = {
  activo: { label: 'Activo', variant: 'green' },
  probando: { label: 'Probando', variant: 'yellow' },
  inactivo: { label: 'Inactivo', variant: 'red' },
}

const FILTROS = [
  { key: 'todos', label: 'Todos' },
  { key: 'hoy', label: 'Hoy' },
  { key: 'inactivos', label: 'Inactivos' },
  { key: 'activos', label: 'Activos' },
  { key: 'trial', label: 'Trial por vencer' },
]

function haceTiempo(fecha) {
  const ms = new Date().getTime() - new Date(fecha).getTime()
  const dias = Math.floor(ms / 86400000)
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  return `Hace ${dias}d`
}

/* ── LA CAMPAÑA DE FOTOS (7-10 ago 2026) ────────────────────────────────────
 *
 * Vive DENTRO de Activación y no en una sección propia. La campaña es una
 * jugada de activación —el muro del negocio es pasar el cuaderno, y esto mide
 * si el lector de cartulinas sirve para tumbarlo—, así que la pregunta es la
 * misma que ya responde esta pantalla. Y el panel tiene trece secciones: una
 * decimocuarta para tres días queda huérfana en el menú el martes.
 *
 * ⚠ CUENTA, NO ENSEÑA. Ni una foto ni un nombre de cliente. Una galería de
 * cédulas ajenas en una pantalla web recrearía justo el agujero que estas fotos
 * evitan yéndose a `/opt/cf-fotos-donadas`. Se revisan por SSH.
 *
 * Se retira sola: si no hay ni una foto y la campaña ya cerró, no pinta nada.
 */
function TiraFotosDonadas() {
  const [d, setD] = useState(null)
  useEffect(() => {
    fetch('/api/admin/fotos-donadas').then(r => r.json()).then(setD).catch(() => {})
  }, [])

  if (!d || d.error) return null
  if (!d.viva && !d.total) return null

  const pct = Math.min(100, Math.round((d.total / d.meta) * 100))
  const cierra = new Date(d.cierraEn)
  const FORMA = { cartulina: 'tarjeta por cliente', lista: 'cuaderno con lista', otro: 'otra cosa', sin_decir: 'no dijo' }

  return (
    <Card className="mb-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Fotos donadas para el lector</p>
          <p className="text-2xl font-bold text-[var(--color-text-primary)]">
            {d.total} <span className="text-sm font-normal text-[var(--color-text-muted)]">de {d.meta}</span>
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)]">
            {d.negocios.length} {d.negocios.length === 1 ? 'negocio' : 'negocios'}
            {d.ultima ? ` · última ${haceTiempo(d.ultima)}` : ''}
          </p>
        </div>
        <div className="text-right">
          <Badge variant={d.viva ? 'yellow' : 'green'}>{d.viva ? 'Abierta' : 'Cerrada'}</Badge>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
            {d.viva
              ? `Cierra ${cierra.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' })}`
              : 'Ya se retiró del panel'}
          </p>
        </div>
      </div>

      <div className="h-1.5 rounded-full mt-3 overflow-hidden" style={{ background: 'var(--color-border)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--color-accent)' }} />
      </div>

      {/* Qué forma tienen los registros: decide para qué hay que construir. */}
      {Object.keys(d.porForma).length > 0 && (
        <div className="flex gap-3 mt-3 flex-wrap">
          {Object.entries(d.porForma).map(([k, n]) => (
            <span key={k} className="text-[11px] text-[var(--color-text-muted)]">
              <strong className="text-[var(--color-text-primary)]">{n}</strong> {FORMA[k] ?? k}
            </span>
          ))}
        </div>
      )}

      {d.negocios.length > 0 && (
        <p className="text-[11px] text-[var(--color-text-muted)] mt-2">
          {d.negocios.slice(0, 6).map(n => `${n.nombre} (${n.fotos})`).join(' · ')}
          {d.negocios.length > 6 ? ` y ${d.negocios.length - 6} más` : ''}
        </p>
      )}
    </Card>
  )
}

export default function ActivacionPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')

  useEffect(() => {
    fetch('/api/admin/activacion')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="max-w-5xl mx-auto"><SkeletonCard /><SkeletonCard /></div>
  if (!data) return <p className="text-sm text-[var(--color-text-muted)] text-center py-12">Error cargando datos</p>

  const { resumen } = data
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const filtrados = data.datos.filter(u => {
    if (filtro === 'hoy') return new Date(u.createdAt) >= hoy
    if (filtro === 'inactivos') return u.estado === 'inactivo'
    if (filtro === 'activos') return u.estado === 'activo' || u.estado === 'probando'
    if (filtro === 'trial') return u.diasTrial > 0 && u.diasTrial <= 3
    return true
  })



  function whatsappLink(tel, nombre) {
    if (!tel) return null
    const num = tel.replace(/\D/g, '')
    const msg = encodeURIComponent(`Hola ${nombre}, vi que te registraste en Control Finanzas. ¿Necesitas ayuda para empezar? Te puedo guiar por WhatsApp en 2 minutos.`)
    return `https://wa.me/${num}?text=${msg}`
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-[25px] font-semibold text-[var(--color-text-primary)]">Panel de Activación</h1>
        <p className="text-xs text-[var(--color-text-muted)]">Monitorea registros, activación y trial de usuarios</p>
      </div>

      {/* Resumen cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card>
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Hoy / Ayer</p>
          <p className="text-2xl font-bold text-[var(--color-accent)]">{resumen.registrosHoy} <span className="text-sm font-normal text-[var(--color-text-muted)]">/ {resumen.registrosAyer}</span></p>
        </Card>
        <Card>
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Esta semana</p>
          <p className="text-2xl font-bold text-[var(--color-text-primary)]">{resumen.registrosSemana}</p>
        </Card>
        <Card>
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Activación</p>
          <p className="text-2xl font-bold text-[var(--color-success)]">{resumen.tasaActivacion}%</p>
          <p className="text-[10px] text-[var(--color-text-muted)]">{resumen.totalActivos} activos de {resumen.total}</p>
        </Card>
        <Card>
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Trial por vencer</p>
          <p className="text-2xl font-bold text-[var(--color-warning)]">{resumen.trialPorVencer}</p>
          <p className="text-[10px] text-[var(--color-text-muted)]">Próximos 3 días</p>
        </Card>
      </div>

      <TiraFotosDonadas />

      {/* Filtros */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {FILTROS.map(f => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
              filtro === f.key
                ? 'bg-[var(--color-accent)] text-[#1a1a2e]'
                : 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {f.label}
            {f.key === 'inactivos' && ` (${resumen.totalInactivos})`}
            {f.key === 'trial' && ` (${resumen.trialPorVencer})`}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-text-muted)]">
                <th className="text-left px-4 py-3 font-medium">Usuario</th>
                <th className="text-left px-3 py-3 font-medium hidden sm:table-cell">Registro</th>
                <th className="text-center px-3 py-3 font-medium">Clientes</th>
                <th className="text-center px-3 py-3 font-medium">Préstamos</th>
                <th className="text-center px-3 py-3 font-medium">Estado</th>
                <th className="text-center px-3 py-3 font-medium">Trial</th>
                <th className="text-right px-4 py-3 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-[var(--color-text-muted)]">Sin resultados</td></tr>
              ) : filtrados.map(u => {
                const est = ESTADO_CONFIG[u.estado] || ESTADO_CONFIG.inactivo
                const waLink = whatsappLink(u.ownerTelefono, u.ownerNombre)
                return (
                  <tr key={u.id} className="border-b border-[#1a1a1a] hover:bg-[var(--color-bg-card)] transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-[var(--color-text-primary)] truncate max-w-[180px]">{u.ownerNombre || u.orgNombre}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)] truncate max-w-[180px]">{u.ownerEmail}</p>
                    </td>
                    <td className="px-3 py-3 hidden sm:table-cell">
                      <p className="text-[var(--color-text-muted)]">{haceTiempo(u.createdAt)}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">{new Date(u.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</p>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`font-bold ${u.clientes > 0 ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>{u.clientes}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`font-bold ${u.prestamos > 0 ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>{u.prestamos}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Badge variant={est.variant}>{est.label}</Badge>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {u.diasTrial > 0 ? (
                        <span className={`text-[11px] font-bold ${u.diasTrial <= 3 ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-muted)]'}`}>
                          {u.diasTrial}d
                        </span>
                      ) : (
                        <span className="text-[10px] text-[var(--color-text-muted)]">Vencido</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {waLink && (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-[8px] bg-[var(--color-success)]/10 text-[var(--color-success)] hover:bg-[var(--color-success)]/20 transition-all"
                            title="WhatsApp"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                              <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.243-1.212l-.304-.18-2.867.852.852-2.867-.18-.304A8 8 0 1112 20z" />
                            </svg>
                          </a>
                        )}
                        <a
                          href={`/admin/organizaciones/${u.id}`}
                          className="p-1.5 rounded-[8px] bg-[rgba(245,197,24,0.1)] text-[var(--color-accent)] hover:bg-[rgba(245,197,24,0.2)] transition-all"
                          title="Ver detalle"
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
    </div>
  )
}
