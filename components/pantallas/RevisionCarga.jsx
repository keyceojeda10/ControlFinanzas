'use client'

// components/pantallas/RevisionCarga.jsx — «04 · Revisión del OCR».
//
// El diseñador la llama LA PANTALLA CLAVE, «porque ahí es donde se abandona».
// Sirve igual para la foto de la cartulina y para el Excel: en los dos casos la
// pregunta es la misma —«¿esto que leí es tu cartera?»— y la promesa también:
// no se crea nada hasta que la persona confirme.
//
// Un punto de estado por fila. La dudosa se abre con el dato a corregir y, si
// viene de una foto, con el recorte de dónde estaba escrito.
//
// ══ CADA CLIENTE ES SU PROPIA TARJETA, no una fila de una lista ═════════════
//
// T01-04 los dibuja separados, con gap 8, y la que hay que revisar lleva anillo
// dorado. No es estética: en una lista con divisores no se puede resaltar una fila
// —el borde de la tarjeta es lo que la saca del montón—, y aquí el trabajo consiste
// exactamente en encontrar las dos de siete que están mal.
//
// ══ EL CAMPO DE CORRECCIÓN ESTABA MUERTO ════════════════════════════════════
//
// Era `defaultValue=""` sin controlador, y `onCorregir` no lo pasaba nadie: el
// único consumidor real (`WizardExcel`) construye lo que importa desde la lectura
// del archivo. O sea que se podía escribir la cédula que falta, pulsar «crear los 7
// clientes», y el cliente entraba sin cédula — en la pantalla que el diseñador
// llama «la clave, porque ahí es donde se abandona».
//
// Ahora el valor viene del padre (`r.valor`) y es él quien decide qué hacer con la
// corrección. Un control que se puede pulsar y no hace nada es peor que no tenerlo.

import { useState } from 'react'

/* Ámbar = revísalo · verde = entró limpio. Ocho píxeles y centrado con el nombre,
   como la lámina: a 7px y alineado arriba parecía una viñeta. */
function Punto({ revisar }) {
  return (
    <span aria-hidden style={{
      width: 8, height: 8, borderRadius: 999, flex: 'none',
      background: revisar ? 'var(--cf-gold)' : 'var(--cf-green)',
    }} />
  )
}

/* «LEÍDO POR IA» va en VIOLETA, y es el único violeta del rediseño.
   El color dice una cosa que ninguno de los otros puede decir: esto lo escribió una
   máquina. No es bueno (verde), ni malo (rojo), ni una acción (dorado) — es una
   procedencia, y de ahí sale el «revísalo» de la pantalla entera. Local al
   componente porque no hay ningún otro sitio donde signifique eso. */
const IA_FONDO = 'rgba(122,108,240,.12)'
const IA_BORDE = 'rgba(122,108,240,.25)'
const IA_PUNTO = '#7A6CF0'
const IA_TINTA = '#5B4FD0'

export default function RevisionCarga({
  titulo, detalle, filas = [], cartera, total = 0,
  deColumna = [],
  escala,                    // { sospecha, mediana, factor }
  onConfirmarEscala,         // (enMiles: boolean) => void
  onCorregir,                // (indice, campo, valor) => void
  onCrear, onOtraFoto,
  creando = false,
}) {
  // LA PRIMERA QUE HAY QUE REVISAR ARRANCA ABIERTA. La lámina la dibuja así y es
  // lo correcto: la pantalla existe para corregir esas dos filas, y abrirla enseña
  // qué se espera sin tener que adivinar que las tarjetas se pueden tocar.
  //
  // `null` significa «nadie ha tocado nada», y entonces manda la primera con
  // reparos. `-1` es «la cerró a mano», que hay que distinguir de `null` o volvería
  // a abrirse sola.
  const [abierta, setAbierta] = useState(null)
  const primeraConReparos = filas.findIndex((f) => f.reparos?.length > 0)
  const activa = abierta === null ? primeraConReparos : abierta

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cf-gap-cards)' }}>

      {/* La fila de arriba: volver a la izquierda y la procedencia a la derecha.
          Antes lo tenía al revés —«leído por IA» como rótulo del título y «otra
          foto» de pastilla a la derecha—, que pone el peso en la máquina en vez de
          en lo que dice la pantalla. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        {onOtraFoto ? (
          <button type="button" onClick={onOtraFoto} style={{
            display: 'flex', alignItems: 'center', gap: 6, border: 0, background: 'none',
            padding: 0, cursor: 'pointer', font: 'inherit', flex: 'none',
            fontSize: 14, fontWeight: 600, color: 'var(--cf-ink-2)',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
            Otra foto
          </button>
        ) : <span />}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, height: 28, padding: '0 11px',
          borderRadius: 11, flex: 'none',
          background: IA_FONDO, border: `1px solid ${IA_BORDE}`,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: IA_PUNTO, flex: 'none' }} />
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '.03em',
            textTransform: 'uppercase', color: IA_TINTA,
          }}>Leído por IA</span>
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 4px' }}>
        <h2 style={{
          fontFamily: 'var(--font-space-grotesk), system-ui',
          fontSize: 24, fontWeight: 600, letterSpacing: '-.02em',
          color: 'var(--cf-ink)', margin: 0, lineHeight: 1.15,
        }}>
          {titulo}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--cf-ink-2)', margin: 0, lineHeight: 1.45 }}>
          {detalle}
        </p>
      </div>

      {/* ── LA ESCALA ──
          Va arriba del todo y es lo único que puede parar la importación. Si el
          archivo viene en miles y se importa tal cual, la cartera entra mil
          veces más pequeña y NINGUNA CIFRA SE VE ROTA: cuotas, saldos y
          porcentajes quedan proporcionados entre sí. Por eso no se decide solo:
          se pregunta, con el ejemplo delante. */}
      {escala?.sospecha && (
        <div style={{
          padding: '14px 16px', borderRadius: 'var(--cf-r-card)',
          background: 'var(--cf-gold-tint)', border: '1px solid var(--cf-gold-border)',
        }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--cf-gold-text)', margin: 0 }}>
            ¿Los montos vienen en miles?
          </p>
          <p style={{ fontSize: 12.5, color: 'var(--cf-ink-2)', margin: '5px 0 0', lineHeight: 1.5 }}>
            El préstamo típico del archivo dice{' '}
            <span className="cf-num" style={{ fontWeight: 700 }}>{escala.mediana?.toLocaleString('es-CO')}</span>.
            Si eso son miles, lo leo como{' '}
            <span className="cf-num" style={{ fontWeight: 700 }}>${(escala.mediana * 1000).toLocaleString('es-CO')}</span>.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
            <button type="button" onClick={() => onConfirmarEscala?.(true)} style={{
              flex: 1, height: 40, borderRadius: 'var(--cf-r-control)', border: 0, cursor: 'pointer',
              background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', fontSize: 13.5, fontWeight: 700,
            }}>
              Sí, son miles
            </button>
            <button type="button" onClick={() => onConfirmarEscala?.(false)} style={{
              flex: 1, height: 40, borderRadius: 'var(--cf-r-control)', cursor: 'pointer',
              background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
              fontSize: 13.5, fontWeight: 700, color: 'var(--cf-ink-2)',
            }}>
              No, son pesos
            </button>
          </div>
        </div>
      )}

      {/* Lo que le falta a TODO el archivo se dice una vez aquí. Repetirlo en
          cada fila pinta la lista entera de ámbar, y una lista donde todo está
          marcado es una lista donde nada está marcado. */}
      {deColumna.length > 0 && (
        <div style={{
          padding: '12px 15px', borderRadius: 'var(--cf-r-card)',
          background: 'var(--cf-fill)', border: '1px solid var(--cf-border)',
        }}>
          {deColumna.map((c) => (
            <p key={c.campo} style={{ fontSize: 12.5, color: 'var(--cf-ink-2)', margin: 0, lineHeight: 1.5 }}>
              {c.texto}. Los puedes completar después, cliente por cliente.
            </p>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filas.map((f, i) => {
          const abierto = activa === i && f.reparos?.length > 0
          return (
            <div key={i} style={{
              background: 'var(--cf-card)', borderRadius: 'var(--cf-r-card)',
              /* El anillo dorado saca del montón a la que hay que revisar. Solo la
                 abierta lo lleva: si lo llevaran las dos ámbar a la vez, volvería a
                 no destacar ninguna. */
              border: abierto ? '1.5px solid var(--cf-gold)' : '1px solid var(--cf-border)',
              boxShadow: abierto ? '0 0 0 3px var(--cf-gold-focus)' : 'none',
              padding: abierto ? 16 : 0,
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              <button
                type="button"
                onClick={() => setAbierta(activa === i ? -1 : i)}
                aria-expanded={abierto}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  padding: abierto ? 0 : '14px 16px', background: 'none', border: 0,
                  cursor: f.revisar ? 'pointer' : 'default', textAlign: 'left',
                  font: 'inherit', color: 'var(--cf-ink)',
                }}
              >
                <Punto revisar={f.revisar} />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.01em' }}>
                    {f.nombre}
                  </span>
                  {f.contexto && (
                    <span className="cf-num" style={{
                      fontSize: 12,
                      /* Qué le falta, en ámbar y en negrita: es lo que hay que leer.
                         Los datos que entraron bien van en gris. */
                      fontWeight: f.revisar ? 600 : 500,
                      color: f.revisar ? 'var(--cf-gold-dark)' : 'var(--cf-ink-3)',
                    }}>
                      {f.contexto}
                    </span>
                  )}
                </span>
                {f.monto && (
                  <span className="cf-fig" style={{
                    flex: 'none',
                    fontFamily: 'var(--font-space-grotesk), system-ui',
                    fontSize: 17, fontWeight: 600, letterSpacing: '-.02em',
                    /* Un monto que la máquina no leyó bien va en ámbar y con «?»:
                       la cifra está ahí para que se reconozca, no para creerla. */
                    color: f.montoDudoso ? 'var(--cf-gold-dark)' : 'var(--cf-ink)',
                  }}>
                    {f.monto}{f.montoDudoso ? '?' : ''}
                  </span>
                )}
              </button>

              {abierto && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {f.reparos.map((r) => (
                    <label key={r.campo} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
                        textTransform: 'uppercase', color: 'var(--cf-ink-3)',
                      }}>
                        {r.texto}
                      </span>
                      {/* Controlado: el padre puede prellenar lo que el OCR leyó a
                          medias, que es justo lo que la lámina dibuja. */}
                      <input
                        value={r.valor ?? ''}
                        onChange={(e) => onCorregir?.(i, r.campo, e.target.value)}
                        inputMode={r.campo === 'telefono' || r.campo === 'cedula' ? 'numeric' : 'text'}
                        style={{
                          height: 48, padding: '0 14px', borderRadius: 14,
                          background: 'var(--cf-fill)', border: '1px solid var(--cf-border-strong)',
                          outline: 'none', font: 'inherit',
                          fontFamily: 'var(--font-space-grotesk), system-ui',
                          fontSize: 16, fontWeight: 500, color: 'var(--cf-ink)',
                        }}
                      />
                      {/* El recorte de la foto donde iba el dato — solo existe
                          cuando la carga vino de una cartulina. Verlo es lo que
                          permite escribirlo sin volver a la foto. */}
                      {r.recorte && (
                        <span style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px', borderRadius: 11, background: 'var(--cf-fill)',
                        }}>
                          <img src={r.recorte} alt="" style={{
                            width: 44, height: 30, objectFit: 'cover', flex: 'none',
                            borderRadius: 6, border: '1px solid var(--cf-border)',
                          }} />
                          <span style={{
                            fontFamily: 'ui-monospace, monospace',
                            fontSize: 10, lineHeight: 1.35, color: 'var(--cf-ink-3)',
                          }}>{r.dondeIba ?? 'recorte de la foto\ndonde iba el dato'}</span>
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <span className="cf-num" style={{ fontSize: 12.5, color: 'var(--cf-ink-3)' }}>
            {total} cliente{total === 1 ? '' : 's'} · cartera
          </span>
          <span className="cf-fig" style={{ fontSize: 19, fontWeight: 700, color: 'var(--cf-ink)' }}>
            {cartera}
          </span>
        </div>

        <button
          type="button"
          onClick={onCrear}
          disabled={creando}
          style={{
            width: '100%', height: 'var(--cf-h-btn)', border: 0,
            borderRadius: 'var(--cf-r-control)', cursor: creando ? 'default' : 'pointer',
            background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
            fontSize: 15, fontWeight: 700, opacity: creando ? 0.6 : 1,
          }}
        >
          {creando ? 'Creando…' : `Crear los ${total} clientes`}
        </button>
      </div>
    </div>
  )
}
