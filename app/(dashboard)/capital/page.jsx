'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { formatCOP } from '@/lib/calculos'

const TIPO_LABELS = {
  capital_inicial: 'Capital inicial',
  inyeccion: 'Inyeccion',
  retiro: 'Retiro',
  desembolso: 'Desembolso',
  recaudo: 'Recaudo',
  gasto: 'Gasto',
  ajuste: 'Ajuste',
}

const TIPO_COLORS = {
  capital_inicial: '#22c55e',
  inyeccion: '#22c55e',
  retiro: '#ef4444',
  desembolso: '#f59e0b',
  recaudo: '#06b6d4',
  gasto: '#ef4444',
  ajuste: '#a855f7',
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

  const fetchResumen = useCallback(() => {
    fetch('/api/capital/resumen')
      .then(r => r.json())
      .then(d => setResumen(d))
      .catch(() => {})
      .finally(() => setLoading(false))
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

  if (authLoading) return null
  if (!esOwner) {
    return (
      <div className="max-w-3xl mx-auto py-10 text-center">
        <p className="text-[#888888]">No tienes acceso a esta seccion.</p>
      </div>
    )
  }

  const noConfigurado = resumen && !resumen.configurado

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Capital</h1>
          <p className="text-sm text-[#888888] mt-0.5">Control de tu capital disponible</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-[#f5c518] text-[#0a0a0a] text-sm font-semibold rounded-[10px] hover:bg-[#d4a900] transition-colors"
        >
          + Movimiento
        </button>
      </div>

      {/* Setup prompt if not configured */}
      {noConfigurado && (
        <div className="bg-[#1a1a1a] border border-[#f5c518]/30 rounded-[16px] px-5 py-5 text-center">
          <p className="text-white font-medium mb-2">Configura tu capital inicial</p>
          <p className="text-sm text-[#888888] mb-4">Registra con cuanto capital empiezas para que el sistema lleve el control automaticamente.</p>
          <button
            onClick={() => { setModalTipo('capital_inicial'); setShowModal(true) }}
            className="px-5 py-2.5 bg-[#f5c518] text-[#0a0a0a] text-sm font-semibold rounded-[10px] hover:bg-[#d4a900] transition-colors"
          >
            Registrar capital inicial
          </button>
        </div>
      )}

      {/* Saldo grande */}
      {resumen?.configurado && (
        <div
          className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px] px-5 py-5 text-center"
          style={{
            background: `linear-gradient(135deg, #06b6d40A 0%, #1a1a1a 40%, #1a1a1a 70%, #06b6d405 100%)`,
            boxShadow: `0 0 30px #06b6d408, 0 1px 2px rgba(0,0,0,0.3)`,
          }}
        >
          <p className="text-[11px] text-[#888888] mb-1">Saldo disponible</p>
          <p className={`text-3xl font-bold font-mono-display ${resumen.saldo >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            {formatCOP(resumen.saldo)}
          </p>
          {resumen.saldo < 0 && (
            <p className="text-xs text-[#ef4444] mt-1">Capital en negativo</p>
          )}
        </div>
      )}

      {/* Stats del mes */}
      {resumen?.mes && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px] px-4 py-4">
            <p className="text-[11px] text-[#888888] mb-1">Desembolsado</p>
            <p className="text-lg font-bold font-mono-display text-[#f59e0b]">{formatCOP(resumen.mes.desembolsado)}</p>
            <p className="text-[10px] text-[#888888]">{resumen.mes.prestamosOtorgados} prestamos</p>
          </div>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px] px-4 py-4">
            <p className="text-[11px] text-[#888888] mb-1">Recaudado</p>
            <p className="text-lg font-bold font-mono-display text-[#06b6d4]">{formatCOP(resumen.mes.recaudado)}</p>
            <p className="text-[10px] text-[#888888]">{resumen.mes.pagosRecibidos} pagos</p>
          </div>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px] px-4 py-4">
            <p className="text-[11px] text-[#888888] mb-1">Gastos</p>
            <p className="text-lg font-bold font-mono-display text-[#ef4444]">{formatCOP(resumen.mes.gastos)}</p>
          </div>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px] px-4 py-4">
            <p className="text-[11px] text-[#888888] mb-1">Flujo de caja</p>
            <p className={`text-lg font-bold font-mono-display ${(resumen.mes.flujoCajaTotal ?? resumen.mes.flujoNeto) >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {(resumen.mes.flujoCajaTotal ?? resumen.mes.flujoNeto) >= 0 ? '+' : ''}{formatCOP(resumen.mes.flujoCajaTotal ?? resumen.mes.flujoNeto)}
            </p>
            <p className="text-[10px] text-[#888888]">Incluye inyecciones, retiros y ajustes</p>
          </div>
        </div>
      )}

      {/* Historial de movimientos */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px] px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wide">Movimientos</p>
          <select
            value={filtroTipo}
            onChange={(e) => { setFiltroTipo(e.target.value); setPage(1) }}
            className="text-xs bg-[#0a0a0a] border border-[#2a2a2a] text-[#888888] rounded-lg px-2 py-1"
          >
            <option value="">Todos</option>
            <option value="capital_inicial">Capital inicial</option>
            <option value="inyeccion">Inyecciones</option>
            <option value="retiro">Retiros</option>
            <option value="desembolso">Desembolsos</option>
            <option value="recaudo">Recaudos</option>
            <option value="gasto">Gastos</option>
            <option value="ajuste">Ajustes</option>
          </select>
        </div>

        {loadingMov ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse bg-[#2a2a2a] rounded-[10px] h-14" />
            ))}
          </div>
        ) : movimientos.length === 0 ? (
          <p className="text-sm text-[#888888] text-center py-6">No hay movimientos registrados</p>
        ) : (
          <div className="space-y-0 divide-y divide-[#2a2a2a]">
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
                    <p className="text-xs text-[#888888] mt-0.5 truncate">{m.descripcion}</p>
                  )}
                  <p className="text-[10px] text-[#555555] mt-0.5">{fechaCorta(m.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <div className="text-right">
                    <p className={`text-sm font-bold ${esMovimientoIngreso(m) ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                      {esMovimientoIngreso(m) ? '+' : '-'}{formatCOP(m.monto)}
                    </p>
                    <p className="text-[10px] text-[#555555]">Saldo: {formatCOP(m.saldoNuevo)}</p>
                  </div>
                  {TIPOS_MANUALES.includes(m.tipo) && (
                    <button
                      type="button"
                      onClick={() => handleEliminar(m)}
                      disabled={eliminando === m.id}
                      title="Eliminar movimiento"
                      className="w-7 h-7 flex items-center justify-center rounded-[8px] text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)] disabled:opacity-50 transition-colors"
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
          <div className="flex items-center justify-center gap-3 mt-4 pt-3 border-t border-[#2a2a2a]">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="text-xs text-[#888888] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="text-xs text-[#888888]">{page} / {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="text-xs text-[#888888] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>

      {/* Modal registrar movimiento */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px] w-full max-w-md p-5">
            <h2 className="text-lg font-bold text-white mb-4">Registrar movimiento</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-[#888888] mb-1 block">Tipo</label>
                <select
                  value={modalTipo}
                  onChange={(e) => setModalTipo(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white rounded-[10px] px-3 py-2.5 text-sm"
                >
                  <option value="capital_inicial">Capital inicial</option>
                  <option value="inyeccion">Inyectar capital</option>
                  <option value="retiro">Retirar capital</option>
                  <option value="ajuste">Ajuste manual</option>
                </select>
              </div>
              {modalTipo === 'ajuste' && (
                <div>
                  <label className="text-xs text-[#888888] mb-1 block">Direccion del ajuste</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setModalDireccion('ingreso')}
                      className={[
                        'h-10 rounded-[10px] border text-sm font-semibold transition-all',
                        modalDireccion === 'ingreso'
                          ? 'bg-[rgba(34,197,94,0.1)] border-[rgba(34,197,94,0.35)] text-[#22c55e]'
                          : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#888888]',
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
                          ? 'bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.35)] text-[#ef4444]'
                          : 'bg-[#0a0a0a] border-[#2a2a2a] text-[#888888]',
                      ].join(' ')}
                    >
                      Salida
                    </button>
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs text-[#888888] mb-1 block">Monto</label>
                <input
                  type="number"
                  value={modalMonto}
                  onChange={(e) => setModalMonto(e.target.value)}
                  placeholder="0"
                  min="1"
                  required
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white rounded-[10px] px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-[#888888] mb-1 block">Descripción (opcional)</label>
                <input
                  type="text"
                  value={modalDesc}
                  onChange={(e) => setModalDesc(e.target.value)}
                  placeholder="Ej: Capital para iniciar el mes"
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-white rounded-[10px] px-3 py-2.5 text-sm"
                />
              </div>
              {error && <p className="text-sm text-[#ef4444]">{error}</p>}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setError(''); setModalDireccion('ingreso') }}
                  className="flex-1 px-4 py-2.5 border border-[#2a2a2a] text-[#888888] rounded-[10px] text-sm hover:bg-[#2a2a2a] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-[#f5c518] text-[#0a0a0a] font-semibold rounded-[10px] text-sm hover:bg-[#d4a900] disabled:opacity-50 transition-colors"
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
