'use client'

// components/pantallas/RegistrarCobro.jsx — turno 2 · 04 y turno 8 · 01.
//
// LA PANTALLA MÁS USADA DEL SISTEMA, y la única que se opera de pie, con una mano
// y sol de frente. Es también la única del rediseño donde un número equivocado no
// es un número feo: es un cobro mal registrado.
//
// ── ES UNA HOJA INFERIOR, NO UNA PANTALLA COMPLETA ──────────────────────────
//
// Yo la había construido de pantalla completa, con su propia cabecera de cerrar y
// chips. Las dos láminas la dibujan como hoja sobre la ficha oscurecida al 42%,
// con el asa de 38×4 arriba: el préstamo se sigue viendo detrás, y eso importa
// porque el cobrador está mirando a quién le cobra mientras teclea.
//
// Por eso este archivo exporta DOS piezas y ninguna cabecera: el cuerpo y el pie.
// `HojaInferior` ya pone el asa, el título, el subtítulo, la X y la ranura de
// acción, con las mismas medidas de la lámina. Repetir la cabecera aquí daría dos
// títulos y dos X, que es exactamente lo que pasó en la ficha con la barra de
// acción duplicada.
//
// ── EL ORDEN, QUE ES LO QUE DE VERDAD CAMBIA ────────────────────────────────
//
// El pie de T02-04: «Hoy el modal abre con siete tipos de pago en una rejilla y la
// tabla de cuotas futuras arriba. Aquí primero el monto, luego a qué se aplica en
// tres opciones, y lo raro —recargo, descuento, abono por días— plegado.»
//
//   1 · MONTO, con anillo dorado. Es lo único que hay que teclear.
//   2 · Tres atajos: Cuota · Mitad · Todo.
//   3 · ¿A qué se aplica? Cuota · Capital · Interés.
//   4 · ¿Cómo te pagó? — T08-01, campo nuevo.
//   5 · Después de este pago. LO NUEVO: el saldo y el estado ANTES de confirmar.
//   6 · Lo raro, en un enlace.
//   7 · Confirmar $X, con el monto EN el botón, y el recibo por WhatsApp.
//
// ── T08-01 MANDA DONDE CHOCAN ───────────────────────────────────────────────
//
// Turno 8 es posterior al 2. Donde difieren gana la de 8: los atajos dicen «Cuota
// / Mitad / Todo» a secas, el monto va a 38px sin el caret dibujado —el caret de
// verdad lo pone el navegador—, el enlace de lo raro va DESPUÉS del resumen, y el
// interruptor dice «Enviar recibo al confirmar».
//
// ── LOS MEDIOS NO SON NEQUI Y DAVIPLATA ─────────────────────────────────────
//
// La lámina dibuja «Efectivo · Nequi · Daviplata · Banco», que es Colombia. En el
// modelo real `MetodoPago` es una lista POR ORGANIZACIÓN: cada negocio crea sus
// cuentas y les pone el nombre que quiere, y el sistema atiende 12 países. Así que
// las casillas se pintan con las cuentas REALES de la org —Efectivo siempre primero
// y por defecto, «el 90% de los casos» según el pie— y con la inicial de cada
// cuenta en el círculo. Con la lista fija de la lámina, un negocio de Perú vería
// dos cuentas que no tiene y ninguna de las suyas.
//
// ── LO QUE NO ESTÁ AQUÍ: «NO PAGÓ» ──────────────────────────────────────────
//
// La versión que yo tenía ofrecía «No pagó» como tercera opción de «qué pasó», con
// un argumento que sigue siendo bueno: si no cabe, el cobrador se salta al cliente
// y el dato se pierde. Pero no pertenece a esta hoja: aquí se entra desde la ficha,
// habiendo decidido ya que hay plata que registrar. «No pagó» es una respuesta del
// recorrido —cobrar hoy y modo ruta—, y ahí es donde tiene que estar.

const ORO = '#E7A400'

/* Etiqueta de sección: 10px, 700, .1em, mayúsculas. Se repite cuatro veces, y
   escribirla cuatro veces son cuatro sitios donde se desincroniza. */
function Rotulo({ children }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
      textTransform: 'uppercase', color: 'var(--cf-ink-3)', flex: 'none',
    }}>{children}</span>
  )
}

/* Una fila de opciones que se reparten el ancho a partes iguales. Los atajos de
   monto y el «¿a qué se aplica?» son la misma pieza con dos alturas y dos formas
   de marcar el activo, y la diferencia no es decorativa:

   · los atajos marcan en DORADO SUAVE (`--cf-gold-tint`, borde al 35%), porque son
     una ayuda para escribir;
   · «¿a qué se aplica?» marca en NEGRO, porque sí es una decisión y cambia dónde
     entra la plata. */
function Opciones({ opciones = [], activo, onElegir, alto = 40, marca = 'oro' }) {
  return (
    <div style={{ display: 'flex', gap: 7, flex: 'none' }}>
      {opciones.map((o) => {
        const on = o.id === activo
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onElegir?.(o)}
            aria-pressed={on}
            style={{
              flex: 1, minWidth: 0, height: alto, borderRadius: 14, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              font: 'inherit', fontSize: 13, fontWeight: on ? 700 : 600,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              // `--cf-surface` es el `#F4F4F1` de la lámina. Mi primera versión puso
              // `--cf-bg`, que NO EXISTE: el CSS lo resuelve a nada y queda el color
              // heredado sobre negro. Una variable inventada no falla en ningún sitio.
              ...(marca === 'negro'
                ? on
                  ? { background: 'var(--cf-ink)', color: 'var(--cf-surface)', border: 'none' }
                  : { background: 'var(--cf-card)', color: 'var(--cf-ink-2)', border: '1px solid var(--cf-border)' }
                : on
                  ? {
                      background: 'var(--cf-gold-tint)', color: 'var(--cf-gold-ink)',
                      border: `1px solid color-mix(in srgb, ${ORO} 35%, transparent)`,
                    }
                  : { background: 'var(--cf-fill)', color: 'var(--cf-ink-2)', border: '1px solid var(--cf-border)' }),
            }}
          >{o.etiqueta}</button>
        )
      })}
    </div>
  )
}

/* El icono de billete. Efectivo es el único medio con icono propio: no es una
   cuenta, así que no tiene inicial que lo represente. */
function IconoEfectivo({ activo }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
         stroke={activo ? 'var(--cf-gold-dark)' : 'var(--cf-ink-2)'}
         strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  )
}

/* Una casilla de medio: icono arriba, nombre abajo, y el elegido con el mismo
   anillo dorado que el campo de monto. */
function Medio({ nombre, inicial, color, efectivo, activo, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      style={{
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 7, padding: '13px 8px', borderRadius: 14,
        cursor: 'pointer', font: 'inherit', background: 'var(--cf-card)',
        border: activo ? `1.5px solid ${ORO}` : '1px solid var(--cf-border)',
        boxShadow: activo ? '0 0 0 3px rgba(231,164,0,.13)' : 'none',
      }}
    >
      {efectivo ? <IconoEfectivo activo={activo} /> : (
        <span aria-hidden style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 22, height: 22, borderRadius: 999, flex: 'none',
          background: color || 'var(--cf-ink-3)', color: '#FFF',
          fontSize: 11, fontWeight: 700,
        }}>{inicial}</span>
      )}
      {/* EL NOMBRE CABE ENTERO, aunque sea en dos líneas. Con una sola línea y
          elipsis, «Bancolombia» salía «Bancolo…» —lo vi en la captura— y ahí el
          cobrador no lo distingue de «Banco Bogotá». Los nombres de la lámina son
          cortos porque son de mentira; las cuentas de verdad las nombra cada negocio
          y no caben en 62px. */}
      <span style={{
        fontSize: 11.5, fontWeight: activo ? 700 : 600, lineHeight: 1.15,
        color: activo ? 'var(--cf-gold-ink)' : 'var(--cf-ink-2)',
        maxWidth: '100%', textAlign: 'center', wordBreak: 'break-word',
      }}>{nombre}</span>
    </button>
  )
}

/**
 * El CUERPO de la hoja. Va como `children` de `HojaInferior`, que ya pone el
 * relleno lateral de 22 y el hueco entre bloques.
 */
export default function RegistrarCobro({
  monto = '', moneda = '$', onMonto,
  atajos = [], atajoActivo, onAtajo,
  aplicaciones = [], aplicacion, onAplicacion,
  medios = [], medio, onMedio,
  despues = [],
  onLoRaro, textoLoRaro = 'Recargo, descuento y abono por días',
}) {
  return (
    <>
      {/* ── 1 · EL MONTO ───────────────────────────────────────────────────
          El anillo dorado va aquí y en ningún otro sitio de la hoja: es el único
          campo que hay que teclear, y en una pantalla que se opera de pie con sol
          de frente eso tiene que encontrarse sin buscarlo. */}
      <div style={{
        flex: 'none', background: 'var(--cf-card)', borderRadius: 'var(--cf-r-card)',
        border: `1.5px solid ${ORO}`, boxShadow: '0 0 0 3px rgba(231,164,0,.13)',
        padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 11,
      }}>
        <Rotulo>Monto que recibiste</Rotulo>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ fontSize: 23, fontWeight: 600, color: 'var(--cf-ink-3)', flex: 'none' }}>
            {moneda}
          </span>
          {/* `type=text` con `inputMode=decimal`: un `type=number` RECHAZA el
              separador decimal que no coincide con el locale del teléfono, y este
              sistema atiende 12 países. Ya pasó una vez.
              Y es CONTROLADO. La versión vieja usaba `defaultValue`, así que los
              atajos no podían escribir en él: tocar «Todo» no cambiaba nada. */}
          <input
            value={monto}
            onChange={(e) => onMonto?.(e.target.value)}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            aria-label="Monto que recibiste"
            className="cf-fig"
            style={{
              flex: 1, minWidth: 0, border: 0, background: 'none', padding: 0,
              outline: 'none', font: 'inherit',
              fontFamily: 'var(--font-space-grotesk), system-ui',
              fontSize: 38, fontWeight: 600, letterSpacing: '-.035em', lineHeight: 1,
              color: 'var(--cf-ink)',
            }}
          />
        </div>
        {atajos.length > 0 && (
          <Opciones opciones={atajos} activo={atajoActivo} onElegir={onAtajo} alto={40} marca="oro" />
        )}
      </div>

      {/* ── 2 · ¿A QUÉ SE APLICA? ─────────────────────────────────────────
          Solo con más de una opción: en un préstamo de un solo pago no hay cuota
          contra la que aplicar, y un selector de una opción es una pregunta cuya
          respuesta ya se sabe. */}
      {aplicaciones.length > 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 'none' }}>
          <Rotulo>¿A qué se aplica?</Rotulo>
          <Opciones opciones={aplicaciones} activo={aplicacion} onElegir={onAplicacion} alto={44} marca="negro" />
        </div>
      )}

      {/* ── 3 · ¿CÓMO TE PAGÓ? (T08-01, campo nuevo) ─────────────────────── */}
      {medios.length > 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 'none' }}>
          <Rotulo>¿Cómo te pagó?</Rotulo>
          <div style={{ display: 'flex', gap: 8 }}>
            {medios.map((m) => (
              <Medio
                key={m.id}
                nombre={m.nombre}
                inicial={m.inicial}
                color={m.color}
                efectivo={m.efectivo}
                activo={m.id === medio}
                onClick={() => onMedio?.(m)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── 4 · DESPUÉS DE ESTE PAGO ─────────────────────────────────────
          LO NUEVO de la pantalla: el saldo y el estado resultantes se ven ANTES de
          confirmar, no después de haber cobrado.

          Es una PROYECCIÓN, y los textos los compone `lib/adaptadores/pago.js`, que
          está probado por casos. Ninguna fila se enseña si su dato de partida no
          llegó: un «quedará al día» inventado es peor que no decir nada, porque es
          la línea que el cobrador lee para decidir si insiste o se va. */}
      {despues.length > 0 && (
        <div style={{
          flex: 'none', background: 'var(--cf-card)', borderRadius: 'var(--cf-r-card)',
          border: '1px solid var(--cf-border)', padding: '16px 18px',
          display: 'flex', flexDirection: 'column', gap: 11,
        }}>
          <Rotulo>Después de este pago</Rotulo>
          {despues.map((f) => (
            <div key={f.clave} style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--cf-ink-2)', flex: 'none' }}>{f.etiqueta}</span>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flex: 'none' }}>
                  {/* El antes TACHADO. Sin él, el dueño ve un número y no sabe si
                      mejoró ni cuánto. */}
                  {f.antes && (
                    <span className="cf-num" style={{
                      fontSize: 13, color: 'var(--cf-ink-4)', textDecoration: 'line-through',
                    }}>{f.antes}</span>
                  )}
                  <span
                    className={f.antes ? 'cf-fig' : undefined}
                    style={{
                      fontSize: f.antes ? 19 : 14,
                      fontWeight: f.antes ? 600 : 700,
                      letterSpacing: f.antes ? '-.02em' : undefined,
                      // El estado va en su color; el resto en tinta normal. El tono
                      // lo decide el adaptador por PLATA, no por días.
                      color: f.tono === 'mora' ? 'var(--cf-red-dark)'
                        : f.tono === 'atraso' ? 'var(--cf-gold-dark)'
                        : f.tono === 'aldia' ? 'var(--cf-green-dark)'
                        : 'var(--cf-ink)',
                    }}
                  >{f.valor}</span>
                </span>
              </div>
              {f.nota && (
                <span style={{ fontSize: 11.5, color: 'var(--cf-ink-3)', textAlign: 'right' }}>
                  {f.nota}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── 5 · LO RARO, EN UN ENLACE ────────────────────────────────────
          Recargo, descuento y abono por días. Hoy son tres de los siete tipos de
          una rejilla que abre POR DELANTE del monto; aquí van detrás de una línea,
          porque son el caso raro y quien los necesita los busca. */}
      {onLoRaro && (
        <button type="button" onClick={onLoRaro} style={{
          flex: 'none', alignSelf: 'flex-start', padding: '0 2px', border: 0,
          background: 'none', cursor: 'pointer', font: 'inherit',
          fontSize: 12, fontWeight: 700, color: 'var(--cf-gold-dark)', textAlign: 'left',
        }}>{textoLoRaro}</button>
      )}
    </>
  )
}

/**
 * El PIE de la hoja. Va en la ranura `accion` de `HojaInferior`, que ya pone el
 * fondo blanco, el filete de arriba y el relleno de la lámina.
 *
 * Se envuelve en columna porque esa ranura es `flex` en fila con hueco de 10: el
 * botón y la línea del recibo van uno debajo del otro.
 */
export function PieRegistrarCobro({
  textoConfirmar = 'Confirmar', onConfirmar, confirmando = false, deshabilitado = false, error,
  recibo = true, onRecibo,
}) {
  const muerto = confirmando || deshabilitado
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, width: '100%' }}>
      {error && (
        <span role="alert" style={{ fontSize: 13, color: 'var(--cf-red-dark)', textAlign: 'center' }}>
          {error}
        </span>
      )}

      {/* CON EL MONTO EN EL BOTÓN. «Confirmar» a secas obliga a subir a comprobar
          qué se escribió, y ésta es la pantalla que se opera con una mano. */}
      <button type="button" onClick={onConfirmar} disabled={muerto} style={{
        height: 52, width: '100%', border: 'none', borderRadius: 14,
        background: ORO, color: 'var(--cf-gold-ink)', font: 'inherit',
        fontSize: 16, fontWeight: 700,
        cursor: muerto ? 'not-allowed' : 'pointer',
        opacity: muerto ? 0.55 : 1,
      }}>{confirmando ? 'Guardando…' : textoConfirmar}</button>

      {onRecibo && (
        <button type="button" onClick={() => onRecibo(!recibo)} aria-pressed={recibo} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          border: 0, background: 'none', cursor: 'pointer', font: 'inherit', padding: 0,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#25D366"
               strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
            <path d="M20 12a8 8 0 01-11.6 7.1L4 20l.9-4.3A8 8 0 1120 12z" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cf-ink-2)' }}>
            Enviar recibo al confirmar
          </span>
          {/* `--cf-green` y no el literal `#12A150`: esta fila va sobre fondo de
              tarjeta, así que el token resuelve bien en los dos temas. En un bloque
              permanentemente oscuro haría falta el `#2FBE6A` a mano, que es donde me
              he equivocado dos veces. */}
          <span aria-hidden style={{
            width: 36, height: 20, borderRadius: 999, flex: 'none', padding: 2,
            display: 'inline-flex', alignItems: 'center',
            justifyContent: recibo ? 'flex-end' : 'flex-start',
            background: recibo ? 'var(--cf-green)' : 'var(--cf-fill-2)',
            transition: 'background .15s',
          }}>
            <span style={{ width: 16, height: 16, borderRadius: 999, background: '#FFF' }} />
          </span>
        </button>
      )}
    </div>
  )
}
