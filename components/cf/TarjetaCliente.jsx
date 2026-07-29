'use client'

// components/cf/TarjetaCliente.jsx
//
// LA PIEZA MÁS REPETIDA DEL SISTEMA. docs/design_handoff/03-COMPONENTES.md § 3.
//
// Dos niveles de información, NUNCA tres:
//   nivel 1 — quién:        nombre + estado
//   nivel 2 — dónde/cuándo: días de atraso + dirección
//   y debajo, el monto con su barra.
//
// DECISIONES DE MAQUETACIÓN QUE NO SON OPCIONALES (salieron de defectos reales):
//
//  · La pastilla de días BAJA a la segunda línea. Si comparte fila con el
//    nombre le roba ~51px y el nombre se corta.
//  · La tarjeta es `flex:none`. Con `flex:1` dentro de una columna saturada
//    absorbe todo el déficit, se aplasta y su texto se sale del overflow.
//  · La barra de progreso es `flex:none`. Si es encogible colapsa a 0px y
//    desaparece el estado de la fila.
//  · El fondo es SIEMPRE blanco. El estado va en el riel de 4px, nunca tiñendo
//    la tarjeta: eso era el muro chillón que este rediseño corrige.

import { BarraProgreso, Pastilla } from './primitivos'

const COLOR_ESTADO = {
  mora:   'var(--cf-red)',
  atraso: 'var(--cf-gold)',
  aldia:  'var(--cf-green)',
}

const TONO_BARRA = { mora: 'mal', atraso: 'oro', aldia: 'ok' }

export default function TarjetaCliente({
  nombre,
  iniciales,
  estado = 'aldia',        // 'mora' | 'atraso' | 'aldia'
  etiquetaEstado,          // "Al día", "36d"…
  diasAtraso,              // number | null — va en la SEGUNDA línea
  contexto,                // "Bolivariana · Cl 8 # 31-05"
  etiquetaMonto = 'Deuda total',
  monto,
  porcentaje = 0,
  onClick,
  style,
}) {
  const color = COLOR_ESTADO[estado] || COLOR_ESTADO.aldia

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        position: 'relative',
        background: 'var(--cf-card)',
        border: '1px solid var(--cf-border)',
        borderRadius: 'var(--cf-r-card)',
        padding: '15px 16px 15px 19px',   /* el 19 izquierdo deja sitio al riel */
        display: 'flex', flexDirection: 'column', gap: 11,
        overflow: 'hidden',
        flex: 'none',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {/* El riel: el portador del color de estado */}
      <span aria-hidden style={{
        position: 'absolute', left: 0, top: 14, bottom: 14,
        width: 4, borderRadius: 999, background: color,
      }} />

      {/* ── Nivel 1 · quién ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 40, minWidth: 40, height: 40, aspectRatio: '1',
          borderRadius: 999, flex: 'none',
          background: 'var(--cf-fill)',
          border: estado !== 'aldia' ? `2px solid ${color}` : 'none',
          fontSize: 15, fontWeight: 700, color: 'var(--cf-ink-2)',
        }}>{iniciales}</span>

        <span style={{ flex: 1, minWidth: 0 }}>
          {/* El nombre SOLO en su fila: nada le puede robar ancho. */}
          <span style={{
            display: 'block',
            fontSize: 16, fontWeight: 700, letterSpacing: '-.015em',
            color: 'var(--cf-ink)',
            minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{nombre}</span>

          {/* Nivel 2 · dónde/cuándo — acá baja la pastilla de días */}
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 3, minWidth: 0 }}>
            {diasAtraso > 0 && (
              <Pastilla tono={estado === 'mora' ? 'mora' : 'atraso'} numerica style={{ height: 20, fontSize: 10 }}>
                {diasAtraso}d
              </Pastilla>
            )}
            {contexto && (
              <span style={{
                fontSize: 12, color: 'var(--cf-ink-3)',
                minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{contexto}</span>
            )}
          </span>
        </span>

        {etiquetaEstado && (
          <Pastilla tono={estado} style={{ alignSelf: 'flex-start' }}>{etiquetaEstado}</Pastilla>
        )}
      </div>

      {/* ── El monto y su barra ── */}
      {monto != null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
              {etiquetaMonto}
            </span>
            <span className="cf-num" style={{ fontSize: 11, color: 'var(--cf-ink-3)', flex: 'none' }}>
              {porcentaje}% pagado
            </span>
          </div>
          <span className="cf-fig" style={{ fontSize: 22, letterSpacing: '-.03em', color: 'var(--cf-ink)' }}>
            {monto}
          </span>
          <BarraProgreso porcentaje={porcentaje} tono={TONO_BARRA[estado]} alto={5} />
        </div>
      )}
    </div>
  )
}
