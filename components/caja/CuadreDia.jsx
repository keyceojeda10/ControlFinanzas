'use client'

import { Cuadre } from '@/components/pantallas/Caja'
import { diferenciaDeCuadre, causasDeDescuadre } from '@/lib/adaptadores/cuadre'
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

  // Solo entran al lote los cobradores que YA DECLARARON, al cerrar su caja, el
  // mismo monto que registro el sistema. Ahi el lote no inventa nada: confirma
  // una coincidencia que ya existe.
  //
  // Antes filtraba por estado === 'pendiente', que significa "el admin todavia
  // no confirmo" — NO "cuadra exacto" — y le escribia a todos
  // efectivoRecibido = recaudadoSistema. O sea que por construccion todos
  // quedaban cuadrados con diferencia 0. Si un cobrador traia $120.000 menos,
  // ese faltante quedaba firmado como cuadre perfecto y ya no habia a que
  // volver. Era una firma en blanco sobre plata real.
  const exactos = (data?.filas || []).filter(
    (f) => f.estado === 'pendiente'
      && f.entregadoReportado != null
      && Math.round(f.entregadoReportado) === Math.round(f.recaudadoSistema)
  )

  const confirmarExactos = async () => {
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
        {/* El boton aparece segun `exactos` (los que declararon lo mismo que el
            sistema), no segun `g.pendientes` (los que faltan por confirmar).
            A los que no coinciden hay que contarles la plata uno por uno. */}
        {exactos.length > 0 && (
          <button
            type="button"
            onClick={confirmarExactos}
            disabled={guardando}
            className="mt-3 w-full h-9 rounded-[10px] text-xs font-semibold text-[#1a1a2e] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-colors"
          >
            Confirmar {exactos.length} que entregó{exactos.length === 1 ? '' : 'aron'} lo mismo que dice el sistema
          </button>
        )}
        {g.pendientes > exactos.length && (
          <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
            {g.pendientes - exactos.length} cobrador{g.pendientes - exactos.length === 1 ? '' : 'es'} no coincide{g.pendientes - exactos.length === 1 ? '' : 'n'} con el sistema: cuéntale{g.pendientes - exactos.length === 1 ? '' : 's'} el efectivo y confirma abajo.
          </p>
        )}
      </Card>

      {/* Filtros */}
      <div className="flex gap-1 p-1 rounded-[12px]" style={{ background: 'var(--color-bg-hover)', border: '1px solid var(--color-border)' }}>
        {[{ k: 'todos', l: 'Todos' }, { k: 'pendientes', l: 'Pendientes' }, { k: 'diferencia', l: 'Con diferencia' }].map((t) => (
          <button key={t.k} type="button" onClick={() => setFiltro(t.k)}
            className="flex-1 py-1.5 text-[11px] font-semibold rounded-[8px] transition-all"
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* EL CUERPO DEL MODAL PASA A `Cuadre` (T33).
                Lo que cambia, y por qué importa en el momento en que una persona
                le entrega dinero a otra:

                · LAS CAUSAS SON BOTONES, no un «motivo (opcional)» en blanco. Un
                  campo vacío se deja vacío: el administrador tiene ocho cobradores
                  esperando. Con las cuatro causas reales a un toque, la diferencia
                  queda explicada — y una diferencia explicada es la que después se
                  puede buscar.
                · LAS CAUSAS CAMBIAN DE LADO: un faltante y un sobrante no se
                  explican igual. Faltar suele ser un gasto sin registrar; sobrar,
                  un cobro sin anotar.
                · LA DIFERENCIA TRAE SU PROPORCIÓN («4% de lo recaudado»), que es
                  lo que dice si buscar un error de conteo o un billete perdido.

                El endpoint, el guardado y `nota` no se tocan: la causa elegida
                escribe en `nota`, que es lo que ya viajaba. */}
            <Cuadre
              segunLaApp={formatMoney(modal.recaudadoSistema)}
              contado={montoRecibido}
              /* SOLO DÍGITOS. `MoneyInput` entregaba el valor ya limpio; el campo
                 de `Cuadre` no limpia nada, y `confirmar` hace `Number(...)`. Si
                 alguien teclea «1.200.000» —que es como se escribe aquí— eso da
                 NaN y viaja al endpoint como el efectivo recibido. Es el momento
                 en que una persona le entrega dinero a otra: no puede depender de
                 si escribió los puntos. */
              onContado={(v) => setMontoRecibido(String(v ?? '').replace(/\D/g, ''))}
              diferencia={diferenciaDeCuadre(
                { sistema: modal.recaudadoSistema, contado: montoRecibido },
                formatMoney,
              )}
              causas={difModal !== 0 ? causasDeDescuadre(difModal > 0 ? 'sobra' : 'falta') : []}
              onCausa={(c) => setNota(c.texto)}
            />

            {/* La causa elegida se ve y se puede matizar a mano: «un gasto que no
                se registró» es el titular, y a veces hace falta decir cuál. */}
            {difModal !== 0 && (
              <input
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Puedes añadir un detalle…"
                style={{
                  width: '100%', height: 44, padding: '0 14px', borderRadius: 14,
                  background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
                  font: 'inherit', fontSize: 14, color: 'var(--cf-ink)', outline: 'none',
                }}
              />
            )}

            <p style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--cf-ink-3)', margin: 0 }}>
              La diferencia se registra como ajuste de caja para no descuadrar el capital.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
