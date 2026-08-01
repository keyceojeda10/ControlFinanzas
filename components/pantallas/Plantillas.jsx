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
      {/* De quién es el chat, y por qué se le escribe. La hoja se abre encima de
          la ficha y el nombre desaparece; sin esta franja se manda el mensaje sin
          confirmar a quién. */}
      <div style={{
        flex: 'none', padding: '8px 20px 14px',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <span style={{
          fontFamily: 'var(--font-space-grotesk), system-ui',
          fontSize: 19, fontWeight: 600, letterSpacing: '-.02em',
        }}>{cliente}</span>
        {detalle && (
          <span className="cf-num" style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>{detalle}</span>
        )}
      </div>

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
              <span style={{
                fontFamily: 'var(--font-space-grotesk), system-ui',
                fontSize: 20, fontWeight: 600, letterSpacing: '-.02em',
              }}>Escribirle por WhatsApp</span>
              <span style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>
                Se abre WhatsApp con el mensaje listo
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
                      <span style={{ fontSize: 14, lineHeight: 1.5, color: '#15161A' }}>
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

          {onEditarPlantillas && (
            <button type="button" onClick={onEditarPlantillas} style={{
              flex: 'none', alignSelf: 'flex-start', background: 'none', border: 0,
              padding: 2, cursor: 'pointer', font: 'inherit',
              fontSize: 12, fontWeight: 700, color: 'var(--cf-gold-dark)',
            }}>Editar las plantillas</button>
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
