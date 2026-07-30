'use client'

// components/pantallas/Caja.jsx — turnos 6a · 01 y 02 del handoff.
//
// LA CAJA TIENE QUE CUADRAR SOLA.
//
// Lo que había: la fórmula del saldo repartida en CINCO MOSAICOS de colores
// distintos y, debajo, nueve tarjetas idénticas con una carita triste — una por
// cobrador sin pagos. Unos 1.800px de vacío con emojis, en la pantalla donde el
// dueño cuadra su plata.
//
// Lo que hay ahora:
//
//  1. EL SALDO SE LEE COMO UN EXTRACTO, no como cinco mosaicos: cada línea con
//     su signo, de arriba abajo, y el saldo al final. Como una cuenta hecha a
//     mano. Verde suma, rojo resta — el color por fin significa algo.
//  2. LOS MOVIMIENTOS DEL DÍA PASAN AL FRENTE, con quién y a qué hora. Estaban
//     escondidos tras un desplegable de cobradores.
//  3. Nueve tarjetas con emoji se vuelven TRES FILAS que importan y un pie de
//     línea con "4 cobradores sin cobros hoy".

import { Tarjeta, BarraAccion, BotonPrimario, BotonSecundario, Chip } from '@/components/cf/primitivos'

// ⚠️ CAJA ES PANTALLA DE NAVEGACIÓN: lleva pastilla. Y `02-ARMAZON.md` §E dice
// que la barra de acción anclada ocupa el sitio de la pastilla SOLO CUANDO LA
// PASTILLA NO ESTÁ. Las dos no caben: son el mismo hueco.
//
// El render del handoff dibuja "Registrar gasto · Cerrar el día" ancladas abajo,
// pero ese mismo documento pone caja en la fila "pastilla: sí". Gana la tabla
// normativa, igual que en el caso de la barra de 76px.
//
// Así que las acciones bajan al contenido, y van JUSTO DEBAJO DEL SALDO —no al
// final del scroll— porque cerrar el día es lo que uno hace con esa cifra, y
// enterrarlas tras la lista de movimientos sería esconder la razón de entrar.

const ORO = '#E7A400'

/* Rótulo de sección con FILETE que estira, y opcionalmente una cifra al final.
   Es el mismo de T12-01 —«Las 6 cuotas ——— total $1.699.999»— y el de T06-02
   —«Ya entregaron ——— $224.000»—: la raya ata el título al grupo que encabeza y el
   valor al final es la contrapartida que se lee de paso.

   Va sobre el fondo, no dentro de una tarjeta: metido en la tarjeta se lee como
   una fila más del contenido. */
function Rotulo({ children, filete = false, valor, tonoValor }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 'none', padding: '0 2px' }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
        textTransform: 'uppercase', color: 'var(--cf-ink-3)', flex: 'none',
      }}>{children}</span>
      {filete && <span aria-hidden style={{ flex: 1, height: 1, background: 'var(--cf-hairline)' }} />}
      {valor && (
        <span className="cf-num" style={{
          fontSize: 11, fontWeight: 700, flex: 'none',
          color: tonoValor === 'ok' ? 'var(--cf-green-dark)'
            : tonoValor === 'mal' ? 'var(--cf-red-dark)'
            : 'var(--cf-ink-3)',
        }}>{valor}</span>
      )}
    </div>
  )
}

/* ── Extracto ──────────────────────────────────────────────────────────── */

function LineaExtracto({ concepto, valor, signo }) {
  const color = signo === '+' ? 'var(--cf-green-dark)'
              : signo === '−' ? 'var(--cf-red-dark)'
              : 'var(--cf-ink-3)'
  return (
    // SIN separador entre lineas. Los tenia, y la lamina no: un extracto son
    // cinco lineas de UNA MISMA cuenta, y una raya entre cada dos las convierte
    // en cinco cosas distintas. La unica raya es la de ANTES DEL SALDO, y esa si
    // significa algo: cierra la suma.
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flex: 'none' }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--cf-ink-2)' }}>
        {concepto}
      </span>
      <span className="cf-fig" style={{ fontSize: 16, color, flex: 'none' }}>
        {signo && `${signo} `}{valor}
      </span>
    </div>
  )
}

export function CajaDia({
  fecha,
  rangos = [], rangoActivo, onRango,
  baseInicial, cobrado, prestado, gastos, ajustes, saldo,
  movimientos = [], totalMovimientos = 0,
  onDetalle, onVerMovimientos, onGasto, onCerrarDia, onReporte,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--cf-gap-cards)', padding: '8px var(--cf-pad-screen) 16px' }}>

        {/* El encabezado: «Caja», la fecha debajo, y «Reporte» a la derecha.
            Faltaba entero, como en las otras listas: la cabecera del armazon es
            la de navegacion y no lleva titulo.

            LA FECHA IMPORTA MAS AQUI que en las otras pantallas. Esta caja es la
            de UN DIA concreto, y los chips de arriba la cambian: sin la fecha
            escrita, mirando «Ayer» no hay forma de saber que dia se esta
            cuadrando. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 'none' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{
              margin: 0,
              fontFamily: 'var(--font-space-grotesk), system-ui',
              fontSize: 22, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)',
            }}>Caja</h1>
            {fecha && (
              <span className="cf-num" style={{ display: 'block', fontSize: 13, color: 'var(--cf-ink-3)', marginTop: 2 }}>
                {fecha}
              </span>
            )}
          </div>
          {onReporte && (
            <button type="button" onClick={onReporte} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, flex: 'none',
              height: 42, padding: '0 15px', borderRadius: 'var(--cf-r-control)',
              background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
              fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)', cursor: 'pointer',
              fontFamily: 'var(--font-manrope), system-ui',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h4" />
              </svg>
              Reporte
            </button>
          )}
        </div>

        {rangos.length > 0 && (
          <div style={{ display: 'flex', gap: 'var(--cf-gap-chips)', overflowX: 'auto', flex: 'none', paddingBottom: 2 }}>
            {rangos.map((r) => (
              <Chip key={r.id} chico activo={r.id === rangoActivo} onClick={() => onRango?.(r.id)}>
                {r.nombre}
              </Chip>
            ))}
          </div>
        )}

        {/* Relleno 20 y hueco 13, de la lamina. La tarjeta estandar trae 16/19 y
            gap 12, que esta bien para una tarjeta cualquiera; un extracto de
            cinco lineas necesita algo mas de aire o las cifras se apelotonan. */}
        <Tarjeta style={{ padding: 20, gap: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
              Cómo se arma el saldo
            </span>
            {/* Solo si hay a donde ir. Un «Ver detalle» que no abre nada es el
                patron del control muerto, que ya costo cinco esta sesion. */}
            {onDetalle && (
              <button type="button" onClick={onDetalle} style={{
                background: 'none', border: 0, cursor: 'pointer', flex: 'none',
                fontSize: 12, fontWeight: 700, color: 'var(--cf-gold-dark)',
                fontFamily: 'var(--font-manrope), system-ui',
              }}>Ver detalle</button>
            )}
          </div>

          {/* Un extracto: se lee de arriba abajo y el saldo cierra la cuenta.
              OJO: aquí "Prestado" resta de verdad — la plata salió del bolsillo
              hoy. Eso NO contradice "prestar no es una pérdida": esa regla es
              para el patrimonio, y esto es el efectivo del día. Son dos
              preguntas distintas y por eso pueden dar signos distintos. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <LineaExtracto concepto="Base inicial" valor={baseInicial} />
            <LineaExtracto concepto="Cobrado hoy"  valor={cobrado}  signo="+" />
            <LineaExtracto concepto="Prestado hoy" valor={prestado} signo="−" />
            <LineaExtracto concepto="Gastos"       valor={gastos}   signo="−" />
            <LineaExtracto concepto="Ajustes"      valor={ajustes} />
          </div>

          {/* EL SALDO VA SOBRE BLANCO, cerrando el extracto. NO en un bloque
              oscuro: ese era una invencion mia.

              La receta §2 reserva el bloque oscuro para «una cifra que es LA
              RESPUESTA de la pantalla», y aqui el saldo no es una cifra suelta:
              es la ULTIMA LINEA DE UNA CUENTA. Metida en un rectangulo negro se
              sale de la cuenta, y lo que la hace creible es justo verla salir de
              las cinco lineas de arriba.

              La raya de 1.5px es la del subtotal de un extracto hecho a mano:
              mas gruesa que las demas a proposito, porque es la unica que separa
              algo. */}
          <div style={{
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12,
            flex: 'none', paddingTop: 13, borderTop: '1.5px solid rgba(20,20,28,.14)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
                color: 'var(--cf-ink-3)',
              }}>Saldo en caja</span>
              {/* «disponible para prestar» no es decoracion: es la diferencia
                  entre el saldo contable y la plata con la que de verdad se puede
                  salir a la calle hoy. */}
              <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>disponible para prestar</span>
            </div>
            <span className="cf-fig" style={{
              fontSize: 30, letterSpacing: '-.03em', color: 'var(--cf-ink)', flex: 'none',
            }}>{saldo}</span>
          </div>
        </Tarjeta>

        {/* Las acciones. `flex: 1.3` en la primaria es de la lamina: con las dos
            al mismo ancho, «cerrar el dia» y «registrar gasto» pesan igual, y no
            pesan igual — una cierra la jornada. */}
        {(onGasto || onCerrarDia) && (
          <div style={{ display: 'flex', gap: 10, flex: 'none' }}>
            {onGasto && <BotonSecundario style={{ flex: 1 }} onClick={onGasto}>Registrar gasto</BotonSecundario>}
            {onCerrarDia && <BotonPrimario style={{ flex: 1.3 }} onClick={onCerrarDia}>Cerrar el día</BotonPrimario>}
          </div>
        )}

        {/* Estaban detrás de un desplegable de cobradores. Con quién y a qué
            hora, un movimiento se puede reclamar; sin eso, solo se puede creer. */}
        <Tarjeta plana>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '17px 20px 13px', flex: 'none' }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
              Movimientos de hoy
            </span>
            <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)', flex: 'none' }}>
              {totalMovimientos}
            </span>
          </div>

          {movimientos.map((m, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 13, flex: 'none',
              padding: '13px 20px', borderTop: '1px solid var(--cf-hairline)',
            }}>
              {/* EL PUNTO DE COLOR, que faltaba. Dice si el movimiento suma o
                  resta ANTES de leer el monto, y con catorce filas eso es la
                  diferencia entre recorrer la lista y leerla. El signo del monto
                  lo repite, y esta bien que lo repita: el punto se ve de lejos y
                  el signo confirma de cerca. */}
              <span aria-hidden style={{
                width: 7, height: 7, borderRadius: 999, flex: 'none',
                background: m.entra ? 'var(--cf-green)' : 'var(--cf-red)',
              }} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{
                  fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{m.concepto}</span>
                <span className="cf-num" style={{
                  fontSize: 12, color: 'var(--cf-ink-3)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{m.detalle}</span>
              </div>
              <span className="cf-fig" style={{
                fontSize: 15, flex: 'none',
                color: m.entra ? 'var(--cf-green-dark)' : 'var(--cf-red-dark)',
              }}>{m.entra ? '+' : '−'}{m.monto}</span>
            </div>
          ))}

          {/* El pie va SIEMPRE que haya movimientos, no solo cuando hay mas de
              los que caben. La lamina lo pone con dos filas visibles y catorce en
              total, y el sentido es «aqui esta el resto»; pero incluso con dos de
              dos, el extracto completo del dia es otra pantalla —con sus filtros
              y su exportacion— y desde aqui hay que poder llegar. */}
          {movimientos.length > 0 && (
            <button type="button" onClick={onVerMovimientos} style={{
              display: 'block', width: '100%', padding: '13px 20px', cursor: 'pointer',
              background: 'none', border: 0, borderTop: '1px solid var(--cf-hairline)',
              fontSize: 13, fontWeight: 700, color: 'var(--cf-gold-dark)', textAlign: 'center',
              fontFamily: 'var(--font-manrope), system-ui',
            }}>Ver los {totalMovimientos} movimientos</button>
          )}
        </Tarjeta>

        {/* El contenido pasa POR DEBAJO de la pastilla a propósito, pero ningún
            texto puede quedar a medio tapar. */}
        <span style={{ height: 92, flex: 'none' }} />
      </div>
    </div>
  )
}

/* ══ T06-02 · Cierre de cobradores ═════════════════════════════════════════
   «ADIÓS A LAS CARITAS.» El pie de la lámina:

     «Nueve tarjetas con emoji se vuelven tres filas que importan y un pie de
      línea con "4 cobradores sin cobros hoy". Arriba, la única cifra que el dueño
      busca a esa hora: cuánta plata falta que le entreguen. Los que no cobraron no
      merecen 200px cada uno.»

   Todo el diseño está en esa última frase. La pantalla de hoy le da el mismo
   espacio al que trajo $118.300 que al que no salió, y a las siete de la noche el
   dueño solo quiere saber una cosa: cuánto falta por entrar y quién lo tiene.

   TRES NIVELES DE ESPACIO, y cada uno dice cuánto importa:

     pendientes    fila de 15/18 con avatar de 38 y ANILLO DORADO. Es plata que
                   está en la calle: el anillo es el mismo que marca la cuota que
                   toca en la tabla, y significa lo mismo — esto es lo que sigue
                   abierto.
     ya entregaron fila más baja, check verde de 30, monto en gris. Está resuelto,
                   así que se lee y se pasa.
     sin cobros    UNA LÍNEA al pie de la tarjeta, sin nombres. Que Fulano no
                   cobrara hoy no es un hecho de la caja.

   Y el botón lleva NOMBRE Y CIFRA —«Recibir de Pepito · $61.500»—: a esa hora hay
   tres personas esperando y «Recibir» a secas no dice de cuál. */
export function CierreCobradores({
  fecha,
  faltaEntregar, pastillaFaltan,
  pendientes = [], yaEntregaron = [], totalEntregado,
  sinCobros = 0, onRecibir,
}) {
  const primero = pendientes[0]

  return (
    <>
      {/* La única cifra que el dueño busca a las siete de la noche. Va en tarjeta
          blanca y no en bloque oscuro: el oscuro de esta familia es para el «antes →
          después», y aquí no hay comparación, hay un saldo. */}
      <div style={{
        flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
        borderRadius: 'var(--cf-r-card)', padding: '18px 20px',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12,
      }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
            textTransform: 'uppercase', color: 'var(--cf-ink-3)',
          }}>Falta que te entreguen</span>
          <span className="cf-fig" style={{
            fontSize: 30, fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1, color: 'var(--cf-ink)',
          }}>{faltaEntregar}</span>
        </span>
        {/* «3 de 9» a secas, debajo de «falta que te entreguen», se puede leer como
            «3 ya entregaron». El verbo lo desambigua y cuesta una palabra. */}
        {pastillaFaltan && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', height: 26, padding: '0 11px',
            borderRadius: 11, flex: 'none',
            background: 'var(--cf-gold-bg)', border: '1px solid var(--cf-gold-border)',
            fontSize: 12, fontWeight: 700, color: 'var(--cf-gold-text-2)',
          }} className="cf-num">{pastillaFaltan}</span>
        )}
      </div>

      {pendientes.length > 0 && (
        <>
          <Rotulo filete>Pendientes de cierre</Rotulo>
          <div style={{
            flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
            borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
          }}>
            {pendientes.map((p, i) => (
              <button
                key={p.id ?? p.nombre}
                type="button"
                onClick={p.onRecibir ? () => p.onRecibir(p) : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 13, width: '100%',
                  padding: '15px 18px', font: 'inherit', textAlign: 'left',
                  background: 'none', border: 0,
                  borderTop: i === 0 ? 'none' : '1px solid var(--cf-hairline)',
                  cursor: p.onRecibir ? 'pointer' : 'default',
                }}
              >
                {/* ANILLO DORADO de 2px: plata que sigue en la calle. Es el mismo
                    anillo que marca la cuota que toca, y significa lo mismo. */}
                <span aria-hidden style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 38, height: 38, borderRadius: 999, flex: 'none',
                  background: 'var(--cf-fill)', border: `2px solid ${ORO}`,
                  fontSize: 13, fontWeight: 700, color: 'var(--cf-ink-2)',
                }}>{p.iniciales}</span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{
                    fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{p.nombre}</span>
                  {/* «Ruta 2 · 4 cobros · terminó 18:38». La hora de fin es lo que
                      distingue al que ya acabó y no ha entregado del que sigue en la
                      calle, y son dos conversaciones distintas. */}
                  <span className="cf-num" style={{
                    fontSize: 12, color: 'var(--cf-ink-3)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{p.detalle}</span>
                </span>
                <span className="cf-fig" style={{ fontSize: 17, fontWeight: 600, color: 'var(--cf-ink)', flex: 'none' }}>
                  {p.monto}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {(yaEntregaron.length > 0 || sinCobros > 0) && (
        <>
          {/* El total de lo entregado va EN EL RÓTULO y en verde. Es la contrapartida
              de la cifra de arriba: cuánto ya entró. En su propia tarjeta ocuparía
              una fila entera para un número que se lee de paso. */}
          <Rotulo filete valor={totalEntregado} tonoValor="ok">Ya entregaron</Rotulo>
          <div style={{
            flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
            borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
          }}>
            {yaEntregaron.map((p, i) => (
              <div key={p.id ?? p.nombre} style={{
                display: 'flex', alignItems: 'center', gap: 13,
                padding: '14px 18px',
                borderTop: i === 0 ? 'none' : '1px solid var(--cf-hairline)',
              }}>
                <span aria-hidden style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 30, height: 30, borderRadius: 999, flex: 'none',
                  background: 'var(--cf-green-pill-bg)',
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cf-green)"
                       strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span style={{
                  flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{p.nombre}</span>
                {/* El monto en GRIS: está resuelto, no compite con los pendientes. */}
                <span className="cf-fig" style={{ fontSize: 15, fontWeight: 600, color: 'var(--cf-ink-3)', flex: 'none' }}>
                  {p.monto}
                </span>
              </div>
            ))}

            {/* UNA LÍNEA, sin nombres. Que Fulano no cobrara hoy no es un hecho de la
                caja, y nueve tarjetas con carita son 1.800px de nada. */}
            {sinCobros > 0 && (
              <div style={{
                padding: '13px 18px', textAlign: 'center',
                borderTop: yaEntregaron.length > 0 ? '1px solid var(--cf-hairline)' : 'none',
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cf-ink-3)' }}>
                  {sinCobros} {sinCobros === 1 ? 'cobrador' : 'cobradores'} sin cobros hoy
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}

/** El pie de T06-02: recibir del PRIMER pendiente, con su nombre y su cifra. A esa
    hora hay tres personas esperando y «Recibir» a secas no dice de cuál. */
export function PieCierreCobradores({ pendiente, onRecibir, recibiendo = false, error }) {
  if (!pendiente) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, width: '100%' }}>
      {error && (
        <span role="alert" style={{ fontSize: 13, color: 'var(--cf-red-dark)', textAlign: 'center' }}>
          {error}
        </span>
      )}
      <button type="button" onClick={() => onRecibir?.(pendiente)} disabled={recibiendo} style={{
        width: '100%', height: 50, border: 'none', borderRadius: 14,
        background: ORO, color: 'var(--cf-gold-ink)', font: 'inherit',
        fontSize: 15, fontWeight: 700,
        cursor: recibiendo ? 'progress' : 'pointer', opacity: recibiendo ? 0.6 : 1,
      }}>
        {recibiendo ? 'Recibiendo…' : `Recibir de ${pendiente.nombre} · ${pendiente.monto}`}
      </button>
    </div>
  )
}

/* ══ T06-03 · Tu dinero ════════════════════════════════════════════════════
   El pie de la lámina dice qué estaba mal:

     «Hoy "Tu patrimonio" es una cifra sola con un botón dorado de "Ajustar saldo
      general" debajo — LA ACCIÓN MÁS PELIGROSA DE LA APP, EN EL SITIO MÁS
      VISIBLE. Aquí el patrimonio se abre en caja / calle / riesgo, aparece la
      ganancia del mes con su tendencia, y ajustar el saldo baja a una fila
      discreta con su explicación.»

   Tres cambios, y el tercero es el importante: ajustar el saldo general reescribe
   la caja a mano. Ponerlo en dorado debajo de la cifra grande lo convierte en el
   siguiente paso natural, cuando debería ser el último recurso.

   ── LA TARJETA DORADA ────────────────────────────────────────────────────

   Es el único sitio del sistema donde el dorado es EL FONDO y no un acento. Se lo
   gana: es la cifra que resume el negocio entero. Todo lo que va encima usa la
   tinta oscura sobre dorado —`#3A2900` para las cifras, `#7A5800` para los
   rótulos—, nunca blanco: sobre este dorado el blanco no se lee.

   Y se abre en TRES: en caja, en la calle, en riesgo. Un patrimonio de $27M sin
   ese desglose no dice si el dueño está líquido o si lo tiene todo prestado, que
   es la diferencia entre poder prestar mañana y no poder.

   ── LA GANANCIA ES INTERÉS COBRADO MENOS GASTOS ──────────────────────────

   NUNCA recaudado menos gastos. El recaudado incluye el capital que vuelve, que
   no es ganancia: es la plata que ya era tuya. Confundirlos infló las analíticas
   7,9 veces y escondió negocios que estaban en pérdida. La lámina lo hace bien
   —$1.877.000 de intereses menos $35.000 de gastos son los $1.842.000 de arriba—
   y las dos líneas de abajo están para que la cuenta se pueda comprobar a ojo. */
export function TuDinero({
  patrimonio, enCaja, enCalle, enRiesgo,
  gananciaEtiqueta, ganancia, tendencia, tendenciaTono = 'ok', meses = [],
  interesesCobrados, gastosDelMes,
  onAjustar,
}) {
  const maximo = Math.max(...meses.map((m) => Number(m?.valor) || 0), 1)

  return (
    <>
      <div style={{
        flex: 'none', background: ORO, borderRadius: 'var(--cf-r-card)',
        padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.11em',
            textTransform: 'uppercase', color: '#7A5800',
          }}>Patrimonio</span>
          <span className="cf-fig" style={{
            fontSize: 38, fontWeight: 600, letterSpacing: '-.035em', lineHeight: 1, color: '#3A2900',
          }}>{patrimonio}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#7A5800' }}>
            Todo el dinero del negocio
          </span>
        </span>

        {/* Las tres partes, separadas por líneas verticales y no por huecos: son un
            reparto de la cifra de arriba, no tres datos sueltos. */}
        <div style={{
          display: 'flex', gap: 8, paddingTop: 14,
          borderTop: '1px solid rgba(58,41,0,.16)',
        }}>
          {[
            ['En caja', enCaja],
            ['En la calle', enCalle],
            ['En riesgo', enRiesgo],
          ].map(([etiqueta, valor], i) => (
            <span key={etiqueta} style={{ display: 'contents' }}>
              {i > 0 && <span aria-hidden style={{ width: 1, background: 'rgba(58,41,0,.16)', flex: 'none' }} />}
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
                  textTransform: 'uppercase', color: '#7A5800',
                }}>{etiqueta}</span>
                <span className="cf-fig" style={{ fontSize: 16, fontWeight: 600, color: '#3A2900' }}>
                  {valor ?? '—'}
                </span>
              </span>
            </span>
          ))}
        </div>
      </div>

      {ganancia && (
        <div style={{
          flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          borderRadius: 'var(--cf-r-card)', padding: 20,
          display: 'flex', flexDirection: 'column', gap: 15,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
              textTransform: 'uppercase', color: 'var(--cf-ink-3)',
            }}>{gananciaEtiqueta}</span>
            {tendencia && (
              <span style={{
                fontSize: 12, fontWeight: 700, flex: 'none',
                color: tendenciaTono === 'mal' ? 'var(--cf-red-dark)' : 'var(--cf-green-dark)',
              }}>{tendencia}</span>
            )}
          </div>

          <span className="cf-fig" style={{
            fontSize: 30, fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1,
            color: 'var(--cf-green-dark)',
          }}>{ganancia}</span>

          {/* Los meses anteriores en gris y el actual en verde. Sin ejes ni cifras:
              lo que se lee de un vistazo es la FORMA —si viene subiendo o cayendo—,
              y para el número exacto está la cifra de arriba. */}
          {meses.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 56, flex: 'none' }}>
              {meses.map((m, i) => (
                <span
                  key={m.id ?? i}
                  title={m.etiqueta}
                  style={{
                    flex: 1, borderRadius: '4px 4px 0 0',
                    // Mínimo 4%: un mes de cero se vería como un hueco en la fila y
                    // parecería que falta el dato, no que no hubo ganancia.
                    height: `${Math.max(4, ((Number(m.valor) || 0) / maximo) * 100)}%`,
                    background: i === meses.length - 1 ? 'var(--cf-green)' : 'var(--cf-fill-2)',
                  }}
                />
              ))}
            </div>
          )}

          {/* La cuenta, para que se pueda comprobar a ojo: intereses menos gastos. */}
          {interesesCobrados && (
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12,
              paddingTop: 13, borderTop: '1px solid var(--cf-hairline)',
            }}>
              <span style={{ fontSize: 13, color: 'var(--cf-ink-2)' }}>Intereses cobrados</span>
              <span className="cf-fig" style={{ fontSize: 15, fontWeight: 600, color: 'var(--cf-ink)', flex: 'none' }}>
                {interesesCobrados}
              </span>
            </div>
          )}
          {gastosDelMes && (
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--cf-ink-2)' }}>Gastos del mes</span>
              <span className="cf-fig" style={{ fontSize: 15, fontWeight: 600, color: 'var(--cf-red-dark)', flex: 'none' }}>
                − {gastosDelMes}
              </span>
            </div>
          )}
        </div>
      )}

      {/* LA ACCIÓN MÁS PELIGROSA DE LA APP, en una fila discreta y con su
          explicación. Reescribe la caja a mano: en dorado debajo de la cifra grande
          se leía como el siguiente paso natural. */}
      {onAjustar && (
        <button type="button" onClick={onAjustar} style={{
          flex: 'none', display: 'flex', alignItems: 'center', gap: 13, width: '100%',
          padding: '18px 20px', borderRadius: 'var(--cf-r-card)', cursor: 'pointer',
          background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          font: 'inherit', textAlign: 'left',
        }}>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)' }}>
              Ajustar el saldo general
            </span>
            <span style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--cf-ink-3)' }}>
              Si contaste el efectivo y no cuadra
            </span>
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-4)"
               strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      )}
    </>
  )
}
