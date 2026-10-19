'use client'

// components/pantallas/Reportes.jsx — turno 30. Las cuatro pantallas de números.
//
// ── EL ERROR DE FONDO (T30-01) ──────────────────────────────────────────────
//
// La pantalla de «mi plata» remata hoy en «Balance neto −$17.621.429» EN ROJO, con
// la fórmula «cobrado − prestado − gastos». Esa resta no es un balance: PRESTAR NO
// ES GASTAR, es cambiar plata de bolsillo. Un negocio que crece siempre saldrá
// rojo ahí, y el dueño lee que va perdiendo.
//
// El número no está mal calculado —es un flujo de caja de verdad—; lo que está mal
// es LLAMARLO BALANCE Y PINTARLO EN ROJO. Así que el número grande pasa a ser toda
// la plata, partida en la que está lista y la que se está cobrando, y los $17.6M
// siguen apareciendo pero EXPLICADOS: están en la calle, con tu nombre.
//
// Mismo error de familia que «ganancia = recaudado − gastos», que infló las
// analíticas 7,9 veces: confundir plata que se mueve con plata que se pierde.
//
// ── LO QUE HACE CADA UNA ────────────────────────────────────────────────────
//
//   T30-01  mi plata          toda tu plata, el mes, y el aviso explicado
//   T30-02  cómo va el negocio  «por cada $100 en la calle, ganas $8 neto»
//   T30-03  reportes          ocho tarjetas teñidas → un bloque y el hallazgo
//   T30-04  línea de crédito  el azul se va; el número grande es lo que PUEDE pedir

// Sin importar nada del sistema: estas cuatro pantallas son bloques oscuros y
// tarjetas de cifras, y no usan ninguna de las 17 piezas. Un import que no se usa
// es una pista falsa sobre de qué está hecha la pantalla.
const ORO = '#E7A400'

/* Rótulo de sección. Igual que en caja y en gestión: 10px, 700, .1em. */
function Rotulo({ children, valor, tonoValor }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flex: 'none' }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
        textTransform: 'uppercase', color: 'var(--cf-ink-3)',
      }}>{children}</span>
      {valor && (
        <span className="cf-num" style={{
          fontSize: 12, fontWeight: 700, flex: 'none',
          color: tonoValor === 'enlace' ? 'var(--cf-gold-dark)' : 'var(--cf-ink-3)',
        }}>{valor}</span>
      )}
    </div>
  )
}

/* Fila de cifras separadas por líneas verticales. Se repite en las cuatro
   pantallas: son un reparto de algo, no cuatro datos sueltos, y la línea lo dice
   mejor que un hueco. */
function Reparto({ celdas = [], compacto = false }) {
  // CON CUATRO COLUMNAS LAS ETIQUETAS PARTEN EN DOS LÍNEAS, y entonces la cifra de
  // la que partió queda 13px más abajo que las otras tres: en una fila de cifras que
  // se comparan, el desnivel se lee como si una fuera de otra categoría. Lo vi al
  // capturar «TE PAGARON» junto a «GASTOS».
  //
  // Se le reserva sitio a las dos líneas y se afloja el espaciado. Reservar espacio
  // que a veces no se usa cuesta 13px; desalinear cifras de plata cuesta una mala
  // lectura, que es más caro.
  const apretado = celdas.length > 3
  return (
    <div style={{ display: 'flex', gap: apretado ? 7 : 8 }}>
      {celdas.map((c, i) => (
        <span key={c.etiqueta} style={{ display: 'contents' }}>
          {i > 0 && <span aria-hidden style={{ width: 1, background: 'var(--cf-hairline)', flex: 'none' }} />}
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{
              fontSize: 10, fontWeight: 700,
              letterSpacing: apretado ? '.03em' : '.06em',
              lineHeight: 1.25,
              minHeight: apretado ? 25 : undefined,
              textTransform: 'uppercase', color: 'var(--cf-ink-3)',
            }}>{c.etiqueta}</span>
            <span className="cf-fig" style={{
              fontSize: compacto ? 15 : 17, fontWeight: 600,
              color: c.tono === 'ok' ? 'var(--cf-green-dark)'
                : c.tono === 'mal' ? 'var(--cf-red-dark)'
                : 'var(--cf-ink)',
            }}>{c.valor}</span>
          </span>
        </span>
      ))}
    </div>
  )
}

/* ══ T30-01 · Mi plata ═════════════════════════════════════════════════════
   El número grande es TODA TU PLATA: caja más calle. No un balance.

   Y la frase de abajo es la pantalla entera: «prestaste más de lo que te pagaron
   porque la cartera está creciendo. Eso no es una pérdida: esos $17.6M están en la
   calle con tu nombre». Sin ella el dueño ve dos cifras que no cuadran y saca la
   conclusión que la app le sugería en rojo.

   «Modo estricto» pasa a llamarse LO QUE HACE: «no prestar sin tener con qué». Un
   interruptor que se llama por su implementación obliga a adivinar qué apaga. */
export function MiPlata({
  total, tramos = [], partes = [],
  mesEtiqueta = 'Este mes', mes = [], explicacion,
  estricto, onEstricto,
  movimientos = [], onTodosLosMovimientos,
}) {
  return (
    <>
      <div style={{
        flex: 'none', background: '#15161A', borderRadius: 20,
        padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 15,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
          textTransform: 'uppercase', color: '#A3A8B2',
        }}>Toda tu plata</span>
        <span className="cf-fig" style={{
          fontSize: 38, fontWeight: 600, letterSpacing: '-.035em', lineHeight: 1, color: '#F3F3F6',
        }}>{total}</span>

        {tramos.length > 0 && (
          <span aria-hidden style={{
            display: 'flex', height: 13, borderRadius: 999, overflow: 'hidden', flex: 'none',
            background: 'rgba(255,255,255,.08)',
          }}>
            {tramos.map((t) => (
              <span key={t.id} style={{ width: `${t.porcentaje}%`, background: t.color, flex: 'none' }} />
            ))}
          </span>
        )}

        {/* «Lista para prestar» y «en la calle, cobrándose». Las dos partes de la
            misma plata: es lo que sustituye al balance en rojo. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {partes.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span aria-hidden style={{ width: 9, height: 9, borderRadius: 3, background: p.color, flex: 'none' }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#A3A8B2' }}>{p.etiqueta}</span>
              <span className="cf-fig" style={{
                fontSize: 15, fontWeight: 600, flex: 'none',
                color: p.destacado ? p.color : '#F3F3F6',
              }}>{p.valor}</span>
            </div>
          ))}
        </div>
      </div>

      {mes.length > 0 && (
        <div style={{
          flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          borderRadius: 'var(--cf-r-card)', padding: '17px 19px',
          display: 'flex', flexDirection: 'column', gap: 13,
        }}>
          <Rotulo>{mesEtiqueta}</Rotulo>
          <Reparto celdas={mes} compacto />
          {/* LA FRASE QUE SUSTITUYE AL ROJO. Los $17.6M siguen ahí, explicados. */}
          {explicacion && (
            <span style={{
              fontSize: 12, lineHeight: 1.45, color: 'var(--cf-ink-2)',
              paddingTop: 11, borderTop: '1px solid var(--cf-hairline)',
            }}>{explicacion}</span>
          )}
        </div>
      )}

      {onEstricto && (
        <button
          type="button"
          onClick={() => onEstricto(!estricto)}
          aria-pressed={estricto}
          style={{
            flex: 'none', display: 'flex', alignItems: 'center', gap: 12, width: '100%',
            background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
            borderRadius: 'var(--cf-r-card)', padding: '15px 18px',
            font: 'inherit', textAlign: 'left', cursor: 'pointer',
          }}
        >
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* SE LLAMA LO QUE HACE. «Modo estricto» obliga a adivinar qué apaga. */}
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)' }}>
              No prestar sin tener con qué
            </span>
            <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>
              {estricto ? 'La app te frena si el capital no alcanza' : 'Hoy puedes prestar hasta quedar en negativo'}
            </span>
          </span>
          <span aria-hidden style={{
            width: 46, height: 28, borderRadius: 999, flex: 'none', position: 'relative',
            background: estricto ? ORO : 'var(--cf-fill-2)',
            border: estricto ? 'none' : '1px solid var(--cf-border-strong)',
            transition: 'background .15s',
          }}>
            <span style={{
              position: 'absolute', top: 3, width: 22, height: 22, borderRadius: 999,
              background: '#FFF', boxShadow: '0 1px 3px rgba(20,20,28,.24)',
              left: estricto ? 21 : 3, transition: 'left .15s',
            }} />
          </span>
        </button>
      )}

      {movimientos.length > 0 && (
        <div style={{
          flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '15px 18px 11px', flex: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
                textTransform: 'uppercase', color: 'var(--cf-ink-3)',
              }}>Movimientos</span>
              {onTodosLosMovimientos && (
                <button type="button" onClick={onTodosLosMovimientos} style={{
                  border: 0, background: 'none', padding: 0, cursor: 'pointer', font: 'inherit',
                  fontSize: 12, fontWeight: 700, color: 'var(--cf-gold-dark)', flex: 'none',
                }}>Todos</button>
              )}
            </div>
          </div>
          {movimientos.map((m) => (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 18px', borderTop: '1px solid var(--cf-hairline)',
            }}>
              <span aria-hidden style={{
                width: 7, height: 7, borderRadius: 999, flex: 'none',
                background: m.signo === '+' ? 'var(--cf-green)' : ORO,
              }} />
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{
                  fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{m.concepto}</span>
                {/* «Quedaste en $2.520.280» es el dato que convierte una lista de
                    movimientos en un extracto: sin el saldo corrido no se puede
                    reconstruir dónde se fue la plata. */}
                <span className="cf-num" style={{
                  fontSize: 11, color: 'var(--cf-ink-3)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{m.detalle}</span>
              </span>
              <span className="cf-fig" style={{
                fontSize: 15, fontWeight: 600, flex: 'none',
                color: m.signo === '+' ? 'var(--cf-green-dark)' : 'var(--cf-ink)',
              }}>{m.monto}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/* ══ T30-02 · ¿Cómo va el negocio? ═════════════════════════════════════════
   «POR CADA $100 EN LA CALLE, GANAS $8 NETO» es la mejor frase de la app y hoy
   está en gris de 12px debajo del porcentaje. Aquí sube al bloque negro con el
   7,8%, porque eso es lo que el dueño quiere saber: un porcentaje mensual no le
   dice nada, «por cada cien, ocho» sí.

   La proyección dice «92% DE LO ESPERADO», no «92% por debajo». La app calcula
   bien el 8% que falta, pero decirlo en la forma negativa asusta por nada: el
   dueño lee «92% por debajo» y entiende que va al 8%. Y encima se añade lo que
   falta para llegar —$947.026 en 3 días—, que es lo único que se puede hacer con
   ese dato. */
export function ComoVaElNegocio({
  rendimiento, rendimientoUnidad = 'al mes', porCada,
  cifras = [],
  proyeccionEtiqueta, proyeccionDia, proyeccion, proyeccionPorcentaje, proyeccionFalta,
  repartoPeso = [],
  rutas = [], rutasTotal, sinRuta, clavos,
}) {
  return (
    <>
      <div style={{
        flex: 'none', background: '#15161A', borderRadius: 20,
        padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
          textTransform: 'uppercase', color: '#A3A8B2',
        }}>Lo que rinde tu capital</span>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
          <span className="cf-fig" style={{
            fontSize: 38, fontWeight: 600, letterSpacing: '-.035em', lineHeight: 1, color: '#F3F3F6',
          }}>{rendimiento}</span>
          <span style={{ fontSize: 14, color: '#8A8E98', flex: 'none' }}>{rendimientoUnidad}</span>
        </span>
        {/* LA MEJOR FRASE DE LA APP, en el sitio que le corresponde. */}
        {porCada && (
          <span style={{ fontSize: 14, lineHeight: 1.45, color: '#A3A8B2' }}>{porCada}</span>
        )}
      </div>

      {cifras.length > 0 && (
        <div style={{
          flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          borderRadius: 'var(--cf-r-card)', padding: '17px 19px',
        }}>
          <Reparto celdas={cifras} />
        </div>
      )}

      {proyeccion && (
        <div style={{
          flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          borderRadius: 'var(--cf-r-card)', padding: '17px 19px',
          display: 'flex', flexDirection: 'column', gap: 11,
        }}>
          <Rotulo valor={proyeccionDia}>{proyeccionEtiqueta}</Rotulo>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span className="cf-fig" style={{
              flex: 1, minWidth: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-.03em', color: 'var(--cf-ink)',
            }}>{proyeccion}</span>
            {/* «92% DE lo esperado». En positivo, porque el mismo dato dicho en
                negativo se lee al revés. */}
            {proyeccionPorcentaje && (
              <span className="cf-num" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cf-ink-2)', flex: 'none' }}>
                {proyeccionPorcentaje}
              </span>
            )}
          </div>
          {/* LO QUE FALTA PARA LLEGAR. Es lo único que se puede hacer con el dato:
              sin esto, el porcentaje es una nota y no una meta. */}
          {proyeccionFalta && (
            <span style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--cf-ink-2)' }}>
              {proyeccionFalta}
            </span>
          )}
        </div>
      )}

      {/* «De cada peso que entra: 25¢ ganancia, 75¢ tu capital de vuelta.» Es la
          traducción del recaudado, y la que evita confundirlo con la ganancia. */}
      {repartoPeso.length > 0 && (
        <div style={{
          flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          borderRadius: 'var(--cf-r-card)', padding: '17px 19px',
          display: 'flex', flexDirection: 'column', gap: 11,
        }}>
          <Rotulo>De cada peso que entra</Rotulo>
          <div style={{ display: 'flex', gap: 12 }}>
            {repartoPeso.map((r) => (
              <span key={r.etiqueta} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                {/* Alineado a la PRIMERA linea, no al centro: «75¢ tu capital de
                    vuelta» parte en dos y con `center` el punto quedaba flotando
                    entre las dos lineas, sin pertenecer a ninguna. */}
                <span aria-hidden style={{ width: 9, height: 9, borderRadius: 3, background: r.color, flex: 'none', marginTop: 5 }} />
                <span style={{ fontSize: 13, color: 'var(--cf-ink-2)' }}>
                  <strong className="cf-fig" style={{ color: 'var(--cf-ink)' }}>{r.valor}</strong> {r.etiqueta}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {rutas.length > 0 && (
        <>
          <Rotulo valor={rutasTotal}>Rutas que más rinden</Rotulo>
          <div style={{
            flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
            borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
          }}>
            {rutas.map((r, i) => (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
                borderTop: i === 0 ? 'none' : '1px solid var(--cf-hairline)',
              }}>
                <span style={{
                  flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{r.nombre}</span>
                <span className="cf-fig" style={{ fontSize: 15, fontWeight: 600, color: 'var(--cf-ink)', flex: 'none' }}>
                  {r.rendimiento}
                </span>
              </div>
            ))}

            {/* Los préstamos sin ruta y los clavos NO son rutas, así que van al pie
                y no como dos filas más: mezclarlos deja «sin ruta» compitiendo por
                el primer puesto de una lista de rendimiento. */}
            {sinRuta && (
              <button type="button" onClick={sinRuta.onAsignar} style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                padding: '13px 18px', borderTop: '1px solid var(--cf-hairline)',
                background: 'none', border: 0, font: 'inherit', textAlign: 'left',
                cursor: sinRuta.onAsignar ? 'pointer' : 'default',
              }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--cf-ink-2)' }}>
                  {sinRuta.texto}
                </span>
                {sinRuta.onAsignar && (
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cf-gold-dark)', flex: 'none' }}>
                    Asignar
                  </span>
                )}
              </button>
            )}
          </div>
        </>
      )}

      {/* «CLAVOS» SE QUEDA: es la palabra que usa el gremio, y traducirla a
          «irrecuperables» sería hablarle al dueño en un idioma que no es el suyo. */}
      {clavos && (
        <div style={{
          flex: 'none', display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          borderRadius: 'var(--cf-r-card)', padding: '15px 18px',
        }}>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)' }}>Clavos</span>
            <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{clavos.detalle}</span>
          </span>
          <span className="cf-fig" style={{ fontSize: 16, fontWeight: 600, color: 'var(--cf-red-dark)', flex: 'none' }}>
            {clavos.monto}
          </span>
        </div>
      )}
    </>
  )
}

/* ══ T30-03 · Reportes ═════════════════════════════════════════════════════
   Ocho tarjetas teñidas —verde, rojo, ámbar, morado, azul— y hay que bajar mucho
   para llegar a lo útil. El muro se colapsa en UN bloque negro con las cuatro
   cifras, y lo que sube al tope es EL HALLAZGO que estaba enterrado en el podio de
   cobradores:

     «En 26 días, los 8 cobradores marcan $0 recogido sobre $45M esperados. Los
      pagos entran todos con tu nombre: están cobrando y no lo están registrando.»

   El podio «#1 #2 #3» con todos en $0 premiaba a nadie. Un ranking de ceros no es
   un ranking, es un síntoma, y dicho como síntoma se puede arreglar. */
export function Reportes({
  entroEtiqueta = 'Entró en el período', entro, entroDetalle,
  cifras = [],
  hallazgoTitulo, hallazgoDetalle,
  rutas = [], rutasTotal, sinPeso,
}) {
  return (
    <>
      <div style={{
        flex: 'none', background: '#15161A', borderRadius: 20,
        padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
            textTransform: 'uppercase', color: '#A3A8B2',
          }}>{entroEtiqueta}</span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
            <span className="cf-fig" style={{
              fontSize: 34, fontWeight: 600, letterSpacing: '-.035em', lineHeight: 1, color: '#F3F3F6',
            }}>{entro}</span>
            {entroDetalle && (
              <span className="cf-num" style={{ fontSize: 13, color: '#8A8E98', flex: 'none' }}>
                {entroDetalle}
              </span>
            )}
          </span>
        </span>

        {/* Las cuatro cifras que eran ocho tarjetas de colores. Dentro del bloque y
            en la misma tinta: son contexto de la de arriba, no cuatro noticias. */}
        {/* SIN `flexWrap`. Con envoltura, los cuatro se partían en dos filas de 3 y
            1, y el filete que separaba el tercero del cuarto se quedaba huérfano al
            final de la primera fila: una raya vertical suelta que no separa nada.
            Lo vi al capturar.

            Caben los cuatro apretando el espaciado y bajando la cifra a 15: son
            contexto de la de arriba, no cuatro titulares. */}
        {cifras.length > 0 && (
          <div style={{ display: 'flex', gap: 7 }}>
            {cifras.map((c, i) => (
              <span key={c.etiqueta} style={{ display: 'contents' }}>
                {i > 0 && <span aria-hidden style={{ width: 1, background: 'rgba(255,255,255,.09)', flex: 'none' }} />}
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '.03em', lineHeight: 1.25,
                    minHeight: cifras.length > 3 ? 25 : undefined,
                    textTransform: 'uppercase', color: '#8A8E98',
                  }}>{c.etiqueta}</span>
                  <span className="cf-fig" style={{
                    fontSize: cifras.length > 3 ? 15 : 16, fontWeight: 600, color: '#F3F3F6',
                  }}>{c.valor}</span>
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* EL HALLAZGO, arriba. Estaba enterrado en un podio de ceros. */}
      {hallazgoTitulo && (
        <div style={{
          flex: 'none', display: 'flex', gap: 11, alignItems: 'flex-start',
          padding: '16px 18px', borderRadius: 'var(--cf-r-card)',
          background: 'var(--cf-red-bg)', border: '1px solid var(--cf-red-border)',
        }}>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--cf-red-darker)' }}>
              {hallazgoTitulo}
            </span>
            {hallazgoDetalle && (
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--cf-red-darker)' }}>
                {hallazgoDetalle}
              </span>
            )}
          </span>
        </div>
      )}

      {rutas.length > 0 && (
        <>
          <Rotulo valor={rutasTotal}>Cartera por ruta</Rotulo>
          <div style={{
            flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
            borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
          }}>
            {rutas.map((r, i) => (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
                borderTop: i === 0 ? 'none' : '1px solid var(--cf-hairline)',
              }}>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{
                    fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{r.nombre}</span>
                  <span className="cf-num" style={{
                    fontSize: 12, color: 'var(--cf-ink-3)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{r.detalle}</span>
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end', flex: 'none' }}>
                  <span className="cf-fig" style={{ fontSize: 15, fontWeight: 600, color: 'var(--cf-ink)' }}>
                    {r.cartera}
                  </span>
                  {r.porDia && (
                    <span className="cf-num" style={{ fontSize: 11, color: 'var(--cf-ink-3)' }}>{r.porDia}</span>
                  )}
                </span>
              </div>
            ))}

            {sinPeso && (
              <button type="button" onClick={sinPeso.onVer} style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                padding: '13px 18px', borderTop: '1px solid var(--cf-hairline)',
                background: 'none', border: 0, font: 'inherit', textAlign: 'left',
                cursor: sinPeso.onVer ? 'pointer' : 'default',
              }}>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cf-ink-2)' }}>{sinPeso.titulo}</span>
                  {sinPeso.detalle && (
                    <span style={{
                      fontSize: 11.5, color: 'var(--cf-ink-3)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{sinPeso.detalle}</span>
                  )}
                </span>
                {sinPeso.onVer && (
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cf-gold-dark)', flex: 'none' }}>Ver</span>
                )}
              </button>
            )}
          </div>
        </>
      )}
    </>
  )
}

/* ══ T30-04 · Línea de crédito ═════════════════════════════════════════════
   La tarjeta actual es un DEGRADADO AZUL: el único elemento de toda la app fuera
   de la marca, y encima el azul es el color del CLIENTE en este sistema, no del
   dinero. Pasa a carbón cálido con dorado, que además la distingue legítimamente
   de los préstamos —tarjetas blancas—: es otro producto, no un préstamo raro.

   Tres cambios más, y los tres son de contenido:

     · el número grande es LO QUE PUEDE PEDIR, no lo que debe. Es la pregunta que
       trae al cliente a la puerta.
     · EL CORTE sube a segundo lugar. En un cupo rotativo es la fecha que manda, y
       hoy está en gris de 12px.
     · de cinco botones, tres. Los dos que se van no desaparecen: bajan al pie,
       donde viven las acciones que se usan una vez. */
export function LineaCredito({
  puedePedir, cupoTotal, estado,
  usado, usadoPorcentaje, tasa,
  corteEnEtiqueta = 'El corte es en', corteEn, corteDetalle, onVerCorte,
  onDarPlata, onRecibirPago,
  movimientos = [], movimientosNota,
  onCongelar, onCerrar,
}) {
  return (
    <>
      {/* CARBÓN CÁLIDO CON DORADO, no el degradado azul: el azul es el color del
          cliente en este sistema, y esta tarjeta es de dinero. */}
      <div style={{
        flex: 'none', background: '#15161A', borderRadius: 20,
        padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 15,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
            textTransform: 'uppercase', color: '#A3A8B2',
          }}>Puede pedir hasta</span>
          {estado && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px',
              borderRadius: 11, flex: 'none', background: 'rgba(47,190,106,.16)',
              fontSize: 11, fontWeight: 700, color: '#2FBE6A',
            }}>{estado}</span>
          )}
        </div>

        {/* LO QUE PUEDE PEDIR, no lo que debe: es la pregunta que trae al cliente. */}
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
          <span className="cf-fig" style={{
            fontSize: 38, fontWeight: 600, letterSpacing: '-.035em', lineHeight: 1, color: ORO,
          }}>{puedePedir}</span>
          {cupoTotal && (
            <span className="cf-num" style={{ fontSize: 14, color: '#8A8E98', flex: 'none' }}>
              de {cupoTotal}
            </span>
          )}
        </span>

        <div style={{
          display: 'flex', gap: 12, alignItems: 'baseline',
          paddingTop: 13, borderTop: '1px solid rgba(255,255,255,.09)',
        }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#A3A8B2' }}>
            Ya usó <strong className="cf-fig" style={{ color: '#F3F3F6' }}>{usado}</strong>
            {usadoPorcentaje ? ` · ${usadoPorcentaje}` : ''}
          </span>
          {tasa && (
            <span className="cf-num" style={{ fontSize: 13, fontWeight: 600, color: '#F5B824', flex: 'none' }}>
              {tasa}
            </span>
          )}
        </div>
      </div>

      {/* EL CORTE, EN SEGUNDO LUGAR. En un cupo rotativo es la fecha que manda:
          hoy estaba en gris de 12px al fondo. */}
      {corteEn && (
        <button type="button" onClick={onVerCorte} style={{
          flex: 'none', display: 'flex', alignItems: 'center', gap: 12, width: '100%',
          background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          borderRadius: 'var(--cf-r-card)', padding: '16px 18px',
          font: 'inherit', textAlign: 'left', cursor: onVerCorte ? 'pointer' : 'default',
        }}>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--cf-ink-2)' }}>{corteEnEtiqueta}</span>
              <span className="cf-fig" style={{ fontSize: 17, fontWeight: 600, color: 'var(--cf-ink)' }}>
                {corteEn}
              </span>
            </span>
            {corteDetalle && (
              <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{corteDetalle}</span>
            )}
          </span>
          {onVerCorte && (
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cf-gold-dark)', flex: 'none' }}>
              Ver corte
            </span>
          )}
        </button>
      )}

      {/* DE CINCO BOTONES, DOS ARRIBA. Son los dos que se usan cada ciclo. */}
      {(onDarPlata || onRecibirPago) && (
        <div style={{ display: 'flex', gap: 9, flex: 'none' }}>
          {onDarPlata && (
            <button type="button" onClick={onDarPlata} style={{
              flex: 1, height: 48, borderRadius: 13, border: 'none', cursor: 'pointer',
              background: ORO, color: 'var(--cf-gold-ink)', font: 'inherit',
              fontSize: 14, fontWeight: 700,
            }}>Le doy plata</button>
          )}
          {onRecibirPago && (
            <button type="button" onClick={onRecibirPago} style={{
              flex: 1, height: 48, borderRadius: 13, cursor: 'pointer',
              background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
              color: 'var(--cf-ink)', font: 'inherit', fontSize: 14, fontWeight: 700,
            }}>Me paga</button>
          )}
        </div>
      )}

      {movimientos.length > 0 && (
        <>
          <Rotulo valor={movimientosNota}>Movimientos</Rotulo>
          <div style={{
            flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
            borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
          }}>
            {movimientos.map((m, i) => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px',
                borderTop: i === 0 ? 'none' : '1px solid var(--cf-hairline)',
              }}>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)' }}>{m.concepto}</span>
                  {/* El desglose interés/capital es lo que distingue un pago de una
                      línea del de un préstamo: aquí el capital no baja solo. */}
                  {/* En DOS lineas, no truncado: «$40.000 interes + $110.000 capi…»
                      corta justo en la palabra que distingue un pago de linea del de
                      un prestamo. Un nombre se puede truncar; un desglose de plata
                      no. */}
                  <span className="cf-num" style={{
                    fontSize: 11.5, lineHeight: 1.35, color: 'var(--cf-ink-3)',
                  }}>{m.detalle}</span>
                </span>
                <span className="cf-fig" style={{
                  fontSize: 15, fontWeight: 600, flex: 'none',
                  color: m.signo === '+' ? 'var(--cf-green-dark)' : 'var(--cf-ink)',
                }}>{m.monto}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Los dos que bajaron: se usan una vez en la vida de la línea. */}
      {(onCongelar || onCerrar) && (
        <div style={{ display: 'flex', gap: 12, flex: 'none', paddingTop: 4 }}>
          {onCongelar && (
            <button type="button" onClick={onCongelar} style={{
              border: 0, background: 'none', padding: 0, cursor: 'pointer', font: 'inherit',
              fontSize: 13, fontWeight: 700, color: 'var(--cf-ink-2)',
            }}>Congelar</button>
          )}
          {onCerrar && (
            <button type="button" onClick={onCerrar} style={{
              border: 0, background: 'none', padding: 0, cursor: 'pointer', font: 'inherit',
              fontSize: 13, fontWeight: 700, color: 'var(--cf-red-dark)',
            }}>Cerrar la línea</button>
          )}
        </div>
      )}
    </>
  )
}
