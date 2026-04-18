'use client'
// components/pagos/ListadoPagos.jsx
// Componente unificado para renderizar listas de pagos en distintas vistas
// (caja, historial de cliente, cobradores, etc).

import Link from 'next/link'
import { formatCOP } from '@/lib/calculos'
import { Badge } from '@/components/ui/Badge'

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

const metodoLabel = (pago) => {
  if (pago?.metodoPago === 'transferencia') {
    return pago?.plataforma ? `Transferencia · ${pago.plataforma}` : 'Transferencia'
  }
  if (pago?.metodoPago === 'efectivo') return 'Efectivo'
  return null
}

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
      <p className="text-sm text-[var(--color-text-muted)] text-center py-4">{emptyLabel}</p>
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
          tipo === 'recargo' ? '#f97316'
          : tipo === 'descuento' ? 'var(--color-success)'
          : 'var(--color-success)'
        const cliente = getCliente(pago)
        const cobrador = getCobrador(pago)
        const prestamoId = getPrestamoId(pago)
        const metodo = metodoLabel(pago)

        return (
          <div
            key={pago.id}
            className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {mostrarCli && cliente && (
                  <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{cliente}</p>
                )}
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                  {fmtFecha(pago.fechaPago)}
                  {fmtHora(pago.fechaPago) ? ` · ${fmtHora(pago.fechaPago)}` : ''}
                  {mostrarCob && cobrador ? ` · ${cobrador}` : ''}
                  {metodo && !esAjuste ? ` · ${metodo}` : ''}
                </p>
                {pago.nota && (
                  <p className="text-[11px] mt-0.5 text-[#aaaaaa]">{pago.nota}</p>
                )}
                {mostrarLinkPrestamo && prestamoId && (
                  <Link
                    href={`/prestamos/${prestamoId}`}
                    className="inline-block mt-1 text-[11px] text-[var(--color-info)] hover:underline"
                  >
                    Ver préstamo
                  </Link>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <p
                  className="text-sm font-bold font-mono-display"
                  style={{ color: colorMonto }}
                >
                  {prefijoMonto}{formatCOP(pago.montoPagado)}
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
