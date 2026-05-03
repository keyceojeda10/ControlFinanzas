'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { formatCOP } from '@/lib/calculos'

const TIPO_LABELS = {
  capital_inicial: 'Capital inicial',
  inyeccion: 'Inyeccion',
  retiro: 'Retiro',
  desembolso: 'Prestado',
  recaudo: 'Cobrado',
  gasto: 'Gasto',
  ajuste: 'Ajuste',
}

const TIPO_COLORS = {
  capital_inicial: 'var(--color-success)',
  inyeccion: 'var(--color-success)',
  retiro: 'var(--color-danger)',
  desembolso: 'var(--color-warning)',
  recaudo: 'var(--color-info)',
  gasto: 'var(--color-danger)',
  ajuste: 'var(--color-purple)',
}

function esIngreso(tipo) {
  return ['capital_inicial', 'inyeccion', 'recaudo'].includes(tipo)
}

function esMovimientoIngreso(movimiento) {
  if (movimiento?.tipo === 'ajuste') {
    return (movimiento?.saldoNuevo ?? 0) >= (movimiento?.saldoAnterior ?? 0)
  }
  return esIngreso(movimiento?.tipo)
}

const TIPOS_MANUALES = ['capital_inicial', 'inyeccion', 'retiro', 'ajuste']

function fechaCorta(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })
}

export default function CapitalPage() {
  const { esOwner, loading: authLoading } = useAuth()
  const [resumen, setResumen] = useState(null)
  const [movimientos, setMovimientos] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMov, setLoadingMov] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [modalTipo, setModalTipo] = useState('inyeccion')
  const [modalDireccion, setModalDireccion] = useState('ingreso')
  const [modalMonto, setModalMonto] = useState('')
  const [modalDesc, setModalDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [eliminando, setEliminando] = useState(null)
  const [aplicandoSugerido, setAplicandoSugerido] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [capitalEstricto, setCapitalEstricto] = useState(false)
  const [togglingEstricto, setTogglingEstricto] = useState(false)
  const [confirmEstricto, setConfirmEstricto] = useState(null)

  const fetchResumen = useCallback(() => {
    fetch('/api/capital/resumen')
      .then(r => r.json())
      .then(d => setResumen(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const fetchConfig = useCallback(() => {
    fetch('/api/capital')
      .then(r => r.json())
      .then(d => setCapitalEstricto(!!d?.config?.capitalEstricto))
      .catch(() => {})
  }, [])

  const fetchMovimientos = useCallback(() => {
    setLoadingMov(true)
    const params = new URLSearchParams({ page, limit: 15 })
    if (filtroTipo) params.set('tipo', filtroTipo)
    fetch(`/api/capital/movimientos?${params}`)
      .then(r => r.json())
      .then(d => {
        setMovimientos(d.movimientos || [])
        setTotalPages(d.totalPages || 1)
      })
      .catch(() => {})
      .finally(() => setLoadingMov(false))
  }, [page, filtroTipo])

  useEffect(() => { fetchResumen() }, [fetchResumen])
  useEffect(() => { fetchMovimientos() }, [fetchMovimientos])
  useEffect(() => { fetchConfig() }, [fetchConfig])

  const aplicarToggleEstricto = async (nuevoValor) => {
    setTogglingEstricto(true)
    setFeedback(null)
    try {
      const res = await fetch('/api/capital', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capitalEstricto: nuevoValor }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar la configuración')
      setCapitalEstricto(!!data?.config?.capitalEstricto)
      setFeedback({
        tipo: 'ok',
        mensaje: nuevoValor
          ? 'Modo estricto activado. Ahora los préstamos requieren capital disponible.'
          : 'Modo estricto desactivado. Los préstamos ya no validan tu capital.',
      })
    } catch (err) {
      setFeedback({ tipo: 'error', mensaje: err.message })
    } finally {
      setTogglingEstricto(false)
      setConfirmEstricto(null)
    }
  }

  const handleEliminar = async (m) => {
    const label = TIPO_LABELS[m.tipo] || m.tipo
    const msg = `Eliminar ${label.toLowerCase()} de ${formatCOP(m.monto)}? Se revertirá el efecto en el saldo.`
    if (!confirm(msg)) return
    setEliminando(m.id)
    try {
      const res = await fetch(`/api/capital/movimientos/${m.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || 'No se pudo eliminar el movimiento')
        return
      }
      fetchResumen()
      fetchMovimientos()
    } finally {
      setEliminando(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const res = await fetch('/api/capital', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: modalTipo,
          direccion: modalTipo === 'ajuste' ? modalDireccion : undefined,
          monto: Number(modalMonto),
          descripcion: modalDesc,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al registrar')
      setShowModal(false)
      setModalMonto('')
      setModalDesc('')
      setModalDireccion('ingreso')
      fetchResumen()
      setPage(1)
      fetchMovimientos()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const aplicarCapitalSugerido = async () => {
    const montoSugerido = Math.round(Number(resumen?.sugerido?.saldo || 0))
    if (!Number.isFinite(montoSugerido) || montoSugerido <= 0) {
      setFeedback({
        tipo: 'error',
        mensaje: 'El capital sugerido debe ser mayor a 0 para poder aplicarlo.',
      })
      return
    }

    setAplicandoSugerido(true)
    setFeedback(null)
    try {
      const res = await fetch('/api/capital', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'capital_inicial',
          monto: montoSugerido,
          descripcion: 'Capital inicial aplicado desde capital sugerido',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo aplicar el capital sugerido')

      setFeedback({
        tipo: 'ok',
        mensaje: `Capital sugerido aplicado: ${formatCOP(montoSugerido)}.`,
      })
      fetchResumen()
      setPage(1)
      fetchMovimientos()
    } catch (err) {
      setFeedback({
        tipo: 'error',
        mensaje: err.message || 'No se pudo aplicar el capital sugerido',
      })
    } finally {
      setAplicandoSugerido(false)
    }
  }

  if (authLoading) return null
  if (!esOwner) {
    return (
      <div className="max-w-3xl mx-auto py-10 text-center">
        <p className="text-[var(--color-text-muted)]">No tienes acceso a esta seccion.</p>
      </div>
    )
  }

  const noConfigurado = resumen && !resumen.configurado
  const sugerido = resumen?.sugerido
  const saldoCapital = Math.round(Number(resumen?.saldo || 0))
  const mostrarSugerido = Boolean(sugerido) && saldoCapital === 0
  const calidadSugerida = sugerido?.calidad || 'baja'
  const colorCalidad = calidadSugerida === 'alta' ? 'var(--color-success)' : calidadSugerida === 'media' ? 'var(--color-accent)' : 'var(--color-danger)'

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Capital</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Control de tu capital disponible</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-[var(--color-accent)] text-[#1a1a2e] text-sm font-semibold rounded-[10px] hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          + Movimiento
        </button>
      </div>

      {feedback && (
        <div
          className="rounded-[12px] px-4 py-3 text-sm border"
          style={feedback.tipo === 'ok'
            ? { color: 'var(--color-success)', borderColor: 'color-mix(in srgb, var(--color-success) 25%, transparent)', background: 'var(--color-success-dim)' }
            : { color: 'var(--color-danger)', borderColor: 'color-mix(in srgb, var(--color-danger) 25%, transparent)', background: 'var(--color-danger-dim)' }}
        >
          {feedback.mensaje}
        </div>
      )}

      {/* Setup prompt if not configured */}
      {noConfigurado && (
        <div className="bg-[var(--color-bg-surface)] border border-[color-mix(in_srgb,var(--color-accent)_30%,transparent)] rounded-[16px] px-5 py-5 text-center">
          <p className="text-[var(--color-text-primary)] font-medium mb-2">Configura tu capital inicial</p>
          <p className="text-sm text-[var(--color-text-muted)] mb-2">Registra con cuanto capital empiezas para que el sistema lleve el control automaticamente.</p>
          {mostrarSugerido && (
            <p className="text-sm text-[var(--color-success)] mb-4">
              Sugerencia por historial: <span className="font-semibold font-mono-display">{formatCOP(sugerido.saldo)}</span>
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {mostrarSugerido && (
              <button
                onClick={aplicarCapitalSugerido}
                disabled={aplicandoSugerido || Number(sugerido?.saldo || 0) <= 0}
                className="px-5 py-2.5 bg-[var(--color-success)] text-[#0a1f14] text-sm font-semibold rounded-[10px] hover:bg-[color-mix(in_srgb,var(--color-success)_85%,black)] disabled:opacity-50 transition-colors"
              >
                {aplicandoSugerido ? 'Aplicando...' : 'Aplicar capital sugerido'}
              </button>
            )}
            <button
              onClick={() => { setModalTipo('capital_inicial'); setShowModal(true) }}
              className="px-5 py-2.5 bg-[var(--color-accent)] text-[#1a1a2e] text-sm font-semibold rounded-[10px] hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              Registrar capital inicial
            </button>
          </div>
        </div>
      )}

      {/* HERO CARD: Saldo del capital */}
      {resumen?.configurado && (() => {
        const heroColor = resumen.saldo >= 0 ? '#06b6d4' : '#ef4444'
        return (
          <div
            className="relative rounded-[20px] overflow-hidden"
            style={{
              background: `linear-gradient(135deg, color-mix(in srgb, ${heroColor} 14%, var(--color-bg-card)) 0%, var(--color-bg-card) 50%, color-mix(in srgb, ${heroColor} 8%, var(--color-bg-card)) 100%)`,
              border: `1px solid color-mix(in srgb, ${heroColor} 25%, var(--color-border))`,
              boxShadow: `0 8px 32px color-mix(in srgb, ${heroColor} 18%, transparent)`,
            }}
          >
            <div className="hero-glow absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
              style={{ background: `radial-gradient(circle, color-mix(in srgb, ${heroColor} 35%, transparent), transparent 70%)`, filter: 'blur(20px)' }} />
            <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
              style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '16px 16px', color: heroColor }} />

            <div className="relative px-5 py-5 sm:px-6 sm:py-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: heroColor, boxShadow: `0 0 12px ${heroColor}` }} />
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--color-text-secondary)' }}>
                  Saldo del capital
                </p>
              </div>
              <p
                className="font-mono-display font-bold leading-none tracking-tight"
                style={{
                  color: resumen.saldo >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                  fontSize: 'clamp(36px, 10vw, 52px)',
                  textShadow: `0 0 30px color-mix(in srgb, ${resumen.saldo >= 0 ? 'var(--color-success)' : 'var(--color-danger)'} 25%, transparent)`,
                }}
              >
                {formatCOP(resumen.saldo)}
              </p>
              {resumen.saldo < 0 && (
                <p className="text-[12px] mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-full font-medium" style={{ background: 'rgba(239, 68, 68, 0.12)', color: 'var(--color-danger)' }}>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                  Capital en negativo
                </p>
              )}
            </div>
          </div>
        )
      })()}

      {/* Configuración: modo estricto */}
      {resumen?.configurado && (
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[16px] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">Modo estricto</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {capitalEstricto
                  ? 'Activado: no podrás crear préstamos si no tienes capital suficiente. El sistema te pedirá inyectar el faltante.'
                  : 'Desactivado: puedes crear préstamos aunque no tengas capital (tu saldo puede quedar en negativo).'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmEstricto(capitalEstricto ? 'desactivar' : 'activar')}
              disabled={togglingEstricto}
              className={`px-3 py-1.5 text-xs font-semibold rounded-[10px] transition-colors ${
                capitalEstricto
                  ? 'bg-[var(--color-success-dim)] text-[var(--color-success)] border border-[color-mix(in_srgb,var(--color-success)_30%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-success)_25%,transparent)]'
                  : 'bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]'
              }`}
            >
              {capitalEstricto ? 'Activo' : 'Inactivo'}
            </button>
          </div>
        </div>
      )}

      {confirmEstricto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[16px] w-full max-w-md p-5">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">
              {confirmEstricto === 'activar' ? 'Activar modo estricto' : 'Desactivar modo estricto'}
            </h3>
            {confirmEstricto === 'activar' ? (
              <div className="text-sm text-[var(--color-text-primary)] space-y-2">
                <p>Al activar este modo:</p>
                <ul className="list-disc pl-5 space-y-1 text-[var(--color-text-secondary)]">
                  <li>No podrás crear préstamos si no tienes capital suficiente en el sistema.</li>
                  <li>Cuando falte capital, se abrirá un aviso para que inyectes el dinero que hace falta.</li>
                  <li>Tu saldo de capital nunca quedará en negativo.</li>
                  <li>Deberás registrar cada entrada de dinero externo (inyección) para seguir prestando.</li>
                </ul>
                <p className="text-[var(--color-accent)] mt-3">
                  Recomendado si quieres llevar un control real del dinero disponible en caja.
                </p>
              </div>
            ) : (
              <div className="text-sm text-[var(--color-text-primary)] space-y-2">
                <p>Al desactivar este modo:</p>
                <ul className="list-disc pl-5 space-y-1 text-[var(--color-text-secondary)]">
                  <li>Podrás crear préstamos aunque no tengas capital registrado.</li>
                  <li>Tu saldo de capital puede quedar en negativo sin advertencia.</li>
                  <li>No se te pedirá inyectar dinero antes de desembolsar.</li>
                </ul>
                <p className="text-[var(--color-danger)] mt-3">
                  Úsalo solo si aún no quieres llevar control estricto de capital.
                </p>
              </div>
            )}
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => setConfirmEstricto(null)}
                disabled={togglingEstricto}
                className="flex-1 px-4 py-2 bg-[var(--color-bg-hover)] text-[var(--color-text-primary)] text-sm font-semibold rounded-[10px] hover:bg-[var(--color-bg-hover)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => aplicarToggleEstricto(confirmEstricto === 'activar')}
                disabled={togglingEstricto}
                className={`flex-1 px-4 py-2 text-sm font-semibold rounded-[10px] disabled:opacity-50 ${
                  confirmEstricto === 'activar'
                    ? 'bg-[var(--color-success)] text-[#0a1f14] hover:bg-[color-mix(in_srgb,var(--color-success)_85%,black)]'
                    : 'bg-[var(--color-danger)] text-[var(--color-text-primary)] hover:bg-[color-mix(in_srgb,var(--color-danger)_85%,black)]'
                }`}
              >
                {togglingEstricto ? 'Aplicando...' : (confirmEstricto === 'activar' ? 'Activar' : 'Desactivar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarSugerido && (
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[16px] px-5 py-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wide">Capital sugerido</p>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${colorCalidad}22`, color: colorCalidad }}>
              Calidad {calidadSugerida}
            </span>
          </div>
          <p className="text-2xl font-bold font-mono-display text-[var(--color-accent)]">{formatCOP(sugerido.saldo)}</p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">Tu saldo está en cero. Puedes aplicarlo como capital inicial con un clic.</p>
          <button
            type="button"
            onClick={aplicarCapitalSugerido}
            disabled={aplicandoSugerido || Number(sugerido?.saldo || 0) <= 0}
            className="mt-3 px-4 py-2 bg-[var(--color-success)] text-[#0a1f14] text-sm font-semibold rounded-[10px] hover:bg-[color-mix(in_srgb,var(--color-success)_85%,black)] disabled:opacity-50 transition-colors"
          >
            {aplicandoSugerido ? 'Aplicando...' : 'Aplicar como saldo del capital'}
          </button>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-2">
            Esta sugerencia se calcula desde historial de préstamos, cobros, gastos y movimientos manuales. No modifica tu saldo automáticamente.
          </p>
        </div>
      )}

      {/* Stats del mes — cards premium con iconos circulares */}
      {resumen?.mes && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: 'Prestado',
              value: formatCOP(resumen.mes.desembolsado),
              sub: `${resumen.mes.prestamosOtorgados} préstamos`,
              color: '#f97316',
              icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0l3-3m-3 3V2.25" /></svg>,
            },
            {
              label: 'Cobrado',
              value: formatCOP(resumen.mes.recaudado),
              sub: `${resumen.mes.pagosRecibidos} pagos`,
              color: '#22c55e',
              icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15m-6 6l3-3m0 0l3 3m-3-3v6.75" /></svg>,
            },
            {
              label: 'Gastos',
              value: formatCOP(resumen.mes.gastos),
              sub: 'del mes',
              color: '#ef4444',
              icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25M6.75 12h.008v.008H6.75V12z" /></svg>,
            },
          ].map((s, i) => (
            <div
              key={i}
              className="rounded-[16px] px-4 py-3 transition-all kpi-lift"
              style={{
                background: `linear-gradient(135deg, color-mix(in srgb, ${s.color} 8%, var(--color-bg-card)) 0%, var(--color-bg-card) 100%)`,
                border: `1px solid color-mix(in srgb, ${s.color} 22%, var(--color-border))`,
              }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-5 h-5 rounded-[6px] flex items-center justify-center" style={{ background: `color-mix(in srgb, ${s.color} 18%, transparent)`, color: s.color }}>
                  <span className="w-3 h-3">{s.icon}</span>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: s.color }}>{s.label}</p>
              </div>
              <p className="text-[16px] font-bold font-mono-display leading-tight" style={{ color: 'var(--color-text-primary)' }}>{s.value}</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{s.sub}</p>
            </div>
          ))}
          {(() => {
            const flujo = resumen.mes.flujoNeto ?? 0
            const balanceColor = flujo >= 0 ? '#22c55e' : '#ef4444'
            return (
              <div
                className="rounded-[16px] px-4 py-3 transition-all kpi-lift"
                style={{
                  background: `linear-gradient(135deg, color-mix(in srgb, ${balanceColor} 8%, var(--color-bg-card)) 0%, var(--color-bg-card) 100%)`,
                  border: `1px solid color-mix(in srgb, ${balanceColor} 22%, var(--color-border))`,
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-5 h-5 rounded-[6px] flex items-center justify-center" style={{ background: `color-mix(in srgb, ${balanceColor} 18%, transparent)`, color: balanceColor }}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941" />
                    </svg>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: balanceColor }}>Balance neto</p>
                </div>
                <p className="text-[16px] font-bold font-mono-display leading-tight" style={{ color: balanceColor }}>
                  {flujo >= 0 ? '+' : ''}{formatCOP(flujo)}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Cobrado − Prestado − Gastos</p>
              </div>
            )
          })()}
        </div>
      )}

      {/* Historial de movimientos */}
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[16px] px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Movimientos</p>
          <select
            value={filtroTipo}
            onChange={(e) => { setFiltroTipo(e.target.value); setPage(1) }}
            className="text-xs bg-[var(--color-bg-base)] border border-[var(--color-border)] text-[var(--color-text-muted)] rounded-lg px-2 py-1"
          >
            <option value="">Todos</option>
            <option value="capital_inicial">Capital inicial</option>
            <option value="inyeccion">Inyecciones</option>
            <option value="retiro">Retiros</option>
            <option value="desembolso">Prestados</option>
            <option value="recaudo">Cobrados</option>
            <option value="gasto">Gastos</option>
            <option value="ajuste">Ajustes</option>
          </select>
        </div>

        {loadingMov ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse bg-[var(--color-bg-hover)] rounded-[10px] h-14" />
            ))}
          </div>
        ) : movimientos.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-6">No hay movimientos registrados</p>
        ) : (
          <div className="space-y-0 divide-y divide-[var(--color-border)]">
            {movimientos.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                      style={{ background: `${TIPO_COLORS[m.tipo]}20`, color: TIPO_COLORS[m.tipo] }}
                    >
                      {TIPO_LABELS[m.tipo] || m.tipo}
                    </span>
                  </div>
                  {m.descripcion && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">{m.descripcion}</p>
                  )}
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{fechaCorta(m.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <div className="text-right">
                    <p className={`text-sm font-bold ${esMovimientoIngreso(m) ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                      {esMovimientoIngreso(m) ? '+' : '-'}{formatCOP(m.monto)}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">Saldo: {formatCOP(m.saldoNuevo)}</p>
                  </div>
                  {TIPOS_MANUALES.includes(m.tipo) && (
                    <button
                      type="button"
                      onClick={() => handleEliminar(m)}
                      disabled={eliminando === m.id}
                      title="Eliminar movimiento"
                      className="w-7 h-7 flex items-center justify-center rounded-[8px] text-[var(--color-danger)] hover:bg-[var(--color-danger-dim)] disabled:opacity-50 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Paginacion */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-4 pt-3 border-t border-[var(--color-border)]">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="text-xs text-[var(--color-text-muted)]">{page} / {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>

      {/* Modal registrar movimiento */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[16px] w-full max-w-md p-5">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-4">Registrar movimiento</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Tipo</label>
                <select
                  value={modalTipo}
                  onChange={(e) => setModalTipo(e.target.value)}
                  className="w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-[10px] px-3 py-2.5 text-sm"
                >
                  <option value="capital_inicial">Capital inicial</option>
                  <option value="inyeccion">Inyectar capital</option>
                  <option value="retiro">Retirar capital</option>
                  <option value="ajuste">Ajuste manual</option>
                </select>
              </div>
              {modalTipo === 'ajuste' && (
                <div>
                  <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Direccion del ajuste</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setModalDireccion('ingreso')}
                      className={[
                        'h-10 rounded-[10px] border text-sm font-semibold transition-all',
                        modalDireccion === 'ingreso'
                          ? 'bg-[var(--color-success-dim)] border-[color-mix(in_srgb,var(--color-success)_35%,transparent)] text-[var(--color-success)]'
                          : 'bg-[var(--color-bg-base)] border-[var(--color-border)] text-[var(--color-text-muted)]',
                      ].join(' ')}
                    >
                      Entrada
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalDireccion('egreso')}
                      className={[
                        'h-10 rounded-[10px] border text-sm font-semibold transition-all',
                        modalDireccion === 'egreso'
                          ? 'bg-[var(--color-danger-dim)] border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)] text-[var(--color-danger)]'
                          : 'bg-[var(--color-bg-base)] border-[var(--color-border)] text-[var(--color-text-muted)]',
                      ].join(' ')}
                    >
                      Salida
                    </button>
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Monto</label>
                <input
                  type="number"
                  value={modalMonto}
                  onChange={(e) => setModalMonto(e.target.value)}
                  placeholder="0"
                  min="1"
                  required
                  className="w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-[10px] px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Descripción (opcional)</label>
                <input
                  type="text"
                  value={modalDesc}
                  onChange={(e) => setModalDesc(e.target.value)}
                  placeholder="Ej: Capital para iniciar el mes"
                  className="w-full bg-[var(--color-bg-base)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-[10px] px-3 py-2.5 text-sm"
                />
              </div>
              {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setError(''); setModalDireccion('ingreso') }}
                  className="flex-1 px-4 py-2.5 border border-[var(--color-border)] text-[var(--color-text-muted)] rounded-[10px] text-sm hover:bg-[var(--color-bg-hover)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-[var(--color-accent)] text-[#1a1a2e] font-semibold rounded-[10px] text-sm hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
