'use client'

// components/pantallas/ModoRuta.jsx — T28. Recorriendo.
//
// ══ ESTO SE MIRA A LAS CINCO DE LA TARDE, BAJO SOL, CAMINANDO ═══════════════
//
// El pie de la lámina fija la hora a propósito: «a las 17:00, que es la hora pico
// real, esto se ve bajo sol». De ahí sale todo lo demás:
//
//   · UNA SOLA TARJETA ABIERTA — la parada actual. Las siguientes van comprimidas
//     en orden de recorrido, con su distancia. Con dos tarjetas grandes hay que
//     decidir cuál mirar, y aquí no se decide nada: se va a la que toca.
//   · LOS COBRADOS SE COLAPSAN a una línea con su total. «Hechos, pero no se
//     olvidan»: es lo que se mira cuando la cuenta de la noche no cuadra.
//   · El botón mide 56px y dice el nombre. Es el más alto de la app porque se
//     pulsa de pie, con una mano, mirando a otro sitio.
//
// ══ CLARO ES EL DEFAULT; OSCURO ES LA MISMA PANTALLA ════════════════════════
//
// La lámina T28-01 se titula «claro — el default» y T28-02 es su gemela oscura.
// No son dos pantallas: es una escrita con tokens. `--cf-card`, `--cf-ink`,
// `--cf-fill` y compañía ya cambian con el tema, así que el modo noche —que en la
// calle sirve, porque a las nueve el sol ya no está— sale sin una línea aparte.
//
// Por eso aquí NO HAY LITERALES DE COLOR, salvo el verde de WhatsApp, que es una
// marca ajena y no un tema. Todo lo demás son tokens.
//
// Esa es la parte que fallé en la primera pasada: escribí `#E7A400` y `var(--cf-green-dark)` a
// mano, y el oscuro salió con el oro y el verde del claro — o sea justo los tres
// ajustes que T28-02 marca como «no automáticos». Con tokens salen solos, porque
// el tema oscuro ya sube el oro a #F5B824 y aclara verde y rojo.

import { Parada } from './DetalleRuta'

const TONO = {
  verde: { fondo: 'var(--cf-green-pill-bg)', borde: 'var(--cf-green-pill-border)', tinta: 'var(--cf-green-dark)' },
  oro:   { fondo: 'var(--cf-gold-bg)',       borde: 'var(--cf-gold-border)',       tinta: 'var(--cf-gold-dark)' },
  rojo:  { fondo: 'var(--cf-red-pill-bg)',   borde: 'var(--cf-red-pill-border)',   tinta: 'var(--cf-red-dark)' },
}

function Rotulo({ children, espaciado = '.1em' }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: espaciado,
      textTransform: 'uppercase', color: 'var(--cf-ink-3)',
    }}>{children}</span>
  )
}

/* Separador con filete. El título a la izquierda, la línea rellenando, y a la
   derecha lo que haga falta (el total de los cobrados). Es lo que permite tener
   tres grupos en una lista sin meterlos en tres tarjetas. */
function Separador({ titulo, derecha, arriba = 0 }) {
  return (
    <div style={{
      flex: 'none', display: 'flex', alignItems: 'center', gap: 9,
      padding: `${arriba}px 2px 0`,
    }}>
      <Rotulo>{titulo}</Rotulo>
      <span aria-hidden style={{ flex: 1, height: 1, background: 'var(--cf-border)' }} />
      {derecha}
    </div>
  )
}

/* Lista o mapa. Cápsula de dos, con el activo en blanco y sombra — el patrón que
   ya usa el resto de la app para «dos formas de ver lo mismo». */
export function ConmutadorVista({ vista = 'lista', onVista }) {
  const opciones = [
    {
      id: 'lista', etiqueta: 'Ver en lista',
      icono: <path d="M4 7h16M4 12h16M4 17h16" />,
      trazo: 2.2,
    },
    {
      id: 'mapa', etiqueta: 'Ver en mapa',
      icono: <><path d="M9 5L3.5 7v12L9 17l6 2 5.5-2V5L15 7z" /><path d="M9 5v12M15 7v12" /></>,
      trazo: 1.9,
    },
  ]
  return (
    <div style={{
      display: 'flex', gap: 4, padding: 4, borderRadius: 11, flex: 'none',
      background: 'var(--cf-fill-2)',
    }}>
      {opciones.map((o) => {
        const activa = vista === o.id
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onVista?.(o.id)}
            aria-label={o.etiqueta}
            aria-pressed={activa}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: 8, border: 0, padding: 0,
              cursor: 'pointer', flex: 'none',
              background: activa ? 'var(--cf-card)' : 'transparent',
              boxShadow: activa ? '0 1px 2px var(--cf-border-strong)' : 'none',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke={activa ? 'var(--cf-ink)' : 'var(--cf-ink-3)'}
              strokeWidth={o.trazo} strokeLinecap="round" strokeLinejoin="round">
              {o.icono}
            </svg>
          </button>
        )
      })}
    </div>
  )
}

/* ── La parada actual: la única tarjeta abierta ───────────────────────────── */

export function ParadaActual({
  orden, nombre, estado, donde,
  cobrarEtiqueta = 'Cobrarle hoy', cobrar, debe,
  onAvisar, onLlegar,
}) {
  const tono = TONO[estado?.tono] ?? TONO.oro
  return (
    <div style={{
      flex: 'none', position: 'relative', overflow: 'hidden',
      background: 'var(--cf-card)', borderRadius: 'var(--cf-r-card)',
      border: '1.5px solid var(--cf-gold)', boxShadow: '0 0 0 3px var(--cf-gold-focus)',
      padding: '17px 19px', display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* El número va en dorado relleno y a 36px: es «aquí estás». */}
        <span className="cf-num" style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 999, flex: 'none',
          background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', fontSize: 14, fontWeight: 700,
        }}>{orden}</span>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.015em', color: 'var(--cf-ink)' }}>
            {nombre}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            {estado && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px',
                borderRadius: 11, flex: 'none',
                background: tono.fondo, border: `1px solid ${tono.borde}`,
                fontSize: 11, fontWeight: 700, color: tono.tinta,
              }}>{estado.texto}</span>
            )}
            {/* La dirección se corta con puntos suspensivos y no parte la fila:
                una dirección larga no puede empujar la pastilla de estado. */}
            {donde && (
              <span className="cf-num" style={{
                minWidth: 0, fontSize: 12, color: 'var(--cf-ink-2)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{donde}</span>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Rotulo espaciado=".09em">{cobrarEtiqueta}</Rotulo>
          <span className="cf-fig" style={{
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 27, fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1,
            color: 'var(--cf-ink)',
          }}>{cobrar}</span>
        </div>
        {debe && (
          <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)', flex: 'none' }}>
            {debe}
          </span>
        )}
      </div>

      {/* Las dos cosas que se hacen ANTES de cobrar: avisar que vas, o que te
          lleve. Ninguna es dorada — el dorado es cobrar, en el pie. */}
      {(onAvisar || onLlegar) && (
        <div style={{ display: 'flex', gap: 8 }}>
          {onAvisar && (
            <BotonSecundario onClick={onAvisar} etiqueta="Avisarle">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#25D366"
                strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 12a8 8 0 01-11.6 7.1L4 20l.9-4.3A8 8 0 1120 12z" />
              </svg>
            </BotonSecundario>
          )}
          {onLlegar && (
            <BotonSecundario onClick={onLlegar} etiqueta="Llegar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-2)"
                strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12l16-7-7 16-2-7z" />
              </svg>
            </BotonSecundario>
          )}
        </div>
      )}
    </div>
  )
}

function BotonSecundario({ onClick, etiqueta, children }) {
  return (
    <button type="button" onClick={onClick} style={{
      flex: 1, minWidth: 0, height: 46, borderRadius: 14, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
      background: 'var(--cf-fill)', border: '1px solid var(--cf-hairline)',
      font: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--cf-ink-2)',
    }}>
      {children}
      {etiqueta}
    </button>
  )
}

/* ── La banda de arriba ───────────────────────────────────────────────────── */

/* Es la misma gramática que el detalle —recaudado y falta— pero más compacta: aquí
   compite con la parada actual, que es lo que hay que mirar. */
export function BandaDelDia({ recaudado, falta, progreso = 0 }) {
  return (
    <div style={{
      background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
      borderRadius: 'var(--cf-r-card-sm)', padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 11, flex: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Rotulo espaciado=".09em">Recaudado hoy</Rotulo>
          <span className="cf-fig" style={{
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 26, fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1,
            color: 'var(--cf-ink)',
          }}>{recaudado}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end', flex: 'none' }}>
          <Rotulo espaciado=".09em">Falta</Rotulo>
          <span className="cf-fig" style={{
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 17, fontWeight: 600, lineHeight: 1, color: 'var(--cf-ink-2)',
          }}>{falta}</span>
        </div>
      </div>
      <div style={{
        height: 7, borderRadius: 999, background: 'var(--cf-fill)', overflow: 'hidden',
        flex: 'none', display: 'flex',
      }}>
        <span style={{
          width: `${Math.max(0, Math.min(100, progreso))}%`, height: 7,
          borderRadius: 999, background: 'var(--cf-gold)', flex: 'none',
        }} />
      </div>
    </div>
  )
}

/* ── La pantalla ──────────────────────────────────────────────────────────── */

export default function ModoRuta({
  ruta, posicion, tiempo,
  vista = 'lista', onVista,
  onAtras,
  hoy,             // de loDeHoy()
  actual,          // de adaptarParadaActual()
  onAvisar, onLlegar, onCobrar,
  faltanTitulo = 'Falta cobrar', faltan = [],
  cobradosTitulo, cobrados = [], cobradosTotal,
  onParada,
  mapa,            // el mapa, cuando la vista es 'mapa' (T11-02)
}) {
  const arriba = [posicion, tiempo].filter(Boolean).join(' · ')

  return (
    <div style={{
      height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column',
      color: 'var(--cf-ink)',
    }}>
      <div style={{
        flex: 'none', padding: '6px 20px 12px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {onAtras && (
            <button type="button" onClick={onAtras} aria-label="Salir del recorrido" style={{
              border: 0, background: 'none', padding: 0, cursor: 'pointer', flex: 'none',
              display: 'inline-flex', alignItems: 'center',
            }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-2)"
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{
              fontFamily: 'var(--font-space-grotesk), system-ui',
              fontSize: 20, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)',
            }}>Recorriendo {ruta}</span>
            {arriba && (
              <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{arriba}</span>
            )}
          </div>
          {onVista && <ConmutadorVista vista={vista} onVista={onVista} />}
        </div>

        {hoy && <BandaDelDia {...hoy} />}
      </div>

      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 20px',
        display: 'flex', flexDirection: 'column', gap: 11,
      }}>
        {vista === 'mapa' ? mapa : (
          <>
            {actual && (
              <ParadaActual {...actual} onAvisar={onAvisar} onLlegar={onLlegar} />
            )}

            {faltan.length > 0 && (
              <>
                <Separador titulo={faltanTitulo} />
                {faltan.map((p) => (
                  <Parada key={p.id} {...p} onIr={onParada ? () => onParada(p) : undefined} />
                ))}
              </>
            )}

            {/* HECHOS, PERO NO SE OLVIDAN: una línea con el total. Es lo que se
                mira cuando la cuenta de la noche no cuadra. */}
            {cobradosTitulo && (
              <Separador
                arriba={6}
                titulo={cobradosTitulo}
                derecha={cobradosTotal && (
                  <span className="cf-num" style={{
                    fontFamily: 'var(--font-space-grotesk), system-ui',
                    fontSize: 12, fontWeight: 600, color: 'var(--cf-green-dark)', flex: 'none',
                  }}>{cobradosTotal}</span>
                )}
              />
            )}
          </>
        )}
      </div>

      {/* 56px, el botón más alto de la app. Se pulsa de pie, con una mano, y
          mirando a otro sitio. Y dice el nombre para no tener que pulsar y ver. */}
      {onCobrar && actual && (
        <div style={{
          flex: 'none', padding: '14px 20px 22px', background: 'var(--cf-card)',
          borderTop: '1px solid var(--cf-border)',
        }}>
          <button type="button" onClick={onCobrar} style={{
            width: '100%', height: 56, border: 'none', borderRadius: 14, cursor: 'pointer',
            background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', font: 'inherit',
            fontSize: 17, fontWeight: 700,
          }}>
            Cobrarle a {String(actual.nombre ?? '').split(' ').slice(0, 2).join(' ')}
          </button>
        </div>
      )}
    </div>
  )
}
