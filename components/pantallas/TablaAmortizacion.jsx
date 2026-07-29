'use client'

// components/pantallas/TablaAmortizacion.jsx — turno 12 · 01 y 02.
//
// ⚠️ ESTO ES LA VARIANTE, NO LA NORMA. Solo 4 de los 8 modos tienen tabla, y
// suman el 6,2% de la cartera. La ficha por defecto es la de `fijo`, en
// FichaPrestamo.jsx. `05-PANTALLAS.md` los presenta al revés.
//
// LA DECISIÓN: cada cuota se dibuja como UNA BARRA PARTIDA — negro el capital
// que vuelve, dorado la ganancia. El desglose anterior era una lista de meses
// plegables con capital, interés y cuota en tres columnitas de 11px: servía
// para consultar un mes, no para lo que la gente de verdad quiere saber, que es
// cuánto de cada cuota es ganancia. En decreciente dinámico la parte dorada se
// encoge mes a mes y eso SE VE sin leer un número.
//
// Y deja de ser un acordeón, así que se puede compartir con el cliente. Esta es
// la tabla que el cliente pide cuando reclama.

import { Tarjeta, BarraAccion, BotonPrimario, BotonSecundario, Pastilla } from '@/components/cf/primitivos'

const NEGRO = '#15161A'
const ORO   = 'var(--cf-gold)'

/* La barra partida. `capital` y `ganancia` son números crudos: el reparto no se
   puede calcular sobre texto formateado. */
function BarraPartida({ capital, ganancia, alto = 10 }) {
  const total = capital + ganancia
  const pct = total > 0 ? (capital / total) * 100 : 0
  return (
    <span style={{
      display: 'flex', height: alto, borderRadius: 999, overflow: 'hidden',
      background: 'var(--cf-fill-2)', flex: 'none',
    }}>
      <span style={{ width: `${pct}%`, background: NEGRO, flex: 'none' }} />
      <span style={{ flex: 1, background: ORO }} />
    </span>
  )
}

function Leyenda({ etiqueta, valor, color, alineado }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, justifyContent: alineado }}>
      <span aria-hidden style={{ width: 9, height: 9, borderRadius: 3, background: color, flex: 'none' }} />
      <span style={{ fontSize: 11.5, color: 'var(--cf-ink-3)', flex: 'none' }}>{etiqueta}</span>
      <span className="cf-num" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--cf-ink)', flex: 'none' }}>
        {valor}
      </span>
    </span>
  )
}

export default function TablaAmortizacion({
  modo, capital, ganancia, capitalNum, gananciaNum,
  totalCuotas, total, cuotas = [], montoOculto,
  onComparar, onCompartir, onImprimir,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--cf-gap-cards)', padding: '8px var(--cf-pad-screen) 16px' }}>

        <Tarjeta>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
                Modo de interés
              </span>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)', marginTop: 3 }}>
                {modo}
              </span>
            </span>
            {/* "Comparar modos" prometía los ocho y enseñaba cuatro. Lo que
                compara son CALENDARIOS, y los 4 que muestra son exactamente los
                4 que tienen calendario: con el nombre correcto, la selección
                deja de ser un recorte y pasa a ser la lista completa. */}
            <button type="button" onClick={onComparar} style={{
              background: 'none', border: 0, cursor: 'pointer', flex: 'none',
              fontSize: 12.5, fontWeight: 700, color: 'var(--cf-gold-dark)',
            }}>Comparar calendarios</button>
          </div>

          <span style={{ height: 1, background: 'var(--cf-hairline)' }} />

          {/* La misma partición para el préstamo entero, arriba. */}
          <BarraPartida capital={capitalNum} ganancia={gananciaNum} alto={12} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ flex: 1, minWidth: 0 }}><Leyenda etiqueta="Capital" valor={capital} color={NEGRO} /></span>
            <span style={{ flex: 'none' }}><Leyenda etiqueta="Ganancia" valor={ganancia} color={ORO} /></span>
          </div>
        </Tarjeta>

        <Tarjeta plana>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '14px 18px 12px', flex: 'none' }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
              Las {totalCuotas} cuotas
            </span>
            <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)', flex: 'none' }}>
              total {total}
            </span>
          </div>

          {cuotas.map((c, i) => (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column', gap: 8, flex: 'none',
              padding: '13px 18px 15px', borderTop: '1px solid var(--cf-hairline)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{
                  flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: 'var(--cf-ink)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{c.cuando}</span>
                {c.siguiente && (
                  <Pastilla tono="oro" style={{ height: 19, fontSize: 9, flex: 'none' }}>siguiente</Pastilla>
                )}
                <span className="cf-fig" style={{ fontSize: 16, color: 'var(--cf-ink)', flex: 'none' }}>
                  {c.cuota}
                </span>
              </div>

              <BarraPartida capital={c.capitalNum} ganancia={c.gananciaNum} />

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <Leyenda etiqueta="capital" valor={c.capital} color={NEGRO} />
                </span>
                <span style={{ flex: 'none' }}>
                  <Leyenda etiqueta="ganancia" valor={c.ganancia} color={ORO} />
                </span>
              </div>
            </div>
          ))}

          {/* La suma de lo visible MÁS lo declarado tiene que dar el total de
              arriba. Un "total $1.699.999" sobre cuatro filas que suman
              $1.266.668 deja al dueño creyendo que ya vio la tabla entera. */}
          {totalCuotas > cuotas.length && (
            <button type="button" style={{
              display: 'block', width: '100%', padding: '13px 18px', cursor: 'pointer',
              background: 'none', border: 0, borderTop: '1px solid var(--cf-hairline)',
              fontSize: 13, fontWeight: 700, color: 'var(--cf-gold-dark)', textAlign: 'center',
            }}>
              Ves {cuotas.length} de las {totalCuotas}
              {montoOculto && <> · faltan {totalCuotas - cuotas.length} por {montoOculto}</>}
            </button>
          )}
        </Tarjeta>
      </div>

      <BarraAccion>
        <BotonPrimario style={{ flex: 1.4 }} onClick={onCompartir}>Compartir tabla</BotonPrimario>
        <BotonSecundario style={{ flex: 1 }} onClick={onImprimir}>Imprimir</BotonSecundario>
      </BarraAccion>
    </div>
  )
}

/* ── Comparar calendarios (turno 12 · 02) ──────────────────────────────────
   Lo que NO existía: comparar DESPUÉS, sobre un préstamo ya creado. El selector
   del paso 5 ya nombra los modos en cristiano y marca el recomendado; esta hoja
   usa los mismos nombres y la misma matemática, con la partición a la vista.

   Cada opción trae la frase que explica QUÉ LE PASA AL CLIENTE, no la fórmula.
   Y el actual va marcado: sin eso, la comparación no tiene desde dónde. */
export function CompararCalendarios({ resumen, opciones = [], actual, onDejar, onElegir }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      <span className="cf-num" style={{ fontSize: 12.5, color: 'var(--cf-ink-3)', flex: 'none' }}>
        {resumen}
      </span>

      {opciones.map((o) => {
        const esActual = o.id === actual
        return (
          <button key={o.id} type="button" onClick={() => onElegir?.(o)} style={{
            display: 'flex', flexDirection: 'column', gap: 9, flex: 'none',
            padding: '14px 15px 15px', cursor: 'pointer', textAlign: 'left',
            background: 'var(--cf-card)',
            border: `1px solid ${esActual ? 'var(--cf-ink)' : 'var(--cf-border)'}`,
            borderRadius: 'var(--cf-r-card)',
          }}>
            {/* La pastilla NO va en la fila del nombre: le roba ~85px y corta
                "Decreciente dinámico" justo donde se distingue de los otros. */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{
                flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 700, color: 'var(--cf-ink)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{o.nombre}</span>
              <span className="cf-fig" style={{ fontSize: 16, color: 'var(--cf-ink)', flex: 'none' }}>
                {o.total}
              </span>
            </div>
            {esActual && (
              <Pastilla tono="neutro" style={{ height: 20, fontSize: 9.5, alignSelf: 'flex-start', marginTop: -3 }}>
                el de ahora
              </Pastilla>
            )}

            <BarraPartida capital={o.capitalNum} ganancia={o.gananciaNum} alto={8} />

            <span style={{ fontSize: 12, color: 'var(--cf-ink-2)', lineHeight: 1.45 }}>
              {o.explicacion}
            </span>
          </button>
        )
      })}

      <BotonSecundario onClick={onDejar}>Dejar el de ahora</BotonSecundario>
    </div>
  )
}
