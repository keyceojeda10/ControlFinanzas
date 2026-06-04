'use client'
// components/caja/CuadreDia.jsx
// Cuadre del día (solo owner): el admin verifica y confirma el efectivo que recibe de
// cada cobrador. Banner global + lista por cobrador (semáforos, problemas primero) +
// confirmar recibo (individual o en lote). Diseñado mobile-first.

import { useState, useEffect, useCallback, useMemo } from 'react'
import { formatMoney } from '@/lib/i18n'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import MoneyInput from '@/components/ui/MoneyInput'
import { Button } from '@/components/ui/Button'

// Config visual por estado (sin emojis: punto de color + label).
const ESTADO = {
  cuadrado:  { label: 'Cuadró',   color: 'var(--color-success)', orden: 3 },
  sobrante:  { label: 'Sobrante', color: 'var(--color-warning)', orden: 1 },
  faltante:  { label: 'Faltante', color: 'var(--color-danger)',  orden: 0 },
  pendiente: { label: 'Pendiente', color: 'var(--color-text-muted)', orden: 2 },
}

const fmtHora = (d) => d ? new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Bogota' }) : ''

export default function CuadreDia({ fecha }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos') // 'todos' | 'pendientes' | 'diferencia'
  const [modal, setModal] = useState(null)       // fila en confirmación
  const [montoRecibido, setMontoRecibido] = useState('')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/caja/cuadre?fecha=${fecha}`)
      const d = await res.json()
      setData(res.ok ? d : null)
    } catch { setData(null) } finally { setLoading(false) }
  }, [fecha])

  useEffect(() => { fetchData() }, [fetchData])

  const filas = useMemo(() => {
    const arr = [...(data?.filas || [])]
    arr.sort((a, b) => (ESTADO[a.estado]?.orden ?? 9) - (ESTADO[b.estado]?.orden ?? 9))
    if (filtro === 'pendientes') return arr.filter((f) => f.estado === 'pendiente')
    if (filtro === 'diferencia') return arr.filter((f) => f.estado === 'faltante' || f.estado === 'sobrante')
    return arr
  }, [data, filtro])

  const g = data?.resumenGlobal

  const abrirConfirmar = (fila) => {
    setModal(fila)
    setMontoRecibido(String(fila.recaudadoSistema || 0))
    setNota(fila.notaCuadre || '')
  }

  const confirmar = async () => {
    if (!modal) return
    setGuardando(true)
    try {
      const res = await fetch('/api/caja/cuadre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, cobradorId: modal.cobradorId, efectivoRecibido: Number(montoRecibido), nota }),
      })
      if (!res.ok) throw new Error()
      setModal(null)
      await fetchData()
    } catch { /* noop */ } finally { setGuardando(false) }
  }

  // Confirmar en lote los pendientes cuyo recibo = recaudado (cuadran exacto).
  const confirmarExactos = async () => {
    const exactos = (data?.filas || []).filter((f) => f.estado === 'pendiente')
    if (!exactos.length) return
    setGuardando(true)
    try {
      const confirmaciones = exactos.map((f) => ({ cobradorId: f.cobradorId, efectivoRecibido: f.recaudadoSistema }))
      const res = await fetch('/api/caja/cuadre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, confirmaciones }),
      })
      if (!res.ok) throw new Error()
      await fetchData()
    } catch { /* noop */ } finally { setGuardando(false) }
  }

  if (loading) return <Card><p className="text-sm text-[var(--color-text-muted)]">Cargando cuadre…</p></Card>
  if (!data || data.filas.length === 0) return null

  const difModal = modal ? Math.round(Number(montoRecibido || 0) - modal.recaudadoSistema) : 0

  return (
    <div className="space-y-3">
      {/* Banner global */}
      <Card>
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Cuadre del día</p>
          <span className="text-[11px] text-[var(--color-text-muted)]">
            <span className="font-bold" style={{ color: g.cuadraron === g.total ? 'var(--color-success)' : 'var(--color-accent)' }}>{g.cuadraron}/{g.total}</span> cuadraron
          </span>
        </div>
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Total recibido hoy</p>
        <p className="text-2xl font-bold font-mono-display text-[var(--color-success)]">
          {formatMoney(g.totalRecibido)}
          <span className="text-xs font-normal text-[var(--color-text-muted)]"> / {formatMoney(g.totalRecaudadoSistema)} sistema</span>
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px]">
          {g.pendientes > 0 && <span className="text-[var(--color-text-muted)]">{g.pendientes} pendiente{g.pendientes === 1 ? '' : 's'}</span>}
          {g.conDiferencia > 0 && <span className="text-[var(--color-danger)]">{g.conDiferencia} con diferencia</span>}
          {g.faltanteTotal < 0 && <span className="text-[var(--color-danger)]">Faltante total: {formatMoney(g.faltanteTotal)}</span>}
        </div>
        {g.pendientes > 0 && (
          <button
            type="button"
            onClick={confirmarExactos}
            disabled={guardando}
            className="mt-3 w-full h-9 rounded-[10px] text-xs font-semibold text-[#1a1a2e] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-colors"
          >
            Confirmar {g.pendientes} cobrador{g.pendientes === 1 ? '' : 'es'} que cuadran exacto
          </button>
        )}
      </Card>

      {/* Filtros */}
      <div className="flex gap-1 p-1 rounded-[12px]" style={{ background: 'var(--color-bg-hover)', border: '1px solid var(--color-border)' }}>
        {[{ k: 'todos', l: 'Todos' }, { k: 'pendientes', l: 'Pendientes' }, { k: 'diferencia', l: 'Con diferencia' }].map((t) => (
          <button key={t.k} type="button" onClick={() => setFiltro(t.k)}
            className="flex-1 py-1.5 text-[11px] font-semibold rounded-[9px] transition-all"
            style={filtro === t.k ? { background: 'var(--color-bg-card)', color: 'var(--color-accent)' } : { color: 'var(--color-text-muted)' }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Lista por cobrador */}
      <div className="space-y-2">
        {filas.map((f) => {
          const est = ESTADO[f.estado] || ESTADO.pendiente
          const confirmado = f.estado !== 'pendiente'
          return (
            <div key={f.cobradorId} className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: est.color, boxShadow: `0 0 8px ${est.color}` }} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{f.nombre}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)] truncate">{f.rutaNombre} · {est.label}{confirmado && f.confirmadoEn ? ` ${fmtHora(f.confirmadoEn)}` : ''}</p>
                  </div>
                </div>
                {!confirmado ? (
                  <button type="button" onClick={() => abrirConfirmar(f)}
                    className="shrink-0 text-[11px] font-semibold text-[#1a1a2e] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] rounded-[8px] px-3 py-1.5 transition-colors">
                    Confirmar
                  </button>
                ) : (
                  <button type="button" onClick={() => abrirConfirmar(f)}
                    className="shrink-0 text-[11px] font-medium text-[var(--color-accent)] hover:underline px-2 py-1">
                    Editar
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2.5">
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">Sistema</p>
                  <p className="text-[13px] font-bold font-mono-display text-[var(--color-text-primary)]">{formatMoney(f.recaudadoSistema)}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">Recibido</p>
                  <p className="text-[13px] font-bold font-mono-display text-[var(--color-text-primary)]">{f.efectivoRecibido != null ? formatMoney(f.efectivoRecibido) : '—'}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">Diferencia</p>
                  <p className="text-[13px] font-bold font-mono-display" style={{ color: f.diferencia == null ? 'var(--color-text-muted)' : f.diferencia === 0 ? 'var(--color-success)' : f.diferencia < 0 ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                    {f.diferencia == null ? '—' : `${f.diferencia > 0 ? '+' : ''}${formatMoney(f.diferencia)}`}
                  </p>
                </div>
              </div>
              {f.notaCuadre && <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5 italic">“{f.notaCuadre}”</p>}
            </div>
          )
        })}
        {filas.length === 0 && <p className="text-sm text-[var(--color-text-muted)] text-center py-4">Sin cobradores en este filtro.</p>}
      </div>

      {/* Modal confirmar recibo */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal ? `Confirmar recibo — ${modal.nombre}` : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)} disabled={guardando}>Cancelar</Button>
            <Button onClick={confirmar} loading={guardando}>Confirmar</Button>
          </>
        }
      >
        {modal && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-text-muted)]">El sistema registró</span>
              <span className="font-bold font-mono-display text-[var(--color-text-primary)]">{formatMoney(modal.recaudadoSistema)}</span>
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Efectivo que recibiste</label>
              <MoneyInput value={montoRecibido} onChange={(e) => setMontoRecibido(e.target.value)} placeholder="0" />
            </div>
            {difModal !== 0 && (
              <>
                <div className="flex items-center justify-between text-sm rounded-[10px] px-3 py-2"
                  style={{ background: difModal < 0 ? 'var(--color-danger-dim)' : 'var(--color-warning-dim)' }}>
                  <span style={{ color: difModal < 0 ? 'var(--color-danger)' : 'var(--color-warning)' }}>{difModal < 0 ? 'Faltante' : 'Sobrante'}</span>
                  <span className="font-bold font-mono-display" style={{ color: difModal < 0 ? 'var(--color-danger)' : 'var(--color-warning)' }}>{difModal > 0 ? '+' : ''}{formatMoney(difModal)}</span>
                </div>
                <div>
                  <label className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Motivo (opcional)</label>
                  <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. gasto no registrado, faltante…"
                    className="w-full h-10 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 text-sm text-[var(--color-text-primary)]" />
                </div>
              </>
            )}
            <p className="text-[11px] text-[var(--color-text-muted)]">La diferencia se registra como ajuste de caja para no descuadrar el capital.</p>
          </div>
        )}
      </Modal>
    </div>
  )
}
