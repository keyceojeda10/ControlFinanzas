'use client'

// components/pantallas/RutaEditar.jsx — T24-01 crear ruta · T24-02 reordenar.
//
// ══ T24-02 NUNCA EXISTIÓ, Y ESO ES EL HALLAZGO ══════════════════════════════
//
// Hoy los cobros salen EN EL ORDEN EN QUE SE CREARON LOS CLIENTES, así que el
// cobrador hace zigzag por el barrio todos los días. El pie de la lámina cuantifica
// lo que cuesta: 3,4 km bajan a 2,6 km, «casi una hora al mes».
//
// Arrastrar es el gesto correcto porque EL ORDEN LO SABE ÉL, NO LA APP: sabe qué
// calle es de una sola dirección, dónde hay perro y a qué hora abre el granero. La
// app propone por cercanía y dice cuánto se ahorra, pero no decide.
//
// Y cada parada enseña la distancia DESDE LA ANTERIOR —la primera, desde donde
// está—, que es lo único que permite juzgar si el orden es bueno. Una lista de
// distancias al cobrador no dice nada del zigzag.
//
// ══ EL ARRASTRE ES DE VERDAD, CON PUNTEROS ══════════════════════════════════
//
// Con Pointer Events, que cubre dedo y ratón con el mismo código. Si lo hubiera
// dejado en un `onMover(id, direccion)` con flechas, la pantalla que «nunca
// existió» seguiría sin existir: el gesto ES la pantalla.
//
// El asa (`touchAction: 'none'`) es lo único que arranca el arrastre. Arrastrar
// desde toda la fila pelearía con el scroll de la lista, que en una ruta de treinta
// paradas es lo que más se usa.

import { useRef, useState } from 'react'

const FILETE = { rojo: 'var(--cf-red)', verde: 'var(--cf-green)', oro: 'var(--cf-gold)' }

function Rotulo({ children }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
      textTransform: 'uppercase', color: 'var(--cf-ink-3)',
    }}>{children}</span>
  )
}

function Cabecera({ titulo, detalle, onAtras, accion, tamano = 21 }) {
  return (
    <div style={{
      flex: 'none', padding: '6px 20px 12px', display: 'flex', alignItems: 'center', gap: 12,
    }}>
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
          fontSize: tamano, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)',
        }}>{titulo}</span>
        {detalle && (
          <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{detalle}</span>
        )}
      </div>
      {accion}
    </div>
  )
}

function Consejo({ texto }) {
  if (!texto) return null
  return (
    <div style={{
      flex: 'none', display: 'flex', gap: 10, alignItems: 'flex-start',
      padding: '13px 16px', borderRadius: 14,
      background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
    }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-3)"
        strokeWidth="2" strokeLinecap="round" style={{ flex: 'none', marginTop: 1 }}>
        <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
      </svg>
      <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--cf-ink-2)' }}>{texto}</span>
    </div>
  )
}

function Marca({ elegido, cuadrada }) {
  const radio = cuadrada ? 6 : 999
  const lado = cuadrada ? 22 : 22
  if (!elegido) {
    return (
      <span style={{
        width: lado, height: lado, borderRadius: radio, flex: 'none',
        border: '1.5px solid var(--cf-border-strong)',
      }} />
    )
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: lado, height: lado, borderRadius: radio, flex: 'none',
      background: 'var(--cf-gold)',
    }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--cf-gold-ink)"
        strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 13l4 4L19 7" />
      </svg>
    </span>
  )
}

/* ══ T24-01 · Crear ruta ═══════════════════════════════════════════════════
   TRES DECISIONES Y NADA MÁS: cómo se llama, quién la recorre y quiénes van.

   El nombre pide barrio y dice por qué: «es como la va a buscar el cobrador». Un
   «Ruta 3» no se busca, se cuenta.

   Los cobradores SIN RUTA van primero — el mismo hallazgo de las rutas vacías,
   atacado desde el otro lado.

   Y el aviso ámbar dice la consecuencia que nadie prevé: mover clientes aquí los
   saca de la ruta de otro cobrador, que se enterará al día siguiente en la calle. */
export function CrearRuta({
  nombre, onNombre,
  nombreAyuda = 'Ponle el nombre del barrio; es como la va a buscar el cobrador.',
  cobradores = [], cobradorNota, cobrador, onCobrador,
  clientes = [], elegidos = [], onCliente,
  buscar, onBuscar, buscarPlaceholder,
  aviso,
  onCrear, creando,
}) {
  const cuantos = elegidos.length
  return (
    <div style={{
      height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column',
      color: 'var(--cf-ink)',
    }}>
      <Cabecera titulo="Nueva ruta" onAtras={undefined} />

      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 20px 6px',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Rotulo>Cómo se llama</Rotulo>
          <div style={{
            display: 'flex', alignItems: 'center', height: 56, padding: '0 16px',
            borderRadius: 14, background: 'var(--cf-card)',
            border: '1.5px solid var(--cf-gold)', boxShadow: '0 0 0 3px var(--cf-gold-focus)',
          }}>
            <input
              value={nombre ?? ''}
              onChange={(e) => onNombre?.(e.target.value)}
              aria-label="Nombre de la ruta"
              style={{
                flex: 1, minWidth: 0, border: 0, background: 'none', padding: 0,
                outline: 'none', font: 'inherit',
                fontSize: 17, fontWeight: 600, color: 'var(--cf-ink)',
              }}
            />
          </div>
          <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{nombreAyuda}</span>
        </div>

        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <Rotulo>Quién la recorre</Rotulo>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {cobradores.map((c) => {
              const elegido = cobrador === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onCobrador?.(c.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                    padding: '13px 16px', borderRadius: 14, cursor: 'pointer',
                    textAlign: 'left', font: 'inherit', color: 'var(--cf-ink)',
                    background: 'var(--cf-card)',
                    border: elegido ? '1.5px solid var(--cf-gold)' : '1px solid var(--cf-border)',
                    boxShadow: elegido ? '0 0 0 3px var(--cf-gold-focus)' : 'none',
                  }}
                >
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 34, height: 34, borderRadius: 999, flex: 'none',
                    background: 'var(--cf-fill)', fontSize: 12, fontWeight: 700, color: 'var(--cf-ink-2)',
                  }}>{c.iniciales}</span>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{c.nombre}</span>
                    <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{c.detalle}</span>
                  </span>
                  <Marca elegido={elegido} />
                </button>
              )
            })}
          </div>
          {cobradorNota && (
            <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{cobradorNota}</span>
          )}
        </div>

        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Rotulo>Qué clientes van</Rotulo>
            <span style={{ flex: 1 }} />
            {cuantos > 0 && (
              <span className="cf-num" style={{
                fontSize: 12, fontWeight: 700, color: 'var(--cf-gold-dark)', flex: 'none',
              }}>{cuantos} escogido{cuantos === 1 ? '' : 's'}</span>
            )}
          </div>

          <div style={{
            background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
            borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              flex: 'none', display: 'flex', alignItems: 'center', gap: 11,
              height: 48, padding: '0 16px', background: 'var(--cf-fill)',
              borderBottom: '1px solid var(--cf-hairline)',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-4)"
                strokeWidth="2" strokeLinecap="round" style={{ flex: 'none' }}>
                <circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" />
              </svg>
              <input
                value={buscar ?? ''}
                onChange={(e) => onBuscar?.(e.target.value)}
                placeholder={buscarPlaceholder}
                aria-label="Buscar clientes"
                style={{
                  flex: 1, minWidth: 0, border: 0, background: 'none', padding: 0,
                  outline: 'none', font: 'inherit', fontSize: 14, color: 'var(--cf-ink)',
                }}
              />
            </div>

            {clientes.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onCliente?.(c.id)}
                style={{
                  flex: 'none', display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  padding: '9px 16px', background: 'none', border: 0,
                  borderTop: i === 0 ? 'none' : '1px solid var(--cf-hairline)',
                  cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'var(--cf-ink)',
                }}
              >
                <Marca cuadrada elegido={c.elegido} />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{c.nombre}</span>
                  {/* «Hoy en Ruta 2» aquí y no en un aviso general: se decide
                      cliente por cliente, así que la información va en la fila. */}
                  <span className="cf-num" style={{ fontSize: 11, color: 'var(--cf-ink-3)' }}>
                    {c.detalle}
                  </span>
                </span>
              </button>
            ))}
          </div>

          {/* LA CONSECUENCIA, antes de guardar. */}
          {aviso && (
            <div style={{
              flex: 'none', display: 'flex', gap: 10, alignItems: 'flex-start',
              padding: '13px 16px', borderRadius: 14,
              background: 'var(--cf-gold-tint)', border: '1px solid var(--cf-gold-border)',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cf-gold-dark)"
                strokeWidth="2.1" strokeLinecap="round" style={{ flex: 'none', marginTop: 1 }}>
                <path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" />
              </svg>
              <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--cf-gold-text)' }}>
                {aviso}
              </span>
            </div>
          )}
        </div>
      </div>

      <div style={{
        flex: 'none', padding: '14px 20px 22px', background: 'var(--cf-card)',
        borderTop: '1px solid var(--cf-border)',
      }}>
        {/* El botón cuenta lo que va a crear. «Crear ruta» a secas obliga a subir
            a contar los seleccionados antes de pulsar. */}
        <button type="button" onClick={onCrear} disabled={creando || cuantos === 0} style={{
          width: '100%', height: 54, border: 'none', borderRadius: 14,
          background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', font: 'inherit',
          fontSize: 17, fontWeight: 700,
          cursor: creando || cuantos === 0 ? 'not-allowed' : 'pointer',
          opacity: creando || cuantos === 0 ? 0.55 : 1,
        }}>
          {cuantos === 0
            ? 'Escoge al menos un cliente'
            : `Crear la ruta con ${cuantos} cliente${cuantos === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  )
}

/* ══ T24-02 · Orden del recorrido ══════════════════════════════════════════ */

/* El asa. Es lo único que arranca el arrastre — desde toda la fila pelearía con el
   scroll, que en una ruta de treinta paradas es el gesto más usado. */
function Asa({ activa, ...resto }) {
  return (
    <span
      {...resto}
      role="button"
      tabIndex={-1}
      aria-label="Arrastrar para reordenar"
      style={{ display: 'inline-flex', flex: 'none', cursor: 'grab', touchAction: 'none' }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
        stroke={activa ? 'var(--cf-gold-dark)' : 'var(--cf-chevron)'}
        strokeWidth="2.2" strokeLinecap="round">
        <path d="M8 7h.01M8 12h.01M8 17h.01M16 7h.01M16 12h.01M16 17h.01" />
      </svg>
    </span>
  )
}

export function OrdenRecorrido({
  titulo = 'Orden del recorrido', detalle, onAtras, onMapa,
  consejo = 'Arrastra para cambiar el orden. Así es como te van a salir los cobros cada día.',
  paradas = [],
  onReordenar,
  propuesta, onProbar,
  onDeshacer, onGuardar, guardando,
  sucio,
}) {
  const [arrastrando, setArrastrando] = useState(null)  // índice que se mueve
  const cajas = useRef([])

  // El arrastre en cinco líneas: se mide dónde está cada fila al empezar, y al
  // mover se busca cuál contiene el dedo. No hay animación de reordenado en vivo
  // —la fila se marca «soltando…» y la lista se reordena al soltar—: reordenar en
  // cada píxel con treinta filas va a tirones en un teléfono de gama baja.
  const empezar = (i) => (e) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    cajas.current = paradas.map((_, j) => {
      const el = document.querySelector(`[data-parada="${j}"]`)
      return el ? el.getBoundingClientRect() : null
    })
    setArrastrando({ desde: i, hasta: i })
  }

  const mover = (e) => {
    if (!arrastrando) return
    const y = e.clientY
    const dentro = cajas.current.findIndex((r) => r && y >= r.top && y <= r.bottom)
    if (dentro >= 0 && dentro !== arrastrando.hasta) {
      setArrastrando((a) => ({ ...a, hasta: dentro }))
    }
  }

  const soltar = () => {
    if (!arrastrando) return
    const { desde, hasta } = arrastrando
    setArrastrando(null)
    if (desde !== hasta) onReordenar?.(desde, hasta)
  }

  return (
    <div
      style={{
        height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column',
        color: 'var(--cf-ink)',
      }}
      onPointerMove={mover}
      onPointerUp={soltar}
      onPointerCancel={soltar}
    >
      <Cabecera
        titulo={titulo} detalle={detalle} onAtras={onAtras} tamano={20}
        accion={onMapa && (
          <button type="button" onClick={onMapa} style={{
            display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 12px',
            borderRadius: 11, flex: 'none', cursor: 'pointer',
            background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
            font: 'inherit', fontSize: 12, fontWeight: 700, color: 'var(--cf-ink-2)',
          }}>Ver mapa</button>
        )}
      />

      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 20px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <Consejo texto={consejo} />

        {paradas.map((p, i) => {
          const activa = arrastrando?.desde === i
          const destino = arrastrando && arrastrando.hasta === i && !activa
          return (
            <div
              key={p.id}
              data-parada={i}
              style={{
                flex: 'none', position: 'relative', overflow: 'hidden',
                background: 'var(--cf-card)', borderRadius: 'var(--cf-r-card-sm)',
                padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 12,
                border: activa || destino ? '1.5px solid var(--cf-gold)' : '1px solid var(--cf-border)',
                // La fila que se mueve se levanta y se inclina un grado: es lo que
                // hace que se lea como «cogida» y no como «seleccionada».
                boxShadow: activa ? '0 8px 20px rgba(20,20,28,.14)' : 'none',
                transform: activa ? 'rotate(-1deg)' : 'none',
              }}
            >
              {/* El filete de estado desaparece en la fila cogida: ahí el color
                  dorado del borde ya dice lo único que importa. */}
              {!activa && (
                <span aria-hidden style={{
                  position: 'absolute', left: 0, top: 12, bottom: 12, width: 3,
                  borderRadius: 999, background: FILETE[p.color] ?? FILETE.oro,
                }} />
              )}

              <Asa activa={activa} onPointerDown={empezar(i)} />

              <span className="cf-num" style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: 999, flex: 'none',
                background: activa ? 'var(--cf-gold)' : 'var(--cf-fill)',
                fontSize: 13, fontWeight: 700,
                color: activa ? 'var(--cf-gold-ink)' : 'var(--cf-ink-2)',
              }}>{p.orden}</span>

              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{p.nombre}</span>
                {p.detalle && (
                  <span className="cf-num" style={{ fontSize: 11, color: 'var(--cf-ink-3)' }}>
                    {p.detalle}
                  </span>
                )}
              </span>

              {activa ? (
                <span style={{
                  fontSize: 12, fontWeight: 700, color: 'var(--cf-gold-text)', flex: 'none',
                }}>soltando…</span>
              ) : p.tramo && (
                /* La distancia DESDE LA ANTERIOR. Es lo que permite ver el zigzag. */
                <span className="cf-num" style={{ fontSize: 11, color: 'var(--cf-ink-3)', flex: 'none' }}>
                  {p.tramo}
                </span>
              )}
            </div>
          )
        })}

        {/* LA APP PROPONE Y DICE CUÁNTO SE AHORRA. Sin la cifra es un botón que hay
            que probar a ver qué pasa; con ella es una oferta que se puede juzgar. */}
        {propuesta && (
          <div style={{
            flex: 'none', display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 16px', borderRadius: 'var(--cf-r-card-sm)', background: '#15161A',
          }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#F3F3F6' }}>{propuesta.titulo}</span>
              <span className="cf-num" style={{ fontSize: 11, color: '#A3A8B2' }}>{propuesta.detalle}</span>
            </div>
            <button type="button" onClick={onProbar} style={{
              display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 13px',
              borderRadius: 11, flex: 'none', border: 0, cursor: 'pointer',
              background: '#F5B824', color: '#3A2900', font: 'inherit',
              fontSize: 12, fontWeight: 700,
            }}>Probar</button>
          </div>
        )}
      </div>

      <div style={{
        flex: 'none', padding: '14px 20px 22px', background: 'var(--cf-card)',
        borderTop: '1px solid var(--cf-border)', display: 'flex', gap: 10,
      }}>
        {/* «Deshacer» existe porque arrastrar se falla: el dedo suelta donde no
            era y hay que poder volver sin acordarse del orden anterior. */}
        <button
          type="button"
          onClick={onDeshacer}
          disabled={!sucio}
          style={{
            flex: 1, height: 52, borderRadius: 14,
            background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
            color: 'var(--cf-ink-2)', font: 'inherit', fontSize: 15, fontWeight: 600,
            cursor: sucio ? 'pointer' : 'not-allowed', opacity: sucio ? 1 : 0.5,
          }}
        >Deshacer</button>
        <button
          type="button"
          onClick={onGuardar}
          disabled={guardando || !sucio}
          style={{
            flex: 1.7, height: 52, borderRadius: 14, border: 'none',
            background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', font: 'inherit',
            fontSize: 16, fontWeight: 700,
            cursor: guardando || !sucio ? 'not-allowed' : 'pointer',
            opacity: guardando || !sucio ? 0.55 : 1,
          }}
        >{guardando ? 'Guardando…' : 'Guardar el orden'}</button>
      </div>
    </div>
  )
}
