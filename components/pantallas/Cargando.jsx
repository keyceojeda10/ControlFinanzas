'use client'

// components/pantallas/Cargando.jsx — T05-06 cargando · T34-02 novedades.
//
// ══ EL ESQUELETO TIENE LA FORMA DE LO QUE VA A APARECER ═════════════════════
//
// No barras genéricas: el hueco del bloque grande mide lo que mide el bloque
// grande, y la tarjeta de lista tiene su avatar, sus dos líneas y su cifra a la
// derecha. Si el hueco no coincide con lo que llega, al cargar todo salta y la
// pantalla parece que se rompió — que es peor que no haber enseñado nada.
//
// Por eso no hay una sola pieza que valga para todo: hay una por forma, y
// cada pantalla arma la suya con las que le tocan.
//
// Y NO SE ANIMA. Un brillo recorriendo ocho tarjetas en un teléfono de gama baja
// cuesta cuadros justo cuando el hilo está ocupado pidiendo datos. La quietud
// también dice «espera».

const CARBON = '#15161A'
const CARBON_ORO = '#F5B824'
const CARBON_TINTA = '#F3F3F6'
const CARBON_TINTA_2 = '#C4C7CD'

function Rotulo({ children }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
      textTransform: 'uppercase', color: 'var(--cf-ink-3)',
    }}>{children}</span>
  )
}

/* Una barra. `alto` y `ancho` imitan al texto que va a caer ahí.
   Dos grises: el del dato principal y el del secundario. Con uno solo, el
   esqueleto se lee como una reja. */
export function Hueco({ ancho, alto = 15, radio = 5, tenue, reparte }) {
  return (
    <span aria-hidden style={{
      display: 'block', height: alto, borderRadius: radio,
      // `reparte` es para los que van en fila y se reparten el ancho. Con un
      // width: '100%' cada uno pedia el ancho entero y la fila se desbordaba.
      ...(reparte ? { flex: 1, minWidth: 0 } : { flex: 'none', width: ancho ?? '100%' }),
      background: tenue ? 'var(--cf-fill)' : 'var(--cf-fill-2)',
    }} />
  )
}

/* El bloque grande de arriba — patrimonio, cartera, lo que sea. */
export function HuecoBloque({ alto = 150 }) {
  return (
    <span aria-hidden style={{
      display: 'block', height: alto, borderRadius: 'var(--cf-r-card)',
      background: 'var(--cf-fill-2)', flex: 'none',
    }} />
  )
}

/* Dos cifras lado a lado. */
export function HuecoDosCifras() {
  return (
    <div aria-hidden style={{ display: 'flex', gap: 10, flex: 'none' }}>
      {[[56, 104], [48, 80]].map(([r, c], i) => (
        <div key={i} style={{
          flex: 1, minWidth: 0, height: 88, borderRadius: 'var(--cf-r-card)',
          background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <Hueco ancho={r} alto={9} tenue />
          <Hueco ancho={c} alto={20} radio={6} />
        </div>
      ))}
    </div>
  )
}

/* Una tarjeta de lista: avatar, dos líneas y una cifra. Es la forma más repetida
   del sistema, así que es la que más importa que no salte. */
export function HuecoFila({ conPie, atenuada }) {
  return (
    <div aria-hidden style={{
      flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
      borderRadius: 'var(--cf-r-card)', padding: 20,
      display: 'flex', flexDirection: 'column', gap: 16,
      // Las de más abajo se desvanecen: dice «hay más» sin dibujar diez.
      opacity: atenuada ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{
          width: 44, height: 44, borderRadius: 999, flex: 'none', background: 'var(--cf-fill-2)',
        }} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <Hueco ancho={132} />
          <Hueco ancho={168} alto={11} tenue />
        </div>
        <Hueco ancho={74} alto={20} radio={6} />
      </div>
      {conPie && (
        <div style={{ display: 'flex', gap: 8, paddingTop: 14, borderTop: '1px solid var(--cf-hairline)' }}>
          {[0, 1, 2, 3].map((i) => <Hueco key={i} alto={32} radio={6} tenue reparte />)}
        </div>
      )}
    </div>
  )
}

/* El panel cargando, armado con las piezas. La cabecera conserva la moneda —lo
   único que ya se sabe— para que al llegar los datos no parpadee entera. */
export function PanelCargando() {
  return (
    <div aria-busy="true" aria-label="Cargando" style={{
      height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        flex: 'none', padding: '6px 20px 14px', display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 30, height: 30, borderRadius: 11, flex: 'none',
            background: 'var(--cf-gold)', border: '2px solid var(--cf-gold-light)',
          }}>
            <span style={{
              fontFamily: 'var(--font-space-grotesk), system-ui',
              fontSize: 15, fontWeight: 700, color: 'var(--cf-gold-ink)',
            }}>$</span>
          </span>
          <Hueco ancho={150} alto={17} radio={6} />
        </div>
        <HuecoBloque />
      </div>

      <div style={{
        flex: 1, minHeight: 0, overflow: 'hidden', padding: '0 20px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <HuecoDosCifras />
        <HuecoFila conPie />
        <HuecoFila conPie atenuada />
      </div>
    </div>
  )
}

/* ══ T34-02 · Novedades ════════════════════════════════════════════════════
   UNA SOLA SE EXPLICA; LAS DEMÁS SON UNA LÍNEA. Siete novedades con la misma
   jerarquía no se leen: se cierran. La primera va en carbón, con lo que hace y
   POR QUÉ sirve —«así dejan de llamarte a preguntar»— y con su acción.

   «LUEGO» EXISTE Y NO ESCONDE NADA. Sin salida, la hoja se cierra por la X y la
   novedad se pierde igual; con ella, la respuesta queda dicha. */
export function Novedades({
  titulo, detalle, onCerrar,
  destacada, onActivar, onLuego,
  restoTitulo, resto = [], onVerTodas, onNovedad,
}) {
  return (
    <div style={{
      height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column',
      background: 'var(--cf-surface)', color: 'var(--cf-ink)',
      borderRadius: 'var(--cf-r-sheet) var(--cf-r-sheet) 0 0', overflow: 'hidden',
      boxShadow: '0 -12px 32px rgba(20,20,28,.18)',
    }}>
      <div style={{ flex: 'none', padding: '10px 0 0', display: 'flex', flexDirection: 'column' }}>
        <span aria-hidden style={{
          width: 38, height: 4, borderRadius: 999, alignSelf: 'center', marginBottom: 14,
          background: 'var(--cf-border-strong)',
        }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '0 22px 14px' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{
              fontFamily: 'var(--font-space-grotesk), system-ui',
              fontSize: 20, fontWeight: 600, letterSpacing: '-.02em',
            }}>{titulo}</span>
            {detalle && (
              <span style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>{detalle}</span>
            )}
          </div>
          {onCerrar && (
            <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{
              border: 0, background: 'none', padding: 0, cursor: 'pointer', flex: 'none',
              display: 'inline-flex', marginTop: 3,
            }}>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-2)"
                strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 22px 22px',
        display: 'flex', flexDirection: 'column', gap: 11,
      }}>
        {destacada && (
          <div style={{
            flex: 'none', background: CARBON, borderRadius: 20, padding: '20px 22px',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start',
              height: 22, padding: '0 9px', borderRadius: 11,
              background: 'rgba(245,184,36,.16)',
              fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
              textTransform: 'uppercase', color: CARBON_ORO,
            }}>{destacada.etiqueta ?? 'Lo más útil'}</span>

            <span style={{
              fontFamily: 'var(--font-space-grotesk), system-ui',
              fontSize: 23, fontWeight: 600, letterSpacing: '-.025em', lineHeight: 1.2,
              color: CARBON_TINTA,
            }}>{destacada.titulo}</span>

            {/* Qué hace y POR QUÉ sirve. «Así dejan de llamarte a preguntar» es lo
                que convierte una función en una razón para tocarla. */}
            <span style={{ fontSize: 14, lineHeight: 1.5, color: CARBON_TINTA_2 }}>
              {destacada.texto}
            </span>

            <div style={{ display: 'flex', gap: 9 }}>
              {onActivar && (
                <button type="button" onClick={onActivar} style={{
                  flex: 1, minWidth: 0, height: 46, borderRadius: 13, border: 0, cursor: 'pointer',
                  background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', font: 'inherit',
                  fontSize: 14, fontWeight: 700,
                }}>{destacada.accion ?? 'Activarlo ahora'}</button>
              )}
              {onLuego && (
                <button type="button" onClick={onLuego} style={{
                  flex: 'none', height: 46, padding: '0 16px', borderRadius: 13, cursor: 'pointer',
                  background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.16)',
                  font: 'inherit', fontSize: 14, fontWeight: 600, color: CARBON_TINTA,
                }}>Luego</button>
              )}
            </div>
          </div>
        )}

        {resto.length > 0 && (
          <>
            <div style={{
              flex: 'none', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', gap: 12, padding: 2,
            }}>
              <Rotulo>{restoTitulo ?? `Las otras ${resto.length}, en una línea`}</Rotulo>
              {onVerTodas && (
                <button type="button" onClick={onVerTodas} style={{
                  border: 0, background: 'none', padding: 0, cursor: 'pointer', flex: 'none',
                  font: 'inherit', fontSize: 12, fontWeight: 700, color: 'var(--cf-gold-dark)',
                }}>Ver las {resto.length}</button>
              )}
            </div>

            <div style={{
              flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
              borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
            }}>
              {resto.map((n, i) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onNovedad?.(n)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                    padding: '13px 17px', background: 'none', border: 0,
                    borderTop: i === 0 ? 'none' : '1px solid var(--cf-hairline)',
                    cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'var(--cf-ink)',
                  }}
                >
                  <span aria-hidden style={{
                    width: 7, height: 7, borderRadius: 999, flex: 'none', background: 'var(--cf-gold)',
                  }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600 }}>{n.texto}</span>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cf-chevron)"
                    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
