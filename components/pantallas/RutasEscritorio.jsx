'use client'

// components/pantallas/RutasEscritorio.jsx — T14-02 «Rutas (escritorio)».
//
// ── POR QUÉ NO ES UNA TABLA ────────────────────────────────────────────────
//
// El pie de la lámina lo dice, y va en contra de lo que hicimos en clientes y
// préstamos: «Rutas NO va como tabla: son cuatro, y lo que el dueño mira es el
// estado de cada una, no compararlas fila a fila».
//
// Es correcto. Una tabla sirve para COMPARAR muchas filas por una columna; con
// cuatro rutas no hay nada que comparar, y en cambio cada una tiene un estado
// compuesto —cuánto lleva del día, cuántos cobros faltan, si tiene cobrador—
// que en una fila de tabla se aplasta en celdas sueltas.
//
// Así que en 1440 son las MISMAS tarjetas, pero en dos columnas y con el estado
// completo: la lámina les añade la cartera de la ruta, los cobros de hoy, el
// cumplimiento y el recorrido, que en móvil no caben.
//
// ── LO QUE ARREGLA ─────────────────────────────────────────────────────────
//
// El dueño: «en el apartado de rutas no tiene una versión de PC, se ve como se
// ve en móvil y se ve bastante feo». Y tenía razón: la lista de móvil estirada
// a 1142px deja una tarjeta por renglón con dos cifras y medio metro de blanco
// a la derecha.
//
// NO tiene lógica propia: recibe las rutas ya adaptadas y devuelve los clics.
// Lo que decide qué se ve sigue en la página.

import { BarraProgreso } from '@/components/cf/primitivos'

/* Una cifra del pie de la tarjeta: rótulo arriba, valor abajo. Las tres van
   separadas por un filete de 1px, como la tira de cifras de la tarjeta móvil. */
function Cifra({ etiqueta, valor, tono }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
        textTransform: 'uppercase', color: 'var(--cf-ink-3)',
      }}>{etiqueta}</span>
      <span className="cf-fig" style={{
        fontSize: 15, fontWeight: 600,
        color: tono === 'contra' ? 'var(--cf-red-dark)'
          : tono === 'favor' ? 'var(--cf-green-dark)' : 'var(--cf-ink)',
      }}>{valor}</span>
    </div>
  )
}

const Filete = () => (
  <span aria-hidden style={{ width: 1, background: 'var(--cf-hairline)', flex: 'none' }} />
)

/* El riel de color: el mismo portador de estado que la tarjeta de móvil, para
   que la lectura no cambie entre dispositivos. */
function colorRiel(pastilla) {
  if (pastilla?.tono === 'mora') return 'var(--cf-red)'
  if (pastilla?.tono === 'atraso') return 'var(--cf-gold)'
  if (pastilla?.tono === 'neutro') return 'var(--cf-ink-4)'
  return 'var(--cf-green)'
}

function TarjetaRuta({ ruta, onAbrir, onAsignar }) {
  const sinCobrador = !ruta.cobrador
  return (
    <button
      type="button"
      onClick={() => onAbrir?.(ruta)}
      style={{
        position: 'relative', textAlign: 'left', font: 'inherit', cursor: 'pointer',
        background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
        borderRadius: 'var(--cf-r-card)', padding: '20px 22px',
        display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden',
      }}
    >
      <span aria-hidden style={{
        position: 'absolute', left: 0, top: 16, bottom: 16, width: 4,
        borderRadius: 999, background: colorRiel(ruta.pastilla),
      }} />

      {/* Nombre + pastilla de estado, y debajo quién cobra y cuántos clientes. */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
            <span style={{
              fontFamily: 'var(--font-space-grotesk), system-ui',
              fontSize: 19, fontWeight: 600, letterSpacing: '-.02em',
              color: 'var(--cf-ink)', minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{ruta.nombre}</span>
            {ruta.pastilla?.texto && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', flex: 'none',
                height: 21, padding: '0 8px', borderRadius: 11,
                fontSize: 11, fontWeight: 700,
                background: ruta.pastilla.tono === 'mora'
                  ? 'color-mix(in srgb, var(--cf-red) 12%, transparent)'
                  : 'color-mix(in srgb, var(--cf-gold) 14%, transparent)',
                border: `1px solid ${ruta.pastilla.tono === 'mora'
                  ? 'color-mix(in srgb, var(--cf-red) 25%, transparent)'
                  : 'color-mix(in srgb, var(--cf-gold) 30%, transparent)'}`,
                color: ruta.pastilla.tono === 'mora' ? 'var(--cf-red-dark)' : 'var(--cf-gold-text)',
              }}>{ruta.pastilla.texto}</span>
            )}
          </div>
          <span className="cf-num" style={{
            fontSize: 12, color: 'var(--cf-ink-3)', minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{ruta.subtitulo}</span>
        </div>

        {/* UNA RUTA SIN COBRADOR ES UN AGUJERO, no una tarjeta más: sus cobros
            no salen en la pantalla de nadie. Por eso la salida va aquí arriba y
            no escondida en un menú. */}
        {sinCobrador && onAsignar && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onAsignar(ruta) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onAsignar(ruta) } }}
            style={{
              flex: 'none', fontSize: 12.5, fontWeight: 700,
              color: 'var(--cf-gold-dark)', cursor: 'pointer',
            }}
          >Asignar</span>
        )}
      </div>

      {/* La cartera a la izquierda y lo de HOY a la derecha: lo que se tiene
          puesto en esta ruta, y cómo va la jornada. */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        {ruta.cartera && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '.09em',
              textTransform: 'uppercase', color: 'var(--cf-ink-3)',
            }}>Cartera de la ruta</span>
            <span className="cf-fig" style={{
              fontSize: 25, fontWeight: 600, letterSpacing: '-.03em',
              lineHeight: 1, color: 'var(--cf-ink)',
            }}>{ruta.cartera}</span>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end', flex: 'none' }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.09em',
            textTransform: 'uppercase', color: 'var(--cf-ink-3)',
          }}>Hoy</span>
          <span className="cf-fig" style={{
            fontSize: 17, fontWeight: 600, color: 'var(--cf-ink-2)', whiteSpace: 'nowrap',
          }}>{ruta.recaudado} de {ruta.esperado}</span>
        </div>
      </div>

      <BarraProgreso
        porcentaje={ruta.porcentaje ?? 0}
        tono={ruta.pastilla?.tono === 'mora' ? 'mora' : ruta.inactiva ? 'neutro' : 'aldia'}
        alto={7}
      />

      {/* Las tres cifras del pie. Solo si hay algo que contar: en una ruta sin
          cobros hoy serían tres ceros, que es ruido con forma de dato. */}
      {(ruta.cobrosHoy || ruta.cumple) && (
        <div style={{
          display: 'flex', gap: 8, paddingTop: 12,
          borderTop: '1px solid var(--cf-hairline)',
        }}>
          {ruta.cobrosHoy && <Cifra etiqueta="Cobros hoy" valor={ruta.cobrosHoy} />}
          {ruta.cobrosHoy && ruta.cumple && <Filete />}
          {ruta.cumple && <Cifra etiqueta="Cumple" valor={ruta.cumple.valor} tono={ruta.cumple.tono} />}
          <Filete />
          <Cifra etiqueta="Clientes" valor={String(ruta.clientes ?? 0)} />
        </div>
      )}
    </button>
  )
}

/**
 * @param rutas     las de `adaptarRutas`
 * @param resumen   «4 rutas · $34.500 de $207.500 hoy»
 * @param sinRuta   { cantidad, monto } — el agujero de los clientes sin ruta
 * @param acciones  los botones del encabezado, ya compuestos por la página
 */
export default function RutasEscritorio({
  rutas = [], resumen, sinRuta, acciones,
  onAbrir, onAsignar, onVerSinRuta,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Encabezado: título y cifras a la izquierda, acciones a la derecha.
          En móvil los controles van en la fila del título por falta de sitio;
          aquí sobra, así que respiran. */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <h1 style={{
            margin: 0, fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 27, fontWeight: 600, letterSpacing: '-.025em', color: 'var(--cf-ink)',
          }}>Rutas</h1>
          {resumen && (
            <span className="cf-num" style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>{resumen}</span>
          )}
        </div>
        {acciones && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>{acciones}</div>
        )}
      </div>

      {/* La franja del agujero: clientes sin ruta. Va ARRIBA y no al final de la
          lista porque es lo que hay que resolver, no un elemento más. */}
      {sinRuta?.cantidad > 0 && (
        <div style={{
          display: 'flex', gap: 11, alignItems: 'center',
          padding: '14px 18px', borderRadius: 'var(--cf-r-card)',
          background: 'var(--cf-gold-tint-2)', border: '1px solid var(--cf-gold-border)',
        }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--cf-gold-dark)"
            strokeWidth="2.1" strokeLinecap="round" style={{ flex: 'none' }}>
            <path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" />
          </svg>
          <span style={{ fontSize: 13, color: 'var(--cf-gold-text)', flex: 1, minWidth: 0 }}>
            <strong>{sinRuta.cantidad} {sinRuta.cantidad === 1 ? 'cliente' : 'clientes'} sin ruta
              {sinRuta.monto ? ` · ${sinRuta.monto}` : ''}.</strong>{' '}
            Sus cobros no salen en la pantalla de nadie.
          </span>
          {onVerSinRuta && (
            <button type="button" onClick={onVerSinRuta} style={{
              flex: 'none', background: 'none', border: 0, padding: 0, cursor: 'pointer',
              font: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--cf-gold-text)',
            }}>Asignarlos</button>
          )}
        </div>
      )}

      {/* DOS COLUMNAS. Con tres o cuatro rutas, una sola deja medio 1440 en
          blanco; con más de seis, tres columnas dejan las tarjetas tan estrechas
          que la cartera vuelve a no caber. */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16,
      }}>
        {rutas.map((r) => (
          <TarjetaRuta key={r.id} ruta={r} onAbrir={onAbrir} onAsignar={onAsignar} />
        ))}
      </div>
    </div>
  )
}
