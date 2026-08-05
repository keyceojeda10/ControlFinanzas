'use client'

import { formatMoney } from '@/lib/i18n'
import { getPlataformaInfo, PlataformaIcon } from '@/components/ui/LogoPlataforma'

const COLORES = {
  efectivo: 'var(--cf-green-dark)',
  transferencia: 'var(--cf-ink-2)',
  otro: 'var(--cf-red-dark)',
}

/* EN QUÉ CUENTA ESTÁ CADA PESO.
 *
 * El dueño: «sería mucho más explicativo y sabría el usuario en qué cuenta está
 * qué dinero: qué tanto en Nequi, qué tanto en Bancolombia, qué tanto en
 * Daviplata, y eso hace una suma total de transferencia».
 *
 * Antes esto solo enseñaba lo que ENTRÓ por cada vía. Si prestas por Nequi, esa
 * cuenta baja y no se veía: decía lo que entró a Nequi, no lo que hay en Nequi.
 * Ahora cada cuenta lleva su entrada, su salida y lo que queda.
 */
export default function DesgloseMetodoPago({ items, totalTransferencias = null }) {
  if (!items || !items.length) return null

  // La barra se reparte por lo que ENTRÓ, que es como se leía antes.
  const total = items.reduce((a, i) => a + (i.entra ?? i.monto ?? 0), 0)
  const huboSalidas = items.some((i) => (i.sale ?? 0) > 0)
  if (total <= 0 && !huboSalidas) return null

  // Con una sola vía y sin salidas no hay nada que repartir: era la regla de
  // antes (`items.length <= 1`) y se mantiene, pero ahora sí se pinta cuando esa
  // única vía tiene movimiento en los dos sentidos.
  if (items.length <= 1 && !huboSalidas) return null

  const colorDe = (item) => getPlataformaInfo(item.label)?.color
    || COLORES[item.tipo] || COLORES.transferencia

  return (
    <div
      className="mb-3 rounded-[12px] overflow-hidden"
      style={{
        background: 'var(--cf-card)',
        border: '1px solid var(--cf-border)',
      }}
    >
      {/* Barra apilada */}
      <div className="flex h-2 mx-3 mt-3 rounded-full overflow-hidden" style={{ background: 'var(--cf-fill)' }}>
        {items.map((item) => {
          const entra = item.entra ?? item.monto ?? 0
          const pct = total > 0 ? (entra / total) * 100 : 0
          if (pct <= 0) return null
          return (
            <div
              key={item.label}
              style={{ width: `${pct}%`, background: colorDe(item), minWidth: 4 }}
            />
          )
        })}
      </div>

      {/* Filas */}
      <div className="px-3 py-2 space-y-2">
        {items.map((item) => {
          const entra = item.entra ?? item.monto ?? 0
          const sale = item.sale ?? 0
          const neto = item.neto ?? (entra - sale)
          const pct = total > 0 ? Math.round((entra / total) * 100) : 0
          const platInfo = getPlataformaInfo(item.label)
          const rowColor = colorDe(item)
          return (
            <div key={item.label}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {platInfo
                    ? <PlataformaIcon plataforma={item.label} size={14} />
                    : <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: rowColor }}
                      />
                  }
                  <span className="text-[12px] font-medium truncate" style={{ color: 'var(--cf-ink-2)' }}>
                    {item.label}
                  </span>
                  {entra > 0 && (
                    <span className="text-[10px] font-semibold shrink-0" style={{ color: rowColor }}>
                      {pct}%
                    </span>
                  )}
                </div>
                <span className="text-[12px] font-bold font-mono-display shrink-0" style={{ color: 'var(--cf-ink)' }}>
                  {formatMoney(neto)}
                </span>
              </div>

              {/* El desglose de la cuenta: solo cuando hay las dos cosas, o la
                  línea se llenaría de «entró X · salió 0» que no dice nada. */}
              {sale > 0 && (
                <div className="flex items-center justify-end gap-3 mt-0.5 pr-0.5">
                  <span className="text-[10px] font-mono-display" style={{ color: 'var(--cf-green-dark)' }}>
                    entró {formatMoney(entra)}
                  </span>
                  <span className="text-[10px] font-mono-display" style={{ color: 'var(--cf-red-dark)' }}>
                    salió {formatMoney(sale)}
                  </span>
                </div>
              )}

              {/* Lo que no se pudo clasificar se dice, no se esconde: un
                  desglose que se come plata en silencio es peor que ninguno. */}
              {item.tipo === 'otro' && (
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--cf-red-dark)' }}>
                  Sin método de pago registrado. Se cuenta como efectivo.
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* EL TOTAL POR TRANSFERENCIA, que es lo que el dueño pidió poder leer sin
          sumar las cuentas de cabeza. Solo si hay más de una: con una sola, el
          total repetiría el renglón de arriba. */}
      {totalTransferencias?.cuentas > 1 && (
        <div
          className="px-3 py-2 flex items-center justify-between gap-2"
          style={{ borderTop: '1px solid var(--cf-border)', background: 'var(--cf-fill)' }}
        >
          <span className="text-[11px] font-semibold" style={{ color: 'var(--cf-ink-2)' }}>
            En cuentas ({totalTransferencias.cuentas})
          </span>
          <span className="text-[12px] font-bold font-mono-display" style={{ color: 'var(--cf-ink)' }}>
            {formatMoney(totalTransferencias.neto)}
          </span>
        </div>
      )}
    </div>
  )
}
