'use client'

// components/caja/CajaPorRuta.jsx — T08-02 «Caja · por ruta».
//
// Sustituye al `<select>` de cobrador y la media pantalla en blanco. Ahora se
// ven TODAS las rutas de una, cada una con lo recaudado partido en efectivo y
// digital.
//
// La partición es el punto: al cerrar el día, de lo que cobró esta ruta el
// cobrador solo entrega EL EFECTIVO. Lo digital ya está en la cuenta. Sin
// separarlo, se le pide una cifra que incluye plata que nunca tocó.
//
// El selector de cobrador NO desaparece: sigue debajo para el detalle de uno,
// que es otra pregunta («qué hizo Pepito hoy»). Lo que cambia es que ya no hay
// que elegir para ver algo.

/* Los dos tramos de la barra: cuánto de lo cobrado es efectivo y cuánto digital.
   Es la misma barra partida del bloque oscuro de «Cuentas». */
function BarraPartida({ pctEfectivo, pctDigital, alto = 8 }) {
  if (!pctEfectivo && !pctDigital) return null
  return (
    <span aria-hidden style={{
      display: 'flex', height: alto, borderRadius: 999, overflow: 'hidden',
      background: 'var(--cf-fill)', flex: 'none',
    }}>
      {pctEfectivo > 0 && <span style={{ width: `${pctEfectivo}%`, background: 'var(--cf-gold)' }} />}
      {pctDigital > 0 && <span style={{ width: `${pctDigital}%`, background: 'var(--cf-green)' }} />}
    </span>
  )
}

function Cifra({ etiqueta, valor, color }) {
  if (valor == null) return null
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
        textTransform: 'uppercase', color: 'var(--cf-ink-3)',
      }}>{etiqueta}</span>
      <span className="cf-fig" style={{ fontSize: 14, fontWeight: 600, color: color ?? 'var(--cf-ink)' }}>
        {valor}
      </span>
    </div>
  )
}

/* La leyenda de los colores. Sin ella la barra son dos tramos de colores que no
   dicen cuál es cuál. */
function Punto({ color, children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--cf-ink-3)' }}>
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: color, flex: 'none' }} />
      {children}
    </span>
  )
}

/**
 * ⚠ `selector` VA ENTRE EL TOTAL Y LA LISTA, y es un hueco, no un componente.
 *
 * El dueño, 22 ago 2026: «un usuario que tenga diez rutas, como hay un caso,
 * tiene que bajar hasta el final para poder seleccionar la que quiere ver».
 * Tenía razón: el selector de cobrador iba después de las diez tarjetas.
 *
 * Subirlo del todo tampoco servía: el total del día es el titular de esta
 * pantalla —es a lo que se entra— y taparlo con un `<select>` es cambiar un
 * problema por otro. Así que va en medio: el total sigue siendo lo primero, y
 * el selector se alcanza sin pasar por ninguna ruta.
 *
 * Es un hueco porque quien sabe qué poner ahí es la página (el `<select>` y el
 * detalle del cobrador elegido). Aquí solo se decide DÓNDE.
 */
export default function CajaPorRuta({ filas = [], totales, onAbrirRuta, selector = null }) {
  if (!filas.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {selector}
      <div style={{
        background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
        borderRadius: 'var(--cf-r-card)', padding: '26px 20px', textAlign: 'center',
      }}>
        {/* «Ni cobros ni préstamos»: desde que la pestaña también cuenta lo
            desembolsado, una ruta que hoy solo prestó SÍ sale. Decir solo «no
            hay cobros» con préstamos hechos sería mentira.

            Y una ruta con capital propio sale SIEMPRE, así que llegar aquí
            significa que tampoco hay capital repartido por rutas. */}
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--cf-ink-3)' }}>
          Todavía no hay cobros ni préstamos hoy en ninguna ruta.
        </p>
      </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* El total del día, partido igual que las filas: es la suma de lo de
          abajo y se lee con la misma gramática. */}
      {totales?.hayAlgo && (
        <div style={{
          background: '#15161A', borderRadius: 'var(--cf-r-card)',
          // El borde dibuja la caja en tema oscuro, donde el fondo de la app
          // ES este mismo #15161A y el bloque desaparecía.
          border: '1px solid rgba(255,255,255,.09)',
          padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
              textTransform: 'uppercase', color: '#A3A8B2',
            }}>Recaudado hoy</span>
            <span className="cf-fig" style={{
              fontSize: 30, fontWeight: 600, letterSpacing: '-.035em', lineHeight: 1, color: '#F3F3F6',
            }}>{totales.total}</span>
          </span>
          <span aria-hidden style={{
            display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden',
            background: 'rgba(255,255,255,.08)', flex: 'none',
          }}>
            {totales.pctEfectivo > 0 && <span style={{ width: `${totales.pctEfectivo}%`, background: 'var(--cf-gold)' }} />}
            {totales.pctDigital > 0 && <span style={{ width: `${totales.pctDigital}%`, background: 'var(--cf-green)' }} />}
          </span>
          <span style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#A3A8B2' }}>
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--cf-gold)' }} />
              Efectivo <strong style={{ color: '#F3F3F6' }}>{totales.efectivo}</strong>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#A3A8B2' }}>
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--cf-green)' }} />
              Digital <strong style={{ color: '#F3F3F6' }}>{totales.digital}</strong>
            </span>
          </span>

          {/* ⚠ LO PRESTADO NO ENTRA EN LA BARRA NI EN «RECAUDADO». Sale de la
              caja, no entra: meterlo con efectivo y digital sumaría plata que
              se fue con plata que llegó. Va en su renglón, debajo de la línea,
              para leerlo CONTRA lo cobrado: «entró esto, salió aquello». */}
          {totales.prestado && (
            <span style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12,
              paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.10)',
            }}>
              <span style={{ fontSize: 12, color: '#A3A8B2' }}>Prestado hoy</span>
              <span className="cf-fig" style={{ fontSize: 15, fontWeight: 600, color: '#F3F3F6' }}>
                {totales.prestado}
              </span>
            </span>
          )}

          {/* ── EL CAPITAL, Y POR QUÉ LAS RUTAS NO SUMAN EL TOTAL ────────
              «En rutas $5.554.155 · sin asignar $8.803.600 · total $14.357.755».
              Sin la línea del medio, la suma de las tarjetas de abajo parece que
              le falta más de la mitad de la plata del negocio, y ahí es donde
              alguien empieza a buscar un fallo que no existe. No es descuadre:
              es plata que no vive en la calle de ningún cobrador. */}
          {totales.capitalGlobal && (
            <span style={{
              display: 'flex', flexDirection: 'column', gap: 5,
              paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.10)',
            }}>
              {[
                { rot: 'Capital en las rutas', val: totales.capitalEnRutas },
                // ⚠ EN NEGATIVO SE DICE DE OTRA FORMA, NO EN ROJO.
                //
                // «Sin asignar a ruta −$29.166.797» se lee como un faltante, y
                // NO lo es. Comprobado contra producción: pasa en 1 de los 6
                // negocios que usan capital por ruta, y la causa es sana — los
                // `ajusteArranqueRuta` restan del global pero NO de la sub-bolsa
                // (absorben préstamos hechos antes de que la ruta tuviera
                // capital), así que una ruta que ES el negocio entero acaba con
                // más saldo que el global. La aritmética está bien; el rótulo
                // era el que mentía.
                ...(totales.capitalSinAsignarNegativo
                  ? [{ rot: 'Las rutas suman más que el global', val: null, nota: true }]
                  : [{ rot: 'Sin asignar a ruta', val: totales.capitalSinAsignar }]),
                { rot: 'Capital del negocio', val: totales.capitalGlobal, fuerte: true },
              ].map((l) => (
                <span key={l.rot} style={{
                  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12,
                }}>
                  <span style={{ fontSize: l.nota ? 11 : 12, color: '#A3A8B2', ...(l.fuerte ? { color: '#F3F3F6' } : {}) }}>
                    {l.rot}
                  </span>
                  {l.val != null && (
                    <span className="cf-fig" style={{
                      fontSize: l.fuerte ? 15 : 13,
                      fontWeight: l.fuerte ? 600 : 400,
                      color: '#F3F3F6',
                    }}>{l.val}</span>
                  )}
                </span>
              ))}
              {totales.capitalSinAsignarNegativo && (
                <span style={{ fontSize: 11, color: '#A3A8B2', lineHeight: 1.45 }}>
                  Pasa cuando una ruta arrastra préstamos anteriores a su capital.
                  No falta plata.
                </span>
              )}
            </span>
          )}

          {/* Los gastos que NO se pudieron asignar a una ruta. Se dicen en vez
              de repartirse: `GastoMenor` solo guarda el cobrador, y repartir el
              gasto de quien lleva tres rutas entre las tres sería inventar. */}
          {(totales.gastosAmbiguos || totales.gastosSinCobrador) && (
            <span style={{
              display: 'flex', flexDirection: 'column', gap: 3,
              paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.10)',
            }}>
              {totales.gastosSinCobrador && (
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, color: '#A3A8B2' }}>
                  Gastos del negocio (sin ruta)
                  <span className="cf-fig" style={{ color: '#F3F3F6' }}>{totales.gastosSinCobrador}</span>
                </span>
              )}
              {totales.gastosAmbiguos && (
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, color: '#A3A8B2' }}>
                  Gastos de cobradores con varias rutas
                  <span className="cf-fig" style={{ color: '#F3F3F6' }}>{totales.gastosAmbiguos}</span>
                </span>
              )}
            </span>
          )}
        </div>
      )}

      {selector}

      {/* ── ⚠ ESTE AVISO YO LO ESCRIBÍ MAL, Y ASUSTABA SIN MOTIVO ──────────
          Decía «salió plata que no se registró como entrada», que se lee como
          que falta dinero. Lo comprobé después contra producción y es FALSO:

           · Los 253 negocios cuadran al peso con la fórmula de `lib/capital.js`
             (mi primera medición dijo lo contrario, pero el error era mío:
             sumaba todos los `ajuste` en positivo y el código decide el signo
             comparando `saldoNuevo` con `saldoAnterior`).
           · De los 107 negocios con saldo negativo, **106 se explican enteros
             por la cartera viva**: lo que «falta» es menos de lo que tienen
             prestado en la calle.
           · 98 de 107 nunca registraron su capital inicial y 100 de 107
             prestaron ANTES de meter plata al sistema.

          O sea: no salió plata de más. Faltó declarar la de partida, la bolsa
          arrancó en cero y cada préstamo la hundió. El aviso ahora dice eso y
          cómo arreglarlo, en vez de dar a entender un robo.

          En tono de aviso (ámbar), no de alarma (rojo): es un dato que falta,
          no una pérdida. */}
      {totales?.rutasEnNegativo > 0 && (
        <div style={{
          background: 'var(--cf-gold-tint)', borderRadius: 'var(--cf-r-card)',
          border: '1px solid var(--cf-gold-border)',
          padding: '11px 14px', fontSize: 12, color: 'var(--cf-ink-2)', lineHeight: 1.45,
        }}>
          <strong style={{ color: 'var(--cf-gold-dark)' }}>
            {totales.rutasEnNegativo === 1
              ? 'Una ruta aparece con el capital en negativo.'
              : `${totales.rutasEnNegativo} rutas aparecen con el capital en negativo.`}
          </strong>
          {' '}Casi siempre es porque se empezó a prestar antes de registrar con
          cuánto capital contaba {totales.rutasEnNegativo === 1 ? 'esa ruta' : 'cada ruta'}:
          la bolsa arranca en cero y cada préstamo la baja. La plata no se perdió,
          está en la calle. Se arregla en{' '}
          <strong style={{ color: 'var(--cf-ink)' }}>Capital → Inyectar a la ruta</strong>.
        </div>
      )}

      {/* Una tarjeta por ruta. En PC, dos columnas. */}
      <div className="contents lg:grid lg:grid-cols-2 lg:gap-3">
        {filas.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => !f.sinRuta && onAbrirRuta?.(f)}
            style={{
              textAlign: 'left', font: 'inherit',
              cursor: f.sinRuta || !onAbrirRuta ? 'default' : 'pointer',
              background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
              borderRadius: 'var(--cf-r-card)', padding: '16px 18px',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{
                  fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)',
                  minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  // La de «sin ruta» es un agujero, no una ruta: se dice en
                  // cursiva y en tinta clara, como el «Sin ruta» de clientes.
                  ...(f.sinRuta ? { fontStyle: 'italic', color: 'var(--cf-ink-3)' } : {}),
                }}>{f.nombre}</span>
                <span className="cf-num" style={{
                  fontSize: 11.5, color: 'var(--cf-ink-3)',
                  minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{f.subtitulo}</span>
              </div>
              <span className="cf-fig" style={{
                fontSize: 19, fontWeight: 600, letterSpacing: '-.02em',
                color: 'var(--cf-ink)', flex: 'none',
              }}>{f.total}</span>
            </div>

            <BarraPartida pctEfectivo={f.pctEfectivo} pctDigital={f.pctDigital} />

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Punto color="var(--cf-gold)">Efectivo <strong style={{ color: 'var(--cf-ink-2)' }}>{f.efectivo}</strong></Punto>
              <Punto color="var(--cf-green)">Digital <strong style={{ color: 'var(--cf-ink-2)' }}>{f.digital}</strong></Punto>
            </div>

            {/* Las cifras del DÍA: lo que se esperaba cobrar y lo que salió a
                la calle. Lo cobrado ya está arriba, en grande. */}
            {(f.esperado || f.prestado) && (
              <div style={{
                display: 'flex', gap: 18, paddingTop: 10,
                borderTop: '1px solid var(--cf-hairline)',
              }}>
                {f.esperado && <Cifra etiqueta="Tocaba cobrar" valor={f.esperado} />}
                {f.prestado && <Cifra etiqueta="Prestado" valor={f.prestado} />}
              </div>
            )}

            {/* ── DINERO EN MANO: CAPITAL − GASTOS ─────────────────────────
                La cifra que pidió el dueño como principal de la ruta. Va abajo
                y con su resta A LA VISTA, no solo el resultado: «$3.096.800 de
                capital − $47.000 de gastos» se puede seguir con un lápiz, y esa
                es la única forma de que alguien detecte que no cuadra.

                Solo sale si la ruta lleva CAPITAL PROPIO. Sin él su plata vive
                en la bolsa global del negocio y un «$0» aquí se leería como
                «esta ruta no tiene nada», que es distinto. */}
            {f.enMano && (
              <div style={{
                paddingTop: 10, borderTop: '1px solid var(--cf-hairline)',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <span style={{
                  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--cf-ink-2)' }}>
                    Dinero en mano
                  </span>
                  <span className="cf-fig" style={{
                    fontSize: 17, fontWeight: 700,
                    // En negativo va en rojo: una sub-bolsa no puede tener menos
                    // de cero pesos físicos, así que es una señal, no un dato.
                    color: f.enManoNegativo ? 'var(--cf-red-dark)' : 'var(--cf-green-dark)',
                  }}>{f.enMano}</span>
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--cf-ink-3)' }}>
                  {f.capital} de capital − {f.gastos} de gastos
                </span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
