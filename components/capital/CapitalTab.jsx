'use client'
import { useState, useEffect, useCallback } from 'react'
import { useCountry } from '@/hooks/useCountry'
import { AntesDespues } from '@/components/cf/primitivos'
import MoneyInput from '@/components/ui/MoneyInput'
import { porQueNegativa, esAlarma } from '@/lib/dinero/ruta-negativa'

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
  capital_inicial: 'var(--cf-green-dark)',
  inyeccion: 'var(--cf-green-dark)',
  retiro: 'var(--cf-red-dark)',
  desembolso: 'var(--cf-gold-dark)',
  recaudo: 'var(--cf-ink-2)',
  gasto: 'var(--cf-red-dark)',
  ajuste: 'var(--cf-ink-2)',
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
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Bogota',
  })
}

export default function CapitalTab() {
  const { formatMoney } = useCountry()
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
  const [porRuta, setPorRuta] = useState([])
  const [modalRutaId, setModalRutaId] = useState('') // '' = general (sin ruta)
  const [modalAbsorber, setModalAbsorber] = useState(false) // descontar prestamos activos al inyectar a ruta
  const [editMov, setEditMov] = useState(null)   // movimiento en edicion { id, monto, descripcion, tipo }
  const [editMonto, setEditMonto] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

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
      .then(d => {
        setCapitalEstricto(!!d?.config?.capitalEstricto)
        setPorRuta(Array.isArray(d?.porRuta) ? d.porRuta : [])
      })
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
    const msg = `Eliminar ${label.toLowerCase()} de ${formatMoney(m.monto)}? Se revertirá el efecto en el saldo.`
    if (!confirm(msg)) return
    setEliminando(m.id)
    try {
      const res = await fetch(`/api/capital/movimientos/${m.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { alert(data.error || 'No se pudo eliminar el movimiento'); return }
      fetchResumen()
      fetchMovimientos()
    } finally {
      setEliminando(null)
    }
  }

  const abrirEditar = (m) => {
    setEditMov(m)
    setEditMonto(String(Math.round(m.monto || 0)))
    setEditDesc(m.descripcion || '')
    setEditError('')
  }

  const guardarEditar = async (e) => {
    e.preventDefault()
    if (!editMov) return
    const monto = Number(editMonto)
    if (!Number.isFinite(monto) || monto <= 0) { setEditError('Ingresa un monto válido'); return }
    setEditSaving(true)
    setEditError('')
    try {
      const res = await fetch(`/api/capital/movimientos/${editMov.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto, descripcion: editDesc }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setEditError(data.error || 'No se pudo editar'); return }
      setEditMov(null)
      fetchResumen()
      fetchConfig()
      fetchMovimientos()
    } finally {
      setEditSaving(false)
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
          ...(modalRutaId && { rutaId: modalRutaId }),
          ...(modalRutaId && modalTipo === 'inyeccion' && modalAbsorber && { absorberActivos: true }),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al registrar')
      setShowModal(false)
      setModalMonto('')
      setModalDesc('')
      setModalDireccion('ingreso')
      setModalRutaId('')
      setModalAbsorber(false)
      fetchResumen()
      fetchConfig()
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
      setFeedback({ tipo: 'error', mensaje: 'El capital sugerido debe ser mayor a 0 para poder aplicarlo.' })
      return
    }
    setAplicandoSugerido(true)
    setFeedback(null)
    try {
      const res = await fetch('/api/capital', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'capital_inicial', monto: montoSugerido, descripcion: 'Capital inicial aplicado desde capital sugerido' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo aplicar el capital sugerido')
      setFeedback({ tipo: 'ok', mensaje: `Capital sugerido aplicado: ${formatMoney(montoSugerido)}.` })
      fetchResumen()
      setPage(1)
      fetchMovimientos()
    } catch (err) {
      setFeedback({ tipo: 'error', mensaje: err.message || 'No se pudo aplicar el capital sugerido' })
    } finally {
      setAplicandoSugerido(false)
    }
  }

  const abrirMovimientoRuta = (rutaId, tipo) => {
    setModalTipo(tipo)
    setModalRutaId(rutaId)
    setModalDireccion('ingreso')
    setError('')
    setShowModal(true)
  }

  if (loading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="animate-pulse bg-[var(--cf-fill)] rounded-[16px] h-20" />)}</div>

  const noConfigurado = resumen && !resumen.configurado
  const sugerido = resumen?.sugerido
  const saldoCapital = Math.round(Number(resumen?.saldo || 0))
  const mostrarSugerido = Boolean(sugerido) && saldoCapital === 0
  const calidadSugerida = sugerido?.calidad || 'baja'
  const colorCalidad = calidadSugerida === 'alta' ? 'var(--cf-green-dark)' : calidadSugerida === 'media' ? 'var(--cf-gold)' : 'var(--cf-red-dark)'

  // ── «TODA TU PLATA» (T30-01) ──
  // El pie de la lámina lo llama «el error de fondo»: la pantalla enseñaba solo
  // lo que hay en caja, y el prestamista concluía que su negocio valía eso.
  // Su plata es la suma de las dos: lo que tiene listo MÁS lo que está en la
  // calle cobrándose. `capitalEnCalle` ya venía del endpoint
  // (`/api/capital/resumen`), solo que no se pintaba en ninguna parte.
  const enCalle = Math.round(Number(resumen?.cartera?.capitalEnCalle || 0))
  const todaLaPlata = saldoCapital + enCalle
  const pctListo = todaLaPlata > 0 ? Math.max(2, Math.round((saldoCapital / todaLaPlata) * 100)) : 0

  return (
    <div className="space-y-5">
      {/* ── TODA TU PLATA (T30-01) ── */}
      {todaLaPlata > 0 && (
        <div className="rounded-[16px] p-4" style={{ background: 'var(--cf-ink)', color: 'var(--cf-surface)' }}>
          <span className="text-[10px] font-bold uppercase tracking-[.09em]" style={{ opacity: .65 }}>
            Toda tu plata
          </span>
          <p className="cf-fig mt-1 mb-3" style={{ fontSize: 30, letterSpacing: '-.03em' }}>
            {formatMoney(todaLaPlata)}
          </p>
          {/* La barra parte el total en sus dos mitades: sin ella, dos cifras
              sueltas no dicen cuál pesa más. */}
          <div className="h-[7px] rounded-full overflow-hidden flex" style={{ background: 'rgba(255,255,255,.14)' }}>
            <span style={{ width: `${pctListo}%`, background: 'var(--cf-green)' }} />
            <span style={{ flex: 1, background: 'var(--cf-gold)' }} />
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] flex items-center gap-2" style={{ opacity: .8 }}>
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--cf-green)' }} />
                Lista para prestar
              </span>
              <span className="cf-fig text-[13.5px] font-bold">{formatMoney(saldoCapital)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] flex items-center gap-2" style={{ opacity: .8 }}>
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--cf-gold)' }} />
                En la calle, cobrándose
              </span>
              <span className="cf-fig text-[13.5px] font-bold" style={{ color: 'var(--cf-gold)' }}>
                {formatMoney(enCalle)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── T31-01 · LAS DOS ENTRADAS, SEPARADAS ──
          «Registrar movimiento» es lo de cada semana y va en dorado. «Cuadrar
          el saldo» —el antiguo «ajuste manual»— sale del desplegable y tiene su
          propia entrada, en gris y con su explicacion: reescribe el saldo sin
          que haya entrado ni salido plata, y eso no es un movimiento mas. */}
      <div className="flex justify-end items-center gap-2">
        <button
          type="button"
          onClick={() => { setModalTipo('ajuste'); setShowModal(true) }}
          title="Corrige el saldo cuando el real no coincide con el de la app. Queda registrado quién lo hizo y por qué."
          className="px-4 py-2 text-sm font-semibold rounded-[10px] transition-colors"
          style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)', color: 'var(--cf-ink-2)' }}
        >
          Cuadrar el saldo
        </button>
        <button
          onClick={() => { setModalTipo('inyeccion'); setShowModal(true) }}
          className="px-4 py-2 bg-[var(--cf-gold)] text-[var(--cf-gold-ink)] text-sm font-semibold rounded-[10px] hover:opacity-90 transition-opacity"
        >
          Registrar movimiento
        </button>
      </div>

      {feedback && (
        <div
          className="rounded-[12px] px-4 py-3 text-sm border"
          style={feedback.tipo === 'ok'
            ? { color: 'var(--cf-green-dark)', borderColor: 'var(--cf-green)', background: 'var(--cf-green-pill-bg)' }
            : { color: 'var(--cf-red-dark)', borderColor: 'var(--cf-red-border)', background: 'var(--cf-red-pill-bg)' }}
        >
          {feedback.mensaje}
        </div>
      )}

      {noConfigurado && (
        <div className="bg-[var(--cf-surface)] border border-[var(--cf-border-strong)] rounded-[16px] px-5 py-5 text-center">
          <p className="text-[var(--cf-ink)] font-medium mb-2">Configura tu capital inicial</p>
          <p className="text-sm text-[var(--cf-ink-3)] mb-2">Registra con cuanto capital empiezas para que el sistema lleve el control automáticamente.</p>
          {mostrarSugerido && (
            <p className="text-sm text-[var(--cf-green-dark)] mb-4">
              Sugerencia por historial: <span className="font-semibold font-mono-display">{formatMoney(sugerido.saldo)}</span>
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {mostrarSugerido && (
              <button
                onClick={aplicarCapitalSugerido}
                disabled={aplicandoSugerido || Number(sugerido?.saldo || 0) <= 0}
                className="px-5 py-2.5 bg-[var(--cf-green-dark)] text-[#0a1f14] text-sm font-semibold rounded-[10px] disabled:opacity-50 transition-colors"
              >
                {aplicandoSugerido ? 'Aplicando...' : 'Aplicar capital sugerido'}
              </button>
            )}
            <button
              onClick={() => { setModalTipo('capital_inicial'); setShowModal(true) }}
              className="px-5 py-2.5 bg-[var(--cf-gold)] text-[var(--cf-ink)] text-sm font-semibold rounded-[10px] hover:bg-[var(--cf-gold-dark)] transition-colors"
            >
              Registrar capital inicial
            </button>
          </div>
        </div>
      )}

      {resumen?.configurado && (() => {
        const heroColor = resumen.saldo >= 0 ? 'var(--cf-ink-2)' : 'var(--cf-red-dark)'
        return (
          <div
            className="cf-hero-card relative rounded-[20px] overflow-hidden"
            style={{
              background: `var(--cf-card)`,
              border: `1px solid color-mix(in srgb, ${heroColor} 25%, transparent)`,
              boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            }}
          >
            <div className="hero-glow absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
              style={{ background: `radial-gradient(circle, color-mix(in srgb, ${heroColor} 35%, transparent), transparent 70%)`, filter: 'blur(20px)' }} />
            <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
              style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '16px 16px', color: heroColor }} />
            <div className="relative px-5 py-5 sm:px-6 sm:py-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: heroColor, boxShadow: `0 0 5px ${heroColor}` }} />
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--cf-ink-2)' }}>Saldo del capital</p>
              </div>
              <p
                className="font-mono-display font-bold leading-none tracking-tight"
                style={{
                  color: resumen.saldo >= 0 ? 'var(--cf-green-dark)' : 'var(--cf-red-dark)',
                  fontSize: 'clamp(36px, 10vw, 52px)',
                  textShadow: 'none',
                }}
              >
                {formatMoney(resumen.saldo)}
              </p>
              {resumen.saldo < 0 && (
                <p className="text-[12px] mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-full font-medium" style={{ background: 'rgba(239, 68, 68, 0.12)', color: 'var(--cf-red-dark)' }}>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                  Capital en negativo
                </p>
              )}
            </div>
          </div>
        )
      })()}

      {resumen?.configurado && resumen.cartera && (
        <div className="rounded-[16px] px-4 py-4"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--cf-ink-2) 8%, var(--cf-card)) 0%, var(--cf-card) 100%)',
            border: '1px solid color-mix(in srgb, var(--cf-ink-2) 22%, var(--cf-border))',
          }}
        >
          <div className="flex items-center gap-1.5 mb-3">
            <div className="w-5 h-5 rounded-[6px] flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--cf-ink-2) 18%, transparent)', color: 'var(--cf-ink-2)' }}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-[.07em]" style={{ color: 'var(--cf-ink-2)' }}>Dinero en la calle</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>Capital prestado</p>
              <p className="text-lg font-bold font-mono-display" style={{ color: 'var(--cf-ink)' }}>{formatMoney(resumen.cartera.capitalEnCalle)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>Por cobrar (cartera)</p>
              <p className="text-lg font-bold font-mono-display" style={{ color: 'var(--cf-ink-2)' }}>{formatMoney(resumen.cartera.total)}</p>
            </div>
          </div>
          <p className="text-[10px] mt-2" style={{ color: 'var(--cf-ink-3)' }}>
            {resumen.cartera.prestamosActivos} préstamos activos en todas las rutas
            {resumen.cartera.sinRuta > 0 && (
              <span className="block mt-1" style={{ color: 'var(--cf-gold-dark)' }}>
                {formatMoney(resumen.cartera.sinRuta)} en {resumen.cartera.prestamosSinRuta} préstamo{resumen.cartera.prestamosSinRuta !== 1 ? 's' : ''} de clientes sin ruta asignada
              </span>
            )}
          </p>
        </div>
      )}

      {resumen?.configurado && (
        <div className="bg-[var(--cf-surface)] border border-[var(--cf-border)] rounded-[16px] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--cf-ink)]">Modo estricto</p>
              <p className="text-xs text-[var(--cf-ink-3)] mt-1">
                {capitalEstricto
                  ? 'Activado: no podrás crear préstamos si no tienes capital suficiente.'
                  : 'Desactivado: puedes crear préstamos aunque no tengas capital (saldo puede quedar negativo).'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmEstricto(capitalEstricto ? 'desactivar' : 'activar')}
              disabled={togglingEstricto}
              className={`px-3 py-1.5 text-xs font-semibold rounded-[10px] transition-colors ${
                capitalEstricto
                  ? 'bg-[var(--cf-green-pill-bg)] text-[var(--cf-green-dark)] border border-[var(--cf-green)]'
                  : 'bg-[var(--cf-fill)] text-[var(--cf-ink-3)] border border-[var(--cf-border)]'
              }`}
            >
              {capitalEstricto ? 'Activo' : 'Inactivo'}
            </button>
          </div>
        </div>
      )}

      {confirmEstricto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="bg-[var(--cf-surface)] border border-[var(--cf-border)] rounded-[16px] w-full max-w-md p-5">
            <h3 className="text-base font-semibold text-[var(--cf-ink)] mb-2">
              {confirmEstricto === 'activar' ? 'Activar modo estricto' : 'Desactivar modo estricto'}
            </h3>
            {confirmEstricto === 'activar' ? (
              <div className="text-sm text-[var(--cf-ink)] space-y-2">
                <p>Al activar este modo:</p>
                <ul className="list-disc pl-5 space-y-1 text-[var(--cf-ink-2)]">
                  <li>No podrás crear préstamos si no tienes capital suficiente.</li>
                  <li>Cuando falte capital, se abrirá un aviso para inyectar el faltante.</li>
                  <li>Tu saldo de capital nunca quedará en negativo.</li>
                </ul>
              </div>
            ) : (
              <div className="text-sm text-[var(--cf-ink)] space-y-2">
                <p>Al desactivar este modo:</p>
                <ul className="list-disc pl-5 space-y-1 text-[var(--cf-ink-2)]">
                  <li>Podrás crear préstamos aunque no tengas capital registrado.</li>
                  <li>Tu saldo de capital puede quedar en negativo sin advertencia.</li>
                </ul>
              </div>
            )}
            <div className="flex gap-2 mt-5">
              <button type="button" onClick={() => setConfirmEstricto(null)} disabled={togglingEstricto}
                className="flex-1 px-4 py-2 bg-[var(--cf-fill)] text-[var(--cf-ink)] text-sm font-semibold rounded-[10px]">
                Cancelar
              </button>
              <button type="button" onClick={() => aplicarToggleEstricto(confirmEstricto === 'activar')} disabled={togglingEstricto}
                className={`flex-1 px-4 py-2 text-sm font-semibold rounded-[10px] disabled:opacity-50 ${
                  confirmEstricto === 'activar'
                    ? 'bg-[var(--cf-green-dark)] text-[#0a1f14]'
                    : 'bg-[var(--cf-red-dark)] text-[var(--cf-ink)]'
                }`}>
                {togglingEstricto ? 'Aplicando...' : (confirmEstricto === 'activar' ? 'Activar' : 'Desactivar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarSugerido && (
        <div className="bg-[var(--cf-surface)] border border-[var(--cf-border)] rounded-[16px] px-5 py-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-[11px] text-[var(--cf-ink-3)] uppercase tracking-wide">Capital sugerido</p>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `color-mix(in srgb, ${colorCalidad} 13%, transparent)`, color: colorCalidad }}>
              Calidad {calidadSugerida}
            </span>
          </div>
          <p className="text-2xl font-bold font-mono-display text-[var(--cf-gold)]">{formatMoney(sugerido.saldo)}</p>
          <p className="text-[11px] text-[var(--cf-ink-3)] mt-1">Tu saldo está en cero. Puedes aplicarlo como capital inicial con un clic.</p>
          <button type="button" onClick={aplicarCapitalSugerido}
            disabled={aplicandoSugerido || Number(sugerido?.saldo || 0) <= 0}
            className="mt-3 px-4 py-2 bg-[var(--cf-green-dark)] text-[#0a1f14] text-sm font-semibold rounded-[10px] disabled:opacity-50 transition-colors">
            {aplicandoSugerido ? 'Aplicando...' : 'Aplicar como saldo del capital'}
          </button>
        </div>
      )}

      {resumen?.mes && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Prestado', value: formatMoney(resumen.mes.desembolsado), sub: `${resumen.mes.prestamosOtorgados} préstamos`, color: 'var(--cf-gold-dark)',
              icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0l3-3m-3 3V2.25" /></svg> },
            { label: 'Cobrado', value: formatMoney(resumen.mes.recaudado), sub: `${resumen.mes.pagosRecibidos} pagos`, color: 'var(--cf-green-dark)',
              icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15m-6 6l3-3m0 0l3 3m-3-3v6.75" /></svg> },
            { label: 'Gastos', value: formatMoney(resumen.mes.gastos), sub: 'del mes', color: 'var(--cf-red-dark)',
              icon: <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25M6.75 12h.008v.008H6.75V12z" /></svg> },
          ].map((s, i) => (
            <div key={i} className="rounded-[16px] px-4 py-3 kpi-lift"
              style={{ background: `var(--cf-card)`, border: `1px solid color-mix(in srgb, ${s.color} 22%, transparent)` }}>
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-5 h-5 rounded-[6px] flex items-center justify-center" style={{ background: `color-mix(in srgb, ${s.color} 18%, transparent)`, color: s.color }}>
                  <span className="w-3 h-3">{s.icon}</span>
                </div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.07em]" style={{ color: s.color }}>{s.label}</p>
              </div>
              <p className="text-[16px] font-bold font-mono-display leading-tight" style={{ color: 'var(--cf-ink)' }}>{s.value}</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>{s.sub}</p>
            </div>
          ))}
          {(() => {
            const flujo = resumen.mes.flujoNeto ?? 0
            const balanceColor = flujo >= 0 ? 'var(--cf-green-dark)' : 'var(--cf-red-dark)'
            return (
              <div className="rounded-[16px] px-4 py-3 kpi-lift"
                style={{ background: `var(--cf-card)`, border: `1px solid color-mix(in srgb, ${balanceColor} 22%, transparent)` }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-5 h-5 rounded-[6px] flex items-center justify-center" style={{ background: `color-mix(in srgb, ${balanceColor} 18%, transparent)`, color: balanceColor }}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941" />
                    </svg>
                  </div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[.07em]" style={{ color: balanceColor }}>Balance neto</p>
                </div>
                <p className="text-[16px] font-bold font-mono-display leading-tight" style={{ color: balanceColor }}>
                  {flujo >= 0 ? '+' : ''}{formatMoney(flujo)}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>Cobrado − Prestado − Gastos</p>
              </div>
            )
          })()}
        </div>
      )}

      {/* Capital por ruta — sub-bolsas individuales (solo rutas con capital habilitado) */}
      {porRuta.filter(r => r.capitalHabilitado).length > 0 && (
        <div className="bg-[var(--cf-surface)] border border-[var(--cf-border)] rounded-[16px] px-4 py-4">
          <p className="text-xs font-semibold text-[var(--cf-ink-3)] uppercase tracking-wide mb-3">Capital por ruta</p>
          <div className="space-y-2.5">
            {porRuta.filter(r => r.capitalHabilitado).map((r) => (
              <div key={r.rutaId} className="rounded-[12px] border border-[var(--cf-border)] p-3" style={{ background: 'var(--cf-card)' }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--cf-ink)' }}>{r.nombre}</p>
                    {r.cobrador && <p className="text-[10px] truncate" style={{ color: 'var(--cf-ink-3)' }}>{r.cobrador}</p>}
                  </div>
                  {/* ⚠ EL ROJO ES PARA LO QUE VA MAL, y un negativo casi nunca
                      lo está. Medido sobre las 28 rutas en negativo: 14 es el
                      ajuste de arranque, 12 nunca recibieron capital y SOLO 3
                      son sobregiro de verdad. Pintar las 28 igual es lo que
                      hace que el dueño no distinga las 3 que sí importan. */}
                  <p className="text-base font-bold font-mono-display shrink-0"
                     style={{ color: r.saldoCapital >= 0 ? 'var(--cf-ink-2)'
                       : esAlarma(r) ? 'var(--cf-red-dark)' : 'var(--cf-ink-3)' }}>
                    {formatMoney(r.saldoCapital)}
                  </p>
                </div>

                {/* POR QUÉ ESTÁ EN NEGATIVO.
                    Antes salía la cifra en rojo y nada más: el dueño lee que le
                    falta plata, y no falta —el libro cuadra—. Sin la causa no
                    puede hacer nada con el número; con ella, dos de los tres
                    casos se arreglan registrando un dato. */}
                {(() => {
                  const porQue = porQueNegativa(r)
                  if (!porQue) return null
                  const alarma = porQue.causa === 'sobregiro'
                  return (
                    <div className="mt-2 rounded-[10px] px-2.5 py-2" style={{
                      background: alarma ? 'var(--cf-red-bg)' : 'var(--cf-fill)',
                      border: `1px solid ${alarma ? 'var(--cf-red-border)' : 'var(--cf-border)'}`,
                    }}>
                      <p className="text-[11px] font-bold" style={{
                        color: alarma ? 'var(--cf-red-dark)' : 'var(--cf-ink-2)',
                      }}>{porQue.titulo}</p>
                      <p className="text-[10.5px] leading-snug mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>
                        {porQue.detalle}
                        {porQue.sinEso != null && (
                          <> Sin ese descuento tendría <span className="font-semibold cf-fig"
                            style={{ color: 'var(--cf-ink-2)' }}>{formatMoney(porQue.sinEso)}</span>.</>
                        )}
                      </p>
                    </div>
                  )
                })()}
                <div className="grid grid-cols-3 gap-2 mt-2 text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>
                  <span>Agregado: <span className="font-semibold" style={{ color: 'var(--cf-green-dark)' }}>{formatMoney(r.inyectado)}</span></span>
                  <span>Prestado: <span className="font-semibold" style={{ color: 'var(--cf-gold-dark)' }}>{formatMoney(r.prestado)}</span></span>
                  <span>Cobrado: <span className="font-semibold" style={{ color: 'var(--cf-ink-2)' }}>{formatMoney(r.recaudado)}</span></span>
                </div>
                <div className="flex gap-2 mt-2.5">
                  <button type="button" onClick={() => abrirMovimientoRuta(r.rutaId, 'inyeccion')}
                    className="flex-1 py-1.5 rounded-[8px] text-xs font-semibold transition-colors"
                    style={{ background: 'var(--cf-green-pill-bg)', color: 'var(--cf-green-dark)', border: '1px solid var(--cf-green)' }}>
                    Agregar dinero
                  </button>
                  <button type="button" onClick={() => abrirMovimientoRuta(r.rutaId, 'retiro')}
                    className="flex-1 py-1.5 rounded-[8px] text-xs font-semibold transition-colors"
                    style={{ background: 'var(--cf-red-pill-bg)', color: 'var(--cf-red-dark)', border: '1px solid var(--cf-red-border)' }}>
                    Retirar dinero
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[var(--cf-surface)] border border-[var(--cf-border)] rounded-[16px] px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-[var(--cf-ink-3)] uppercase tracking-wide">Movimientos</p>
          <select value={filtroTipo} onChange={(e) => { setFiltroTipo(e.target.value); setPage(1) }}
            className="text-xs bg-[var(--cf-surface)] border border-[var(--cf-border)] text-[var(--cf-ink-3)] rounded-lg px-2 py-1">
            <option value="">Todos</option>
            <option value="capital_inicial">Capital inicial</option>
            <option value="inyeccion">Dinero agregado</option>
            <option value="retiro">Retiros</option>
            <option value="desembolso">Prestados</option>
            <option value="recaudo">Cobrados</option>
            <option value="gasto">Gastos</option>
            <option value="ajuste">Ajustes</option>
          </select>
        </div>

        {loadingMov ? (
          <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="animate-pulse bg-[var(--cf-fill)] rounded-[10px] h-14" />)}</div>
        ) : movimientos.length === 0 ? (
          <p className="text-sm text-[var(--cf-ink-3)] text-center py-6">No hay movimientos registrados</p>
        ) : (
          <div className="space-y-0 divide-y divide-[var(--cf-border)]">
            {movimientos.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                      style={{ background: `color-mix(in srgb, ${TIPO_COLORS[m.tipo]} 12%, transparent)`, color: TIPO_COLORS[m.tipo] }}>
                      {TIPO_LABELS[m.tipo] || m.tipo}
                    </span>
                  </div>
                  {m.descripcion && <p className="text-xs text-[var(--cf-ink-3)] mt-0.5 truncate">{m.descripcion}</p>}
                  <p className="text-[10px] text-[var(--cf-ink-3)] mt-0.5">{fechaCorta(m.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <div className="text-right">
                    <p className={`text-sm font-bold ${esMovimientoIngreso(m) ? 'text-[var(--cf-green-dark)]' : 'text-[var(--cf-red-dark)]'}`}>
                      {esMovimientoIngreso(m) ? '+' : '-'}{formatMoney(m.monto)}
                    </p>
                    <p className="text-[10px] text-[var(--cf-ink-3)]">Saldo: {formatMoney(m.saldoNuevo)}</p>
                  </div>
                  {TIPOS_MANUALES.includes(m.tipo) && (
                    <>
                      <button type="button" onClick={() => abrirEditar(m)} title="Editar movimiento"
                        className="w-7 h-7 flex items-center justify-center rounded-[8px] text-[var(--cf-gold)] hover:bg-[var(--cf-fill)] transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                        </svg>
                      </button>
                      <button type="button" onClick={() => handleEliminar(m)} disabled={eliminando === m.id} title="Eliminar movimiento"
                        className="w-7 h-7 flex items-center justify-center rounded-[8px] text-[var(--cf-red-dark)] hover:bg-[var(--cf-red-pill-bg)] disabled:opacity-50 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-4 pt-3 border-t border-[var(--cf-border)]">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="text-xs text-[var(--cf-ink-3)] hover:text-[var(--cf-ink)] disabled:opacity-30 disabled:cursor-not-allowed">
              Anterior
            </button>
            <span className="text-xs text-[var(--cf-ink-3)]">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="text-xs text-[var(--cf-ink-3)] hover:text-[var(--cf-ink)] disabled:opacity-30 disabled:cursor-not-allowed">
              Siguiente
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-[var(--cf-surface)] border border-[var(--cf-border)] rounded-[16px] w-full max-w-md p-5">
            <h2 className="text-lg font-bold text-[var(--cf-ink)]">
              {modalTipo === 'ajuste' ? 'Cuadrar el saldo'
                : modalTipo === 'capital_inicial' ? 'Registrar capital inicial'
                : 'Mover plata de tu fondo'}
            </h2>
            {/* CUANTO HAY AHORA, arriba del todo. Es contra esa cifra contra la
                que se decide cuanto meter o sacar. */}
            <p className="text-xs mb-4 mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>
              Tienes {formatMoney(saldoCapital)} listos para prestar
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* ── T31-01 · DOS TARJETAS, NO UN DESPLEGABLE ──
                  Era un `<select>` del SISTEMA OPERATIVO con cuatro cosas
                  distintas dentro. Se veia como Windows, no como la app, y
                  ponia al mismo nivel «meter plata» —que se hace cada semana—
                  con «ajuste manual», que reescribe el saldo.

                  «Capital inicial» sale de aqui: se usa UNA VEZ en la vida y ya
                  tiene su camino en el arranque, en la tarjeta de capital
                  sugerido de mas arriba.

                  «Ajuste manual» tambien sale, y tiene su propia entrada en la
                  columna de la derecha, con la advertencia de que queda
                  registrado. Mezclarlo con «agregar dinero» es como se pierde
                  la trazabilidad de una caja. */}
              {modalTipo !== 'capital_inicial' && modalTipo !== 'ajuste' && (
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: 'inyeccion', titulo: 'Meto plata', ayuda: 'Pones dinero tuyo en el fondo para prestar', signo: 'M12 5v14M5 12h14' },
                    { id: 'retiro',    titulo: 'Saco plata', ayuda: 'Retiras dinero del fondo para ti',           signo: 'M5 12h14' },
                  ].map((op) => {
                    const activa = modalTipo === op.id
                    return (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => setModalTipo(op.id)}
                        className="text-left rounded-[14px] p-3.5 transition-all"
                        style={{
                          background: 'var(--cf-card)',
                          border: activa ? '1.5px solid var(--cf-gold)' : '1px solid var(--cf-border)',
                          boxShadow: activa ? '0 0 0 3px var(--cf-gold-focus)' : 'none',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 26, height: 26, borderRadius: 999, flex: 'none',
                            background: activa ? 'var(--cf-gold)' : 'var(--cf-fill)',
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                              stroke={activa ? 'var(--cf-gold-ink)' : 'var(--cf-ink-3)'}
                              strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                              <path d={op.signo} />
                            </svg>
                          </span>
                          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)' }}>{op.titulo}</span>
                        </span>
                        <span style={{ display: 'block', fontSize: 12, lineHeight: 1.45, color: 'var(--cf-ink-3)' }}>
                          {op.ayuda}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Cuando se entra por «cuadrar el saldo», se dice que se esta
                  haciendo y que queda anotado. No es un movimiento mas. */}
              {modalTipo === 'ajuste' && (
                <div className="rounded-[14px] p-3.5" style={{
                  background: 'var(--cf-gold-tint)',
                  border: '1px solid var(--cf-gold-border)',
                }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--cf-gold-text)', margin: 0 }}>
                    Estás cuadrando el saldo
                  </p>
                  <p style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--cf-ink-2)', margin: '4px 0 0' }}>
                    Esto reescribe el saldo sin que haya entrado ni salido plata.
                    Queda registrado quién lo hizo y por qué.
                  </p>
                </div>
              )}
              {porRuta.filter(r => r.capitalHabilitado).length > 0 && modalTipo !== 'capital_inicial' && (
                <div>
                  <label className="text-xs text-[var(--cf-ink-3)] mb-1 block">Ruta (opcional)</label>
                  <select value={modalRutaId} onChange={(e) => setModalRutaId(e.target.value)}
                    className="w-full bg-[var(--cf-surface)] border border-[var(--cf-border)] text-[var(--cf-ink)] rounded-[10px] px-3 py-2.5 text-sm">
                    <option value="">General (sin ruta)</option>
                    {porRuta.filter(r => r.capitalHabilitado).map((r) => (
                      <option key={r.rutaId} value={r.rutaId}>{r.nombre}</option>
                    ))}
                  </select>
                </div>
              )}
              {modalTipo === 'ajuste' && (
                <div>
                  <label className="text-xs text-[var(--cf-ink-3)] mb-1 block">Dirección del ajuste</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['ingreso', 'egreso'].map(dir => (
                      <button key={dir} type="button" onClick={() => setModalDireccion(dir)}
                        className={['h-10 rounded-[10px] border text-sm font-semibold transition-all',
                          modalDireccion === dir
                            ? dir === 'ingreso'
                              ? 'bg-[var(--cf-green-pill-bg)] border-[var(--cf-green)] text-[var(--cf-green-dark)]'
                              : 'bg-[var(--cf-red-pill-bg)] border-[var(--cf-red-border)] text-[var(--cf-red-dark)]'
                            : 'bg-[var(--cf-surface)] border-[var(--cf-border)] text-[var(--cf-ink-3)]',
                        ].join(' ')}>
                        {dir === 'ingreso' ? 'Entrada' : 'Salida'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs text-[var(--cf-ink-3)] mb-1 block">Cuánto</label>
                <MoneyInput value={modalMonto} onChange={(e) => setModalMonto(e.target.value)} placeholder="0" />
              </div>

              {/* ── EN QUE QUEDA EL SALDO ──
                  El modal no lo decia. Se metian tres millones y habia que
                  cerrarlo y mirar la cifra de arriba para saber en cuanto
                  quedaba el fondo — con lo cual el movimiento se hacia a ciegas.
                  `AntesDespues` es el mismo bloque que usa renovar. */}
              {(() => {
                const m = Math.round(Number(String(modalMonto).replace(/[^0-9]/g, '')) || 0)
                if (!(m > 0)) return null
                const sube = modalTipo === 'inyeccion' || (modalTipo === 'ajuste' && modalDireccion === 'ingreso')
                const despues = sube ? saldoCapital + m : saldoCapital - m
                return (
                  <AntesDespues
                    etiqueta="Antes → después"
                    concepto="Listo para prestar"
                    antes={formatMoney(saldoCapital)}
                    despues={formatMoney(despues)}
                    tono={despues < 0 ? 'empeora' : sube ? 'mejora' : 'neutro'}
                    resumen={despues < 0
                      ? `Te quedarías en negativo por ${formatMoney(Math.abs(despues))}.`
                      : null}
                  />
                )
              })()}
              {/* Absorber: solo al inyectar a una ruta que ya tiene prestamos activos */}
              {modalRutaId && modalTipo === 'inyeccion' && (() => {
                const r = porRuta.find(x => x.rutaId === modalRutaId)
                // Si la ruta ya absorbio sus prestamos previos una vez, no volver a ofrecer.
                if (!r || (r.arranqueAbsorbido || 0) > 0) return null
                return (
                  <div className="rounded-[10px] border border-[var(--cf-border)] p-3" style={{ background: 'var(--cf-surface)' }}>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" checked={modalAbsorber} onChange={(e) => setModalAbsorber(e.target.checked)} className="mt-0.5 accent-[#6366f1]" />
                      <span className="text-xs text-[var(--cf-ink-2)]">
                        Si esta ruta ya tiene préstamos activos de antes, descontar lo que falta por cobrar de esta inyección. El sistema calcula el monto exacto.
                      </span>
                    </label>
                  </div>
                )
              })()}
              <div>
                <label className="text-xs text-[var(--cf-ink-3)] mb-1 block">Descripción (opcional)</label>
                <input type="text" value={modalDesc} onChange={(e) => setModalDesc(e.target.value)}
                  placeholder="Ej: Capital para iniciar el mes"
                  className="w-full bg-[var(--cf-surface)] border border-[var(--cf-border)] text-[var(--cf-ink)] rounded-[10px] px-3 py-2.5 text-sm" />
              </div>
              {error && <p className="text-sm text-[var(--cf-red-dark)]">{error}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowModal(false); setError(''); setModalDireccion('ingreso'); setModalRutaId(''); setModalAbsorber(false) }}
                  className="flex-1 px-4 py-2.5 border border-[var(--cf-border)] text-[var(--cf-ink-3)] rounded-[10px] text-sm hover:bg-[var(--cf-fill)] transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-[var(--cf-gold)] text-[var(--cf-ink)] font-semibold rounded-[10px] text-sm hover:bg-[var(--cf-gold-dark)] disabled:opacity-50 transition-colors">
                  {saving ? 'Guardando…' : (() => {
                    const m = Math.round(Number(String(modalMonto).replace(/[^0-9]/g, '')) || 0)
                    if (!(m > 0)) return 'Registrar'
                    const verbo = modalTipo === 'ajuste' ? 'Cuadrar en'
                      : modalTipo === 'retiro' ? 'Sacar'
                      : 'Meter'
                    return `${verbo} ${formatMoney(m)}`
                  })()}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: editar movimiento manual (corregir monto mal escrito) */}
      {editMov && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-[var(--cf-surface)] border border-[var(--cf-border)] rounded-[16px] w-full max-w-md p-5">
            <h2 className="text-lg font-bold text-[var(--cf-ink)] mb-1">Editar movimiento</h2>
            <p className="text-xs text-[var(--cf-ink-3)] mb-4">
              Corrige el monto de este {TIPO_LABELS[editMov.tipo]?.toLowerCase() || 'movimiento'}. Se recalculará el saldo.
            </p>
            <form onSubmit={guardarEditar} className="space-y-4">
              <div>
                <label className="text-xs text-[var(--cf-ink-3)] mb-1 block">Monto</label>
                <MoneyInput value={editMonto} onChange={(e) => setEditMonto(e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className="text-xs text-[var(--cf-ink-3)] mb-1 block">Descripción (opcional)</label>
                <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full bg-[var(--cf-surface)] border border-[var(--cf-border)] text-[var(--cf-ink)] rounded-[10px] px-3 py-2.5 text-sm" />
              </div>
              {editError && <p className="text-sm text-[var(--cf-red-dark)]">{editError}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => { setEditMov(null); setEditError('') }}
                  className="flex-1 px-4 py-2.5 border border-[var(--cf-border)] text-[var(--cf-ink-3)] rounded-[10px] text-sm hover:bg-[var(--cf-fill)] transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={editSaving}
                  className="flex-1 px-4 py-2.5 bg-[var(--cf-gold)] text-[var(--cf-ink)] font-semibold rounded-[10px] text-sm hover:bg-[var(--cf-gold-dark)] disabled:opacity-50 transition-colors">
                  {editSaving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
