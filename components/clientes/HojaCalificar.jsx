'use client'

import { useState } from 'react'
import HojaInferior from '@/components/cf/HojaInferior'
import { MarcaComoPaga } from '@/components/cf/primitivos'
import { NIVELES, TEXTO, PORQUE, explicacion } from '@/lib/calificacion'

/* POR QUÉ ESTE CLIENTE TIENE ESA MARCA — Y, SI ES EL DUEÑO, CÓMO CORREGIRLA.
 *
 * ⚠ LA MISMA HOJA PARA LOS DOS. Solo el dueño califica —«como para que el
 * administrador solamente pueda hacer eso»—, pero el cobrador es quien ve la
 * estrella en la calle y quien necesita saber de dónde sale. Si la hoja fuera
 * solo del dueño, al cobrador le quedaría un color sin explicación; si fueran
 * dos hojas, la explicación se arreglaría en una y no en la otra, que es como
 * se han roto tres cosas en este repo.
 *
 * ⚠ Y ENSEÑA LO QUE DICE EL SISTEMA ANTES DE DEJAR CAMBIARLO: sin eso el
 * administrador elegiría a ciegas y su marca taparía un cálculo que a lo mejor
 * era correcto, sin que nadie supiera cuál de las dos mandaba. Por lo mismo
 * existe «Volver al cálculo automático»: una marca puesta por error tiene que
 * poder deshacerse, o se queda para siempre.
 */
export default function HojaCalificar({
  abierta, onCerrar, cliente, calificacion, onGuardado, puedeCalificar = false,
}) {
  const [guardando, setGuardando] = useState(null)
  const [error, setError] = useState('')

  const guardar = async (nivel) => {
    setGuardando(nivel ?? 'auto')
    setError('')
    try {
      const r = await fetch(`/api/clientes/${cliente?.id}/calificacion`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nivel }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error || 'No se pudo guardar')
      }
      onGuardado?.()
      onCerrar?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(null)
    }
  }

  return (
    <HojaInferior
      abierta={abierta}
      onCerrar={onCerrar}
      titulo="Cómo paga este cliente"
      subtitulo={cliente?.nombre}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Lo que dice el historial, antes de dejar cambiarlo. */}
        <div style={{
          display: 'flex', gap: 10, alignItems: 'center',
          padding: '12px 14px', borderRadius: 'var(--cf-r-control)',
          background: 'var(--cf-fill)',
        }}>
          {calificacion?.automatico ? (
            <MarcaComoPaga nivel={calificacion.automatico} texto={TEXTO[calificacion.automatico]} />
          ) : null}
          <div style={{ fontSize: 13, color: 'var(--cf-ink-2)', lineHeight: 1.45 }}>
            {calificacion?.automatico ? (
              <>
                Por su historial el sistema lo tiene como{' '}
                <strong style={{ color: 'var(--cf-ink)' }}>{TEXTO[calificacion.automatico].toLowerCase()}</strong>:{' '}
                {PORQUE[calificacion.automatico].toLowerCase()}, en{' '}
                {calificacion.numero} préstamo{calificacion.numero === 1 ? '' : 's'} terminado{calificacion.numero === 1 ? '' : 's'}.
              </>
            ) : (
              /* El cero es un dato: se dice que todavía no hay con qué juzgar,
                 en vez de dejar el hueco en blanco. */
              <>Todavía no ha terminado ningún préstamo, así que el sistema no tiene con qué calificarlo.</>
            )}
          </div>
        </div>

        {calificacion?.aMano && (
          /* Que se sepa que este color lo puso una persona, y quién. Sin esto
             hay dos verdades sobre lo mismo y ninguna forma de saber cuál mandó. */
          <p style={{ margin: 0, fontSize: 13, color: 'var(--cf-ink-2)', lineHeight: 1.45 }}>
            {explicacion(calificacion, cliente?.calificacionPor?.nombre)}
          </p>
        )}

        {puedeCalificar && NIVELES.slice().reverse().map((nivel) => {
          const puesto = calificacion?.aMano && calificacion.nivel === nivel
          return (
            <button
              key={nivel}
              type="button"
              disabled={Boolean(guardando)}
              onClick={() => guardar(nivel)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                padding: '13px 14px', textAlign: 'left', cursor: 'pointer',
                borderRadius: 'var(--cf-r-control)',
                border: `1px solid ${puesto ? 'var(--cf-ink)' : 'var(--cf-border-soft)'}`,
                background: 'var(--cf-card)',
                opacity: guardando && guardando !== nivel ? 0.5 : 1,
              }}
            >
              {/* La MISMA pieza que va a quedar puesta en la ficha y en la
                  calle: se elige mirando exactamente lo que se va a ver, no una
                  muestra parecida. */}
              <MarcaComoPaga nivel={nivel} texto={TEXTO[nivel]} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--cf-ink-3)', lineHeight: 1.35 }}>
                {PORQUE[nivel]}
              </span>
              {puesto && (
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cf-ink-3)' }}>puesto</span>
              )}
            </button>
          )
        })}

        {puedeCalificar && calificacion?.aMano && (
          <button
            type="button"
            disabled={Boolean(guardando)}
            onClick={() => guardar(null)}
            style={{
              background: 'none', border: 0, cursor: 'pointer', padding: '10px 0',
              fontSize: 13, color: 'var(--cf-ink-3)', textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            Volver al cálculo automático
          </button>
        )}

        {error && (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--cf-red-darker)' }}>{error}</p>
        )}
      </div>
    </HojaInferior>
  )
}
