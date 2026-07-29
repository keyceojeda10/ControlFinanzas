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

import { useState } from 'react'

function Punto({ revisar }) {
  return (
    <span aria-hidden style={{
      width: 7, height: 7, borderRadius: 999, flex: 'none', marginTop: 7,
      background: revisar ? 'var(--cf-gold)' : 'var(--cf-green)',
    }} />
  )
}

export default function RevisionCarga({
  titulo, detalle, filas = [], cartera, total = 0,
  deColumna = [],
  escala,                    // { sospecha, mediana, factor }
  onConfirmarEscala,         // (enMiles: boolean) => void
  onCorregir,                // (indice, campo, valor) => void
  onCrear, onOtraFoto,
  creando = false,
}) {
  const [abierta, setAbierta] = useState(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cf-gap-cards)' }}>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.09em',
            textTransform: 'uppercase', color: 'var(--cf-ink-3)',
          }}>
            Leído por IA
          </span>
          <h2 style={{
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 21, fontWeight: 600, letterSpacing: '-.02em',
            color: 'var(--cf-ink)', margin: '4px 0 0', lineHeight: 1.2,
          }}>
            {titulo}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--cf-ink-2)', marginTop: 5, lineHeight: 1.45 }}>
            {detalle}
          </p>
        </div>
        {onOtraFoto && (
          <button type="button" onClick={onOtraFoto} style={{
            flex: 'none', height: 34, padding: '0 13px', borderRadius: 999, cursor: 'pointer',
            background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
            fontSize: 12.5, fontWeight: 600, color: 'var(--cf-ink-2)',
          }}>
            Otra foto
          </button>
        )}
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

      <div style={{
        background: 'var(--cf-card)', borderRadius: 'var(--cf-r-card)',
        border: '1px solid var(--cf-border)', overflow: 'hidden',
      }}>
        {filas.map((f, i) => {
          const abierto = abierta === i
          return (
            <div key={i} style={{ borderTop: i ? '1px solid var(--cf-divider)' : 0 }}>
              <button
                type="button"
                onClick={() => setAbierta(abierto ? null : i)}
                aria-expanded={abierto}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%',
                  padding: '13px 16px', background: 'none', border: 0,
                  cursor: f.revisar ? 'pointer' : 'default', textAlign: 'left',
                }}
              >
                <Punto revisar={f.revisar} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)' }}>
                    {f.nombre}
                  </span>
                  {f.contexto && (
                    <span className="cf-num" style={{
                      display: 'block', fontSize: 12, marginTop: 2,
                      color: f.revisar ? 'var(--cf-gold-dark)' : 'var(--cf-ink-3)',
                    }}>
                      {f.contexto}
                    </span>
                  )}
                </span>
                {f.monto && (
                  <span className="cf-fig" style={{
                    flex: 'none', fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)', marginTop: 1,
                  }}>
                    {f.monto}
                  </span>
                )}
              </button>

              {abierto && f.reparos?.length > 0 && (
                <div style={{ padding: '0 16px 14px 33px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {f.reparos.map((r) => (
                    <label key={r.campo} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--cf-ink-3)' }}>
                        {r.texto}
                      </span>
                      <input
                        defaultValue=""
                        inputMode={r.campo === 'telefono' || r.campo === 'cedula' ? 'numeric' : 'text'}
                        onChange={(e) => onCorregir?.(i, r.campo, e.target.value)}
                        style={{
                          height: 44, padding: '0 13px', borderRadius: 'var(--cf-r-control)',
                          background: 'var(--cf-surface)', border: '1px solid var(--cf-border-strong)',
                          outline: 'none', fontSize: 16, color: 'var(--cf-ink)',
                        }}
                      />
                      {/* El recorte de la foto donde iba el dato — solo existe
                          cuando la carga vino de una cartulina. */}
                      {r.recorte && (
                        <img src={r.recorte} alt="" style={{
                          width: '100%', maxHeight: 64, objectFit: 'cover',
                          borderRadius: 10, border: '1px solid var(--cf-border)',
                        }} />
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
