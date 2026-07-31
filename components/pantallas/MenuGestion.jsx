'use client'

// components/pantallas/MenuGestion.jsx — T05-01 menú de gestión · T15-03 cobro hecho.
//
// ══ EL COLOR VUELVE A SU SEMÁNTICA ══════════════════════════════════════════
//
// Hoy este menú son mosaicos de dos columnas teñidos de cinco colores —renovar
// morado, modificar plazo azul, día de cobro ámbar, recargo rojo, descuento
// verde— donde EL COLOR NO SIGNIFICA NADA. Y «días sin cobro», por venir en gris,
// parece deshabilitado.
//
// Aquí son filas, y el color solo aparece donde dice algo: SOLO «MOVER A
// PERDIDOS» VA EN ROJO, porque es la única que reconoce una pérdida.
//
// ══ CADA FILA TRAE SU VALOR ACTUAL ══════════════════════════════════════════
//
// «Modificar el plazo · 30 días», «Días sin cobro · domingos». Sin el valor hay
// que entrar a cada hoja para saber cómo está el préstamo — y la mitad de las
// veces se entra solo a mirar. Con el valor al lado, el menú contesta sin abrir
// nada.
//
// Las hojas que abre cada fila ya existen en `Gestion.jsx` (turnos 13 y 19). Esto
// es lo que faltaba: la puerta.

const ROJO = 'var(--cf-red-dark)'

function Rotulo({ children }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
      textTransform: 'uppercase', color: 'var(--cf-ink-3)',
    }}>{children}</span>
  )
}

function Fila({ nombre, valor, peligro, onIr, primera }) {
  return (
    <button
      type="button"
      onClick={onIr}
      style={{
        display: 'flex', alignItems: 'center', gap: 13, width: '100%',
        height: 52, padding: '0 16px', background: 'none', border: 0,
        borderTop: primera ? 'none' : '1px solid var(--cf-hairline)',
        cursor: 'pointer', textAlign: 'left', font: 'inherit',
        // El rojo NO es un aviso de peligro genérico: es que esta acción reconoce
        // una pérdida. Ninguna otra fila lleva color.
        color: peligro ? ROJO : 'var(--cf-ink)',
      }}
    >
      <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600 }}>{nombre}</span>
      {/* El valor actual, en gris y sin negrita: informa, no compite con el
          nombre de la acción. */}
      {valor && (
        <span className="cf-num" style={{ fontSize: 13, color: 'var(--cf-ink-3)', flex: 'none' }}>
          {valor}
        </span>
      )}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cf-chevron)"
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
        <path d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

export function MenuGestion({
  titulo = 'Gestionar préstamo', detalle,
  grupos = [], onAccion,
  // Dentro de una hoja que YA tiene cabecera y asa, las suyas sobran: saldrian
  // dos titulos seguidos. Es lo que me paso al montar caja y cobradores.
  cabecera = true,
}) {
  return (
    <div style={{
      background: 'var(--cf-surface)', color: 'var(--cf-ink)',
      borderRadius: cabecera ? 'var(--cf-r-sheet) var(--cf-r-sheet) 0 0' : 0,
      boxShadow: cabecera ? '0 -12px 32px rgba(20,20,28,.18)' : 'none',
      padding: cabecera ? '10px 0 0' : 0, display: 'flex', flexDirection: 'column',
    }}>
      {cabecera && (
        <span aria-hidden style={{
          width: 38, height: 4, borderRadius: 999, alignSelf: 'center', marginBottom: 14,
          background: 'var(--cf-border-strong)',
        }} />
      )}

      <div style={{ padding: cabecera ? '0 22px 20px' : 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {cabecera && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 20, fontWeight: 600, letterSpacing: '-.02em',
          }}>{titulo}</span>
          {/* De quién y cómo va: «Steven Olmos · diario 20% · cuota 22 de 30».
              La hoja se abre desde una lista y el teléfono cambia de mano. */}
          {detalle && (
            <span className="cf-num" style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>{detalle}</span>
          )}
        </div>
        )}

        {grupos.map((g) => (
          <div key={g.titulo} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {/* Los grupos dicen QUÉ CAMBIA cada uno: lo que se cobra, cuándo se
                cobra, o el préstamo entero. Nueve acciones sin agrupar obligan a
                leerlas todas para encontrar una. */}
            <Rotulo>{g.titulo}</Rotulo>
            <div style={{
              background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
              borderRadius: 14, overflow: 'hidden',
            }}>
              {g.acciones.map((a, i) => (
                <Fila key={a.id} {...a} primera={i === 0} onIr={() => onAccion?.(a)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══ T15-03 · Cobro hecho ══════════════════════════════════════════════════
   EL BOTÓN DORADO ES EL SIGUIENTE CLIENTE, no «listo». Quien acaba de cobrar está
   en la puerta de al lado, y «Siguiente: Carlos Prueba 1» encadena el recorrido
   sin volver a la lista a buscar dónde se había quedado.

   Y la pantalla contesta las dos preguntas que quedan después de cobrar:
   CUÁNTO LE QUEDA DEBIENDO a este cliente, y CUÁNTO LLEVA HOY el cobrador. La
   segunda es la que le dice si va bien o si le falta media ruta.

   El recibo se confirma con el número al que se mandó: sin el número, «recibo
   enviado» no se puede comprobar cuando el cliente diga que no le llegó. */
export function CobroHecho({
  monto, cliente,
  debeEtiqueta = 'Le queda debiendo', debe,
  llevasEtiqueta = 'Llevas hoy', llevas, progreso = 0,
  recibo,
  siguiente, onSiguiente, onVolver,
}) {
  return (
    <div style={{
      height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column',
      color: 'var(--cf-ink)',
    }}>
      <div style={{
        flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 26, padding: '0 32px',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          {/* La moneda grande, la misma que cierra el arranque. Aquí no celebra el
              producto: celebra que entró plata. */}
          <span aria-hidden style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 96, minWidth: 96, height: 96, minHeight: 96, flex: 'none',
            borderRadius: 999, background: 'var(--cf-gold)',
            border: '4px solid var(--cf-gold-light)',
            boxShadow: '0 10px 28px rgba(231,164,0,.32)',
          }}>
            <span style={{
              fontFamily: 'var(--font-space-grotesk), system-ui',
              fontSize: 42, fontWeight: 700, color: 'var(--cf-gold-ink)',
            }}>$</span>
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <span className="cf-fig" style={{
              fontFamily: 'var(--font-space-grotesk), system-ui',
              fontSize: 34, fontWeight: 600, letterSpacing: '-.035em', lineHeight: 1,
            }}>{monto}</span>
            <span style={{ fontSize: 15, color: 'var(--cf-ink-2)', textAlign: 'center' }}>
              cobrados a {cliente}
            </span>
          </div>
        </div>

        <div style={{
          width: '100%', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          borderRadius: 'var(--cf-r-card)', padding: '18px 20px',
          display: 'flex', flexDirection: 'column', gap: 13,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--cf-ink-2)' }}>{debeEtiqueta}</span>
            <span className="cf-fig" style={{
              fontFamily: 'var(--font-space-grotesk), system-ui',
              fontSize: 16, fontWeight: 600, flex: 'none',
            }}>{debe}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--cf-ink-2)' }}>{llevasEtiqueta}</span>
            <span className="cf-fig" style={{
              fontFamily: 'var(--font-space-grotesk), system-ui',
              fontSize: 16, fontWeight: 600, flex: 'none',
            }}>{llevas}</span>
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

          {/* CON EL NÚMERO. Sin él, «recibo enviado» no se puede comprobar cuando
              el cliente diga que no le llegó. */}
          {recibo && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 9,
              paddingTop: 12, borderTop: '1px solid var(--cf-hairline)',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#25D366"
                strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
                <path d="M20 12a8 8 0 01-11.6 7.1L4 20l.9-4.3A8 8 0 1120 12z" />
              </svg>
              <span className="cf-num" style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--cf-ink-2)' }}>
                {recibo}
              </span>
            </div>
          )}
        </div>
      </div>

      <div style={{
        flex: 'none', padding: '14px 22px 24px', display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {/* SIGUIENTE, con nombre y flecha. Volver a la lista existe pero queda de
            segunda: quien cobra va casa por casa, no lista por lista. */}
        {siguiente && onSiguiente && (
          <button type="button" onClick={onSiguiente} style={{
            width: '100%', height: 54, border: 'none', borderRadius: 14, cursor: 'pointer',
            background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', font: 'inherit',
            fontSize: 17, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            Siguiente: {siguiente}
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M14 7l5 5-5 5" />
            </svg>
          </button>
        )}
        {onVolver && (
          <button type="button" onClick={onVolver} style={{
            width: '100%', height: 50, borderRadius: 14, cursor: 'pointer',
            background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
            font: 'inherit', fontSize: 15, fontWeight: 600, color: 'var(--cf-ink-2)',
          }}>Volver a la lista</button>
        )}
      </div>
    </div>
  )
}
