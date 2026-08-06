'use client'

// components/pantallas/Estados.jsx — T05-05 sin conexión · T34-03 búsqueda global.
//
// Lo que la app enseña cuando algo no está listo. Es lo que más se ve y lo que
// menos se diseña.
//
// ══ SIN CONEXIÓN NO ES UN ERROR ═════════════════════════════════════════════
//
// Un cobrador en la calle pierde señal cinco veces al día. Si la app dijera «error
// de conexión» cinco veces al día, dejaría de cobrar con la app. La franja dice
// «trabajando en el teléfono» —que es lo que de verdad pasa— y lo importante es la
// cifra: CUÁNTO DINERO HAY GUARDADO AQUÍ que todavía no ha llegado al servidor.
//
// Esa cifra es la que hace que el cobrador no cierre la app ni la reinstale.

const CARBON = '#15161A'
const CARBON_ORO = '#F5B824'
const CARBON_TINTA = '#F3F3F6'
const CARBON_APAGADO = '#8A8E98'

function Rotulo({ children }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
      textTransform: 'uppercase', color: 'var(--cf-ink-3)',
    }}>{children}</span>
  )
}

/* ══ La franja de sin señal ════════════════════════════════════════════════
   Carbón y no roja. El rojo dice «se rompió»; esto no se ha roto — se sigue
   pudiendo cobrar, que es lo único que el cobrador necesita saber. El punto ámbar
   parpadeando es lo que distingue «sin señal» de una barra de título cualquiera. */
export function FranjaSinSenal({
  texto = 'Sin señal · trabajando en el teléfono',
  accion = 'Reintentar', onReintentar,
}) {
  return (
    <div style={{
      flex: 'none', display: 'flex', alignItems: 'center', gap: 10,
      height: 38, padding: '0 20px', background: CARBON,
    }}>
      <span aria-hidden style={{
        width: 7, height: 7, borderRadius: 999, flex: 'none', background: CARBON_ORO,
      }} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: CARBON_TINTA }}>
        {texto}
      </span>
      {onReintentar && (
        <button type="button" onClick={onReintentar} style={{
          border: 0, background: 'none', padding: 0, cursor: 'pointer', flex: 'none',
          font: 'inherit', fontSize: 12, fontWeight: 700, color: CARBON_ORO,
        }}>{accion}</button>
      )}
    </div>
  )
}

/* ══ T05-05 · Por sincronizar ══════════════════════════════════════════════
   LA CIFRA MANDA. «4 pendientes» no dice nada; «$61.500 guardados aquí» dice que
   hay medio día de trabajo dentro del teléfono, y eso es lo que impide que alguien
   lo cierre creyendo que no se guardó.

   Cada cobro con su reloj ámbar. Los ya sincronizados se quedan en la lista pero
   en gris y con el visto: verlos irse uno a uno es lo que da confianza de que el
   resto también va a irse. */
export function PorSincronizar({
  titulo = 'Por sincronizar', onAtras,
  guardadoEtiqueta = 'Cobros guardados aquí', guardado, pendientes,
  cobros = [],
  nota,
}) {
  return (
    <div style={{
      height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column',
      color: 'var(--cf-ink)',
    }}>
      <div style={{
        flex: 'none', padding: '16px 20px 14px',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
          <span style={{
            flex: 1, minWidth: 0,
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 20, fontWeight: 600, letterSpacing: '-.02em',
          }}>{titulo}</span>
        </div>

        <div style={{
          background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          borderRadius: 'var(--cf-r-card)', padding: '18px 20px',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <Rotulo>{guardadoEtiqueta}</Rotulo>
            <span className="cf-fig" style={{
              fontFamily: 'var(--font-space-grotesk), system-ui',
              fontSize: 30, fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1,
              color: 'var(--cf-ink)',
            }}>{guardado}</span>
          </div>
          {pendientes && (
            <span className="cf-num" style={{
              display: 'inline-flex', alignItems: 'center', height: 26, padding: '0 11px',
              borderRadius: 11, flex: 'none',
              background: 'var(--cf-gold-bg)', border: '1px solid var(--cf-gold-border)',
              fontSize: 12, fontWeight: 700, color: 'var(--cf-gold-text)',
            }}>{pendientes}</span>
          )}
        </div>
      </div>

      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 20px 20px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {cobros.length > 0 && (
          <div style={{
            flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
            borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
          }}>
            {cobros.map((c, i) => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 13, padding: '15px 18px',
                borderTop: i === 0 ? 'none' : '1px solid var(--cf-hairline)',
              }}>
                {/* Reloj ámbar mientras espera, visto verde cuando ya subió. Los
                    subidos NO se borran de la lista: verlos irse uno a uno es lo
                    que da confianza de que el resto también va a irse. */}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 30, height: 30, borderRadius: 999, flex: 'none',
                  background: c.sincronizado ? 'var(--cf-green-pill-bg)' : 'var(--cf-gold-bg)',
                }}>
                  {c.sincronizado ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cf-green)"
                      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cf-gold-dark)"
                      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" />
                    </svg>
                  )}
                </span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{
                    fontSize: 14, fontWeight: 700,
                    color: c.sincronizado ? 'var(--cf-ink-3)' : 'var(--cf-ink)',
                  }}>{c.nombre}</span>
                  <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>
                    {c.detalle}
                  </span>
                </span>
                <span className="cf-fig" style={{
                  fontFamily: 'var(--font-space-grotesk), system-ui',
                  fontSize: 16, fontWeight: 600, flex: 'none',
                  // Sin monto o ya subido, en gris: la cifra negra es la que
                  // todavía está dentro del teléfono.
                  color: c.sincronizado || !c.entro ? 'var(--cf-ink-3)' : 'var(--cf-ink)',
                }}>{c.monto}</span>
              </div>
            ))}
          </div>
        )}

        {nota && (
          <span style={{ flex: 'none', fontSize: 12, lineHeight: 1.45, color: 'var(--cf-ink-3)', padding: '0 2px' }}>
            {nota}
          </span>
        )}
      </div>
    </div>
  )
}

/* ══ T34-03 · Búsqueda global ══════════════════════════════════════════════
   SE ABRE CON ALGO YA ESCRITO, aunque el campo esté vacío: «los últimos que
   abriste». Una búsqueda que arranca en blanco obliga a teclear para descubrir qué
   se puede buscar, y con un teclado en pantalla eso son cuatro segundos por vez.

   El campo dice QUÉ se puede escribir —«nombre, cédula o teléfono»— porque en este
   negocio se busca por cédula tanto como por nombre.

   Y el aro de color del avatar trae el estado del cliente: quien busca a alguien
   casi siempre quiere saber cómo va, no solo entrar. */
export function BusquedaGlobal({
  texto, onTexto, marcador = 'Nombre, cédula o teléfono',
  onCerrar,
  recientesTitulo = 'Últimos que abriste', recientes = [],
  atajosTitulo = 'Ir directo a', atajos = [],
  onAbrir, onAtajo,
  resultados, vacio,
  accion, pie,
}) {
  const buscando = String(texto ?? '').trim().length > 0

  return (
    <div style={{
      // El ANCHO hace falta explicito: como hijo de un contenedor en fila se
      // encogia al tamaño de su contenido —medido, 337 de 390— y dejaba una
      // franja del fondo asomando por la derecha. En el banco no se veia
      // porque el marco del telefono ya lo estiraba.
      width: '100%',
      height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column',
      background: 'var(--cf-surface)', color: 'var(--cf-ink)',
    }}>
      <div style={{
        flex: 'none', padding: '14px 20px 12px', background: 'var(--cf-card)',
        borderBottom: '1px solid var(--cf-border)',
        display: 'flex', alignItems: 'center', gap: 11,
      }}>
        <div style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10,
          height: 50, padding: '0 15px', borderRadius: 14,
          background: 'var(--cf-fill)',
          border: '1.5px solid var(--cf-gold)', boxShadow: '0 0 0 3px var(--cf-gold-focus)',
        }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-2)"
            strokeWidth="2" strokeLinecap="round" style={{ flex: 'none' }}>
            <circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" />
          </svg>
          <input
            value={texto ?? ''}
            onChange={(e) => onTexto?.(e.target.value)}
            placeholder={marcador}
            aria-label="Buscar"
            autoComplete="off"
            style={{
              flex: 1, minWidth: 0, border: 0, background: 'none', padding: 0,
              outline: 'none', font: 'inherit',
              fontSize: 16,   // menos de 16 y iOS hace zoom al enfocar
              color: 'var(--cf-ink)',
            }}
          />
        </div>
        {onCerrar && (
          <button type="button" onClick={onCerrar} style={{
            border: 0, background: 'none', padding: 0, cursor: 'pointer', flex: 'none',
            font: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--cf-ink-2)',
          }}>Cerrar</button>
        )}
      </div>

      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px 20px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {/* Con algo escrito manda el resultado; sin nada, lo reciente y los
            atajos. No se enseñan las dos cosas a la vez: la lista de abajo
            empujaría el primer resultado fuera de la pantalla. */}
        {buscando ? (
          <>
            {resultados?.length > 0 ? (
              <Lista filas={resultados} onIr={onAbrir} />
            ) : (
              vacio && (
                <span style={{
                  fontSize: 14, lineHeight: 1.5, color: 'var(--cf-ink-3)',
                  textAlign: 'center', padding: '32px 0',
                }}>{vacio}</span>
              )
            )}
          </>
        ) : (
          <>
            {recientes.length > 0 && (
              <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
                <Rotulo>{recientesTitulo}</Rotulo>
                <Lista filas={recientes} onIr={onAbrir} />
              </div>
            )}

            {atajos.length > 0 && (
              <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
                <Rotulo>{atajosTitulo}</Rotulo>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {atajos.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onAtajo?.(a)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8, flex: 'none',
                        height: 42, padding: '0 14px', borderRadius: 13, cursor: 'pointer',
                        background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
                        font: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)',
                      }}
                    >
                      {a.icono}
                      {a.texto}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* LA ACCION QUE TRAE AQUI A LA MITAD DE LA GENTE.
                Se abre el buscador para llegar a alguien que YA existe; cuando
                no aparece es porque todavia no esta. Sin esto el camino es
                cerrar, buscar el boton de crear y volver a empezar. */}
            {accion && (
              <button
                type="button"
                onClick={accion.onIr}
                style={{
                  flex: 'none', marginTop: 5, display: 'flex', alignItems: 'center', gap: 12,
                  width: '100%', padding: '15px 17px', borderRadius: 18, cursor: 'pointer',
                  border: 0, textAlign: 'left', font: 'inherit',
                  // Bloque permanentemente oscuro: color fijo, no token. Con
                  // tokens se aclara en tema claro y el dorado deja de leerse.
                  background: CARBON,
                }}
              >
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 36, height: 36, borderRadius: 12, flex: 'none',
                  background: 'color-mix(in srgb, ' + CARBON_ORO + ' 16%, transparent)',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={CARBON_ORO}
                    strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: CARBON_TINTA }}>{accion.texto}</span>
                  {accion.nota && (
                    <span style={{ fontSize: 12, color: CARBON_APAGADO }}>{accion.nota}</span>
                  )}
                </span>
              </button>
            )}

            {pie && (
              <span style={{
                flex: 'none', fontSize: 12, color: 'var(--cf-ink-3)', textAlign: 'center',
              }}>{pie}</span>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* Una lista de resultados. El aro de color del avatar trae el estado: quien busca
   a alguien casi siempre quiere saber cómo va, no solo entrar. */
function Lista({ filas = [], onIr }) {
  const ARO = { rojo: 'var(--cf-red)', verde: 'var(--cf-green)', oro: 'var(--cf-gold)' }
  // Las cosas que no son personas traen icono. Se deriva del tipo aqui para que
  // quien llame pase datos y no JSX: los adaptadores son `.js` con pruebas, y
  // meterles un `<svg>` los volveria imposibles de probar sin montar React.
  const ICONO = {
    ruta: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-2)"
        strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5L3.5 7v12L9 17l6 2 5.5-2V5L15 7z" />
      </svg>
    ),
  }
  return (
    <div style={{
      background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
      borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
    }}>
      {filas.map((f, i) => {
        const icono = f.icono ?? ICONO[f.tipo]
        return (
        <button
          key={f.id}
          type="button"
          onClick={() => onIr?.(f)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%',
            padding: '13px 16px', background: 'none', border: 0,
            borderTop: i === 0 ? 'none' : '1px solid var(--cf-hairline)',
            cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'var(--cf-ink)',
          }}
        >
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 34, height: 34, flex: 'none',
            // Las cosas que no son personas llevan icono y esquina redondeada, no
            // círculo: una ruta con iniciales se leería como un cliente.
            borderRadius: icono ? 11 : 999,
            background: 'var(--cf-fill)',
            border: f.estado ? `2px solid ${ARO[f.estado] ?? ARO.oro}` : 'none',
            fontSize: 12, fontWeight: 700, color: 'var(--cf-ink-2)',
          }}>{icono ?? f.iniciales}</span>

          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{f.nombre}</span>
            {f.detalle && (
              <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>
                {f.detalle}
              </span>
            )}
          </span>

          {f.cuando && (
            <span style={{ fontSize: 11, color: 'var(--cf-ink-4)', flex: 'none' }}>{f.cuando}</span>
          )}
        </button>
        )
      })}
    </div>
  )
}
