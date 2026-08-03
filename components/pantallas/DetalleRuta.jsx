'use client'

// components/pantallas/DetalleRuta.jsx — T27-02 «aquí sí el acumulado».
//
// ══ DOS TIEMPOS, DOS COLORES ════════════════════════════════════════════════
//
// El pie de la lámina lo dice entero: «el bloque negro es el sitio nuevo de
// Prestado y Con intereses, ahora con nombres que se entienden: prestado, por
// ganar, cumple. Debajo, en blanco, lo de hoy — y la separación por color deja
// claro que son dos tiempos distintos».
//
// Eso es lo que arregla el problema de fondo: en la ruta hay números que suben
// porque se cobra y números que suben porque se presta, y hasta ahora estaban
// juntos sin nada que dijera cuál era cuál. El negro no se mueve porque hoy se
// cobre; el blanco se reinicia cada mañana.
//
// Los nombres viejos eran «Prestado» y «Con intereses» — dos cifras que nadie
// sabía restar. Ahora son PRESTADO (lo que está puesto), POR GANAR (lo que falta
// cobrar de más) y CUMPLE (cuánto de lo pactado ya entró). Suman lo que se ve
// arriba, y por eso se pueden leer.
//
// ══ EL BOTÓN LLEVA UN NOMBRE ════════════════════════════════════════════════
//
// «Seguir con Steven», no «siguiente cobro». Quien va caminando no quiere pulsar
// para averiguar a quién le toca: quiere saberlo antes de pulsar.
//
// La aritmética está en `lib/adaptadores/ruta.js` y no aquí — sobre todo la de «por
// ganar», que con la resta ingenua sale negativa en cuanto alguien abona.

/* Paleta oscura literal — SOLO para el bloque negro, que es carbon con el tema
   claro y con el oscuro. Fuera de ese bloque no hay literales: los acentos van por
   token, porque el tema oscuro sube el oro a #F5B824 y aclara verde y rojo (los
   tres ajustes que T28-02 marca como «no automaticos»). */
const CARBON = '#15161A'
const CARBON_ORO = '#F5B824'
const CARBON_TINTA = '#F3F3F6'
const CARBON_TINTA_2 = '#A3A8B2'
const CARBON_TINTA_3 = '#8A8E98'
const CARBON_FILETE = 'rgba(255,255,255,.09)'

const FILETE = { rojo: 'var(--cf-red)', verde: 'var(--cf-green)', oro: 'var(--cf-gold)' }

function Rotulo({ children, color = 'var(--cf-ink-3)', espaciado = '.1em' }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: espaciado,
      textTransform: 'uppercase', color,
    }}>{children}</span>
  )
}

/* ── El bloque negro: lo acumulado ────────────────────────────────────────── */

export function LoPuestoAqui({
  etiqueta = 'Lo que tienes puesto aquí',
  carteraEtiqueta = 'Cartera de la ruta', cartera,
  columnas = [],
}) {
  // ── ⚠ EL BORDE NO ES ADORNO: EN OSCURO ES LO ÚNICO QUE DIBUJA LA CAJA ──
  // Este bloque es carbón (#15161A) a propósito en los DOS temas. Pero en
  // tema oscuro el fondo de la app ES #15161A: la tarjeta desaparecía, y se
  // veían las cifras flotando sin caja. Lo vi en la captura del espejo — en
  // el código las dos son «carbón» y parecen correctas.
  // Con el filete que ya usa por dentro (blanco al 9%) el bloque recupera su
  // contorno sin dejar de ser oscuro en claro.
  return (
    <div style={{
      flex: 'none', background: CARBON, borderRadius: 'var(--cf-r-card)',
      border: `1px solid ${CARBON_FILETE}`,
      padding: '19px 21px', display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <Rotulo color={CARBON_TINTA_2}>{etiqueta}</Rotulo>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: CARBON_TINTA_3 }}>{carteraEtiqueta}</span>
          <span className="cf-fig" style={{
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 28, fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1,
            color: CARBON_TINTA,
          }}>{cartera}</span>
        </div>
      </div>

      {columnas.length > 0 && (
        <>
          <div aria-hidden style={{ height: 1, background: CARBON_FILETE }} />
          <div style={{ display: 'flex', gap: 12 }}>
            {columnas.map((c, i) => (
              <span key={c.id} style={{ display: 'contents' }}>
                {i > 0 && <span aria-hidden style={{ width: 1, background: CARBON_FILETE, flex: 'none' }} />}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Rotulo color={CARBON_TINTA_3} espaciado=".06em">{c.etiqueta}</Rotulo>
                  <span className="cf-fig" style={{
                    fontFamily: 'var(--font-space-grotesk), system-ui',
                    fontSize: 16, fontWeight: 600,
                    /* Solo «por ganar» va en oro: es la razón de que la ruta
                       exista, y el único dorado del bloque. */
                    color: c.oro ? CARBON_ORO : CARBON_TINTA,
                  }}>{c.valor}</span>
                </div>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ── La banda blanca: lo de hoy ───────────────────────────────────────────── */

export function LoDeHoy({
  recaudadoEtiqueta = 'Recaudado hoy', recaudado,
  faltaEtiqueta = 'Falta', falta,
  progreso = 0, resumen,
}) {
  return (
    <div style={{
      flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
      borderRadius: 'var(--cf-r-card)', padding: '17px 19px',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Rotulo espaciado=".09em">{recaudadoEtiqueta}</Rotulo>
          <span className="cf-fig" style={{
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 24, fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1,
            color: 'var(--cf-ink)',
          }}>{recaudado}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end', flex: 'none' }}>
          <Rotulo espaciado=".09em">{faltaEtiqueta}</Rotulo>
          {/* Lo que falta va en gris y más pequeño: es un dato, no una alarma.
              En rojo, una ruta a media mañana parecería un problema. */}
          <span className="cf-fig" style={{
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 17, fontWeight: 600, lineHeight: 1, color: 'var(--cf-ink-2)',
          }}>{falta}</span>
        </div>
      </div>

      {/* `flex: none` en la barra y en el relleno (regla 3): una barra de progreso
          encogible colapsa a 0px y el estado desaparece. */}
      <div style={{
        height: 7, borderRadius: 999, background: 'var(--cf-fill)', overflow: 'hidden',
        flex: 'none', display: 'flex',
      }}>
        <span style={{
          width: `${Math.max(0, Math.min(100, progreso))}%`, height: 7,
          borderRadius: 999, background: 'var(--cf-gold)', flex: 'none',
        }} />
      </div>

      {resumen && (
        <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{resumen}</span>
      )}
    </div>
  )
}

/* ── El recorrido ─────────────────────────────────────────────────────────── */

/* Una parada. El filete de color a la izquierda es lo único que se lee mientras se
   camina, y va pegado al borde de la tarjeta —no dentro— para que se distinga con
   el teléfono en una mano. */
export function Parada({ orden, nombre, detalle, monto, color = 'oro', cobrado, onIr }) {
  const Caja = onIr ? 'button' : 'div'
  return (
    <Caja
      {...(onIr ? { type: 'button', onClick: onIr } : {})}
      style={{
        flex: 'none', position: 'relative', width: '100%', textAlign: 'left',
        background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
        borderRadius: 'var(--cf-r-card-sm)', padding: '13px 15px', overflow: 'hidden',
        display: 'flex', alignItems: 'center', gap: 12,
        font: 'inherit', color: 'var(--cf-ink)', cursor: onIr ? 'pointer' : 'default',
      }}
    >
      <span aria-hidden style={{
        position: 'absolute', left: 0, top: 12, bottom: 12, width: 3,
        borderRadius: 999, background: FILETE[color] ?? FILETE.oro,
      }} />

      {/* Cobrado: el visto sustituye al número. El orden ya no importa cuando la
          parada está hecha, y el visto se ve de lejos. */}
      {cobrado ? (
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28, borderRadius: 999, flex: 'none',
          background: 'var(--cf-green-pill-bg)',
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cf-green-dark)"
            strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </span>
      ) : (
        <span className="cf-num" style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28, borderRadius: 999, flex: 'none',
          background: 'var(--cf-fill)', fontSize: 13, fontWeight: 700, color: 'var(--cf-ink-2)',
        }}>{orden}</span>
      )}

      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontSize: 15, fontWeight: 700,
          /* Cobrado, el nombre se apaga: la lista de lo que queda tiene que
             leerse sin que estorbe lo ya hecho. */
          color: cobrado ? 'var(--cf-ink-3)' : 'var(--cf-ink)',
        }}>{nombre}</span>
        {detalle && (
          <span className="cf-num" style={{ fontSize: 11, color: 'var(--cf-ink-3)' }}>{detalle}</span>
        )}
      </span>

      <span className="cf-fig" style={{
        flex: 'none',
        fontFamily: 'var(--font-space-grotesk), system-ui',
        fontSize: 16, fontWeight: 600,
        color: cobrado ? 'var(--cf-green-dark)' : 'var(--cf-ink)',
      }}>{monto}</span>
    </Caja>
  )
}

/* ── La pantalla ──────────────────────────────────────────────────────────── */

export function CabeceraRuta({ titulo, detalle, onAtras, onMas }) {
  return (
    <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '6px 20px 12px' }}>
      {onAtras && (
        <button type="button" onClick={onAtras} aria-label="Atrás" style={{
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
        }}>{titulo}</span>
        {detalle && (
          <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{detalle}</span>
        )}
      </div>
      {onMas && (
        <button type="button" onClick={onMas} aria-label="Más opciones de la ruta" style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 34, height: 34, borderRadius: 11, flex: 'none', cursor: 'pointer',
          background: 'none', border: '1px solid var(--cf-border-strong)',
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-3)"
            strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 6h.01M12 12h.01M12 18h.01" />
          </svg>
        </button>
      )}
    </div>
  )
}

export default function DetalleRuta({
  cabecera, onAtras, onMas,
  puesto,          // de loPuestoAqui()
  hoy,             // de loDeHoy()
  recorridoTitulo = 'El recorrido de hoy',
  recorrido = [],  // de adaptarRecorrido()
  onParada,
  siguiente,       // { nombre } — de siguienteParada()
  onSeguir,
}) {
  return (
    // Scrollea el DOCUMENTO. Ver `SociosReparto.jsx`: con scroll propio, el
    // hueco de la pastilla quedaba fuera y tapaba el último renglón.
    <div style={{
      display: 'flex', flexDirection: 'column',
      color: 'var(--cf-ink)',
    }}>
      <CabeceraRuta {...cabecera} onAtras={onAtras} onMas={onMas} />

      <div style={{
        padding: '0 20px 20px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {puesto && <LoPuestoAqui {...puesto} />}
        {hoy && <LoDeHoy {...hoy} />}

        {recorrido.length > 0 && (
          <>
            <span style={{ flex: 'none', padding: 2 }}>
              <Rotulo>{recorridoTitulo}</Rotulo>
            </span>
            {recorrido.map((p) => (
              <Parada key={p.id} {...p} onIr={onParada ? () => onParada(p) : undefined} />
            ))}
          </>
        )}
      </div>

      {/* El botón dice el nombre. Un «siguiente cobro» obliga a pulsar para saber
          a quién le toca; esto se lee de un vistazo con el teléfono en la mano.
          Sin nadie pendiente no hay botón: la ruta está hecha. */}
      {onSeguir && siguiente && (
        <div style={{
          flex: 'none', padding: '14px 20px 22px', background: 'var(--cf-card)',
          borderTop: '1px solid var(--cf-border)',
        }}>
          <button type="button" onClick={onSeguir} style={{
            width: '100%', height: 52, border: 'none', borderRadius: 14, cursor: 'pointer',
            background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', font: 'inherit',
            fontSize: 16, fontWeight: 700,
          }}>
            Seguir con {String(siguiente.nombre ?? '').split(' ')[0]}
          </button>
        </div>
      )}
    </div>
  )
}
