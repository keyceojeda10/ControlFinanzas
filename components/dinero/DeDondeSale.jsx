'use client'

// components/dinero/DeDondeSale.jsx
//
// ── QUE ES ────────────────────────────────────────────────────────────────
//
// La hoja que se abre al tocar una cifra de dinero. Enseña, en este orden:
//
//   1. La pregunta que esa cifra contesta, en palabras del prestamista.
//   2. Qué entra y qué NO entra en el cálculo.
//   3. LAS FILAS. Los pagos, préstamos o gastos concretos.
//
// El orden importa. La tentación es empezar por las filas —es lo que parece
// «el dato»— pero quien abre esto no viene a ver una lista: viene porque una
// cifra no le cuadra. Primero se le dice qué significa, después qué queda
// fuera, y solo entonces el detalle. Las dos primeras resuelven la mayoría de
// las dudas sin bajar a ninguna fila.
//
// ── POR QUE EXISTE ────────────────────────────────────────────────────────
//
// Porque «tu app está mal» no se puede contestar con «no, está bien». Con esto
// se contesta con «mira, este pago está aquí, a las 11:23, y lo registró Ana».

import { useEffect, useState } from 'react'
import HojaInferior from '@/components/cf/HojaInferior'
import { formatMoney } from '@/lib/i18n'

function Fila({ f, onIr }) {
  const cuando = f.cuando
    ? new Date(f.cuando).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    : null
  const clicable = !!(f.ir && onIr)
  return (
    <button
      type="button"
      disabled={!clicable}
      onClick={clicable ? () => onIr(f.ir) : undefined}
      style={{
        display: 'flex', alignItems: 'baseline', gap: 10, width: '100%',
        padding: '10px 0', background: 'none', border: 'none',
        borderBottom: '1px solid var(--cf-hairline)', textAlign: 'left',
        cursor: clicable ? 'pointer' : 'default', flex: 'none',
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: 'block', fontSize: 14, color: 'var(--cf-ink)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{f.titulo}</span>
        {(f.detalle || cuando) && (
          <span style={{ display: 'block', fontSize: 12, color: 'var(--cf-ink-3)', marginTop: 2 }}>
            {[cuando, f.detalle].filter(Boolean).join(' · ')}
          </span>
        )}
      </span>
      <span className="cf-fig" style={{ fontSize: 14, color: 'var(--cf-ink)', flex: 'none' }}>
        {formatMoney(f.monto)}
      </span>
    </button>
  )
}

export default function DeDondeSale({ cifra, fecha, cobradorId, onCerrar, onIr }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!cifra) return
    let vivo = true
    setDatos(null); setError(null)
    const q = new URLSearchParams({ cifra, ...(fecha ? { fecha } : {}), ...(cobradorId ? { cobradorId } : {}) })
    fetch(`/api/caja/procedencia?${q}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status === 404 ? 'no-catalogada' : 'fallo'))))
      .then((j) => { if (vivo) setDatos(j) })
      // Es plata: un hueco con su motivo es mejor que un número inventado.
      .catch((e) => { if (vivo) setError(e.message) })
    return () => { vivo = false }
  }, [cifra, fecha, cobradorId])

  const e = datos?.explicacion

  return (
    <HojaInferior
      abierta={!!cifra}
      onCerrar={onCerrar}
      titulo={e?.rotulo || 'De dónde sale'}
      subtitulo={e?.pregunta}
    >
      {error === 'no-catalogada' ? (
        <p style={{ fontSize: 14, color: 'var(--cf-ink-2)', lineHeight: 1.5 }}>
          Esta cifra todavía no tiene explicación escrita. Es un fallo nuestro,
          no tuyo: toda cifra de dinero debería poder explicarse.
        </p>
      ) : error ? (
        <p style={{ fontSize: 14, color: 'var(--cf-ink-2)', lineHeight: 1.5 }}>
          No se pudo cargar el detalle. Vuelve a intentarlo.
        </p>
      ) : !datos ? (
        <p style={{ fontSize: 14, color: 'var(--cf-ink-3)' }}>Buscando de dónde sale…</p>
      ) : (
        <>
          {/* ── QUÉ ENTRA Y QUÉ NO ──
              Va ANTES de las filas a propósito: casi todas las dudas se
              resuelven aquí. «¿Por qué no cuadra?» suele ser «no sabía que los
              recargos no contaban». */}
          <div style={{
            padding: 14, borderRadius: 12, marginBottom: 16,
            background: 'var(--cf-card-alt)', flex: 'none',
          }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--cf-ink-2)' }}>
              {e.universo}
            </p>
            <p style={{
              margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.5,
              color: 'var(--cf-ink-3)', fontStyle: 'italic',
            }}>
              {e.formula}
            </p>
            {/* La salida, cuando la duda de fondo se contesta en otra pantalla.
                Sin esto la explicación deja al dueño sabiendo que la cifra está
                bien y sin saber dónde mirar lo que de verdad quería ver. */}
            {e.nota && (
              <p style={{
                margin: '10px 0 0', paddingTop: 10, fontSize: 12.5, lineHeight: 1.5,
                color: 'var(--cf-ink-2)', borderTop: '1px solid var(--cf-border-soft)',
              }}>
                {e.nota}
              </p>
            )}
          </div>

          {datos.filas.length > 0 ? (
            <>
              <div style={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                gap: 12, marginBottom: 4, flex: 'none',
              }}>
                <span style={{ fontSize: 12, letterSpacing: '.04em', color: 'var(--cf-ink-3)', textTransform: 'uppercase' }}>
                  {datos.cantidad} {datos.cantidad === 1 ? 'movimiento' : 'movimientos'}
                </span>
                <span className="cf-fig" style={{ fontSize: 14, color: 'var(--cf-ink)' }}>
                  {formatMoney(datos.total)}
                </span>
              </div>

              {datos.filas.map((f) => <Fila key={f.id} f={f} onIr={onIr} />)}

              {/* Un listado cortado en silencio es la misma mentira que un
                  residuo mudo. Si se llegó al tope, se dice. */}
              {datos.truncado && (
                <p style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--cf-ink-3)', lineHeight: 1.5 }}>
                  Se muestran los primeros {datos.cantidad}. Hay más movimientos
                  ese día: el total de arriba es solo el de los mostrados.
                </p>
              )}
            </>
          ) : (
            <p style={{ fontSize: 14, color: 'var(--cf-ink-3)', lineHeight: 1.5 }}>
              {e.formula
                ? 'Esta cifra no sale de una lista de movimientos: se calcula con la fórmula de arriba.'
                : 'No hubo movimientos ese día.'}
            </p>
          )}
        </>
      )}
    </HojaInferior>
  )
}
