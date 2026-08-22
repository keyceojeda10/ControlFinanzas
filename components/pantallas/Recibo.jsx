'use client'

// components/pantallas/Recibo.jsx — T07-04 recibo.
//
// ══ EL DEUDOR LO VA A GUARDAR ══════════════════════════════════════════════
//
// Esta pantalla no es una confirmación para el cobrador —esa es T15-03, «cobro
// hecho»— sino un COMPROBANTE para el cliente. Por eso el borde troquelado, por
// eso el monto de 40px, y por eso «Recibido por Pepito»: un comprobante sin
// nombre de quien lo dio no zanja ninguna discusión.
//
// ══ EL NÚMERO DE RECIBO NO EXISTE TODAVÍA ══════════════════════════════════
//
// PENDIENTE-BACKEND. La lámina lo dibuja como «CF-2026-04871», pero el modelo
// `Pago` no tiene ningún campo de número ni de código: solo un `id` cuid, que no
// se le puede leer en voz alta a nadie. Un número consecutivo por organización y
// año es una columna nueva más su contador.
//
// Mientras no exista, LA FILA NO SE PINTA. Enseñar el cuid haría un comprobante
// que nadie puede citar; inventar un número haría uno que no se puede verificar.
// Hay una prueba que se muere el día que el campo aparezca en el esquema.
//
// El recibo COMO VISTA sí existe hoy y no necesita número: es la fila del pago
// abierta. Lo que no existe es el código impreso.

const VERDE_WA = '#25D366'

function Fila({ etiqueta, valor, mono, cifra }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 13, color: 'var(--cf-ink-2)', flex: 'none' }}>{etiqueta}</span>
      <span
        className={cifra ? 'cf-fig' : mono ? undefined : 'cf-num'}
        style={{
          flex: 1, minWidth: 0, textAlign: 'right',
          fontSize: cifra ? 16 : mono ? 13 : 14,
          fontWeight: cifra ? 600 : mono ? 600 : 700,
          fontFamily: mono ? 'ui-monospace, monospace' : undefined,
        }}
      >{valor}</span>
    </div>
  )
}

/* ══ LA CAPA DEL COMPROBANTE ══════════════════════════════════════════════
 *
 * ⚠ ESTABA ESCRITA DOS VECES —en `RegistrarPago` y en la ficha de la ruta— y es
 * exactamente como este recibo ya divergió antes: se arregla un camino y el otro
 * se queda con el fallo. Vive aquí y la usan los dos.
 *
 * En el TELÉFONO ocupa todo, que es lo correcto: el cobrador acaba de cobrar y
 * esto es lo único que le importa. En un MONITOR salía la misma página estirada
 * de lado a lado —«Cliente ......... Fantasma 4» con metro y medio de puntos en
 * medio— y el dueño lo reportó con captura: «se ve muy fea así estirada, cuando
 * la mayoría de las cosas del sistema son modales». Desde `lg` el fondo se
 * atenúa y el comprobante se centra, como la hoja de cobro de la que viene. */
export const CAPA_RECIBO = {
  /* ⚠ EL FONDO VA POR CLASE, NO EN EL `style`.
     Un estilo en línea le gana SIEMPRE a la clase, así que con
     `background: 'var(--cf-surface)'` inline el `lg:bg-…` no pintaba nada y la
     capa seguía saliendo clara en el monitor. Es la misma trampa que ya está
     escrita en la barra de acción de «Cobrar hoy», y volví a caer.

     `--cf-surface`, no `--cf-bg`: ese token NO EXISTE, y un nombre inventado no
     da error — la capa sale transparente y se ve la lista por detrás. Lo caza
     `tokens-existen.test.js`. */
  className: 'bg-[var(--cf-surface)] '
    + 'lg:bg-[rgba(20,20,28,0.5)] lg:backdrop-blur-[2px] '
    + 'lg:flex lg:items-center lg:justify-center',
  style: { position: 'fixed', inset: 0, zIndex: 10002, overflowY: 'auto' },
}

export function Recibo({
  // ⚠ Sin valor por defecto: con `negocio` vacío se imprimía «Recibido por
  // Juan · Control Finanzas» en el recibo que ve el deudor. El emisor del
  // recibo es quien prestó, nunca el software.
  monto, cliente, saldo, proximoCobro, numero, recibidoPor, negocio = '',
  cuando,
  onWhatsApp, onGuardarImagen, onImprimir, onSiguiente,
  telefono,
  // ── LO QUE SOLO TENÍA EL COMPROBANTE VIEJO ──
  // Esta pantalla vivía únicamente en el cobro desde la ruta; los otros dos
  // caminos —la ficha del préstamo y el cobro por QR— sacaban una versión
  // escrita a mano dentro de `RegistrarPago.jsx`. Al unificarlos hay que
  // traerse lo que aquella hacía y ésta no, o el rediseño «pierde funciones en
  // silencio», que ya pasó con el modo abreviado.
  //
  // `titulo` — no todo pago es un pago: también se aplican recargos, descuentos,
  // abonos a capital y pagos de solo interés, y el comprobante lo decía.
  titulo = 'Pago registrado',
  // `offline` — el cobro guardado sin señal. Es el aviso MÁS importante de los
  // cuatro: sin él, el cobrador ve el visto verde y cree que ya subió.
  offline = false,
  // `medioPago` — «Efectivo» o «Transferencia · Nequi». Con la caja discriminada
  // por medio de pago, esto es lo que deja constancia de por dónde entró.
  medioPago,
  // `evidencia` — la foto adjunta. `{ url, subiendo, onAdjuntar }`; sin el
  // objeto no se pinta nada (en la ruta no se usa).
  evidencia,
  // EL NOMBRE DEL SIGUIENTE, no «Siguiente cobro». El pie de T15-03 lo dice
  // literal: «la accion dorada NO es "listo": es el nombre del siguiente,
  // porque en la calle el cobro no termina, SIGUE». Un boton que dice a quien
  // se va ahorra mirar la lista para saberlo.
  siguienteNombre,
  // «Volver a la lista queda de segunda» — existe, pero sin peso.
  onCerrar,
  // ── EL TERCER DATO DE T15-03 ──
  // «Tres datos y una salida: cuánto entró, cuánto le queda al cliente y CÓMO
  // VA EL DÍA — con la barra que el cobrador vigila». Los dos primeros ya
  // estaban (el monto y el saldo); éste faltaba, y es el que dice si se puede
  // ir a casa. `{ texto: '$76.500 de $145.000', porcentaje: 53 }`.
  progresoDia,
}) {
  return (
    <div
      /* ⚠ `lg:w-[520px]` Y NO SOLO `max-w`: dentro de un contenedor flex el
         `w-full` se encoge al contenido, y la tarjeta salía de 289px —más
         estrecha que en el teléfono—. El ancho se fija. */
      className={'w-full max-w-[520px] mx-auto '
        + 'lg:w-[520px] lg:flex-none lg:h-auto lg:max-h-[88vh] lg:my-8 lg:overflow-hidden '
        + 'lg:bg-[var(--cf-card)] lg:rounded-[20px] lg:shadow-2xl'}
      style={{
        height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column',
        color: 'var(--cf-ink)',
      }}>
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px 24px 0',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          {/* Verde, no dorado. El dorado de esta pantalla es «siguiente cobro»:
              el visto es un hecho consumado, no la acción que sigue.

              ⚠ SALVO SIN SEÑAL. Un cobro guardado en el teléfono todavía no ha
              subido, y el visto verde diría que sí: el cobrador tiene que saber
              que eso aún le puede faltar al cuadre. Reloj ámbar.

              El fondo va con `--cf-gold-tint`, que el propio fichero de tokens
              describe como «aviso ámbar», NO con `--cf-gold`: ese está reservado
              a seguir la ruta y es el único de la pantalla. Lo defiende una
              prueba, y tiene razón — dos dorados y ninguno destaca. */}
          <span aria-hidden style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 64, height: 64, minWidth: 64, minHeight: 64, flex: 'none',
            borderRadius: 999,
            background: offline ? 'var(--cf-gold-tint)' : 'var(--cf-green)',
            border: offline ? '1.5px solid var(--cf-gold-dark)' : 'none',
          }}>
            {offline ? (
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--cf-gold-dark)"
                strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
              </svg>
            ) : (
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#FFF"
                strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            {/* No todo pago es un pago: también hay recargos, descuentos, abonos
                a capital y pagos de solo interés, y el comprobante viejo los
                nombraba. Llamar «Pago registrado» a un recargo sería mentir en
                el papel que el cliente se guarda. */}
            <span style={{
              fontFamily: 'var(--font-space-grotesk), system-ui',
              fontSize: 23, fontWeight: 600, letterSpacing: '-.02em', textAlign: 'center',
            }}>{titulo}</span>
            {/* Fecha Y HORA. Dos pagos el mismo día son dos recibos distintos, y
                sin la hora no se distinguen. */}
            {cuando && !offline && (
              <span className="cf-num" style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>{cuando}</span>
            )}
            {offline && (
              <span style={{ fontSize: 13, color: 'var(--cf-gold-dark)', textAlign: 'center' }}>
                guardado en el teléfono · sube solo al recuperar señal
              </span>
            )}
          </div>
        </div>

        <div style={{
          flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          borderRadius: 'var(--cf-r-card)', padding: 22,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {/* El troquelado va con `dashed`, que es lo que dice «esto se corta y se
              guarda». Un separador continuo es una tarjeta más. */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            paddingBottom: 16, borderBottom: '1px dashed var(--cf-border-strong)',
          }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
              textTransform: 'uppercase', color: 'var(--cf-ink-3)',
            }}>Recibió</span>
            <span className="cf-fig" style={{ fontSize: 40, letterSpacing: '-.035em' }}>{monto}</span>
          </div>

          <Fila etiqueta="Cliente" valor={cliente} />
          {/* POR DÓNDE ENTRÓ. Va DENTRO del troquelado porque es dato del
              comprobante, no del cobrador: si mañana el cliente reclama que
              transfirió, aquí está escrito. Desde que la caja se discrimina por
              medio de pago (Nequi, Bancolombia, efectivo…) esta línea es la que
              ata el recibo con el cuadre. */}
          {medioPago && <Fila etiqueta="Pagó con" valor={medioPago} />}
          {saldo && <Fila etiqueta="Saldo pendiente" valor={saldo} cifra />}
          {proximoCobro && <Fila etiqueta="Próximo cobro" valor={proximoCobro} />}

          {/* PENDIENTE-BACKEND: `Pago` no tiene número de recibo. Sin él, la fila
              no se pinta — ni cuid ni número inventado. */}
          {numero && (
            <div style={{ paddingTop: 16, borderTop: '1px dashed var(--cf-border-strong)' }}>
              <Fila etiqueta="Recibo" valor={numero} mono />
            </div>
          )}

          {/* Quién lo recibió. Sin nombre, el comprobante no zanja nada. */}
          <span style={{
            fontSize: 11, lineHeight: 1.45, color: 'var(--cf-ink-3)', textAlign: 'center',
          }}>
            {recibidoPor ? `Recibido por ${recibidoPor} · ${negocio}` : negocio}
          </span>
        </div>

        {/* LA FOTO DE EVIDENCIA. También fuera del troquelado: es respaldo del
            cobrador para cuando alguien discute un cobro, no algo que el cliente
            se lleve. Solo con el pago ya subido —sin `id` en el servidor no hay
            dónde colgarla—, por eso el llamador no pasa `evidencia` si el pago
            quedó offline. */}
        {evidencia && (
          <div style={{ flex: 'none', padding: '0 2px' }}>
            {evidencia.url ? (
              <div style={{
                position: 'relative', borderRadius: 14, overflow: 'hidden',
                border: '1px solid var(--cf-border)',
              }}>
                <img src={evidencia.url} alt="Evidencia del cobro"
                  style={{ display: 'block', width: '100%', height: 128, objectFit: 'cover' }} />
                <span style={{
                  position: 'absolute', right: 8, bottom: 8,
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 9px', borderRadius: 999,
                  background: 'rgba(0,0,0,.7)', color: '#FFF', fontSize: 11, fontWeight: 600,
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  Foto guardada
                </span>
              </div>
            ) : (
              <button type="button" onClick={evidencia.onAdjuntar} disabled={evidencia.subiendo}
                style={{
                  ...SECUNDARIO, width: '100%', height: 46, fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  color: 'var(--cf-ink-2)', opacity: evidencia.subiendo ? 0.6 : 1,
                }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
                {evidencia.subiendo ? 'Subiendo…' : 'Adjuntar foto de evidencia'}
              </button>
            )}
          </div>
        )}

        {/* CÓMO VA EL DÍA. Fuera del troquelado a propósito: no es parte del
            comprobante del cliente —a él no le importa la meta de la ruta— sino
            del cobrador que acaba de cobrar. */}
        {progresoDia && (
          <div style={{
            flex: 'none', display: 'flex', flexDirection: 'column', gap: 9,
            padding: '2px 2px 0',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
                textTransform: 'uppercase', color: 'var(--cf-ink-3)', flex: 'none',
              }}>Llevas hoy</span>
              <span className="cf-num" style={{ fontSize: 14, fontWeight: 700 }}>{progresoDia.texto}</span>
            </div>
            {/* `flex: none` obligatorio: sin él la barra colapsa a 0px dentro de
                una columna flex y el estado desaparece. */}
            <div style={{
              flex: 'none', height: 7, borderRadius: 999,
              background: 'var(--cf-fill-2)', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 999, background: 'var(--cf-green)',
                width: `${Math.max(0, Math.min(100, progresoDia.porcentaje ?? 0))}%`,
              }} />
            </div>
          </div>
        )}
      </div>

      <div style={{
        flex: 'none', padding: '14px 24px 24px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {/* Verde WhatsApp: la excepción de marca externa permitida. Apagado sin
            teléfono, que es lo que pasa en la mitad de los clientes cargados en
            la calle. */}
        <button
          type="button"
          disabled={!telefono}
          onClick={onWhatsApp}
          style={{
            height: 54, border: 'none', borderRadius: 14,
            background: telefono ? VERDE_WA : 'var(--cf-fill-2)',
            color: telefono ? '#FFF' : 'var(--cf-ink-3)',
            cursor: telefono ? 'pointer' : 'default',
            font: 'inherit', fontSize: 16, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
          }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 12a8 8 0 01-11.6 7.1L4 20l.9-4.3A8 8 0 1120 12z" />
          </svg>
          {telefono ? 'Enviar por WhatsApp' : 'Sin teléfono para enviarlo'}
        </button>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={onGuardarImagen} style={SECUNDARIO}>Guardar imagen</button>
          <button type="button" onClick={onImprimir} style={SECUNDARIO}>Imprimir</button>
        </div>

        {/* El único dorado: seguir la ruta. Quien cobra va casa por casa. */}
        {onSiguiente && (
          <button type="button" onClick={onSiguiente} style={{
            height: 44, border: 'none', borderRadius: 14,
            background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', cursor: 'pointer',
            font: 'inherit', fontSize: 15, fontWeight: 700,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{siguienteNombre ? `Sigue: ${siguienteNombre}` : 'Siguiente cobro'}</button>
        )}

        {/* De segunda, como pide la lamina: sin relleno y sin borde. */}
        {onCerrar && (
          <button type="button" onClick={onCerrar} style={{
            height: 40, border: 0, background: 'none', cursor: 'pointer',
            font: 'inherit', fontSize: 14, fontWeight: 700, color: 'var(--cf-ink-3)',
          }}>{siguienteNombre ? 'Volver a la lista' : 'Listo'}</button>
        )}
      </div>
    </div>
  )
}

const SECUNDARIO = {
  flex: 1, minWidth: 0, height: 48, borderRadius: 14, cursor: 'pointer',
  background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
  color: 'var(--cf-ink)', font: 'inherit', fontSize: 14, fontWeight: 600,
}
