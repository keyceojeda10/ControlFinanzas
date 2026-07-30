'use client'
// components/caja/CajaCobradorDetalle.jsx
// Cuerpo reutilizable de la caja detallada de un cobrador: resumen del día,
// desglose por ruta y línea de movimientos (cobros + préstamos + gastos).
// Recibe `data` ya cargada del endpoint GET /api/caja/cobrador/[id].
// Se usa en la pantalla dedicada /caja/cobrador/[id] y en la pestaña "Caja por ruta".

import { formatMoney } from '@/lib/i18n'
import { Card } from '@/components/ui/Card'
import CajaResumen from '@/components/caja/CajaResumen'
import DesgloseMetodoPago from '@/components/caja/DesgloseMetodoPago'

const fmtHora = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Bogota' })
}

const MOV_CONFIG = {
  cobro:    { label: 'Cobro',    color: 'var(--cf-green-dark)', signo: '+' },
  prestamo: { label: 'Préstamo', color: 'var(--cf-gold-dark)', signo: '-' },
  gasto:    { label: 'Gasto',    color: 'var(--cf-red-dark)',  signo: '-' },
}

const GASTO_ESTADO_COLORS = {
  pendiente: 'var(--cf-gold-dark)',
  aprobado:  'var(--cf-green-dark)',
  rechazado: 'var(--cf-red-dark)',
}

export default function CajaCobradorDetalle({ data }) {
  const r = data?.resumen || {}
  const movimientos = data?.movimientos || []
  const porRuta = data?.porRuta || []
  const gastos = data?.gastos || []
  const g = data?.gestion || null
  const desgloseMetodo = data?.desgloseMetodoPago || []
  const renov = data?.renovaciones || null

  const esCapitalEfectivo = r.capitalEsEfectivo

  return (
    <div className="space-y-4">
      <CajaResumen
        hero={{
          label: data?.esRango ? 'Efectivo del período' : (esCapitalEfectivo ? 'Dinero en mano' : 'Efectivo del día'),
          valor: r.dineroEnMano ?? 0,
          subtitulo: esCapitalEfectivo ? 'Capital en ruta − Gastos' : 'Cobrado + Seguros + Recargos − Prestado − Gastos',
          color: (r.dineroEnMano ?? 0) >= 0 ? 'var(--cf-green-dark)' : 'var(--cf-red-dark)',
        }}
        cards={[
          ...(r.saldoApertura != null ? [{ label: 'Inicio del dia', valor: r.saldoApertura, color: 'var(--cf-ink-3)' }] : []),
          ...(esCapitalEfectivo ? [{ label: 'Capital en ruta', valor: r.capitalRutasTotal, color: 'var(--cf-ink-2)' }] : []),
          { label: 'Cobrado', valor: r.cobradoDia, color: 'var(--cf-green-dark)' },
          { label: 'Prestado', valor: r.prestadoDia, color: 'var(--cf-gold-dark)', signo: '-' },
          { label: 'Gastos', valor: r.gastosDia, color: 'var(--cf-red-dark)', signo: '-' },
          ...((r.segurosDia || 0) > 0 ? [{ label: 'Seguros', valor: r.segurosDia, color: '#6366f1', signo: '+' }] : []),
          ...((r.recargosCantidad || 0) > 0 ? [{ label: `Recargos (${r.recargosCantidad})`, valor: r.recargosMonto, color: 'var(--cf-gold-dark)', signo: '+' }] : []),
          ...(!esCapitalEfectivo && (r.capitalRutasTotal || 0) > 0 ? [{ label: 'Capital en ruta', valor: r.capitalRutasTotal, color: 'var(--cf-ink-2)' }] : []),
        ]}
      />

      {/* Renovaciones del dia: explica por que "Prestado" no es igual a lo renovado.
          El saldo absorbido (la cartulina) no salio en efectivo, asi que no entra al
          efectivo del dia — pero el prestamista necesita verlo para cuadrar. */}
      {renov && renov.cantidad > 0 && renov.absorbido > 0 && (
        <div
          className="rounded-[12px] p-3"
          style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--cf-ink-3)' }}>
            Renovaciones de hoy ({renov.cantidad})
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>Valor renovado</p>
              <p className="text-[13px] font-bold font-mono-display" style={{ color: 'var(--cf-ink)' }}>{formatMoney(renov.valorTotal)}</p>
            </div>
            <div>
              <p className="text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>Saldo absorbido</p>
              <p className="text-[13px] font-bold font-mono-display" style={{ color: 'var(--cf-ink-2)' }}>{formatMoney(renov.absorbido)}</p>
            </div>
            <div>
              <p className="text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>Entregado en mano</p>
              <p className="text-[13px] font-bold font-mono-display" style={{ color: 'var(--cf-gold-dark)' }}>{formatMoney(renov.entregadoEnMano)}</p>
            </div>
          </div>
          <p className="text-[10px] mt-2 leading-snug" style={{ color: 'var(--cf-ink-3)' }}>
            {renov.enCobrado
              ? 'El saldo absorbido es lo que el cliente ya debía y quedó dentro del nuevo préstamo. Está sumado en "Cobrado" y en "Prestado" a la vez, así que el efectivo del día no cambia.'
              : 'El saldo absorbido es lo que el cliente ya debía y quedó dentro del nuevo préstamo: no entró ni salió efectivo, por eso no suma en "Cobrado" ni en "Prestado".'}
          </p>
        </div>
      )}

      {/* Desglose por método de pago */}
      <DesgloseMetodoPago items={desgloseMetodo} />

      {/* Alerta gastos pendientes */}
      {(r.gastosPendientesCantidad || 0) > 0 && (
        <div
          className="flex items-start gap-2.5 p-3 rounded-[12px] border"
          style={{
            background: 'color-mix(in srgb, var(--cf-gold-dark) 8%, var(--cf-card))',
            borderColor: 'color-mix(in srgb, var(--cf-gold-dark) 25%, var(--cf-border))',
          }}
        >
          <svg className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--cf-gold-dark)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div>
            <p className="text-[12px] font-semibold" style={{ color: 'var(--cf-gold-dark)' }}>
              {r.gastosPendientesCantidad} gasto{r.gastosPendientesCantidad > 1 ? 's' : ''} pendiente{r.gastosPendientesCantidad > 1 ? 's' : ''} por aprobar ({formatMoney(r.gastosPendientesMonto)})
            </p>
            {esCapitalEfectivo && (
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>
                El capital en ruta no refleja este gasto hasta que se apruebe
              </p>
            )}
          </div>
        </div>
      )}

      {/* KPIs de gestion */}
      {g && (
        <Card>
          <h2 className="text-sm font-semibold text-[var(--cf-ink)] mb-3">Gestión de la ruta</h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[10px] p-2.5" style={{ background: 'color-mix(in srgb, var(--cf-gold) 10%, var(--cf-card))', border: '1px solid color-mix(in srgb, var(--cf-gold) 18%, var(--cf-border))' }}>
              <p className="text-[10px] text-[var(--cf-ink-3)] uppercase tracking-wide">Cobros hoy</p>
              <p className="text-lg font-bold font-mono-display text-[var(--cf-gold)] mt-0.5">{g.clientesCobrados}</p>
            </div>
            <div className="rounded-[10px] p-2.5" style={{ background: 'color-mix(in srgb, var(--cf-ink-2) 8%, var(--cf-card))', border: '1px solid color-mix(in srgb, var(--cf-ink-2) 16%, var(--cf-border))' }}>
              <p className="text-[10px] text-[var(--cf-ink-3)] uppercase tracking-wide">Clientes activos</p>
              <p className="text-lg font-bold font-mono-display text-[var(--cf-ink)] mt-0.5">{g.clientesActivos}</p>
            </div>
            <div className="rounded-[10px] p-2.5" style={{ background: 'color-mix(in srgb, var(--cf-ink-2) 10%, var(--cf-card))', border: '1px solid color-mix(in srgb, var(--cf-ink-2) 18%, var(--cf-border))' }}>
              <p className="text-[10px] text-[var(--cf-ink-3)] uppercase tracking-wide">Clientes nuevos</p>
              <p className="text-lg font-bold font-mono-display text-[var(--cf-ink-2)] mt-0.5">{g.clientesNuevos}</p>
            </div>
            <div className="rounded-[10px] p-2.5" style={{ background: 'color-mix(in srgb, var(--cf-green-dark) 10%, var(--cf-card))', border: '1px solid color-mix(in srgb, var(--cf-green-dark) 18%, var(--cf-border))' }}>
              <p className="text-[10px] text-[var(--cf-ink-3)] uppercase tracking-wide">Prestamos nuevos</p>
              <p className="text-lg font-bold font-mono-display text-[var(--cf-green-dark)] mt-0.5">{g.prestamosNuevos}</p>
            </div>
            <div className="rounded-[10px] p-2.5" style={{ background: 'color-mix(in srgb, var(--cf-gold-dark) 10%, var(--cf-card))', border: '1px solid color-mix(in srgb, var(--cf-gold-dark) 18%, var(--cf-border))' }}>
              <p className="text-[10px] text-[var(--cf-ink-3)] uppercase tracking-wide">Renovaciones</p>
              <p className="text-lg font-bold font-mono-display text-[var(--cf-gold-dark)] mt-0.5">{g.renovaciones}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Capital y movimiento por ruta */}
      {porRuta.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-[var(--cf-ink)] mb-3">Por ruta</h2>
          <div className="space-y-2">
            {porRuta.map((ruta) => (
              <div key={ruta.rutaId || 'otros'} className="rounded-[12px] bg-[var(--cf-card)] border border-[var(--cf-border)] p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-semibold text-[var(--cf-ink)]">{ruta.nombre}</span>
                  {ruta.rutaId && (
                    <span className="text-[11px] text-[var(--cf-ink-3)]">
                      Disponible: <span className="font-semibold font-mono-display text-[var(--cf-ink)]">{formatMoney(ruta.saldoCapital)}</span>
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] text-[var(--cf-ink-3)] uppercase tracking-wide">Prestado</p>
                    <p className="text-sm font-semibold font-mono-display text-[var(--cf-gold-dark)]">{ruta.prestadoDia > 0 ? '-' : ''}{formatMoney(ruta.prestadoDia)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--cf-ink-3)] uppercase tracking-wide">Cobrado</p>
                    <p className="text-sm font-semibold font-mono-display text-[var(--cf-green-dark)]">{formatMoney(ruta.cobradoDia)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[var(--cf-ink-3)] uppercase tracking-wide">Seguros</p>
                    <p className="text-sm font-semibold font-mono-display text-[var(--cf-ink-2)]">{formatMoney(ruta.segurosDia)}</p>
                  </div>
                </div>
                {ruta.rutaId && (() => {
                  const flujoRuta = ruta.cobradoDia + ruta.segurosDia - ruta.prestadoDia
                  return (
                    <div className="mt-2 pt-2 border-t border-[var(--cf-border)] flex items-center justify-between">
                      <span className="text-[10px] text-[var(--cf-ink-3)] uppercase tracking-wide">Flujo del día</span>
                      <span className="text-sm font-bold font-mono-display" style={{ color: flujoRuta >= 0 ? 'var(--cf-green-dark)' : 'var(--cf-red-dark)' }}>
                        {formatMoney(flujoRuta)}
                      </span>
                    </div>
                  )
                })()}

                {/* Acumulado colocado en la ruta. Lo de arriba (prestado/cobrado)
                    es el DIA; esto es el stock. Sin este dato, "Disponible: $X"
                    se leia como si fuera todo el dinero de la ruta. */}
                {ruta.rutaId && typeof ruta.capitalEnCalle === 'number' && (
                  <div className="mt-2 pt-2 border-t border-[var(--cf-border)] grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-[var(--cf-ink-3)] uppercase tracking-wide">En la calle</p>
                      <p className="text-sm font-semibold font-mono-display text-[var(--cf-ink)]">{formatMoney(ruta.capitalEnCalle)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-[var(--cf-ink-3)] uppercase tracking-wide">Con intereses</p>
                      <p className="text-sm font-semibold font-mono-display text-[var(--cf-ink)]">{formatMoney(ruta.conIntereses)}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Gastos del día */}
      {gastos.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-[var(--cf-ink)] mb-3">Gastos del día</h2>
          <div className="space-y-1.5">
            {gastos.map((g, i) => {
              const color = GASTO_ESTADO_COLORS[g.estado] || 'var(--cf-gold-dark)'
              return (
                <div key={i} className="flex items-center justify-between gap-2 py-2 border-b border-[var(--cf-border)] last:border-0">
                  <div className="min-w-0">
                    <p className="text-xs text-[var(--cf-ink)] truncate">{g.description}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-semibold" style={{ color }}>{g.estado}</span>
                      <span className="text-[10px] text-[var(--cf-ink-3)]">{fmtHora(g.fecha)}</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold font-mono-display shrink-0 text-[var(--cf-red-dark)]">-{formatMoney(g.monto)}</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Movimientos del día */}
      <Card>
        <h2 className="text-sm font-semibold text-[var(--cf-ink)] mb-3">Movimientos del día</h2>
        {movimientos.length === 0 ? (
          <p className="text-sm text-[var(--cf-ink-3)]">Sin movimientos registrados este día.</p>
        ) : (
          <div className="space-y-1.5">
            {movimientos.map((m, i) => {
              const cfg = MOV_CONFIG[m.tipo] || MOV_CONFIG.cobro
              return (
                <div key={i} className="flex items-center justify-between gap-2 py-2 border-b border-[var(--cf-border)] last:border-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                      {m.esClavo && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-[var(--cf-red-dark)]/15 text-[var(--cf-red-dark)]">CLAVO</span>}
                      <span className="text-[11px] text-[var(--cf-ink-3)]">{fmtHora(m.fecha)}</span>
                    </div>
                    <p className="text-xs text-[var(--cf-ink)] truncate">
                      {m.tipo === 'gasto' ? (m.concepto || 'Gasto menor') : (m.cliente || 'Cliente')}
                      {m.rutaNombre ? <span className="text-[var(--cf-ink-3)]"> · {m.rutaNombre}</span> : null}
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
