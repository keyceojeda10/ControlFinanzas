'use client'
// components/caja/CajaCobradorDetalle.jsx
// Cuerpo reutilizable de la caja detallada de un cobrador: resumen del día,
// desglose por ruta y línea de movimientos (cobros + préstamos + gastos).
// Recibe `data` ya cargada del endpoint GET /api/caja/cobrador/[id].
// Se usa en la pantalla dedicada /caja/cobrador/[id] y en la pestaña "Caja por ruta".

import { formatMoney } from '@/lib/i18n'
import { Card } from '@/components/ui/Card'
import CajaResumen from '@/components/caja/CajaResumen'

const fmtHora = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Bogota' })
}

const MOV_CONFIG = {
  cobro:    { label: 'Cobro',    color: 'var(--color-success)', signo: '+' },
  prestamo: { label: 'Préstamo', color: 'var(--color-warning)', signo: '-' },
  gasto:    { label: 'Gasto',    color: 'var(--color-danger)',  signo: '-' },
}

const GASTO_ESTADO_COLORS = {
  pendiente: 'var(--color-warning)',
  aprobado:  'var(--color-success)',
  rechazado: 'var(--color-danger)',
}

export default function CajaCobradorDetalle({ data }) {
  const r = data?.resumen || {}
  const movimientos = data?.movimientos || []
  const porRuta = data?.porRuta || []
  const gastos = data?.gastos || []

  return (
    <div className="space-y-4">
      {/* Resumen UNIFICADO: hero = dinero real en mano del cobrador */}
      <CajaResumen
        hero={{
          label: data?.esRango ? 'Efectivo del periodo' : 'Efectivo del día',
          valor: r.efectivoDia ?? 0,
          subtitulo: 'Cobrado + Seguros + Recargos − Prestado − Gastos',
          color: (r.efectivoDia ?? 0) >= 0 ? '#22c55e' : '#ef4444',
        }}
        cards={[
          { label: 'Cobrado', valor: r.cobradoDia, color: 'var(--color-success)' },
          { label: 'Prestado', valor: r.prestadoDia, color: 'var(--color-warning)', signo: '-' },
          { label: 'Gastos', valor: r.gastosDia, color: 'var(--color-danger)', signo: '-' },
          ...((r.segurosDia || 0) > 0 ? [{ label: 'Seguros', valor: r.segurosDia, color: '#6366f1', signo: '+' }] : []),
          ...((r.recargosCantidad || 0) > 0 ? [{ label: `Recargos (${r.recargosCantidad})`, valor: r.recargosMonto, color: '#f97316', signo: '+' }] : []),
          ...((r.capitalRutasTotal || 0) > 0 ? [{ label: 'Capital en ruta', valor: r.capitalRutasTotal, color: 'var(--color-info)' }] : []),
        ]}
      />

      {/* Capital y movimiento por ruta */}
      {porRuta.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Por ruta</h2>
          <div className="space-y-2">
            {porRuta.map((ruta) => (
              <div key={ruta.rutaId || 'otros'} className="rounded-[12px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">{ruta.nombre}</span>
                  {ruta.rutaId && (
                    <span className="text-[11px] text-[var(--color-text-muted)]">
                      Capital: <span className="font-semibold font-mono-display text-[var(--color-text-primary)]">{formatMoney(ruta.saldoCapital)}</span>
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Prestado</p>
                    <p className="text-sm font-semibold font-mono-display text-[var(--color-warning)]">{ruta.prestadoDia > 0 ? '-' : ''}{formatMoney(ruta.prestadoDia)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Cobrado</p>
                    <p className="text-sm font-semibold font-mono-display text-[var(--color-success)]">{formatMoney(ruta.cobradoDia)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Seguros</p>
                    <p className="text-sm font-semibold font-mono-display text-[var(--color-info)]">{formatMoney(ruta.segurosDia)}</p>
                  </div>
                </div>
                {ruta.rutaId && (() => {
                  const flujoRuta = ruta.cobradoDia + ruta.segurosDia - ruta.prestadoDia
                  return (
                    <div className="mt-2 pt-2 border-t border-[var(--color-border)] flex items-center justify-between">
                      <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">Flujo del día</span>
                      <span className="text-sm font-bold font-mono-display" style={{ color: flujoRuta >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {formatMoney(flujoRuta)}
                      </span>
                    </div>
                  )
                })()}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Gastos del día */}
      {gastos.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Gastos del día</h2>
          <div className="space-y-1.5">
            {gastos.map((g, i) => {
              const color = GASTO_ESTADO_COLORS[g.estado] || 'var(--color-warning)'
              return (
                <div key={i} className="flex items-center justify-between gap-2 py-2 border-b border-[var(--color-border)] last:border-0">
                  <div className="min-w-0">
                    <p className="text-xs text-[var(--color-text-primary)] truncate">{g.description}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-semibold" style={{ color }}>{g.estado}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">{fmtHora(g.fecha)}</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold font-mono-display shrink-0 text-[var(--color-danger)]">-{formatMoney(g.monto)}</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Movimientos del día */}
      <Card>
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Movimientos del día</h2>
        {movimientos.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">Sin movimientos registrados este día.</p>
        ) : (
          <div className="space-y-1.5">
            {movimientos.map((m, i) => {
              const cfg = MOV_CONFIG[m.tipo] || MOV_CONFIG.cobro
              return (
                <div key={i} className="flex items-center justify-between gap-2 py-2 border-b border-[var(--color-border)] last:border-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                      {m.esClavo && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-[var(--color-danger)]/15 text-[var(--color-danger)]">CLAVO</span>}
                      <span className="text-[11px] text-[var(--color-text-muted)]">{fmtHora(m.fecha)}</span>
                    </div>
                    <p className="text-xs text-[var(--color-text-primary)] truncate">
                      {m.tipo === 'gasto' ? (m.concepto || 'Gasto menor') : (m.cliente || 'Cliente')}
                      {m.rutaNombre ? <span className="text-[var(--color-text-muted)]"> · {m.rutaNombre}</span> : null}
                    </p>
                  </div>
                  <span className="text-sm font-semibold font-mono-display shrink-0" style={{ color: cfg.color }}>
                    {cfg.signo}{formatMoney(m.monto)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
