'use client'
/* DE DÓNDE VIENEN SUS CLIENTES (3 oct 2026).
 *
 * «Si la ruta 9 no está rindiendo lo suficientemente bien a partir de que le
 *  unieron la ruta 10, entonces no era la ruta o el cobrador como tal, sino
 *  eran las personas de esa ruta.» — el dueño.
 *
 * Un renglón por grupo: los que llegaron de cada ruta y los que ya eran de esta.
 * Las cifras las da el servidor (`compararProcedencias` en
 * lib/rutas/procedencia.js) con las mismas cuentas que la ficha de cada
 * cliente. «Ver solo estos» filtra la lista de la ruta.
 *
 * Solo sale si alguien llegó de otra ruta: sin eso no hay nada que comparar.
 */
import { TiraCifras } from '@/components/cf/primitivos'
import { fechaCorta } from '@/lib/adaptadores/prestamos'

/** «Llegaron de Ruta 10 · desde el 5 oct» / «Ya eran de Ruta 9». */
export function tituloProcedencia(g, nombreRuta) {
  if (g.clave === 'propios') return `Ya eran de ${nombreRuta}`
  const desde = g.desde ? fechaCorta(g.desde) : null
  return `Llegaron de ${g.nombre}${desde ? ` · desde el ${desde}` : ''}`
}

/* `compacto`: la columna derecha del PC mide ~245px y cuatro cifras en fila
   salían «CLIE…», «ATRA…» y el atraso en miniatura. Ahí van dos y dos. */
export default function ProcedenciaRuta({ grupos, nombreRuta, filtro, onFiltro, formatMoney, compacto = false }) {
  if (!grupos?.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {grupos.map((g) => {
        const activo = filtro === g.clave
        return (
          <div key={g.clave} style={{
            display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px',
            borderRadius: 'var(--cf-r-card-sm)', background: 'var(--cf-card)',
            border: activo ? '1.5px solid var(--cf-ink)' : '1px solid var(--cf-border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)', overflowWrap: 'anywhere' }}>
                {tituloProcedencia(g, nombreRuta)}
              </span>
              <button
                type="button"
                aria-pressed={activo}
                onClick={() => onFiltro?.(activo ? null : g.clave)}
                style={{
                  background: 'none', border: 0, padding: '4px 0', cursor: 'pointer', font: 'inherit',
                  fontSize: 13, fontWeight: 600, color: activo ? 'var(--cf-ink)' : 'var(--cf-ink-2)',
                  textDecoration: 'underline', textUnderlineOffset: 3,
                }}
              >{activo ? 'Quitar filtro' : 'Ver solo estos'}</button>
            </div>
            {(() => {
              const columnas = [
                { etiqueta: 'Clientes', valor: String(g.clientes) },
                // De los que deben algo: el que ya pagó todo no está ni al día ni atrasado.
                { etiqueta: 'Atrasados', valor: g.pctAtrasados == null ? '—' : `${g.pctAtrasados}%`, tono: g.atrasados > 0 ? 'contra' : undefined },
                { etiqueta: 'Cumplen', valor: g.cumplimiento == null ? '—' : `${g.cumplimiento}%` },
                { etiqueta: 'Atraso', valor: formatMoney(g.atraso), tono: g.atraso > 0 ? 'contra' : undefined },
              ]
              return compacto
                ? <>
                    <TiraCifras enTarjeta columnas={columnas.slice(0, 2)} />
                    <TiraCifras columnas={columnas.slice(2)} />
                  </>
                : <TiraCifras enTarjeta columnas={columnas} />
            })()}
          </div>
        )
      })}
    </div>
  )
}
