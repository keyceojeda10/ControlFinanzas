'use client'

// components/pantallas/Plantillas.jsx — T11-01 plantillas de WhatsApp.
//
// ══ SE LEE ANTES DE MANDARLO ═══════════════════════════════════════════════
//
// Hoy se pulsa «enviar resumen» y se abre WhatsApp con un mensaje que el cobrador
// NO HA LEÍDO, en el chat de una persona que le debe plata. Aquí el mensaje se ve
// entero, en una burbuja igual a la de WhatsApp, con los datos ya puestos y
// RESALTADOS: lo resaltado es lo que llenó el sistema, y es dónde mirar si el
// nombre sale mal o la cuota no cuadra.
//
// El verde de WhatsApp solo en el botón de envío. Es la excepción de marca
// externa que la receta permite, y solo ahí: si la burbuja, el botón y el icono
// fueran verdes, la pantalla dejaría de ser de Control Finanzas.

import { useState } from 'react'

const VERDE_WA = '#25D366'
const BURBUJA = '#DCF8C6'
const BURBUJA_DATO = '#C3ECAB'

export function Plantillas({
  cliente, detalle,
  familias = [], familia, onFamilia,
  plantillas = [], elegida, onElegir,
  telefono,
  onEditarPlantillas, onAbrir, onCerrar,
}) {
  const [libre, setLibre] = useState('')
  const actual = plantillas.find((p) => p.id === elegida) ?? plantillas[0]
  const esLibre = Boolean(actual?.libre)
  const puedeEnviar = Boolean(telefono) && (!esLibre || libre.trim().length > 0)

  return (
    <div style={{
      height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column',
      color: 'var(--cf-ink)',
    }}>
      {/* ⚠ EL NOMBRE VA DENTRO DE LA HOJA, NO ENCIMA DEL VELO.
          Estaba fuera, sobre el velo gris con desenfoque, heredando `--cf-ink`
          —tinta oscura sobre gris oscuro—: en la captura del dueño «Pepito ·
          Debe $1.408.000 · 10 días de atraso» no se leía, y ese detalle es lo
          que decide QUÉ plantilla usar.
          Se movió al bloque de abajo, sobre fondo claro. Ver ahí. */}

      <div style={{
        flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
        background: 'var(--cf-surface)',
        borderRadius: 'var(--cf-r-sheet) var(--cf-r-sheet) 0 0',
        boxShadow: '0 -12px 32px rgba(20,20,28,.18)',
        overflow: 'hidden',
      }}>
        <div style={{ flex: 'none', padding: '10px 0 0', display: 'flex', flexDirection: 'column' }}>
          <span aria-hidden style={{
            width: 38, height: 4, borderRadius: 999, alignSelf: 'center', marginBottom: 14,
            background: 'var(--cf-border-strong)',
          }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '0 22px 14px' }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* EL NOMBRE DEL CLIENTE ES EL TÍTULO, no «Escribirle por
                  WhatsApp»: el icono verde y el botón de abajo ya dicen que
                  esto es WhatsApp. Lo que hay que confirmar antes de mandar un
                  mensaje a alguien que debe plata es A QUIÉN se le escribe.
                  Y el detalle —cuánto debe, cuánto lleva de atraso— es lo que
                  decide qué plantilla usar. */}
              <span style={{
                fontFamily: 'var(--font-space-grotesk), system-ui',
                fontSize: 20, fontWeight: 600, letterSpacing: '-.02em',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{cliente}</span>
              <span className="cf-num" style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>
                {detalle || 'Se abre WhatsApp con el mensaje listo'}
              </span>
            </div>
            {onCerrar && (
              <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{
                background: 'none', border: 0, padding: 0, cursor: 'pointer',
                flex: 'none', marginTop: 3, display: 'inline-flex',
              }}>
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-2)"
                  strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            )}
          </div>
        </div>

        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 22px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {/* Las familias son el orden del día: primero se cobra, luego se
              reclama, luego se negocia, y solo al final se ofrece más plata. */}
          <div style={{ flex: 'none', display: 'flex', gap: 7, overflowX: 'auto' }}>
            {familias.map((f) => {
              const activa = f.id === familia
              return (
                <button key={f.id} type="button" onClick={() => onFamilia?.(f.id)} style={{
                  display: 'inline-flex', alignItems: 'center', height: 36, padding: '0 13px',
                  borderRadius: 11, cursor: 'pointer', font: 'inherit', fontSize: 12, flex: 'none',
                  background: activa ? 'var(--cf-ink)' : 'var(--cf-card)',
                  border: activa ? 'none' : '1px solid var(--cf-border)',
                  color: activa ? 'var(--cf-surface)' : 'var(--cf-ink-2)',
                  fontWeight: activa ? 700 : 600,
                }}>{f.etiqueta}</button>
              )
            })}
          </div>

          {plantillas.map((p) => {
            const marcada = p.id === (actual?.id)
            return (
              <div key={p.id} style={{
                flex: 'none', background: 'var(--cf-card)',
                border: marcada ? '1.5px solid var(--cf-gold)' : '1px solid var(--cf-border)',
                borderRadius: 'var(--cf-r-card)', padding: '16px 18px',
                boxShadow: marcada ? '0 0 0 3px var(--cf-gold-focus)' : 'none',
                display: 'flex', flexDirection: 'column', gap: marcada ? 12 : 10,
              }}>
                <button type="button" onClick={() => onElegir?.(p.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                  background: 'none', border: 0, padding: 0, cursor: 'pointer',
                  font: 'inherit', color: 'inherit', textAlign: 'left',
                }}>
                  {marcada ? (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 20, height: 20, minWidth: 20, flex: 'none',
                      borderRadius: 999, background: 'var(--cf-gold)',
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--cf-gold-ink)"
                        strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  ) : (
                    <span style={{
                      width: 20, height: 20, minWidth: 20, flex: 'none', borderRadius: 999,
                      border: '1.5px solid var(--cf-border-strong)',
                    }} />
                  )}
                  <span style={{ fontSize: 15, fontWeight: 700, flex: 1, minWidth: 0 }}>{p.titulo}</span>
                </button>

                {/* La burbuja solo en la marcada. Cuatro burbujas a la vez son un
                    muro; el resumen de una línea basta para elegir. */}
                {marcada && !p.libre && (
                  <>
                    <div style={{
                      background: BURBUJA, borderRadius: '14px 14px 14px 4px', padding: '13px 15px',
                    }}>
                      {/* ⚠ `pre-wrap` O EL MENSAJE SALE COMO UN LADRILLO.
                          Las plantillas del motor estructuran con SALTOS DE
                          LÍNEA: un rótulo «Resumen:» y debajo una línea por
                          cada cifra. Sin
                          esto el navegador los colapsa a espacios y todo queda
                          en un párrafo corrido e ilegible — reportado con
                          captura, y con razón. */}
                      <span style={{
                        fontSize: 14, lineHeight: 1.5, color: '#15161A',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>
                        {(p.trozos ?? []).map((t, i) => t.dato ? (
                          <span key={i} style={{
                            background: BURBUJA_DATO, borderRadius: 4, padding: '0 3px',
                          }}>{t.texto}</span>
                        ) : (
                          <span key={i}>{t.texto}</span>
                        ))}
                      </span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>
                      Lo resaltado se llena solo con los datos del cliente.
                    </span>
                    {/* Un hueco sin llenar se avisa ANTES de abrir WhatsApp: si no,
                        el mensaje sale raro y el cobrador no se entera. */}
                    {p.faltan?.length > 0 && (
                      <span style={{ fontSize: 12, color: 'var(--cf-red-dark)', lineHeight: 1.4 }}>
                        Le falta {p.faltan.join(', ')}. Revisa el mensaje antes de mandarlo.
                      </span>
                    )}
                  </>
                )}

                {marcada && p.libre && (
                  <textarea
                    value={libre}
                    onChange={(e) => setLibre(e.target.value)}
                    rows={3}
                    placeholder="Escribe el mensaje…"
                    style={{
                      // ⚠ `boxSizing: border-box` O EL MODAL SE DESCUADRA.
                      // Un `<textarea>` NO hereda el `box-sizing` del reset como
                      // los `div`: con `width:100%` y relleno de 13px por lado,
                      // acaba midiendo 100% + 28px y desborda su tarjeta. La hoja
                      // entera se estrecha y se recuesta a la izquierda.
                      // Reportado: «si se escoge mensaje libre se descuadra el
                      // modal, sale más angosto y pegado al lado izquierdo».
                      boxSizing: 'border-box',
                      width: '100%', resize: 'none', borderRadius: 12, padding: '11px 13px',
                      background: 'var(--cf-fill)', border: '1px solid var(--cf-border)',
                      font: 'inherit', fontSize: 14, lineHeight: 1.5, color: 'var(--cf-ink)',
                      outline: 'none',
                    }}
                  />
                )}

                {!marcada && p.resumen && (
                  <span style={{
                    fontSize: 13, lineHeight: 1.45, color: 'var(--cf-ink-2)', paddingLeft: 29,
                  }}>{p.resumen}</span>
                )}
              </div>
            )
          })}

          {/* ══ PERSONALIZAR: ES LO QUE MÁS SE USA, NO UNA LETRA PEQUEÑA ══
              Era un enlace de 12px al final del scroll que ponía «Editar las
              plantillas», y ahí detrás está lo que el dueño de verdad usa:
              encender y apagar secciones del mensaje, añadir campos propios y
              guardar la configuración. Reportado: «las opciones para
              personalizar no salen en el modal nuevo».

              Va como BOTÓN, con el ancho de la hoja, y abre el panel con ESTA
              plantilla ya elegida — no en una lista donde hay que buscarla otra
              vez. */}
          {onEditarPlantillas && (
            <button
              type="button"
              onClick={() => onEditarPlantillas(actual?.id)}
              style={{
                flex: 'none', width: '100%', height: 46, cursor: 'pointer', font: 'inherit',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
                borderRadius: 'var(--cf-r-control)',
                fontSize: 13.5, fontWeight: 700, color: 'var(--cf-ink-2)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 21v-4L16.5 4.5a2.1 2.1 0 013 3L7 20l-3 1z" />
              </svg>
              Personalizar este mensaje
            </button>
          )}
        </div>

        <div style={{
          flex: 'none', padding: '14px 22px 24px',
          background: 'var(--cf-card)', borderTop: '1px solid var(--cf-border-strong)',
        }}>
          {/* Sin teléfono no hay a dónde mandarlo. Abrir un wa.me roto es peor
              que el botón apagado: parece que se mandó. */}
          <button
            type="button"
            disabled={!puedeEnviar}
            onClick={() => onAbrir?.({ plantilla: actual, texto: esLibre ? libre.trim() : actual?.texto })}
            style={{
              width: '100%', height: 52, border: 'none', borderRadius: 14,
              background: puedeEnviar ? VERDE_WA : 'var(--cf-fill-2)',
              color: puedeEnviar ? '#FFF' : 'var(--cf-ink-3)',
              cursor: puedeEnviar ? 'pointer' : 'default',
              font: 'inherit', fontSize: 16, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 12a8 8 0 01-11.6 7.1L4 20l.9-4.3A8 8 0 1120 12z" />
            </svg>
            {telefono ? 'Abrir WhatsApp' : 'Este cliente no tiene teléfono'}
          </button>
        </div>
      </div>
    </div>
  )
}
