'use client'
// components/clientes/LucasSugiere.jsx — E05, la recomendación con marca y acción.
//
// ══ ERA UN BANNER GRIS CON UNA CHISPA Y UNA ✕ ══════════════════════════════
//
// Indistinguible de un aviso del sistema, y decía una frase: «lleva 80% pagado
// — cliente con buen historial de pago». Cierto y sin salida: para actuar había
// que ir a buscar el tope, el historial y el botón de prestar.
//
// De la lámina: «una recomendación sin monto y sin botón es una frase; con los
// dos, es una decisión que el dueño toma en dos segundos».
//
// Y al pie va el descargo que la hace honesta: la app no aprueba un crédito,
// resume lo que ya sabe. El monto sale del tope que el propio dueño puso.

const CHISPA = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2l1.9 5.6L19.5 9l-4.4 3.4 1.4 5.6L12 15l-4.5 3 1.4-5.6L4.5 9l5.6-1.4z" />
  </svg>
)

export default function LucasSugiere({ sugerencia, onPrestar, onOtroMonto }) {
  if (!sugerencia?.titular) return null
  const { tono, titular, porque, etiqueta, monto } = sugerencia
  const esOferta = tono === 'oferta' && monto > 0 && !!onPrestar

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        background: '#15161A', borderRadius: 18, padding: '17px 19px',
        border: '1px solid rgba(255,255,255,.09)',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 30, height: 30, flex: 'none', borderRadius: 10,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--cf-gold)', color: '#3A2900',
          }}>{CHISPA}</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: '#F3F3F6' }}>
            Lucas te sugiere
          </span>
          {etiqueta && (
            <span style={{
              flex: 'none', fontSize: 11, color: '#8A8E98',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{etiqueta}</span>
          )}
        </div>

        {/* El titular lleva la cifra dentro, en dorado: es lo que se lee de un
            vistazo y lo que decide. */}
        <p style={{ margin: 0, fontSize: 16.5, lineHeight: 1.35, color: '#F3F3F6' }}>
          {esOferta ? partirEnLaCifra(titular) : titular}
        </p>

        {porque && (
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: '#A3A8B2' }}>
            {porque}
          </p>
        )}

        {esOferta && (
          <div style={{
            display: 'flex', gap: 8, paddingTop: 12,
            borderTop: '1px solid rgba(255,255,255,.09)',
          }}>
            <button
              type="button"
              onClick={() => onPrestar(monto)}
              style={{
                flex: 1, minWidth: 0, height: 44, borderRadius: 13, border: 0, cursor: 'pointer',
                background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
                font: 'inherit', fontSize: 14, fontWeight: 700,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              Prestarle ${Math.round(monto).toLocaleString('es-CO')}
            </button>
            {onOtroMonto && (
              <button
                type="button"
                onClick={onOtroMonto}
                style={{
                  flex: 'none', height: 44, padding: '0 16px', borderRadius: 13, cursor: 'pointer',
                  background: 'transparent', border: '1px solid rgba(255,255,255,.16)',
                  color: '#F3F3F6', font: 'inherit', fontSize: 14, fontWeight: 700,
                }}
              >
                Otro monto
              </button>
            )}
          </div>
        )}
      </div>

      {/* ⚠ EL DESCARGO NO ES LETRA PEQUEÑA DE ADORNO. La app no está aprobando
          un crédito: está recordando el tope que el dueño puso y cómo le ha
          pagado ese cliente. Decirlo es lo que hace honesta la sugerencia. */}
      {esOferta && (
        <p style={{
          margin: 0, padding: '10px 15px', borderRadius: 13,
          background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          fontSize: 11.5, lineHeight: 1.45, color: 'var(--cf-ink-3)',
        }}>
          Es una sugerencia, no una aprobación. Sale del tope que le pusiste y de
          cómo te ha pagado.
        </p>
      )}
    </div>
  )
}

/* La cifra del titular, en dorado. Se parte por el «$…» en vez de recomponer la
   frase: así el texto lo escribe quien decide qué decir —`clienteTips`— y aquí
   solo se le da color. */
function partirEnLaCifra(texto) {
  const m = /\$[\d.,]+/.exec(texto)
  if (!m) return texto
  return (
    <>
      {texto.slice(0, m.index)}
      <span style={{ color: 'var(--cf-gold)', fontWeight: 700 }}>{m[0]}</span>
      {texto.slice(m.index + m[0].length)}
    </>
  )
}
