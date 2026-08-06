'use client'

// components/pantallas/SociosReparto.jsx — T45. Lo que el turno 45 añade sobre
// `Socios.jsx` (turno 44 + adenda 08), que sigue teniendo la decisión de producto
// escrita en su cabecera y el desglose de la ficha del socio.
//
// Lo que cambia y por qué:
//
//   · LA BARRA PARTIDA sustituye a la tarjeta que explicaba el modelo. «La
//     sociedad en una imagen»: con los dos porcentajes dibujados uno al lado del
//     otro, el modelo SE VE y no hay que contarlo.
//
//   · DOS CIFRAS POR SOCIO, no cuatro. T45-01 deja «le has dado» y «le debes»;
//     lo puesto baja a la línea de detalle bajo el nombre. Cuatro cifras en una
//     tarjeta de lista es un informe, no una lista.
//
//   · LA TARJETA DORADA DE «GANANCIA SIN REPARTIR» convierte Socios de una
//     pantalla de consulta en una pantalla con trabajo pendiente, que es lo que
//     un dueño con socios tiene todos los meses.
//
// ══ REPARTIR NO SACA PLATA DE LA CAJA ═══════════════════════════════════════
//
// El error más caro del módulo, y la lámina lo dice con todas las letras: repartir
// deja ANOTADO que se le debe; el dinero sale cuando se le paga. Un dueño que crea
// que al repartir ya pagó, va a pagar dos veces.
//
// ⚠️ Y hoy NO HAY DÓNDE ANOTARLO: `AporteSocio.tipo` solo admite 'aporte' y
// 'retiro'. Si «repartir» se implementara como un retiro, sacaría la plata de la
// caja — el error exacto que la nota advierte. El PENDIENTE-BACKEND está en
// `lib/adaptadores/socios.js`. Mientras tanto «le debes» no se dibuja: un «$0» ahí
// se lee como «no le debo nada», y lo cierto es que aún no se ha repartido.

const CARBON = '#15161A'
const CARBON_ORO = '#F5B824'
const CARBON_TINTA = '#F3F3F6'
const CARBON_TINTA_2 = '#A3A8B2'
const CARBON_TINTA_3 = '#8A8E98'
const CARBON_FILETE = 'rgba(255,255,255,.09)'

function Rotulo({ children, color = 'var(--cf-ink-3)', espaciado = '.1em' }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: espaciado,
      textTransform: 'uppercase', color,
    }}>{children}</span>
  )
}

function Avatar({ iniciales, tamano = 36 }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: tamano, minWidth: tamano, height: tamano, minHeight: tamano,
      borderRadius: 999, flex: 'none', background: 'var(--cf-fill)',
      fontSize: tamano >= 36 ? 13 : 12, fontWeight: 700, color: 'var(--cf-ink-2)',
    }}>{iniciales}</span>
  )
}

/* ── El bloque negro: la sociedad en una imagen ───────────────────────────── */

export function LoQuePusieron({ etiqueta, total, socios = [], barra = [] }) {
  return (
    <div style={{
      flex: 'none', background: CARBON, borderRadius: 20, padding: '19px 21px',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <Rotulo color={CARBON_TINTA_2}>{etiqueta}</Rotulo>
      <span className="cf-fig" style={{
        fontFamily: 'var(--font-space-grotesk), system-ui',
        fontSize: 34, fontWeight: 600, letterSpacing: '-.035em', lineHeight: 1,
        color: CARBON_TINTA,
      }}>{total}</span>

      {/* LA BARRA PARTIDA. Cada trozo `flex: none` con su ancho exacto: en flex
          normal los trozos pequeños se encogen y el 33% deja de medir 33%. */}
      {barra.length > 0 && (
        <div style={{ display: 'flex', height: 11, borderRadius: 999, overflow: 'hidden', flex: 'none' }}>
          {barra.map((b) => (
            <span key={b.id} style={{ width: `${b.ancho}%`, background: b.color, flex: 'none' }} />
          ))}
        </div>
      )}

      {socios.length > 0 && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {socios.map((s) => (
            <span key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              {/* El cuadrito, no un círculo: ata la leyenda al trozo de barra, que
                  también tiene esquinas. */}
              <span aria-hidden style={{ width: 9, height: 9, borderRadius: 3, background: s.color, flex: 'none' }} />
              <span className="cf-num" style={{ fontSize: 12, color: CARBON_TINTA_2 }}>
                {s.nombre} <strong style={{ color: CARBON_TINTA }}>{s.porcentaje}</strong>
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── La tarjeta dorada: el trabajo pendiente ──────────────────────────────── */

/* Con su FECHA DE CORTE: «desde el 30 de junio». Sin ella, «$1.240.000 sin
   repartir» no dice de cuánto tiempo — y de eso depende si es mucho o poco. */
export function GananciaSinRepartir({
  etiqueta = 'Ganancia sin repartir', monto, desde,
  accion = 'Repartir la ganancia', onRepartir,
}) {
  return (
    <div style={{
      flex: 'none', background: 'var(--cf-card)', borderRadius: 'var(--cf-r-card)',
      border: '1.5px solid var(--cf-gold)', boxShadow: '0 0 0 3px var(--cf-gold-focus)',
      padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Rotulo>{etiqueta}</Rotulo>
          <span className="cf-fig" style={{
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 26, fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1,
            color: 'var(--cf-ink)',
          }}>{monto}</span>
        </div>
        {desde && (
          <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)', flex: 'none' }}>
            {desde}
          </span>
        )}
      </div>
      <button type="button" onClick={onRepartir} style={{
        width: '100%', height: 48, border: 'none', borderRadius: 14, cursor: 'pointer',
        background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', font: 'inherit',
        fontSize: 15, fontWeight: 700,
      }}>{accion}</button>
    </div>
  )
}

/* ── La tarjeta de un socio ───────────────────────────────────────────────── */

export function TarjetaSocio({
  iniciales, nombre, detalle,
  dadoEtiqueta, dado, debeEtiqueta, debe,
  onIr,
}) {
  return (
    <div style={{
      flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
      borderRadius: 'var(--cf-r-card)', padding: '15px 18px',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <button
        type="button"
        onClick={onIr}
        disabled={!onIr}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%',
          background: 'none', border: 0, padding: 0, textAlign: 'left',
          font: 'inherit', color: 'var(--cf-ink)', cursor: onIr ? 'pointer' : 'default',
        }}
      >
        <Avatar iniciales={iniciales} />
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.015em' }}>{nombre}</span>
          {/* Lo puesto baja aquí: en la lista lo que se compara es la deuda, no el
              aporte —el aporte ya está dibujado en la barra de arriba—. */}
          <span className="cf-num" style={{ fontSize: 11, color: 'var(--cf-ink-3)' }}>{detalle}</span>
        </span>
        {onIr && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cf-chevron)"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
            <path d="M9 5l7 7-7 7" />
          </svg>
        )}
      </button>

      {/* DOS CIFRAS, NO UN NETO: «balance neto» junta las dos y esconde la que hay
          que mirar antes de que se la pidan. */}
      <div style={{ display: 'flex', gap: 8, paddingTop: 11, borderTop: '1px solid var(--cf-hairline)' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Rotulo espaciado=".06em">{dadoEtiqueta}</Rotulo>
          <span className="cf-fig" style={{
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 15, fontWeight: 600, color: 'var(--cf-ink)',
          }}>{dado}</span>
        </div>
        {/* Sin repartos registrados no hay columna: un «$0» se lee como «no le
            debo nada» y lo cierto es que todavía no se ha repartido. */}
        {debe !== null && debe !== undefined && (
          <>
            <span aria-hidden style={{ width: 1, background: 'var(--cf-hairline)', flex: 'none' }} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Rotulo espaciado=".06em">{debeEtiqueta}</Rotulo>
              {/* EN DORADO: es plata que va a salir. */}
              <span className="cf-fig" style={{
                fontFamily: 'var(--font-space-grotesk), system-ui',
                fontSize: 15, fontWeight: 600, color: 'var(--cf-gold-dark)',
              }}>{debe}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ── La lista ─────────────────────────────────────────────────────────────── */

/* ── T45-04 · «TU PARTE» ───────────────────────────────────────────────────
   La lámina no la trata como un adorno, la trata como la causa:

     «Sin ese dato, el dueño no sabe si los $1.240.000 que va a repartir son
      toda su ganancia o una parte, y esa duda es la que hace que nadie use el
      módulo.»

   La pantalla decía cuánto pusieron los socios y se callaba cuánto puso él. Con
   los dos al lado, repartir deja de ser un salto de fe. */
function TuParte({ propio, enCalle, deSocios, nota }) {
  const pct = enCalle > 0 ? Math.max(0, Math.min(100, (deSocios / enCalle) * 100)) : 0
  return (
    <section style={{
      flex: 'none', padding: '15px 17px', borderRadius: 'var(--cf-r-card)',
      background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <Rotulo>Tu parte</Rotulo>
        <span style={{ fontSize: 11.5, color: 'var(--cf-ink-3)' }}>capital propio</span>
      </div>
      <p className="cf-fig" style={{
        margin: '6px 0 0', fontSize: 26, fontWeight: 800,
        letterSpacing: '-.02em', color: 'var(--cf-ink)',
      }}>
        {propio}
      </p>

      {/* Cuánto de lo que hay en la calle es de los socios y cuánto es suyo. */}
      <div style={{
        display: 'flex', height: 7, borderRadius: 999, overflow: 'hidden', marginTop: 12,
        background: 'var(--cf-surface)',
      }}>
        <div style={{ width: `${pct}%`, background: 'var(--cf-gold)', flex: 'none' }} />
        <div style={{ width: `${100 - pct}%`, background: 'var(--cf-green-dark)', flex: 'none' }} />
      </div>

      <p style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.5, color: 'var(--cf-ink-3)' }}>
        {nota}
      </p>
    </section>
  )
}

export function ListaSocios({
  cabecera, onAtras, onNuevo,
  puesto, tuParte, pendiente, onRepartir,
  sociosTitulo, socios = [], onSocio,
}) {
  return (
    // Sin `height: 100%`: acotaba la pantalla al alto de la ventana, que es lo
    // que obligaba a la caja de dentro a scrollear por su cuenta. Ver la nota
    // de más abajo. Ahora crece con su contenido y scrollea el documento.
    <div style={{
      display: 'flex', flexDirection: 'column',
      color: 'var(--cf-ink)',
    }}>
      <div style={{
        flex: 'none', height: 56, padding: '0 16px 0 18px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        {onAtras && (
          <button type="button" onClick={onAtras} aria-label="Atrás" style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40, borderRadius: 12, flex: 'none',
            border: 0, background: 'none', padding: 0, cursor: 'pointer',
          }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink)"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 19, fontWeight: 600, letterSpacing: '-.02em',
          }}>{cabecera?.titulo}</span>
          {/* «Reparten por lo que pusieron»: el modelo en cinco palabras, y el
              único que quedó tras la decisión de julio. */}
          <span className="cf-num" style={{ fontSize: 11, color: 'var(--cf-ink-3)' }}>
            {cabecera?.detalle}
          </span>
        </div>
        {onNuevo && (
          <button type="button" onClick={onNuevo} style={{
            display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 13px',
            borderRadius: 11, flex: 'none', cursor: 'pointer',
            background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
            font: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--cf-ink)',
          }}>Nuevo</button>
        )}
      </div>

      {/* ── AQUÍ SCROLLEA EL DOCUMENTO, NO ESTA CAJA ──
          Llevaba `flex: 1, minHeight: 0, overflowY: 'auto'`, así que la pantalla
          scrolleaba por dentro y terminaba donde termina la ventana. El hueco de
          112px que el armazón reserva para la pastilla se pinta DESPUÉS de
          `{children}`, o sea FUERA de esta caja: no llegaba, y la pastilla tapaba
          el último renglón. Es la captura que mandó el dueño, con «Desactivar
          socio» y «Eliminar socio» cortados debajo del menú.

          Decidido: scrollea el documento. Sin `overflowY` propio el contenido
          empuja la página, el hueco del armazón queda al final de verdad y la
          pastilla deja de tapar nada. */}
      <div style={{
        // Sin relleno LATERAL: lo pone el armazón (`layout.jsx` con su `px-5`).
        // Con estos 20 propios encima eran 40 por lado, y las tarjetas medían
        // 313px empezando en x=40 cuando la zona útil va de 20 a 373. Medido
        // con socios sembrados en el espejo: con el estado vacío no se veía,
        // porque no había tarjetas que medir. El vertical sí es suyo.
        padding: '8px 0 20px',
        display: 'flex', flexDirection: 'column', gap: 11,
      }}>
        {puesto && <LoQuePusieron {...puesto} />}
        {tuParte && <TuParte {...tuParte} />}
        {pendiente && <GananciaSinRepartir {...pendiente} onRepartir={onRepartir} />}

        {socios.length > 0 && (
          <>
            <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 9, padding: '0 2px' }}>
              <Rotulo>{sociosTitulo}</Rotulo>
              <span aria-hidden style={{ flex: 1, height: 1, background: 'var(--cf-border)' }} />
            </div>
            {socios.map((s) => (
              <TarjetaSocio key={s.id} {...s} onIr={onSocio ? () => onSocio(s) : undefined} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

/* ══ T45-02 · Repartir la ganancia — el corazón del módulo ═════════════════
   EL REPARTO ES UN HECHO CON FECHA, no un cálculo en vivo. Se declara por período,
   queda registrado, y a partir de ahí es una deuda concreta.

   Tres cosas que esta hoja tiene que hacer bien o el módulo no sirve:

     · DECIR DE DÓNDE SALE LA CIFRA. Sin esa línea, «$1.240.000» es un número que
       el dueño no puede defender cuando un socio pregunte.
     · CUADRAR AL PESO. La suma se enseña porque un reparto que no cuadra es una
       discusión familiar.
     · AVISAR DE QUE NO SACA PLATA DE LA CAJA. */
export function HojaRepartir({
  titulo = 'Repartir la ganancia', periodo, onCerrar,
  reparto, deDonde,
  antesDespues,
  nota,
  onConfirmar, confirmando,
  onCambiarPeriodo,
}) {
  return (
    <div style={{
      height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column',
      color: 'var(--cf-ink)',
      // La hoja trae SU PROPIO FONDO y sus esquinas. Sin ellos se ve el velo a
      // traves del contenido y deja de leerse como una capa encima.
      background: 'var(--cf-surface)',
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
            {periodo && (
              <span className="cf-num" style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>{periodo}</span>
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
        flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 22px',
        display: 'flex', flexDirection: 'column', gap: 9,
      }}>
        <div style={{
          flex: 'none', background: CARBON, borderRadius: 20, padding: '19px 21px',
          display: 'flex', flexDirection: 'column', gap: 13,
        }}>
          <Rotulo color={CARBON_TINTA_2}>{reparto?.etiqueta}</Rotulo>
          <span className="cf-fig" style={{
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 34, fontWeight: 600, letterSpacing: '-.035em', lineHeight: 1,
            color: CARBON_ORO,
          }}>{reparto?.total}</span>
          {/* DE DÓNDE SALE. La ganancia no es lo recaudado: lo recaudado incluye el
              capital que vuelve, y decirlo así es lo que hace la cifra defendible. */}
          {deDonde && (
            <span className="cf-num" style={{ fontSize: 13, lineHeight: 1.45, color: CARBON_TINTA_2 }}>
              {deDonde}
            </span>
          )}
        </div>

        {reparto?.filas?.length > 0 && (
          <div style={{
            flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
            borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
          }}>
            {reparto.filas.map((f, i) => (
              <div key={f.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px',
                borderTop: i === 0 ? 'none' : '1px solid var(--cf-hairline)',
              }}>
                <Avatar iniciales={f.iniciales} tamano={34} />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{f.nombre}</span>
                  <span className="cf-num" style={{ fontSize: 11, color: 'var(--cf-ink-3)' }}>{f.detalle}</span>
                </span>
                {/* En verde: para el socio esto es lo que gana. */}
                <span className="cf-fig" style={{
                  fontFamily: 'var(--font-space-grotesk), system-ui',
                  fontSize: 18, fontWeight: 600, letterSpacing: '-.02em', flex: 'none',
                  color: 'var(--cf-green-dark)',
                }}>{f.montoTexto}</span>
              </div>
            ))}
            {/* LA SUMA SE ENSEÑA Y CUADRA AL PESO. Un reparto que no cuadra es una
                discusión familiar. */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px',
              borderTop: '1px solid var(--cf-border)', background: 'var(--cf-card-alt)',
            }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700 }}>
                {reparto.sumanEtiqueta}
              </span>
              <span className="cf-fig" style={{
                fontFamily: 'var(--font-space-grotesk), system-ui',
                fontSize: 15, fontWeight: 600, flex: 'none',
              }}>{reparto.suman}</span>
            </div>
          </div>
        )}

        {antesDespues && (
          <div style={{
            flex: 'none', background: CARBON, borderRadius: 'var(--cf-r-card)',
            padding: '17px 19px', display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <Rotulo color={CARBON_TINTA_2}>{antesDespues.etiqueta}</Rotulo>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 11, color: CARBON_TINTA_3 }}>{antesDespues.antesEtiqueta}</span>
                <span className="cf-fig" style={{
                  fontFamily: 'var(--font-space-grotesk), system-ui',
                  fontSize: 17, fontWeight: 600, color: CARBON_TINTA_3, textDecoration: 'line-through',
                }}>{antesDespues.antes}</span>
              </div>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={CARBON_ORO}
                strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
                <path d="M5 12h14M14 7l5 5-5 5" />
              </svg>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
                <span style={{ fontSize: 11, color: CARBON_TINTA_3 }}>{antesDespues.despuesEtiqueta}</span>
                <span className="cf-fig" style={{
                  fontFamily: 'var(--font-space-grotesk), system-ui',
                  fontSize: 20, fontWeight: 600, color: CARBON_TINTA,
                }}>{antesDespues.despues}</span>
              </div>
            </div>
          </div>
        )}

        {/* LA NOTA QUE EVITA PAGAR DOS VECES. */}
        {nota && (
          <div style={{
            flex: 'none', display: 'flex', gap: 10, alignItems: 'flex-start',
            padding: '14px 16px', borderRadius: 16,
            background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-3)"
              strokeWidth="2" strokeLinecap="round" style={{ flex: 'none', marginTop: 1 }}>
              <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
            </svg>
            <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--cf-ink-2)' }}>{nota}</span>
          </div>
        )}
      </div>

      <div style={{
        flex: 'none', padding: '13px 22px 24px', background: 'var(--cf-card)',
        borderTop: '1px solid var(--cf-border)',
        display: 'flex', flexDirection: 'column', gap: 9,
      }}>
        {/* El botón lleva la cifra dentro: es un hecho que queda registrado, y
            confirmarlo a ciegas es lo que después nadie sabe explicar. */}
        <button type="button" onClick={onConfirmar} disabled={confirmando} style={{
          width: '100%', height: 52, border: 'none', borderRadius: 14,
          background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', font: 'inherit',
          fontSize: 16, fontWeight: 700,
          cursor: confirmando ? 'progress' : 'pointer', opacity: confirmando ? 0.6 : 1,
        }}>{confirmando ? 'Repartiendo…' : `Repartir ${reparto?.total ?? ''}`}</button>
        {onCambiarPeriodo && (
          <button type="button" onClick={onCambiarPeriodo} style={{
            alignSelf: 'center', border: 0, background: 'none', padding: 0, cursor: 'pointer',
            font: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--cf-ink-3)',
          }}>Cambiar el período</button>
        )}
      </div>
    </div>
  )
}
