'use client'

// components/pantallas/HojaFiltros.jsx — «Más filtros», en hoja inferior.
//
// EL PROBLEMA QUE RESUELVE: en préstamos había cuatro filas de filtros apiladas
// —estado, frecuencia, modo, ruta— más un desplegable y un «filtros avanzados».
// Con las dos franjas de aviso y la cabecera, eso son más de mil píxeles antes
// del primer préstamo, en un teléfono de 844. Se scrollea una pantalla entera
// para ver un solo préstamo.
//
// La regla del rediseño es «una pantalla, una respuesta». La respuesta de una
// lista son los préstamos, no los controles para encontrarlos. Arriba queda lo
// que se usa todos los días (buscar y el estado); lo demás vive aquí y solo se
// abre cuando hace falta.
//
// El botón de arriba lleva EL NÚMERO de filtros puestos, porque si no, un
// filtro escondido es un filtro olvidado: la lista sale corta y nadie sabe por
// qué.

import HojaInferior from '@/components/cf/HojaInferior'

/** Cuenta los grupos con algo elegido. Es lo que se pinta en el botón. */
export function contarFiltros(grupos = []) {
  return grupos.filter((g) => g.valor !== '' && g.valor != null).length
}

/** El botón que abre la hoja. Va en la fila del buscador. */
export function BotonFiltros({ n = 0, onClick }) {
  const puestos = n > 0
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={puestos ? `Más filtros, ${n} puestos` : 'Más filtros'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, flex: 'none',
        height: 'var(--cf-h-field)', padding: '0 14px', cursor: 'pointer',
        borderRadius: 999,
        background: puestos ? 'var(--cf-gold-tint)' : 'var(--cf-card)',
        border: `1px solid ${puestos ? 'var(--cf-gold-border)' : 'var(--cf-border)'}`,
        color: puestos ? 'var(--cf-gold-dark)' : 'var(--cf-ink-2)',
        fontSize: 13.5, fontWeight: 700,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 5h18l-7 8v5.5l-4 2V13z" />
      </svg>
      {puestos ? n : 'Filtros'}
    </button>
  )
}

/**
 * grupos: [{ id, titulo, valor, onCambiar, opciones: [{ valor, nombre }] }]
 * La opción con valor '' es «sin filtrar» y va siempre primera.
 */
export default function HojaFiltros({ abierta, onCerrar, grupos = [], onLimpiar }) {
  const n = contarFiltros(grupos)

  return (
    <HojaInferior abierta={abierta} onCerrar={onCerrar} titulo="Más filtros">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {grupos.map((g) => (
          <div key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.04em',
              textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
              {g.titulo}
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--cf-gap-chips)' }}>
              {g.opciones.map((o) => {
                const activo = String(g.valor ?? '') === String(o.valor)
                // «Sin filtrar» elegido NO se pinta como filtro puesto. Con el
                // mismo negro, seis grupos sin tocar se leen como seis filtros
                // aplicados y uno se va a buscar por qué la lista sale corta.
                const neutro = String(o.valor) === ''
                return (
                  <button
                    key={String(o.valor)}
                    type="button"
                    onClick={() => g.onCambiar?.(o.valor)}
                    style={{
                      // Un solo color para «elegido» en toda la hoja. Antes cada
                      // fila tenía el suyo —azul la frecuencia, morado el modo—
                      // y tres colores compitiendo enseñan tres jerarquías que
                      // no existen. Aquí lo único que brilla es la plata.
                      height: 38, padding: '0 15px', cursor: 'pointer',
                      borderRadius: 999, fontSize: 13.5,
                      fontWeight: activo ? 700 : 600,
                      background: activo && !neutro ? 'var(--cf-ink)'
                        : activo ? 'var(--cf-fill)' : 'var(--cf-card)',
                      color: activo && !neutro ? 'var(--cf-card)' : 'var(--cf-ink-2)',
                      border: `1px solid ${activo && !neutro ? 'var(--cf-ink)'
                        : activo ? 'var(--cf-border-strong)' : 'var(--cf-border)'}`,
                    }}
                  >
                    {o.nombre}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
          {n > 0 && (
            <button
              type="button"
              onClick={onLimpiar}
              style={{
                flex: 1, height: 'var(--cf-h-btn-2)', cursor: 'pointer',
                borderRadius: 'var(--cf-r-control)', background: 'var(--cf-card)',
                border: '1px solid var(--cf-border-strong)',
                fontSize: 14.5, fontWeight: 700, color: 'var(--cf-ink-2)',
              }}
            >
              Quitar los {n}
            </button>
          )}
          <button
            type="button"
            onClick={onCerrar}
            style={{
              flex: 1, height: 'var(--cf-h-btn-2)', cursor: 'pointer',
              borderRadius: 'var(--cf-r-control)', background: 'var(--cf-gold)',
              border: 0, fontSize: 14.5, fontWeight: 700, color: 'var(--cf-gold-ink)',
            }}
          >
            Ver resultados
          </button>
        </div>
      </div>
    </HojaInferior>
  )
}
