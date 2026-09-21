'use client'
/* LOS ÚLTIMOS 7 DÍAS — LA MISMA GRÁFICA EN EL INICIO Y EN EL RESUMEN DEL DÍA.
 *
 * El dueño, 20 sep 2026, con las dos pantallas abiertas: «el cuadro de recaudado
 * hoy del dashboard no se ve tan bien como el que hiciste dentro del resumen
 * diario. Ese cuadro es el mismo, son los últimos siete días, pero está hasta
 * mejor explicado: los números cuando uno selecciona el día salen arriba
 * grandes, abajo sale una pequeña descripción. Que el del dashboard quede igual,
 * obviamente con toda su lógica».
 *
 * Eran dos gráficas distintas del mismo dato, y la del Inicio era la pobre: las
 * barras tenían 90px, los días no se nombraban —solo «hace una semana» y «hoy»,
 * que encima se solapaban con las barras en cero— y la respuesta al tocar era
 * una línea de 12px. Aquí viven las dos en una.
 *
 * ⚠ LO QUE ESTA GRÁFICA HACE ADEMÁS DE PINTARSE, y que hay que conservar si
 * alguien la vuelve a tocar (el rediseño pierde funciones en silencio):
 *   · la LÍNEA de lo que toca cobrar, y el color de cada barra según si ese día
 *     llegó a ella — eso es del Inicio, el resumen del día no la tiene;
 *   · cada barra es un BOTÓN, con `aria-label` y `aria-pressed`. Se perdió una
 *     vez al pasarlas a `<span>` con `title`, que es un globo de escritorio;
 *   · los nombres de los días salen del reloj DEL NAVEGADOR cuando el servidor
 *     no manda fecha, así que se calculan en un efecto o React tira el árbol al
 *     hidratar.
 */
import { useEffect, useState } from 'react'
import { BLOQUE } from '@/components/cf/bloqueOscuro'
import { promedioDeLaSemana, nombreDelDia } from '@/lib/resumen-del-dia'
import { altoDeBarra, alturaDeLaLinea, topeDeLaEscala } from '@/lib/semana-de-cobros'

const LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/* El sitio que se le quita a las barras: el rótulo del día debajo (12px + su
   separación) y el aire de arriba, para que la barra más alta no toque el techo
   ni tape la línea de la meta. */
const RESERVA_ROTULO = 21
const AIRE_ARRIBA = 15

/* Los nombres, cuando el servidor no manda la fecha de cada día. Se deriva del
   reloj: el último es hoy. `Intl` aquí no, que el ICU nuevo mete un «de». */
function nombresDelReloj(largo) {
  const hoy = new Date()
  return Array.from({ length: largo }, (_, i) => {
    const atras = largo - 1 - i
    const d = new Date(hoy)
    d.setDate(d.getDate() - atras)
    const dia = LARGOS[d.getDay()]
    return { dia, corto: dia.slice(0, 3), numero: d.getDate(), esHoy: atras === 0, esAyer: atras === 1 }
  })
}

function comoSeLlama(dias) {
  return dias.map((x, i) => {
    const delServidor = x?.fecha ? nombreDelDia(x.fecha) : null
    if (!delServidor) return null
    return { ...delServidor, esHoy: i === dias.length - 1, esAyer: i === dias.length - 2 }
  })
}

/**
 * @param {Array}    dias        [{ monto, cobros, fecha }] de más viejo a más reciente; el último es hoy
 * @param {Function} formatear   cómo se escribe la plata (lleva el país dentro)
 * @param {number}   [meta]      lo que toca cobrar cada día. Con ella se dibuja la línea y se colorean las barras
 * @param {number}   [alto]      alto de la zona de barras
 * @param {boolean}  [eligeHoy]  arrancar con hoy seleccionado. En el Inicio NO: la cifra de hoy ya está arriba del bloque
 * @param {Function} [pie]       recibe ({ total, elegido }) y devuelve la frase de debajo
 * @param {boolean}  [anima]     la entrada escalonada de las barras
 */
export default function SemanaDeCobros({
  dias = [], formatear, meta = null, alto = 140, eligeHoy = false, pie = null, anima = false,
}) {
  const [elegido, setElegido] = useState(null)
  const [nombres, setNombres] = useState(() => comoSeLlama(dias))

  useEffect(() => {
    const delServidor = comoSeLlama(dias)
    setNombres(delServidor.every(Boolean) ? delServidor : nombresDelReloj(dias.length))
    setElegido(null)
  }, [dias.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (dias.length === 0) return null

  const montos = dias.map((x) => Number(x?.monto) || 0)
  const iDia = elegido ?? (eligeHoy ? dias.length - 1 : null)
  const dia = iDia != null ? dias[iDia] : null

  /* LA ESCALA. La línea de la meta tiene que caber: si un día cobró más, el tope
     es esa barra; si nadie llegó, el tope es la línea. El 1,12 es AIRE — sin él,
     en la semana floja la línea queda pegada al techo y se lee como el borde de
     la caja, no como una referencia. */
  const tope = topeDeLaEscala(montos, meta)
  /* El alto que le queda a la barra más alta: el contenedor menos el rótulo del
     día, su separación y el aire de arriba. Sale de aquí y NO de un porcentaje
     del contenedor, porque entonces la línea de la meta no cae a la altura de
     las barras que compara. */
  const altoBarra = Math.max(12, alto - RESERVA_ROTULO - AIRE_ARRIBA)
  /* ⚠ LA LÍNEA TIENE UN SUELO, Y NO ES COSMÉTICA.
     Medido en el espejo el 20 sep 2026: un negocio con meta de $15.000 y una
     semana de $1,2M dejaba la línea a 1,26 px del suelo. Las barras vacías, que
     se pintan con 3px de mínimo para que el día se vea, quedaban POR ENCIMA: el
     gráfico enseñaba siete días completos mientras el texto decía dos. La
     adenda es tajante —«si dice 3 de 7, tiene que haber exactamente 3 barras por
     encima de la línea»— y aquí decía siete. */
  const lineaPx = alturaDeLaLinea({ meta, tope, altoBarra })
  const alturaLinea = lineaPx != null ? RESERVA_ROTULO + lineaPx : null

  /* EL PROMEDIO, DE UNA SOLA FÓRMULA. El resumen del día dice «69 % más que tu
     promedio ($722.795)» y ese promedio es el total entre los siete días, ceros
     incluidos. Si el Inicio usara otra —la media de los días con cobro, por
     ejemplo— las dos pantallas dirían cosas distintas del mismo martes. */
  const promedio = promedioDeLaSemana(montos)
  const contraPromedio = dia && promedio > 0 ? Math.round(((dia.monto - promedio) / promedio) * 100) : null

  const nombreDe = (i) => {
    const n = nombres?.[i]
    if (!n) return `día ${i + 1}`
    if (n.esHoy) return 'Hoy'
    if (n.esAyer) return 'Ayer'
    return `${n.dia.charAt(0).toUpperCase()}${n.dia.slice(1)} ${n.numero}`
  }
  const cortoDe = (i) => (nombres?.[i]?.esHoy ? 'hoy' : (nombres?.[i]?.corto ?? ''))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* ── LO QUE DICE EL DÍA ELEGIDO, EN GRANDE Y ARRIBA ──
          Es lo que el dueño señaló del resumen del día. Antes esta respuesta
          era una línea de 12px debajo de la gráfica. */}
      {dia && (
        <div suppressHydrationWarning style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: BLOQUE.rotulo }}>{nombreDe(iDia)}</span>
          <span className="cf-fig" style={{
            fontSize: 30, lineHeight: 1, letterSpacing: '-.03em', whiteSpace: 'nowrap',
            color: iDia === dias.length - 1 ? BLOQUE.oro : BLOQUE.tinta,
          }}>{formatear(dia.monto)}</span>
          {/* ⚠ «0 cobrosNo entró plata ese día» — dos frases pegadas sin
              separador, reportado el 20 sep. El día sin plata lo dice UNA vez;
              los demás llevan « · » entre las partes. */}
          <span style={{ fontSize: 14, color: BLOQUE.apagado }}>
            {dia.monto === 0 ? 'No entró plata ese día.' : (
              <>
                {dia.cobros != null ? `${dia.cobros} ${dia.cobros === 1 ? 'cobro' : 'cobros'}` : ''}
                {contraPromedio != null && (
                  <>{dia.cobros != null ? ' · ' : ''}
                    <strong style={{ color: contraPromedio >= 0 ? BLOQUE.verde : BLOQUE.rojo, fontWeight: 700 }}>
                      {contraPromedio >= 0 ? `${contraPromedio}% más` : `${Math.abs(contraPromedio)}% menos`}
                    </strong> que tu promedio ({formatear(promedio)})</>
                )}
                {meta ? (montos[iDia] >= meta
                  ? <> · cobraste todo lo que tocaba</>
                  : <> · faltaron {formatear(meta - montos[iDia])}</>) : null}
              </>
            )}
          </span>
        </div>
      )}

      <div style={{ position: 'relative' }}>
        {/* La línea de lo que toca cobrar cada día. Solo el Inicio la tiene. */}
        {alturaLinea != null && (
          <div aria-hidden style={{
            position: 'absolute', left: 0, right: 0, bottom: Math.round(alturaLinea),
            borderTop: `1px dashed ${BLOQUE.pista}`, pointerEvents: 'none', zIndex: 1,
          }} />
        )}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, height: alto }}>
          {dias.map((x, i) => {
            const monto = montos[i]
            const esHoy = i === dias.length - 1
            const esElegido = i === iDia
            const llego = meta ? monto >= meta : false
            return (
              <button
                key={i}
                type="button"
                suppressHydrationWarning
                onClick={() => setElegido(esElegido && elegido != null ? null : i)}
                aria-pressed={esElegido}
                aria-label={`${nombreDe(i)}: ${formatear(monto)}`}
                style={{
                  flex: 1, minWidth: 0, height: '100%', padding: 0, border: 0, background: 'none',
                  cursor: 'pointer', font: 'inherit',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 6,
                }}
              >
                <span className={anima ? 'cf-res-col' : undefined} style={{
                  width: '100%', flex: 'none', borderRadius: 7,
                  height: altoDeBarra({ monto, meta, tope, altoBarra }),
                  background: esHoy ? BLOQUE.oro : esElegido ? 'rgba(255,255,255,.62)' : (llego ? BLOQUE.barra : BLOQUE.barraNo),
                  outline: esElegido ? `2px solid ${BLOQUE.tinta}` : 'none',
                  outlineOffset: 2,
                  ...(anima ? { animationDelay: `${500 + i * 70}ms` } : null),
                }} />
                <span className="cf-num" suppressHydrationWarning style={{
                  fontSize: 12, fontWeight: esElegido ? 700 : 500,
                  color: esHoy ? BLOQUE.oro : esElegido ? BLOQUE.tinta : BLOQUE.apagado,
                }}>{cortoDe(i)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {pie && (
        <span suppressHydrationWarning style={{ fontSize: 14, color: BLOQUE.tinta, lineHeight: 1.5 }}>
          {pie({ total: montos.reduce((a, b) => a + b, 0), promedio, elegido: iDia })}
        </span>
      )}
    </div>
  )
}
