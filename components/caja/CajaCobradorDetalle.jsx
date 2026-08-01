'use client'
// components/caja/CajaCobradorDetalle.jsx
// Cuerpo reutilizable de la caja detallada de un cobrador: resumen del día,
// desglose por ruta y línea de movimientos (cobros + préstamos + gastos).
// Recibe `data` ya cargada del endpoint GET /api/caja/cobrador/[id].
// Se usa en la pantalla dedicada /caja/cobrador/[id] y en la pestaña "Caja por ruta".

import { formatMoney } from '@/lib/i18n'
import { Card } from '@/components/ui/Card'
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

export default function CajaCobradorDetalle({ data, onExplicar }) {
  const r = data?.resumen || {}
  const movimientos = data?.movimientos || []
  const porRuta = data?.porRuta || []
  const gastos = data?.gastos || []
  const g = data?.gestion || null
  const desgloseMetodo = data?.desgloseMetodoPago || []
  const pd = data?.prestadoDetalle || null
  const rutasNegativas = (data?.porRuta || []).filter(
    (r) => r.rutaId && r.capitalHabilitado && (r.saldoCapital ?? 0) < 0
  )

  const esCapitalEfectivo = r.capitalEsEfectivo

  // Lo que hizo, partido en dos: lo que pasó y lo que no.
  //
  // El cero NO se descarta —hace falta poder decir «hoy no hubo renovaciones»,
  // que es informacion— pero deja de ocupar una tarjeta del mismo tamaño que
  // las que sí traen algo.
  const hizoTodo = data?.hizo || []
  const hizoConAlgo = hizoTodo.filter((h) => (h.cantidad ?? 0) > 0 || (h.monto ?? 0) > 0)
  const hizoEnCero = hizoTodo.filter((h) => !((h.cantidad ?? 0) > 0 || (h.monto ?? 0) > 0))

  return (
    <div className="space-y-4">
      {/* ── LA CUENTA DEL DÍA ─────────────────────────────────────────────
          Antes esto eran seis cajitas de colores con un número cada una:
          «Inicio del día», «Capital en ruta», «Cobrado», «Prestado»,
          «Gastos», «Seguros». La cuenta que las relacionaba SÍ existía —726 +
          406 = 1.132— pero el usuario tenía que descubrir solo que se
          relacionaban. Y encima el hero decía «Dinero en mano» sobre un número
          que era idéntico a «Capital en ruta», o sea un saldo acumulado, con
          $245.000 dentro que habían entrado por transferencia y que nadie
          lleva encima.

          Ahora es una resta, de arriba abajo, con la respuesta al final. Cada
          renglón se toca y dice de dónde sale. */}
      <div className="rounded-[16px] p-4" style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--cf-ink-3)' }}>
          La cuenta del día
        </p>

        <div className="flex flex-col gap-3">
          {(data?.cuenta || []).map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={onExplicar ? () => onExplicar(l.id) : undefined}
              className="flex items-baseline justify-between gap-3 w-full text-left"
              style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: onExplicar ? 'pointer' : 'default' }}
            >
              <span className="text-sm" style={{ color: 'var(--cf-ink-2)' }}>
                {l.rotulo}
                {onExplicar && <span aria-hidden className="ml-1 text-[11px]" style={{ color: 'var(--cf-ink-4)' }}>?</span>}
              </span>
              <span className="cf-fig text-[15px]" style={{
                color: l.signo === 1 ? 'var(--cf-green-dark)' : l.signo === -1 ? 'var(--cf-red-dark)' : 'var(--cf-ink-3)',
              }}>
                {l.signo === 1 ? '+ ' : l.signo === -1 ? '− ' : ''}{formatMoney(l.monto)}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-baseline justify-between gap-3 mt-3 pt-3" style={{ borderTop: '1px solid var(--cf-hairline)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--cf-ink)' }}>
            {esCapitalEfectivo ? 'Debería tener en la mano' : 'Le queda en efectivo'}
          </span>
          <span className="cf-fig text-[22px] font-bold" style={{
            color: (r.dineroEnMano ?? 0) >= 0 ? 'var(--cf-green-dark)' : 'var(--cf-red-dark)',
          }}>
            {formatMoney(r.dineroEnMano ?? 0)}
          </span>
        </div>

        {/* SOLO EFECTIVO, y se dice. Lo que entró por Nequi ya está en la
            cuenta bancaria: contarlo aquí le inventa al cobrador un faltante
            que no es suyo. */}
        <p className="text-[12px] mt-2 leading-snug" style={{ color: 'var(--cf-ink-3)' }}>
          {esCapitalEfectivo
            ? 'Toda la bolsa de sus rutas, no solo lo de hoy. Solo efectivo.'
            : 'Solo efectivo. Lo que entró por transferencia ya está en la cuenta.'}
        </p>

        {/* El descuadre entre las líneas y la respuesta, si lo hay. Un residuo
            mudo es una mentira. */}
        {data?.cuentaSuma != null && !esCapitalEfectivo && data.cuentaSuma !== (r.dineroEnMano ?? 0) && (
          <p className="text-[12px] mt-2 leading-snug" style={{ color: 'var(--cf-red-dark)' }}>
            Las líneas suman {formatMoney(data.cuentaSuma)} y abajo dice {formatMoney(r.dineroEnMano ?? 0)}.
          </p>
        )}
      </div>

      {/* Resumen completo de lo prestado en el dia.
          Reemplaza a la vieja caja "Renovaciones de hoy", que solo aparecia si habia
          renovaciones con saldo absorbido: los prestamos nuevos no salian en ningun
          resumen y el dueño concluia que no se estaban contando. Ahora se listan las
          dos clases y el total cuadra con la tarjeta "Prestado". */}
      {pd && (pd.nuevos.cantidad > 0 || pd.renovaciones.cantidad > 0) && (
        <div
          className="rounded-[12px] p-3"
          style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: 'var(--cf-ink-3)' }}>
            Lo que prestó hoy
          </p>

          <div className="space-y-1.5">
            {pd.nuevos.cantidad > 0 && (
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px]" style={{ color: 'var(--cf-ink-2)' }}>
                  {pd.nuevos.cantidad} préstamo{pd.nuevos.cantidad === 1 ? '' : 's'} nuevo{pd.nuevos.cantidad === 1 ? '' : 's'}
                </span>
                <span className="text-[13px] font-bold font-mono-display" style={{ color: 'var(--cf-ink)' }}>
                  {formatMoney(pd.nuevos.valor)}
                </span>
              </div>
            )}

            {pd.renovaciones.cantidad > 0 && (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px]" style={{ color: 'var(--cf-ink-2)' }}>
                    {pd.renovaciones.cantidad} renovaci{pd.renovaciones.cantidad === 1 ? 'ón' : 'ones'}
                  </span>
                  <span className="text-[13px] font-bold font-mono-display" style={{ color: 'var(--cf-ink)' }}>
                    {formatMoney(pd.renovaciones.valor)}
                  </span>
                </div>
                {pd.renovaciones.absorbido > 0 && (
                  <div className="flex items-baseline justify-between gap-2 pl-3">
                    <span className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>
                      de eso, saldo que ya le debían
                    </span>
                    <span className="text-[11px] font-mono-display" style={{ color: 'var(--cf-ink-2)' }}>
                      {formatMoney(pd.renovaciones.absorbido)}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mt-2.5 pt-2.5 space-y-1.5" style={{ borderTop: '1px solid var(--cf-border)' }}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12px] font-semibold" style={{ color: 'var(--cf-ink)' }}>Total prestado</span>
              <span className="text-[15px] font-bold font-mono-display" style={{ color: 'var(--cf-gold-dark)' }}>
                {formatMoney(pd.valorTotal)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>Efectivo que salió de su mano</span>
              <span className="text-[12px] font-mono-display" style={{ color: 'var(--cf-ink-2)' }}>
                {formatMoney(pd.efectivoTotal)}
              </span>
            </div>
          </div>

          {pd.valorTotal !== pd.efectivoTotal && (
            <p className="text-[10px] mt-2 leading-snug" style={{ color: 'var(--cf-ink-3)' }}>
              La diferencia de {formatMoney(pd.valorTotal - pd.efectivoTotal)} es saldo que los clientes ya debían y
              quedó dentro de la cartulina nueva: no salió efectivo por esa parte.
              {' '}La tarjeta <strong>Prestado</strong> de arriba muestra{' '}
              {pd.tarjetaMuestra === 'valor' ? 'el total prestado' : 'solo el efectivo'}.
            </p>
          )}
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

      {/* ── LO QUE HIZO HOY ───────────────────────────────────────────────
          Antes: cinco recuadros de colores con un número suelto cada uno.
          «RENOVACIONES 0» ocupaba lo mismo que «CLIENTES ACTIVOS 142», y
          ninguno decía CUÁNTO. «10 renovaciones» sin el valor no dice nada, y
          «$2.400.000 en renovaciones» sin cuántas tampoco.

          Ahora: una fila por cosa, con su cantidad Y su valor. Y lo que está
          en cero NO ocupa una tarjeta — se junta en una línea al pie, porque
          cinco recuadros diciendo «no pasó nada» son ruido. */}
      {(hizoConAlgo.length > 0 || hizoEnCero.length > 0) && (
        <Card>
          <h2 className="text-sm font-semibold text-[var(--cf-ink)] mb-1">Lo que hizo hoy</h2>
          <p className="text-[12px] mb-3" style={{ color: 'var(--cf-ink-3)' }}>
            {g?.clientesCobrados ?? 0} de {g?.clientesActivos ?? 0} clientes le pagaron
          </p>

          <div className="flex flex-col">
            {hizoConAlgo.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={onExplicar ? () => onExplicar(h.id) : undefined}
                className="flex items-baseline justify-between gap-3 w-full text-left py-2"
                style={{
                  background: 'none', border: 'none', borderBottom: '1px solid var(--cf-hairline)',
                  padding: '8px 0', font: 'inherit', cursor: onExplicar ? 'pointer' : 'default',
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm" style={{ color: 'var(--cf-ink)' }}>
                    {h.cantidad != null && (
                      <span className="cf-fig font-semibold mr-1.5">{h.cantidad}</span>
                    )}
                    {h.rotulo}
                    {onExplicar && <span aria-hidden className="ml-1 text-[11px]" style={{ color: 'var(--cf-ink-4)' }}>?</span>}
                  </span>
                  {h.nota && (
                    <span className="block text-[12px] mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>{h.nota}</span>
                  )}
                </span>
                {h.monto != null && (
                  <span className="cf-fig text-sm flex-none" style={{ color: 'var(--cf-ink)' }}>
                    {formatMoney(h.monto)}
                  </span>
                )}
              </button>
            ))}
          </div>

          {hizoEnCero.length > 0 && (
            <p className="text-[12px] mt-2.5 leading-snug" style={{ color: 'var(--cf-ink-3)' }}>
              Hoy no hubo {hizoEnCero.map((h) => h.rotulo.toLowerCase()).join(', ')}.
            </p>
          )}
        </Card>
      )}

      {/* Capital y movimiento por ruta */}
      {porRuta.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-[var(--cf-ink)] mb-3">Por ruta</h2>

          {/* Capital de ruta en negativo. Una sub-bolsa no puede tener menos de
              cero pesos fisicos: si esta negativa es que salio plata que nunca se
              registro como entrada. Pasaba en silencio — cuatro rutas de la
              plataforma acumulaban -$94.5 millones sin una sola señal. */}
          {rutasNegativas.length > 0 && (
            <div
              className="rounded-[12px] p-3 mb-3"
              style={{
                background: 'color-mix(in srgb, var(--cf-red-dark) 8%, var(--cf-card))',
                border: '1px solid color-mix(in srgb, var(--cf-red-dark) 25%, var(--cf-border))',
              }}
            >
              <p className="text-[12px] font-semibold mb-1" style={{ color: 'var(--cf-red-dark)' }}>
                {rutasNegativas.length === 1
                  ? `La ruta ${rutasNegativas[0].nombre} está en negativo`
                  : `${rutasNegativas.length} rutas están en negativo`}
              </p>
              <p className="text-[11px] leading-snug" style={{ color: 'var(--cf-ink-2)' }}>
                De esta{rutasNegativas.length === 1 ? '' : 's'} ruta{rutasNegativas.length === 1 ? '' : 's'} salió{' '}
                <strong style={{ color: 'var(--cf-red-dark)' }}>
                  {formatMoney(Math.abs(rutasNegativas.reduce((a, r) => a + (r.saldoCapital || 0), 0)))}
                </strong>{' '}
                más de lo que entró. Casi siempre es porque le entregó plata al cobrador sin
                registrarla como inyección de capital a la ruta.
              </p>
              <p className="text-[11px] leading-snug mt-1.5" style={{ color: 'var(--cf-ink-3)' }}>
                Si esa plata sí se la entregó, regístrela en <strong>Capital → Inyectar a la ruta</strong> y
                el saldo queda al día. Si no, revise los retiros y gastos de la ruta.
              </p>
            </div>
          )}
          <div className="space-y-2">
            {porRuta.map((ruta) => (
              <div key={ruta.rutaId || 'otros'} className="rounded-[12px] bg-[var(--cf-card)] border border-[var(--cf-border)] p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-semibold text-[var(--cf-ink)]">{ruta.nombre}</span>
                  {ruta.rutaId && (
                    <span className="text-[11px] text-[var(--cf-ink-3)]">
                      Disponible:{' '}
                      {/* En rojo si quedo negativo: antes salia del mismo color que
                          cualquier otra cifra y un "-$85.865.000" pasaba inadvertido. */}
                      <span
                        className="font-semibold font-mono-display"
                        style={{ color: (ruta.saldoCapital ?? 0) < 0 ? 'var(--cf-red-dark)' : 'var(--cf-ink)' }}
                      >
                        {formatMoney(ruta.saldoCapital)}
                      </span>
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
