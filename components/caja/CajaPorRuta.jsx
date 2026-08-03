'use client'

// components/caja/CajaPorRuta.jsx — T08-02 «Caja · por ruta».
//
// Sustituye al `<select>` de cobrador y la media pantalla en blanco. Ahora se
// ven TODAS las rutas de una, cada una con lo recaudado partido en efectivo y
// digital.
//
// La partición es el punto: al cerrar el día, de lo que cobró esta ruta el
// cobrador solo entrega EL EFECTIVO. Lo digital ya está en la cuenta. Sin
// separarlo, se le pide una cifra que incluye plata que nunca tocó.
//
// El selector de cobrador NO desaparece: sigue debajo para el detalle de uno,
// que es otra pregunta («qué hizo Pepito hoy»). Lo que cambia es que ya no hay
// que elegir para ver algo.

/* Los dos tramos de la barra: cuánto de lo cobrado es efectivo y cuánto digital.
   Es la misma barra partida del bloque oscuro de «Cuentas». */
function BarraPartida({ pctEfectivo, pctDigital, alto = 8 }) {
  if (!pctEfectivo && !pctDigital) return null
  return (
    <span aria-hidden style={{
      display: 'flex', height: alto, borderRadius: 999, overflow: 'hidden',
      background: 'var(--cf-fill)', flex: 'none',
    }}>
      {pctEfectivo > 0 && <span style={{ width: `${pctEfectivo}%`, background: 'var(--cf-gold)' }} />}
      {pctDigital > 0 && <span style={{ width: `${pctDigital}%`, background: 'var(--cf-green)' }} />}
    </span>
  )
}

function Cifra({ etiqueta, valor, color }) {
  if (valor == null) return null
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: '.06em',
        textTransform: 'uppercase', color: 'var(--cf-ink-3)',
      }}>{etiqueta}</span>
      <span className="cf-fig" style={{ fontSize: 14, fontWeight: 600, color: color ?? 'var(--cf-ink)' }}>
        {valor}
      </span>
    </div>
  )
}

/* La leyenda de los colores. Sin ella la barra son dos tramos de colores que no
   dicen cuál es cuál. */
function Punto({ color, children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--cf-ink-3)' }}>
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: color, flex: 'none' }} />
      {children}
    </span>
  )
}

export default function CajaPorRuta({ filas = [], totales, onAbrirRuta }) {
  if (!filas.length) {
    return (
      <div style={{
        background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
        borderRadius: 'var(--cf-r-card)', padding: '26px 20px', textAlign: 'center',
      }}>
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--cf-ink-3)' }}>
          Todavía no hay cobros hoy en ninguna ruta.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* El total del día, partido igual que las filas: es la suma de lo de
          abajo y se lee con la misma gramática. */}
      {totales?.hayAlgo && (
        <div style={{
          background: '#15161A', borderRadius: 'var(--cf-r-card)',
          padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
              textTransform: 'uppercase', color: '#A3A8B2',
            }}>Recaudado hoy</span>
            <span className="cf-fig" style={{
              fontSize: 30, fontWeight: 600, letterSpacing: '-.035em', lineHeight: 1, color: '#F3F3F6',
            }}>{totales.total}</span>
          </span>
          <span aria-hidden style={{
            display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden',
            background: 'rgba(255,255,255,.08)', flex: 'none',
          }}>
            {totales.pctEfectivo > 0 && <span style={{ width: `${totales.pctEfectivo}%`, background: 'var(--cf-gold)' }} />}
            {totales.pctDigital > 0 && <span style={{ width: `${totales.pctDigital}%`, background: 'var(--cf-green)' }} />}
          </span>
          <span style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#A3A8B2' }}>
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--cf-gold)' }} />
              Efectivo <strong style={{ color: '#F3F3F6' }}>{totales.efectivo}</strong>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#A3A8B2' }}>
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--cf-green)' }} />
              Digital <strong style={{ color: '#F3F3F6' }}>{totales.digital}</strong>
            </span>
          </span>
        </div>
      )}

      {/* Una tarjeta por ruta. En PC, dos columnas. */}
      <div className="contents lg:grid lg:grid-cols-2 lg:gap-3">
        {filas.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => !f.sinRuta && onAbrirRuta?.(f)}
            style={{
              textAlign: 'left', font: 'inherit',
              cursor: f.sinRuta || !onAbrirRuta ? 'default' : 'pointer',
              background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
              borderRadius: 'var(--cf-r-card)', padding: '16px 18px',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{
                  fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)',
                  minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  // La de «sin ruta» es un agujero, no una ruta: se dice en
                  // cursiva y en tinta clara, como el «Sin ruta» de clientes.
                  ...(f.sinRuta ? { fontStyle: 'italic', color: 'var(--cf-ink-3)' } : {}),
                }}>{f.nombre}</span>
                <span className="cf-num" style={{
                  fontSize: 11.5, color: 'var(--cf-ink-3)',
                  minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{f.subtitulo}</span>
              </div>
              <span className="cf-fig" style={{
                fontSize: 19, fontWeight: 600, letterSpacing: '-.02em',
                color: 'var(--cf-ink)', flex: 'none',
              }}>{f.total}</span>
            </div>

            <BarraPartida pctEfectivo={f.pctEfectivo} pctDigital={f.pctDigital} />

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Punto color="var(--cf-gold)">Efectivo <strong style={{ color: 'var(--cf-ink-2)' }}>{f.efectivo}</strong></Punto>
              <Punto color="var(--cf-green)">Digital <strong style={{ color: 'var(--cf-ink-2)' }}>{f.digital}</strong></Punto>
            </div>

            {f.esperado && (
              <div style={{
                display: 'flex', gap: 8, paddingTop: 10,
                borderTop: '1px solid var(--cf-hairline)',
              }}>
                <Cifra etiqueta="Esperado hoy" valor={f.esperado} />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
