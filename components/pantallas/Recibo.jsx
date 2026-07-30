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

export function Recibo({
  monto, cliente, saldo, proximoCobro, numero, recibidoPor, negocio = 'Control Finanzas',
  cuando,
  onWhatsApp, onGuardarImagen, onImprimir, onSiguiente,
  telefono,
}) {
  return (
    <div style={{
      height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column',
      color: 'var(--cf-ink)',
    }}>
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px 24px 0',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          {/* Verde, no dorado. El dorado de esta pantalla es «siguiente cobro»:
              el visto es un hecho consumado, no la acción que sigue. */}
          <span aria-hidden style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 64, height: 64, minWidth: 64, minHeight: 64, flex: 'none',
            borderRadius: 999, background: 'var(--cf-green)',
          }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#FFF"
              strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <span style={{
              fontFamily: 'var(--font-space-grotesk), system-ui',
              fontSize: 23, fontWeight: 600, letterSpacing: '-.02em',
            }}>Pago registrado</span>
            {/* Fecha Y HORA. Dos pagos el mismo día son dos recibos distintos, y
                sin la hora no se distinguen. */}
            {cuando && (
              <span className="cf-num" style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>{cuando}</span>
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
          }}>Siguiente cobro</button>
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
