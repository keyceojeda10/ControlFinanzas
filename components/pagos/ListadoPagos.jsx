'use client'
// components/pagos/ListadoPagos.jsx
// Componente unificado para renderizar listas de pagos en distintas vistas
// (caja, historial de cliente, cobradores, etc).

import { formatMoney } from '@/lib/i18n'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { metodoInfo as getMetodoInfo, PlataformaIcon } from '@/components/ui/LogoPlataforma'

const TIPO_BADGE = {
  completo:  { label: 'Completo',  variant: 'success' },
  parcial:   { label: 'Parcial',   variant: 'warning' },
  capital:   { label: 'Capital',   variant: 'info'    },
  recargo:   { label: 'Recargo',   variant: 'danger'  },
  descuento: { label: 'Descuento', variant: 'success' },
}

const fmtFecha = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
    timeZone: 'America/Bogota',
  })
}

const fmtHora = (d) => {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'America/Bogota',
  })
}

const metodoInfo = getMetodoInfo

const getCliente = (pago) =>
  pago?.clienteNombre
    ?? pago?.prestamo?.cliente?.nombre
    ?? pago?.cliente?.nombre
    ?? null

const getCobrador = (pago) =>
  pago?.cobradorNombre
    ?? pago?.cobrador?.nombre
    ?? (typeof pago?.cobrador === 'string' ? pago.cobrador : null)

const getPrestamoId = (pago) => pago?.prestamoId ?? pago?.prestamo?.id ?? null

/**
 * ListadoPagos — renderiza una lista uniforme de pagos.
 *
 * @param {Array} pagos
 * @param {boolean} mostrarCliente  (default auto: true si hay clientes distintos)
 * @param {boolean} mostrarCobrador (default auto: true si hay cobradores)
 * @param {boolean} mostrarLinkPrestamo
 * @param {string} emptyLabel
 * @param {function} renderAcciones  (pago) => ReactNode opcional
 * @param {string} maxHeight  estilo scroll (ej '320px')
 */
export default function ListadoPagos({
  pagos,
  mostrarCliente,
  mostrarCobrador,
  mostrarLinkPrestamo = true,
  emptyLabel = 'Sin pagos registrados',
  renderAcciones,
  maxHeight,
}) {
  const lista = Array.isArray(pagos) ? pagos : []

  if (lista.length === 0) {
    return (
      <p className="text-sm text-[var(--cf-ink-3)] text-center py-4">{emptyLabel}</p>
    )
  }

  // Deteccion automatica de columnas
  const clientesDistintos = new Set(lista.map(getCliente).filter(Boolean)).size
  const mostrarCli = mostrarCliente ?? clientesDistintos > 1
  const hayCobrador = lista.some((p) => getCobrador(p))
  const mostrarCob = mostrarCobrador ?? hayCobrador

  return (
    <div
      className="space-y-2 pr-1"
      style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
    >
      {lista.map((pago) => {
        const tipo = pago.tipo || 'parcial'
        const badge = TIPO_BADGE[tipo] || TIPO_BADGE.parcial
        const esAjuste = ['recargo', 'descuento'].includes(tipo)
        const prefijoMonto = tipo === 'recargo' ? '+' : tipo === 'descuento' ? '−' : ''
        const colorMonto =
          tipo === 'recargo' ? 'var(--cf-gold-dark)'
          : tipo === 'descuento' ? 'var(--cf-green-dark)'
          : 'var(--cf-green-dark)'
        const cliente = getCliente(pago)
        const cobrador = getCobrador(pago)
        const prestamoId = getPrestamoId(pago)
        const metodo = metodoInfo(pago)

        return (
          <div
            key={pago.id}
            className="rounded-[10px] border border-[var(--cf-border)] bg-[var(--cf-card)] px-3 py-2.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {mostrarCli && cliente && (
                  /* El nombre NO se recorta: baja de renglón. */
                  <p className="text-sm font-semibold text-[var(--cf-ink)] [overflow-wrap:anywhere]">{cliente}</p>
                )}
                <p className="text-[11px] text-[var(--cf-ink-3)] mt-0.5">
                  {fmtFecha(pago.fechaPago)}
                  {fmtHora(pago.fechaPago) ? ` · ${fmtHora(pago.fechaPago)}` : ''}
                  {mostrarCob && cobrador ? ` · ${cobrador}` : ''}
                </p>
                {/* ── EL MEDIO Y EL ENLACE, EN UNA FILA CON AIRE ──
                    Eran dos `inline` seguidos: «Efectivo» y «Ver préstamo» salían
                    PEGADOS, sin un píxel entre los dos, y el enlace se leía como
                    parte del chip. El dueño: «está pegado al texto… está mal
                    hecho». La nota va entre medias, en su propio renglón. */}
                {pago.nota && (
                  <p className="text-[11px] mt-1 text-[var(--cf-ink-3)] [overflow-wrap:anywhere]">{pago.nota}</p>
                )}
                {((metodo && !esAjuste) || (mostrarLinkPrestamo && prestamoId)) && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2">
                    {metodo && !esAjuste && (
                      <span
                        className="inline-flex items-center gap-1 px-2 h-[22px] rounded-full text-[11px] font-semibold"
                        style={{ background: metodo.bg, color: metodo.color }}
                      >
                        {metodo.plataforma
                          ? <PlataformaIcon plataforma={metodo.plataforma} size={12} />
                          : <span className="w-1.5 h-1.5 rounded-full" style={{ background: metodo.color }} />
                        }
                        {metodo.label}
                      </span>
                    )}
                    {mostrarLinkPrestamo && prestamoId && (
                      <Link
                        href={`/prestamos/${prestamoId}`}
                        className="inline-flex items-center gap-0.5 h-[22px] text-[12px] font-semibold text-[var(--cf-ink-2)] hover:underline"
                      >
                        Ver préstamo
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                      </Link>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <p
                  className="text-sm font-bold font-mono-display"
                  style={{ color: colorMonto }}
                >
                  {prefijoMonto}{formatMoney(pago.montoPagado)}
                </p>
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </div>
              {renderAcciones && (
                <div className="flex items-center gap-1 shrink-0">
                  {renderAcciones(pago)}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
