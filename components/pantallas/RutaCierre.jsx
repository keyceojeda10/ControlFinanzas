'use client'

// components/pantallas/RutaCierre.jsx — T04-03 la ruta al cerrar el día ·
// T11-02 la ruta en mapa.
//
// ══ LA PANTALLA CAMBIA DE CARA CUANDO EL RECORRIDO TERMINA ══════════════════
//
// Hoy «Registrar cierre de caja» y el historial ocupan el final de la pantalla
// TODO EL DÍA, incluso a las siete de la mañana con cero cobros. El pie de T04-03
// lo dice así, y la solución es que el cierre no exista hasta que haya algo que
// cerrar: cuando el recorrido acaba pasa al frente, con la cuenta ya hecha e
// incluyendo lo que se prestó en la calle.
//
// De ahí la frase dentro de la tarjeta: «aparece cuando terminas el recorrido, no
// todo el día». Es la pantalla explicándose a quien lleva meses viéndola vacía.
//
// ══ LA CUENTA DEL CIERRE NO ES LA DE LA LÁMINA ══════════════════════════════
//
// T04-03 dibuja dos líneas —cobrado y préstamos entregados— y un total que no
// cuadra con su propia resta: pone «$61.500 − $200.000» y luego «a entregar
// $61.500». La fórmula real, la del endpoint de caja del cobrador, es de TRES
// términos: `cobrado − prestado − gastos`. Sexta vez que una lámina afirma una cifra
// que el código contradice.
//
// La aritmética está en `cierreDelDia` del adaptador, incluido el caso que la
// lámina no contempla: que salga negativo porque prestó más de lo que recogió, y
// entonces la casa le debe a él.

const FILETE = { rojo: 'var(--cf-red)', verde: 'var(--cf-green)', oro: 'var(--cf-gold)' }

function Rotulo({ children, color = 'var(--cf-ink-3)' }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
      textTransform: 'uppercase', color,
    }}>{children}</span>
  )
}

function Atras({ onClick, etiqueta = 'Atrás' }) {
  if (!onClick) return null
  return (
    <button type="button" onClick={onClick} aria-label={etiqueta} style={{
      border: 0, background: 'none', padding: 0, cursor: 'pointer', flex: 'none',
      display: 'inline-flex', alignItems: 'center',
    }}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-2)"
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  )
}

/* ══ T04-03 · La ruta al cerrar el día ═════════════════════════════════════ */

/* El resumen va en DORADO PLENO, y es el único sitio del rediseño donde un bloque
   dorado ocupa la cabecera. Se lo gana: la ruta terminó, y lo que hay que ver es
   cuánto entró. El resto de la pantalla está en blanco y carbón, así que no compite
   con nada. */
export function ResumenDeCierre({ etiqueta, valor, porcentaje, progreso = 0, datos = [] }) {
  return (
    <div style={{
      background: 'var(--cf-gold)', borderRadius: 'var(--cf-r-card)',
      padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 13, flex: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Sobre dorado la tinta es oscura, nunca blanca: son los dos tonos de
              `gold-text` y `gold-ink`, que no cambian con el tema porque el fondo
              tampoco. */}
          <Rotulo color="var(--cf-gold-text)">{etiqueta}</Rotulo>
          <span className="cf-fig" style={{
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 32, fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1,
            color: 'var(--cf-gold-ink)',
          }}>{valor}</span>
        </div>
        {porcentaje && (
          <span className="cf-num" style={{
            display: 'inline-flex', alignItems: 'center', height: 26, padding: '0 11px',
            borderRadius: 11, flex: 'none', background: 'rgba(58,41,0,.14)',
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 14, fontWeight: 700, color: 'var(--cf-gold-ink)',
          }}>{porcentaje}</span>
        )}
      </div>

      <div style={{
        height: 8, borderRadius: 999, background: 'rgba(58,41,0,.16)', overflow: 'hidden',
        flex: 'none', display: 'flex',
      }}>
        <span style={{
          width: `${Math.max(0, Math.min(100, progreso))}%`, height: 8,
          borderRadius: 999, background: 'var(--cf-gold-ink)', flex: 'none',
        }} />
      </div>

      {datos.length > 0 && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {datos.map((d) => (
            <span key={d} className="cf-num" style={{
              fontSize: 12, fontWeight: 600, color: 'var(--cf-gold-text)',
            }}>{d}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export function TarjetaCierre({
  rotulo, titulo, ayuda,
  lineas = [], totalTexto, total, aFavor,
  accion = 'Registrar cierre', onCerrar, cerrando,
}) {
  return (
    <div style={{
      flex: 'none', background: 'var(--cf-card)', borderRadius: 'var(--cf-r-card)',
      border: '1.5px solid var(--cf-gold)', boxShadow: '0 0 0 3px var(--cf-gold-focus)',
      padding: 20, display: 'flex', flexDirection: 'column', gap: 15,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <Rotulo>{rotulo}</Rotulo>
        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.01em', color: 'var(--cf-ink)' }}>
          {titulo}
        </span>
        {/* La frase que explica por qué esto no estaba aquí esta mañana. */}
        {ayuda && (
          <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--cf-ink-2)' }}>{ayuda}</span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {lineas.map((l) => (
          <div key={l.id} style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12,
          }}>
            <span style={{ fontSize: 13, color: 'var(--cf-ink-2)' }}>{l.texto}</span>
            <span className="cf-fig" style={{
              fontFamily: 'var(--font-space-grotesk), system-ui',
              fontSize: 17, fontWeight: 600, flex: 'none',
              /* Lo que sale de la caja va en rojo: es lo que el cobrador NO tiene
                 encima aunque lo haya cobrado. */
              color: l.resta ? 'var(--cf-red-dark)' : 'var(--cf-ink)',
            }}>{l.valor}</span>
          </div>
        ))}

        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12,
          paddingTop: 9, borderTop: '1px solid var(--cf-hairline)',
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cf-ink)' }}>{totalTexto}</span>
          <span className="cf-fig" style={{
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 22, fontWeight: 600, letterSpacing: '-.025em', flex: 'none',
            /* A favor del cobrador va en verde: es plata que se le debe, no que
               debe. Sin distinguirlo, «a entregar $138.500» le pediría poner de su
               bolsillo lo que la casa le debe. */
            color: aFavor ? 'var(--cf-green-dark)' : 'var(--cf-ink)',
          }}>{total}</span>
        </div>
      </div>

      <button type="button" onClick={onCerrar} disabled={cerrando} style={{
        height: 48, border: 'none', borderRadius: 14,
        background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', font: 'inherit',
        fontSize: 15, fontWeight: 700,
        cursor: cerrando ? 'progress' : 'pointer', opacity: cerrando ? 0.6 : 1,
      }}>{cerrando ? 'Registrando…' : accion}</button>
    </div>
  )
}

/* Qué pasó en cada casa. El que no pagó lleva su motivo entre comillas y el monto
   en gris: la cifra sigue ahí porque es lo que se dejó de cobrar, pero no entró. */
export function LoQuePasoHoy({ titulo = 'Lo de hoy', filas = [] }) {
  if (filas.length === 0) return null
  return (
    <div style={{
      flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
      borderRadius: 'var(--cf-r-card)', padding: 20,
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <Rotulo>{titulo}</Rotulo>
      {filas.map((f) => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 34, height: 34, borderRadius: 999, flex: 'none',
            background: f.pago ? 'var(--cf-green-pill-bg)' : 'var(--cf-red-pill-bg)',
          }}>
            {f.pago ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--cf-green)"
                strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--cf-red)"
                strokeWidth="2.6" strokeLinecap="round">
                <path d="M7 7l10 10M17 7L7 17" />
              </svg>
            )}
          </span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)' }}>{f.nombre}</span>
            <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{f.detalle}</span>
          </span>
          <span className="cf-fig" style={{
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 16, fontWeight: 600, flex: 'none',
            color: f.pago ? 'var(--cf-green-dark)' : 'var(--cf-ink-3)',
          }}>{f.monto}</span>
        </div>
      ))}
    </div>
  )
}

export default function RutaCerrada({
  titulo, terminado, onAtras, onMas,
  resumen, cierre, onCerrar, cerrando,
  hoyTitulo, hoy = [],
}) {
  return (
    <div style={{
      height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column',
      color: 'var(--cf-ink)',
    }}>
      <div style={{
        flex: 'none', padding: '6px 20px 14px', display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Atras onClick={onAtras} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{
              fontFamily: 'var(--font-space-grotesk), system-ui',
              fontSize: 21, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)',
            }}>{titulo}</span>
            {/* La hora a la que terminó, no «completada»: si el cobrador cerró a
                las 18:38 y son las 21:00, la diferencia importa. */}
            {terminado && (
              <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{terminado}</span>
            )}
          </div>
          {onMas && (
            <button type="button" onClick={onMas} aria-label="Más opciones" style={{
              border: 0, background: 'none', padding: 0, cursor: 'pointer', flex: 'none',
              display: 'inline-flex',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-2)"
                strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1.5" /><circle cx="6" cy="12" r="1.5" /><circle cx="18" cy="12" r="1.5" />
              </svg>
            </button>
          )}
        </div>

        {resumen && <ResumenDeCierre {...resumen} />}
      </div>

      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 20px 20px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {/* EL CIERRE VA PRIMERO, delante del historial. Es lo único que queda por
            hacer, y por la mañana esta tarjeta no existe. */}
        {cierre && <TarjetaCierre {...cierre} onCerrar={onCerrar} cerrando={cerrando} />}
        <LoQuePasoHoy titulo={hoyTitulo} filas={hoy} />
      </div>
    </div>
  )
}

/* ══ T11-02 · La ruta en mapa ══════════════════════════════════════════════
   Vista alterna, en el mismo conmutador lista/mapa del modo ruta. Los pines llevan
   el NÚMERO del recorrido y el COLOR del estado, así que se ve de golpe dónde están
   los morosos — y el color sale de la misma función que el filete de la lista,
   porque dos vistas de lo mismo no pueden discrepar.

   El lienzo del mapa entra por `children`: aquí se construye el chrome —pines,
   leyenda y la tarjeta de la parada actual— y el mapa real lo pone quien monte la
   pantalla. La lámina lo dice en monoespaciado al pie: «el fondo es un marcador,
   aquí va el mapa real». */

export function LeyendaMapa({ items = [] }) {
  return (
    <div style={{
      position: 'absolute', left: 16, top: 16, zIndex: 2,
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
      borderRadius: 999, background: 'var(--cf-card)',
      boxShadow: '0 3px 12px rgba(20,20,28,.16)',
    }}>
      {items.map((l, i) => (
        <span key={l.texto} style={{ display: 'contents' }}>
          <span aria-hidden style={{
            width: 8, height: 8, borderRadius: 999, flex: 'none',
            background: FILETE[l.color] ?? FILETE.oro,
            marginLeft: i > 0 ? 4 : 0,
          }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cf-ink-2)' }}>{l.texto}</span>
        </span>
      ))}
    </div>
  )
}

/* Un pin. El borde blanco de 3px es lo que lo separa del mapa: sin él, un pin verde
   sobre un parque desaparece. */
export function Pin({ orden, color = 'oro', x, y, activo, onClick }) {
  const fondo = FILETE[color] ?? FILETE.oro
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Parada ${orden}`}
      style={{
        position: 'absolute', left: x, top: y, zIndex: activo ? 3 : 1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 34, height: 34, borderRadius: 999, padding: 0,
        background: fondo, border: '3px solid #FFFFFF',
        boxShadow: '0 3px 10px rgba(20,20,28,.28)',
        cursor: onClick ? 'pointer' : 'default', font: 'inherit',
      }}
    >
      <span className="cf-num" style={{
        fontSize: 13, fontWeight: 700,
        // Sobre ámbar la tinta va oscura; sobre rojo y verde, blanca.
        color: color === 'oro' ? 'var(--cf-gold-ink)' : '#FFFFFF',
      }}>{orden}</span>
    </button>
  )
}

export function TuPunto({ x, y }) {
  return (
    <span aria-hidden style={{
      position: 'absolute', left: x, top: y, zIndex: 2,
      width: 16, height: 16, borderRadius: 999,
      background: 'var(--cf-blue)', border: '3px solid #FFFFFF',
      boxShadow: '0 2px 8px rgba(20,20,28,.3)',
    }} />
  )
}

/* La tarjeta flotante: la parada actual con su distancia real. «Cómo llegar» abre
   el mapa del teléfono; «Cobrar» es la acción, y por eso es la única dorada. */
export function TarjetaEnMapa({
  orden, color = 'oro', nombre, pastilla, donde, monto,
  onLlegar, onCobrar,
}) {
  const fondo = FILETE[color] ?? FILETE.oro
  return (
    <div style={{
      position: 'absolute', left: 16, right: 16, bottom: 16, zIndex: 3,
      background: 'var(--cf-card)', borderRadius: 'var(--cf-r-card)',
      boxShadow: '0 8px 28px rgba(20,20,28,.18)', padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <span className="cf-num" style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 34, height: 34, borderRadius: 999, flex: 'none', background: fondo,
          fontSize: 13, fontWeight: 700,
          color: color === 'oro' ? 'var(--cf-gold-ink)' : '#FFFFFF',
        }}>{orden}</span>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {/* El nombre se corta antes que la pastilla: los días de atraso son
                dos caracteres y deciden si se insiste. */}
            <span style={{
              minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              fontSize: 16, fontWeight: 700, letterSpacing: '-.015em', color: 'var(--cf-ink)',
            }}>{nombre}</span>
            {pastilla && (
              <span className="cf-num" style={{
                display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px',
                borderRadius: 11, flex: 'none',
                background: 'var(--cf-red-pill-bg)', border: '1px solid var(--cf-red-pill-border)',
                fontSize: 11, fontWeight: 700, color: 'var(--cf-red-dark)',
              }}>{pastilla}</span>
            )}
          </div>
          {donde && (
            <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-2)' }}>{donde}</span>
          )}
        </div>

        <span className="cf-fig" style={{
          fontFamily: 'var(--font-space-grotesk), system-ui',
          fontSize: 19, fontWeight: 600, letterSpacing: '-.025em', flex: 'none',
          color: 'var(--cf-ink)',
        }}>{monto}</span>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {onLlegar && (
          <button type="button" onClick={onLlegar} style={{
            flex: 1, minWidth: 0, height: 44, borderRadius: 14, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            background: 'var(--cf-fill)', border: '1px solid var(--cf-hairline)',
            font: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--cf-ink)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-2)"
              strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12l16-7-7 16-2-7z" />
            </svg>
            Cómo llegar
          </button>
        )}
        {onCobrar && (
          <button type="button" onClick={onCobrar} style={{
            flex: 1.3, minWidth: 0, height: 44, borderRadius: 14, border: 0, cursor: 'pointer',
            background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', font: 'inherit',
            fontSize: 14, fontWeight: 700,
          }}>Cobrar</button>
        )}
      </div>
    </div>
  )
}

export function RutaEnMapa({
  titulo, detalle, onAtras, conmutador,
  children, pines = [], tuPunto, leyenda = [], tarjeta,
  onPin, onLlegar, onCobrar,
}) {
  return (
    <div style={{
      height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column',
      color: 'var(--cf-ink)',
    }}>
      {/* La cabecera va sobre blanco y no sobre el fondo de la app: separa el
          chrome del mapa, que ocupa todo lo demás. */}
      <div style={{
        flex: 'none', padding: '6px 20px 12px', background: 'var(--cf-card)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Atras onClick={onAtras} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)',
          }}>{titulo}</span>
          {detalle && (
            <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{detalle}</span>
          )}
        </div>
        {conmutador}
      </div>

      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        {children}
        {pines.map((p) => (
          <Pin key={p.id} {...p} onClick={onPin ? () => onPin(p) : undefined} />
        ))}
        {tuPunto && <TuPunto {...tuPunto} />}
        {leyenda.length > 0 && <LeyendaMapa items={leyenda} />}
        {tarjeta && <TarjetaEnMapa {...tarjeta} onLlegar={onLlegar} onCobrar={onCobrar} />}
      </div>
    </div>
  )
}
