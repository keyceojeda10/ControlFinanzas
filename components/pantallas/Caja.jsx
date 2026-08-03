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

import { Tarjeta, BarraAccion, BotonPrimario, BotonSecundario, Chip, Pastilla } from '@/components/cf/primitivos'
import { rotulo } from '@/lib/dinero/definiciones'

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

function LineaExtracto({ concepto, valor, signo, sub = false, onTocar }) {
  const color = sub ? 'var(--cf-ink-3)'
              : signo === '+' ? 'var(--cf-green-dark)'
              : signo === '−' ? 'var(--cf-red-dark)'
              : 'var(--cf-ink-3)'
  return (
    // SIN separador entre lineas. Los tenia, y la lamina no: un extracto son
    // cinco lineas de UNA MISMA cuenta, y una raya entre cada dos las convierte
    // en cinco cosas distintas. La unica raya es la de ANTES DEL SALDO, y esa si
    // significa algo: cierra la suma.
    <Renglon onTocar={onTocar}>
      <span style={{
        flex: 1, minWidth: 0,
        fontSize: sub ? 13 : 14,
        paddingLeft: sub ? 14 : 0,
        color: sub ? 'var(--cf-ink-3)' : 'var(--cf-ink-2)',
      }}>
        {concepto}
      </span>
      <span className="cf-fig" style={{ fontSize: sub ? 13 : 16, color, flex: 'none' }}>
        {signo && `${signo} `}{valor}
      </span>
      {onTocar && (
        <span aria-hidden style={{ fontSize: 12, color: 'var(--cf-ink-4)', flex: 'none', marginLeft: -4 }}>?</span>
      )}
    </Renglon>
  )
}

// El renglon es un BOTON solo cuando hay algo que explicar. Un `div` con
// `onClick` no lo alcanza el teclado ni lo anuncia un lector de pantalla, y
// esto es la pantalla del dinero: tiene que poder usarla todo el mundo.
//
// La pista de que se puede tocar es el signo de interrogacion al final del
// renglon. Sin subrayado ni color de enlace: son cinco lineas de UNA cuenta, y
// pintarlas como enlaces las convierte en cinco cosas sueltas.
function Renglon({ onTocar, children }) {
  const caja = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flex: 'none' }
  if (!onTocar) return <div style={caja}>{children}</div>
  return (
    <button type="button" onClick={onTocar} style={{
      ...caja, width: '100%', padding: 0, background: 'none', border: 'none',
      textAlign: 'left', cursor: 'pointer', font: 'inherit',
    }}>{children}</button>
  )
}

export function CajaDia({
  fecha,
  rangos = [], rangoActivo, onRango,
  baseInicial, cobrado, cobradoDigital, prestado, gastos, ajustes, saldo,
  lineas = null,
  onExplicar,
  descuadre = null, onVerDescuadre,
  movimientos = [], totalMovimientos = 0,
  onDetalle, onVerMovimientos, onGasto, onCerrarDia, onReporte,
  // `height: 100%` es para cuando la pantalla ES esta —el area de dentro
  // scrollea sola—. Montada dentro de una pagina que ya scrollea, ese 100%
  // reserva la altura entera y deja un HUECO BLANCO de media pantalla debajo de
  // los movimientos. Ahi va `auto`.
  alto = '100%',
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: alto }}>
      <div style={{
        flex: alto === 'auto' ? 'none' : 1, minHeight: 0,
        overflowY: alto === 'auto' ? 'visible' : 'auto',
        display: 'flex', flexDirection: 'column', gap: 'var(--cf-gap-cards)',
        padding: '8px var(--cf-pad-screen) 16px',
      }}>

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
            {/* ── LAS LÍNEAS VIENEN COMPUESTAS, NO SE ARMAN AQUÍ ──────────
                Cuando las armaba esta pantalla NO sumaban el saldo: «Prestado
                hoy» leía el valor nominal de los préstamos mientras el saldo
                venía del libro, que solo cuenta el efectivo que salió de
                verdad. En pantalla faltaban $693.800 y el aviso confesaba
                $200 — la banda vieja con otra cara.

                `lineasDeLaBanda` las compone desde el MISMO libro que calcula
                el descuadre: o suman, o se dice que no.

                Y solo aparecen las líneas que EXISTEN. Antes se pintaba
                «Correcciones $0» aunque no hubiera ninguna, porque la guarda
                comparaba el texto «$0», que siempre es verdadero. Una línea en
                cero ocupa sitio y sugiere que ahí pasó algo. */}
            {/* `flatMap` y no un Fragment con key: este archivo NO importa
                React, así que `React.Fragment` compilaría y reventaría al abrir
                la pantalla. Devolver un array plano de elementos con su propia
                key hace lo mismo sin depender de nada. */}
            {lineas ? lineas.flatMap((l) => {
              const filas = [
                <LineaExtracto
                  key={l.id}
                  concepto={l.rotulo}
                  valor={l.texto}
                  signo={l.signo === 1 ? '+' : l.signo === -1 ? '−' : undefined}
                  onTocar={onExplicar ? () => onExplicar(l.id) : undefined}
                />,
              ]
              // En qué se cobró. Una caja física no contiene Nequi, y el 12%
              // del recaudo de los negocios grandes entra por transferencia:
              // sin esta línea el fajo de la noche no cuadra nunca y el
              // cobrador carga con un faltante que no es suyo.
              if (l.id === 'recaudo' && cobradoDigital) {
                filas.push(
                  <LineaExtracto
                    key="recaudo-digital" sub
                    concepto="de eso, por transferencia"
                    valor={cobradoDigital}
                    onTocar={onExplicar ? () => onExplicar('recaudoDigital') : undefined}
                  />,
                )
              }
              return filas
            }) : (
              <>
                <LineaExtracto concepto="Base inicial" valor={baseInicial} />
                <LineaExtracto concepto="Cobrado hoy"  valor={cobrado}  signo="+" />
                <LineaExtracto concepto="Prestado hoy" valor={prestado} signo="−" />
                <LineaExtracto concepto="Gastos"       valor={gastos}   signo="−" />
              </>
            )}
          </div>

          {/* ── LO QUE NO CUADRA, DICHO ────────────────────────────────────
              Un cero es una afirmación; un residuo mudo es una mentira. Si el
              libro no coincide consigo mismo, la pantalla lo dice y ofrece
              bajar a los movimientos del día. Medido en el cliente de 10
              cobradores: 53 de 57 días con descuadre, y la banda vieja decía
              «cuadra» todos. */}
          {descuadre ? (
            <button
              type="button"
              onClick={onVerDescuadre}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                marginTop: 14, padding: '12px 14px', borderRadius: 12,
                border: '1px solid color-mix(in srgb, var(--cf-red) 30%, transparent)',
                background: 'color-mix(in srgb, var(--cf-red) 8%, transparent)',
                textAlign: 'left', cursor: onVerDescuadre ? 'pointer' : 'default', flex: 'none',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flex: 'none' }}>
                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  stroke="var(--cf-red-dark)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.4, color: 'var(--cf-red-dark)' }}>
                {descuadre.texto}
              </span>
              {onVerDescuadre && (
                <span className="cf-fig" style={{ fontSize: 13, color: 'var(--cf-red-dark)', flex: 'none' }}>Ver ›</span>
              )}
            </button>
          ) : null}

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

          {/* ── LA CABECERA DE LA TABLA, SOLO SENTADO (T06-05) ──
              El `display` va SOLO en la clase, nunca en línea: una clase
              responsive pierde siempre contra un estilo en línea. */}
          {movimientos.length > 0 && movimientos[0]?.hora && (
            <div
              className="hidden lg:grid"
              style={{
                gridTemplateColumns: '18px 84px 1fr 1fr 110px', gap: 13, flex: 'none',
                alignItems: 'center', padding: '9px 20px',
                borderTop: '1px solid var(--cf-hairline)',
                fontSize: 10, fontWeight: 800, letterSpacing: '.07em',
                textTransform: 'uppercase', color: 'var(--cf-ink-3)',
              }}
            >
              <span />
              <span>Hora</span>
              <span>Concepto</span>
              <span>Cobrador</span>
              <span style={{ textAlign: 'right' }}>Monto</span>
            </div>
          )}

          {movimientos.map((m, i) => (
            <div key={`t${i}`}
              className="hidden lg:grid"
              style={{
                gridTemplateColumns: '18px 84px 1fr 1fr 110px', gap: 13, flex: 'none',
                alignItems: 'center', padding: '12px 20px',
                borderTop: '1px solid var(--cf-hairline)',
              }}
            >
              <span aria-hidden style={{
                width: 7, height: 7, borderRadius: 999,
                background: m.entra ? 'var(--cf-green)' : 'var(--cf-red)',
              }} />
              <span className="cf-num" style={{ fontSize: 12.5, color: 'var(--cf-ink-3)', whiteSpace: 'nowrap' }}>{m.hora ?? '—'}</span>
              <span style={{
                fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{m.concepto}</span>
              <span style={{
                fontSize: 12.5, color: 'var(--cf-ink-3)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{[m.cobrador, m.ruta].filter(Boolean).join(' · ') || '—'}</span>
              <span className="cf-fig" style={{
                fontSize: 15, textAlign: 'right',
                color: m.entra ? 'var(--cf-green-dark)' : 'var(--cf-red-dark)',
              }}>{m.entra ? '+' : '−'}{m.monto}</span>
            </div>
          ))}

          {movimientos.map((m, i) => (
            <div key={i}
              // `flex` en la CLASE, no en línea: con `display:'flex'` inline el
              // `lg:hidden` no puede ganar y la fila de móvil saldría TAMBIÉN en
              // escritorio, debajo de la tabla. Es el mismo fallo que ya me costó
              // tres veces en un día, y por eso hay una prueba que lo caza.
              className="flex lg:hidden"
              style={{
                alignItems: 'center', gap: 13, flex: 'none',
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
            }}>
              {/* Con uno solo decía «Ver los 1 movimientos». Es la primera fila
                  que ve un negocio que arranca, y arrancar leyendo un error de
                  concordancia no ayuda a confiar en las cifras de al lado. */}
              {totalMovimientos === 1 ? 'Ver el movimiento' : `Ver los ${totalMovimientos} movimientos`}
            </button>
          )}
        </Tarjeta>

        {/* El contenido pasa POR DEBAJO de la pastilla a propósito, pero ningún
            texto puede quedar a medio tapar.

            Solo cuando esta ES la pantalla. Incrustada en una página que sigue
            debajo, estos 92px son un agujero blanco en mitad del scroll — que es
            exactamente lo que salió al montarla. */}
        {alto !== 'auto' && <span style={{ height: 92, flex: 'none' }} />}
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
              <span style={{ fontSize: 13, color: 'var(--cf-ink-2)' }}>{rotulo('gastosMes')}</span>
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

/* ══ Las cuatro pestañas de la caja (T20) ══════════════════════════════════
   Caja no es una pantalla, son cuatro: HOY, CUENTAS, CUADRE y CIERRES. Es la
   estructura que las láminas de T20 dan por hecha y que hoy no existe: todo vive
   en una sola página de 1.855 líneas donde el conteo físico, el saldo por cuenta y
   el historial se mezclan con el movimiento del día.

   El grupo va ARRIBA y pegado al título, no flotando en el contenido: es
   navegación, no un filtro. Los filtros de rango —hoy, semana, mes— son otra cosa
   y viven dentro de la pestaña que los necesita. */
export function PestanasCaja({ pestanas = [], activa, onCambiar }) {
  return (
    <div style={{
      display: 'flex', gap: 5, padding: 4, borderRadius: 14, flex: 'none',
      background: 'var(--cf-fill-2)',
    }}>
      {pestanas.map((p) => {
        const on = p.id === activa
        return (
          <button key={p.id} type="button" onClick={() => onCambiar?.(p)} aria-pressed={on} style={{
            flex: 1, minWidth: 0, height: 36, borderRadius: 11, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            font: 'inherit', fontSize: 13, fontWeight: on ? 700 : 600, border: 0,
            color: on ? 'var(--cf-ink)' : 'var(--cf-ink-3)',
            // El activo es una pastilla BLANCA con sombra, no un relleno de color:
            // sobre el gris del carril, el blanco elevado se lee como «estás aquí»
            // sin gastar el dorado, que en esta pantalla hace falta para el dinero.
            background: on ? 'var(--cf-card)' : 'transparent',
            boxShadow: on ? '0 1px 3px rgba(20,20,28,.1)' : 'none',
          }}>{p.etiqueta}</button>
        )
      })}
    </div>
  )
}

/* ══ T20-01 · Cuentas ══════════════════════════════════════════════════════
   El pie de la lámina:

     «La pestaña que hacía falta para que el hallazgo #3 se pueda arreglar: SI
      TODO ENTRA COMO EFECTIVO, EL CONTEO FÍSICO NUNCA CUADRA. Solo el efectivo
      lleva las tres cifras del día y el aviso de 4 días sin contar, porque es el
      único dinero que se puede perder por el camino — Nequi y el banco se
      concilian solos.»

   Ahí está toda la pantalla, y explica por qué el efectivo se trata distinto: no
   es que sea más importante, es que es el único que se puede perder entre la mano
   del cliente y la caja fuerte. Una transferencia o está o no está.

   EL RIEL DE COLOR de 4px a la izquierda de cada tarjeta es lo que ata la fila con
   su tramo de la barra de arriba. Sin él, la barra partida es una decoración: con
   él, el dueño ve que el trozo dorado grande es el efectivo que todavía no ha
   contado. */
export function Cuentas({
  total, tramos = [], cuentas = [], onMover,
}) {
  return (
    <>
      <div style={{
        flex: 'none', background: '#15161A', borderRadius: 'var(--cf-r-card)',
        padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 15,
      }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
            textTransform: 'uppercase', color: '#A3A8B2',
          }}>Tienes en total</span>
          <span className="cf-fig" style={{
            fontSize: 32, fontWeight: 600, letterSpacing: '-.035em', lineHeight: 1, color: '#F3F3F6',
          }}>{total}</span>
        </span>

        {tramos.length > 0 && (
          <>
            <span aria-hidden style={{
              display: 'flex', height: 11, borderRadius: 999, overflow: 'hidden', flex: 'none',
              background: 'rgba(255,255,255,.08)',
            }}>
              {tramos.map((t) => (
                <span key={t.id} style={{ width: `${t.porcentaje}%`, background: t.color, flex: 'none' }} />
              ))}
            </span>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {tramos.map((t) => (
                <span key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 'none' }}>
                  <span aria-hidden style={{ width: 9, height: 9, borderRadius: 3, background: t.color, flex: 'none' }} />
                  <span className="cf-num" style={{ fontSize: 12, color: '#A3A8B2' }}>
                    {t.etiqueta} <strong className="cf-fig" style={{ color: '#F3F3F6' }}>{t.corto}</strong>
                  </span>
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── EN PC, DOS COLUMNAS ──
          Cada cuenta gastaba los 1024px de ancho para un nombre y una cifra, así
          que con cuatro cuentas había que bajar por media pantalla de aire para
          verlas. Dos columnas las dejan de un vistazo, que es lo que se pregunta
          aquí: cuánto hay en cada sitio. */}
      <div className="contents lg:grid lg:grid-cols-2 lg:gap-3">
      {cuentas.map((c) => (
        <div key={c.id} style={{
          flex: 'none', position: 'relative', overflow: 'hidden',
          background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          borderRadius: 'var(--cf-r-card)', padding: '17px 19px',
          display: 'flex', flexDirection: 'column', gap: 13,
        }}>
          {/* El riel que ata la tarjeta con su tramo de la barra. */}
          <span aria-hidden style={{
            position: 'absolute', left: 0, top: 16, bottom: 16, width: 4,
            borderRadius: 999, background: c.color,
          }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span aria-hidden style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 38, height: 38, borderRadius: 11, flex: 'none',
              background: c.fondoIcono ?? 'var(--cf-fill)',
              fontSize: 14, fontWeight: 700, color: c.colorIcono ?? 'var(--cf-ink-2)',
            }}>{c.inicial}</span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{
                fontSize: 16, fontWeight: 700, color: 'var(--cf-ink)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{c.nombre}</span>
              {c.detalle && (
                <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{c.detalle}</span>
              )}
            </span>
            <span className="cf-fig" style={{
              fontSize: 20, fontWeight: 600, letterSpacing: '-.025em', color: 'var(--cf-ink)', flex: 'none',
            }}>{c.saldo}</span>
          </div>

          {/* Las tres cifras del día SOLO en efectivo. Nequi y el banco se concilian
              solos: enseñarles «entró / salió / sin contar» sería inventar una
              vigilancia que no hace falta y quitarle peso a la que sí. */}
          {c.movimiento && (
            <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--cf-hairline)' }}>
              {[
                ['Entró hoy', c.movimiento.entro, 'var(--cf-green-dark)'],
                ['Salió hoy', c.movimiento.salio, 'var(--cf-red-dark)'],
                ['Sin contar', c.movimiento.sinContar, 'var(--cf-gold-text-2)'],
              ].map(([etiqueta, valor, color], i) => (
                <span key={etiqueta} style={{ display: 'contents' }}>
                  {i > 0 && <span aria-hidden style={{ width: 1, background: 'var(--cf-hairline)', flex: 'none' }} />}
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
                      textTransform: 'uppercase', color: 'var(--cf-ink-3)',
                    }}>{etiqueta}</span>
                    <span className="cf-fig" style={{ fontSize: 14, fontWeight: 600, color }}>
                      {valor ?? '—'}
                    </span>
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
      </div>

      {/* «Mover plata» cubre el gesto real de consignar lo recogido: el cobrador
          trae efectivo y el dueño lo mete al banco. Sin esta acción, el efectivo
          crece en la app para siempre y el conteo nunca cuadra. */}
      {onMover && (
        <button type="button" onClick={onMover} style={{
          flex: 'none', display: 'flex', alignItems: 'center', gap: 13, width: '100%',
          padding: '17px 19px', borderRadius: 'var(--cf-r-card)', cursor: 'pointer',
          background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          font: 'inherit', textAlign: 'left',
        }}>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)' }}>Mover plata</span>
            <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>
              Consignar el efectivo o sacar del banco
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

/* ══ T20-02 · Cuadre ═══════════════════════════════════════════════════════
   El pie:

     «Cuentas los billetes, escribes el número y la app hace la resta. LO QUE LA
      VUELVE ÚTIL ES LO QUE PASA DESPUÉS: en vez de un "no cuadra", la app
      reconoce la cifra —$35.000 es exactamente la gasolina de la mañana— y ofrece
      las tres causas reales en orden de probabilidad. Cerrar con faltante se
      puede, pero queda en texto: EL FALTANTE SIN EXPLICAR ES CÓMO SE PIERDE PLATA
      SIN DARSE CUENTA.»

   El reconocimiento es la pantalla entera. «No cuadra» es un callejón; «justo lo
   que costó la gasolina de esta mañana» es una pista. Y por eso la sospecha se
   compone ARRIBA, con los datos del día, y no aquí: esta pieza solo la pinta. */
export function Cuadre({
  segunLaApp, contado, onContado,
  diferencia, onCausa, causas = [],
}) {
  return (
    <>
      <div style={{
        flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
        borderRadius: 'var(--cf-r-card)', padding: '18px 20px',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
            textTransform: 'uppercase', color: 'var(--cf-ink-3)',
          }}>La app dice que tienes</span>
          <span className="cf-fig" style={{
            fontSize: 26, fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1, color: 'var(--cf-ink)',
          }}>{segunLaApp}</span>
        </span>
      </div>

      <div style={{
        flex: 'none', background: 'var(--cf-card)', borderRadius: 'var(--cf-r-card)',
        border: `1.5px solid ${ORO}`, boxShadow: '0 0 0 3px rgba(231,164,0,.13)',
        padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
          textTransform: 'uppercase', color: 'var(--cf-ink-3)',
        }}>Cuenta lo que tienes de verdad</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ fontSize: 23, fontWeight: 600, color: 'var(--cf-ink-3)', flex: 'none' }}>$</span>
          <input
            value={contado ?? ''}
            onChange={(e) => onContado?.(e.target.value)}
            type="text" inputMode="decimal" autoComplete="off"
            aria-label="Cuenta lo que tienes de verdad"
            className="cf-fig"
            style={{
              flex: 1, minWidth: 0, border: 0, background: 'none', padding: 0,
              outline: 'none', font: 'inherit',
              fontFamily: 'var(--font-space-grotesk), system-ui',
              fontSize: 38, fontWeight: 600, letterSpacing: '-.035em', lineHeight: 1,
              color: 'var(--cf-ink)',
            }}
          />
        </div>
      </div>

      {/* LA DIFERENCIA, con su sospecha. En rojo si falta, en ámbar si sobra: sobrar
          también es un descuadre —un cobro sin anotar— pero no es una pérdida, así
          que no se pinta como tal. */}
      {diferencia && (
        <div style={{
          flex: 'none', borderRadius: 'var(--cf-r-card)', padding: '18px 20px',
          display: 'flex', flexDirection: 'column', gap: 13,
          background: diferencia.tono === 'sobra' ? 'var(--cf-gold-bg)' : 'var(--cf-red-bg)',
          border: `1px solid ${diferencia.tono === 'sobra' ? 'var(--cf-gold-border)' : 'var(--cf-red-border)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
                color: diferencia.tono === 'sobra' ? 'var(--cf-gold-text-2)' : 'var(--cf-red-darker)',
              }}>{diferencia.etiqueta}</span>
              <span className="cf-fig" style={{
                fontSize: 30, fontWeight: 600, letterSpacing: '-.035em', lineHeight: 1,
                color: diferencia.tono === 'sobra' ? 'var(--cf-gold-text-2)' : 'var(--cf-red-dark)',
              }}>{diferencia.monto}</span>
            </span>
            {diferencia.proporcion && (
              <span style={{
                fontSize: 12, flex: 'none',
                color: diferencia.tono === 'sobra' ? 'var(--cf-gold-text-2)' : 'var(--cf-red-darker)',
              }}>{diferencia.proporcion}</span>
            )}
          </div>
          {/* LA PISTA. «No cuadra» es un callejón; «justo lo que costó la gasolina de
              esta mañana» es por dónde empezar a buscar. */}
          {diferencia.sospecha && (
            <span style={{
              fontSize: 13, lineHeight: 1.5,
              color: diferencia.tono === 'sobra' ? 'var(--cf-gold-text-2)' : 'var(--cf-red-darker)',
            }}>{diferencia.sospecha}</span>
          )}
        </div>
      )}

      {causas.length > 0 && (
        <>
          <Rotulo>Puede ser esto</Rotulo>
          <div style={{
            flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
            borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
          }}>
            {causas.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onCausa?.(c)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 13, width: '100%',
                  padding: '15px 18px', font: 'inherit', textAlign: 'left',
                  background: 'none', border: 0,
                  borderTop: i === 0 ? 'none' : '1px solid var(--cf-hairline)',
                  cursor: 'pointer',
                }}
              >
                <span aria-hidden style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, borderRadius: 999, flex: 'none',
                  background: i === 0 ? 'var(--cf-gold-tint)' : 'var(--cf-fill)',
                  fontSize: 13, fontWeight: 700,
                  color: i === 0 ? 'var(--cf-gold-dark)' : 'var(--cf-ink-3)',
                }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)' }}>{c.titulo}</span>
                  {c.nota && <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{c.nota}</span>}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cf-gold-dark)', flex: 'none' }}>
                  {c.accion}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}

/* ══ T20-03 · Historial de cierres ═════════════════════════════════════════
   El pie de la lámina, que es el diseño entero:

     «UNA LISTA DE DÍAS NO SIRVE DE NADA; LO QUE SIRVE ES EL PATRÓN. Por eso
      arriba están las tres cifras del mes y abajo la línea que hace el trabajo:
      los cuatro descuadres son de la misma ruta. Eso ningún dueño lo ve revisando
      cierres uno por uno, y es la diferencia entre sospechar de alguien y saber
      qué revisar. "Sobró" también es un descuadre — un cobro sin anotar.»

   Así que la lista es lo de menos: lo que justifica la pantalla es el AVISO DEL
   FINAL. Un dueño puede mirar veintidós cierres y no ver que cuatro son del mismo
   cobrador; la app sí, y decirlo es la diferencia entre desconfiar de todos y
   saber dónde mirar.

   El riel de color repite el criterio de T20-01: verde cuadró, rojo faltó, ámbar
   sobró. Y sobrar NO es bueno — es un cobro que no se anotó—, así que va en ámbar
   y no en verde: verde es «esto está bien», y esto no lo está.

   El aviso solo aparece cuando HAY patrón. Un aviso que sale siempre deja de
   leerse, y «los descuadres están repartidos» no es un hallazgo. */
export function HistorialCierres({
  resumen = [], cierres = [], hallazgo,
}) {
  return (
    <>
      {resumen.length > 0 && (
        <div style={{
          flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          borderRadius: 'var(--cf-r-card)', padding: '17px 19px', display: 'flex', gap: 8,
        }}>
          {resumen.map((r, i) => (
            <span key={r.etiqueta} style={{ display: 'contents' }}>
              {i > 0 && <span aria-hidden style={{ width: 1, background: 'var(--cf-hairline)', flex: 'none' }} />}
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
                  textTransform: 'uppercase', color: 'var(--cf-ink-3)',
                }}>{r.etiqueta}</span>
                <span className="cf-fig" style={{
                  fontSize: 17, fontWeight: 600,
                  color: r.tono === 'ok' ? 'var(--cf-green-dark)'
                    : r.tono === 'mal' ? 'var(--cf-red-dark)'
                    : 'var(--cf-ink)',
                }}>{r.valor}</span>
              </span>
            </span>
          ))}
        </div>
      )}

      {cierres.map((c) => {
        const color = c.estado === 'cuadro' ? 'var(--cf-green)'
          : c.estado === 'sobro' ? ORO
          : 'var(--cf-red)'
        return (
          <button
            key={c.id}
            type="button"
            onClick={c.onAbrir}
            style={{
              flex: 'none', position: 'relative', overflow: 'hidden', width: '100%',
              background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
              borderRadius: 'var(--cf-r-card)', padding: '16px 18px',
              display: 'flex', alignItems: 'center', gap: 13,
              font: 'inherit', textAlign: 'left', cursor: c.onAbrir ? 'pointer' : 'default',
            }}
          >
            <span aria-hidden style={{
              position: 'absolute', left: 0, top: 15, bottom: 15, width: 4,
              borderRadius: 999, background: color,
            }} />
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{
                  fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{c.dia}</span>
                {c.pastilla && (
                  <Pastilla
                    tono={c.estado === 'cuadro' ? 'aldia' : c.estado === 'sobro' ? 'atraso' : 'mora'}
                    style={{ height: 20, fontSize: 11, flex: 'none' }}
                  >{c.pastilla}</Pastilla>
                )}
              </span>
              <span className="cf-num" style={{
                fontSize: 12, color: 'var(--cf-ink-3)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{c.detalle}</span>
            </span>
            {c.diferencia && (
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end', flex: 'none' }}>
                <span className="cf-fig" style={{
                  fontSize: 17, fontWeight: 600,
                  color: c.estado === 'sobro' ? 'var(--cf-gold-text-2)' : 'var(--cf-red-dark)',
                }}>{c.diferencia}</span>
                {/* «Sin explicar» es la mitad del dato: un faltante con motivo es un
                    gasto que no se anotó; sin motivo es plata que se fue. */}
                {c.nota && (
                  <span style={{ fontSize: 11, color: 'var(--cf-ink-3)' }}>{c.nota}</span>
                )}
              </span>
            )}
          </button>
        )
      })}

      {/* EL HALLAZGO. Es lo que justifica la pantalla: un dueño puede mirar
          veintidós cierres y no ver que cuatro son del mismo cobrador. */}
      {hallazgo && (
        <div style={{
          flex: 'none', display: 'flex', gap: 10, alignItems: 'flex-start',
          padding: '15px 17px', borderRadius: 'var(--cf-r-card-sm)',
          background: 'var(--cf-gold-bg)', border: '1px solid var(--cf-gold-border)',
        }}>
          <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--cf-gold-text-2)' }}>
            {hallazgo}
          </span>
        </div>
      )}
    </>
  )
}

/* ══ T33-03 · El mes en caja ═══════════════════════════════════════════════
   El cierre mensual que faltaba. NO REPITE EL DIARIO: responde tres preguntas que
   solo tienen sentido con el mes entero delante.

     1 · cuánto pasó por mis manos, y en qué forma
     2 · cuántos días cuadraron
     3 · en qué se gastó

   Y trae dos cosas que solo aparecen al ver el mes completo:

   EL HALLAZGO SUBE AQUÍ CON SU PESO. En el historial de cierres es un aviso ámbar
   al final de una lista; aquí es una tarjeta roja con nombre y apellido, porque
   cuatro faltantes de la misma ruta en un mes ya no es una casualidad.

   Y LA LECTURA DE LOS GASTOS, que es la más útil de la pantalla y la que ningún
   informe da: «un mes de $8,8M con $10.000 de gastos quiere decir que la gasolina
   y los almuerzos no se registran, así que la ganancia se ve más alta de lo que
   es». Un dueño mirando ese $10.000 piensa que gastó poco. La app sabe que eso es
   imposible y lo dice.

   Esa frase se compone FUERA, con la proporción real: escribirla fija aquí sería
   afirmar lo mismo en un negocio que sí registra sus gastos. */
export function MesEnCaja({
  paso, formas = [], tramosFormas = [],
  diasEtiqueta, dias = [], faltanteEtiqueta, faltanteValor,
  hallazgoTitulo, hallazgoDetalle,
  gastosTotal, gastos = [], lecturaGastos,
}) {
  return (
    <>
      <div style={{
        flex: 'none', background: '#15161A', borderRadius: 20,
        padding: '19px 21px', display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
          textTransform: 'uppercase', color: '#A3A8B2',
        }}>Pasó por tus manos</span>
        <span className="cf-fig" style={{
          fontSize: 34, fontWeight: 600, letterSpacing: '-.035em', lineHeight: 1, color: '#F3F3F6',
        }}>{paso}</span>

        {/* EN QUÉ FORMA. Es la pregunta que decide si el conteo físico puede
            cuadrar: la parte de efectivo es la que pasa por manos y se puede
            perder; la digital se concilia sola. */}
        {tramosFormas.length > 0 && (
          <span aria-hidden style={{
            display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', flex: 'none',
            background: 'rgba(255,255,255,.08)',
          }}>
            {tramosFormas.map((t) => (
              <span key={t.id} style={{ width: `${t.porcentaje}%`, background: t.color, flex: 'none' }} />
            ))}
          </span>
        )}
        {formas.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {formas.map((fo) => (
              <div key={fo.id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span aria-hidden style={{ width: 9, height: 9, borderRadius: 3, background: fo.color, flex: 'none' }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#A3A8B2' }}>{fo.etiqueta}</span>
                <span className="cf-fig" style={{
                  fontSize: 14, fontWeight: 600, flex: 'none',
                  color: fo.destacado ? fo.color : '#F3F3F6',
                }}>{fo.valor}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {dias.length > 0 && (
        <div style={{
          flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          borderRadius: 'var(--cf-r-card)', padding: '17px 19px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
            textTransform: 'uppercase', color: 'var(--cf-ink-3)',
          }}>{diasEtiqueta}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {dias.map((d, i) => (
              <span key={d.etiqueta} style={{ display: 'contents' }}>
                {i > 0 && <span aria-hidden style={{ width: 1, background: 'var(--cf-hairline)', flex: 'none' }} />}
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
                    textTransform: 'uppercase', color: 'var(--cf-ink-3)',
                  }}>{d.etiqueta}</span>
                  <span className="cf-fig" style={{
                    fontSize: 19, fontWeight: 600,
                    color: d.tono === 'ok' ? 'var(--cf-green-dark)'
                      : d.tono === 'mal' ? 'var(--cf-red-dark)'
                      : d.tono === 'aviso' ? 'var(--cf-gold-text-2)'
                      : 'var(--cf-ink)',
                  }}>{d.valor}</span>
                </span>
              </span>
            ))}
          </div>
          {faltanteValor && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 11,
              paddingTop: 12, borderTop: '1px solid var(--cf-hairline)',
            }}>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--cf-ink-2)' }}>{faltanteEtiqueta}</span>
              <span className="cf-fig" style={{ fontSize: 16, fontWeight: 600, color: 'var(--cf-red-dark)', flex: 'none' }}>
                {faltanteValor}
              </span>
            </div>
          )}
        </div>
      )}

      {/* EL HALLAZGO, con más peso que en el historial: allí es un aviso ámbar al
          final de una lista, aquí es rojo y con nombre. Cuatro faltantes de la misma
          ruta en un mes ya no es casualidad. */}
      {hallazgoTitulo && (
        <div style={{
          flex: 'none', display: 'flex', gap: 11, alignItems: 'flex-start',
          padding: '15px 17px', borderRadius: 'var(--cf-r-card)',
          background: 'var(--cf-red-bg)', border: '1px solid var(--cf-red-border)',
        }}>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--cf-red-darker)' }}>
              {hallazgoTitulo}
            </span>
            {hallazgoDetalle && (
              <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--cf-red-darker)' }}>
                {hallazgoDetalle}
              </span>
            )}
          </span>
        </div>
      )}

      {gastos.length > 0 && (
        <div style={{
          flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 10, padding: '15px 19px 11px', flex: 'none',
          }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
              textTransform: 'uppercase', color: 'var(--cf-ink-3)',
            }}>En qué se gastó</span>
            <span className="cf-fig" style={{ fontSize: 14, fontWeight: 600, color: 'var(--cf-red-dark)', flex: 'none' }}>
              {gastosTotal}
            </span>
          </div>

          {gastos.map((g) => (
            <div key={g.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 19px', borderTop: '1px solid var(--cf-hairline)',
            }}>
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--cf-red)', flex: 'none' }} />
              <span style={{
                flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{g.concepto}</span>
              <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)', flex: 'none' }}>
                {g.veces}
              </span>
              <span className="cf-fig" style={{ fontSize: 14, fontWeight: 600, color: 'var(--cf-red-dark)', flex: 'none' }}>
                {g.monto}
              </span>
            </div>
          ))}

          {/* LA LECTURA. Es lo más útil de la pantalla y lo que ningún informe da:
              un dueño mirando $10.000 de gastos piensa que gastó poco; la app sabe
              que sobre $8,8M eso es imposible y lo dice. */}
          {lecturaGastos && (
            <div style={{ padding: '16px 19px', borderTop: '1px solid var(--cf-hairline)' }}>
              <span style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--cf-ink-2)' }}>
                {lecturaGastos}
              </span>
            </div>
          )}
        </div>
      )}
    </>
  )
}

/* ══ T33-02 · Bajar información ════════════════════════════════════════════
   El pie de la lámina, con las cuatro decisiones:

     «Las descargas están al fondo de Reportes, después de todo el scroll, CON LOS
      FILTROS DE "QUIÉN ME DEBE" SUELTOS Y SIN RESULTADO VISIBLE: se elige ruta,
      orden y mora SIN SABER CUÁNTOS CLIENTES VAN A SALIR. Aquí los filtros van
      dentro de su tarjeta y encima del botón, con la cuenta hecha: 18 clientes ·
      $16.2M. Y como el destinatario suele ser el contador por WhatsApp, "MANDAR"
      ESTÁ AL LADO DE "BAJAR". Cada Excel dice cuántas filas trae — si dice 0,
      mejor saberlo antes de abrirlo.»

   LA CUENTA ANTES DE BAJAR es lo que arregla el problema real: un informe que sale
   vacío se descubre al abrirlo, ya fuera de la app, y para entonces el dueño ya
   cambió de pantalla. «Van a salir 18 clientes · $16.2M» convierte tres filtros a
   ciegas en una decisión.

   Y «MANDAR» AL LADO DE «BAJAR» porque el destinatario casi nunca es uno mismo: es
   el contador, por WhatsApp. Bajar y luego buscar el archivo para compartirlo son
   dos pasos que sobran.

   Los filtros van DENTRO de la tarjeta que descargan. Sueltos arriba parecían
   filtros de la pantalla, y el dueño no sabía a cuál de los tres informes
   aplicaban. */
export function BajarInformacion({ informes = [], crudos = [], crudosTitulo, crudosNota }) {
  return (
    <>
      {informes.map((inf) => {
        const destacado = Boolean(inf.filtros?.length || inf.cuenta)
        return (
          <div
            key={inf.id}
            style={{
              flex: 'none', background: 'var(--cf-card)', borderRadius: 'var(--cf-r-card)',
              padding: '17px 19px', display: 'flex', flexDirection: 'column', gap: 13,
              // Solo el informe que TIENE filtros lleva el anillo: es el único donde
              // hay algo que decidir antes de pulsar.
              border: destacado ? `1.5px solid ${ORO}` : '1px solid var(--cf-border)',
              boxShadow: destacado ? '0 0 0 3px rgba(231,164,0,.13)' : 'none',
            }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)' }}>{inf.titulo}</span>
              <span style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--cf-ink-3)' }}>{inf.nota}</span>
            </span>

            {inf.filtros?.length > 0 && (
              <div style={{ display: 'flex', gap: 8 }}>
                {inf.filtros.map((fi) => (
                  <button key={fi.id} type="button" onClick={fi.onCambiar} style={{
                    flex: 1, minWidth: 0, height: 44, padding: '0 13px', borderRadius: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    background: 'var(--cf-fill)', border: '1px solid var(--cf-border)',
                    font: 'inherit', cursor: 'pointer',
                  }}>
                    <span style={{
                      flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: 'var(--cf-ink-2)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left',
                    }}>{fi.valor}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-4)"
                         strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                ))}
              </div>
            )}

            {inf.interruptor && (
              <button
                type="button"
                onClick={() => inf.interruptor.onCambiar?.(!inf.interruptor.activo)}
                aria-pressed={inf.interruptor.activo}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  border: 0, background: 'none', padding: 0, cursor: 'pointer',
                  font: 'inherit', textAlign: 'left',
                }}
              >
                <span aria-hidden style={{
                  width: 44, height: 26, borderRadius: 999, flex: 'none', position: 'relative',
                  background: inf.interruptor.activo ? ORO : 'var(--cf-fill-2)',
                  transition: 'background .15s',
                }}>
                  <span style={{
                    position: 'absolute', top: 3, width: 20, height: 20, borderRadius: 999,
                    background: '#FFF', boxShadow: '0 1px 3px rgba(20,20,28,.24)',
                    left: inf.interruptor.activo ? 21 : 3, transition: 'left .15s',
                  }} />
                </span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)' }}>
                  {inf.interruptor.etiqueta}
                </span>
              </button>
            )}

            {/* LA CUENTA HECHA. Es lo que convierte tres filtros a ciegas en una
                decisión: un informe vacío se descubría al abrirlo, ya fuera de la
                app. */}
            {inf.cuenta && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 11,
                padding: '13px 15px', borderRadius: 12,
                background: 'var(--cf-fill-suave, var(--cf-fill))', border: '1px solid var(--cf-hairline)',
              }}>
                <span className="cf-num" style={{ flex: 1, fontSize: 13, color: 'var(--cf-ink-2)' }}>
                  {inf.cuenta}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 9 }}>
              {inf.onBajar && (
                <button type="button" onClick={inf.onBajar} style={{
                  flex: 1, height: 48, borderRadius: 13, border: 'none', cursor: 'pointer',
                  background: ORO, color: 'var(--cf-gold-ink)', font: 'inherit',
                  fontSize: 14, fontWeight: 700,
                }}>Bajar</button>
              )}
              {/* «MANDAR» AL LADO. El destinatario casi nunca es uno mismo: es el
                  contador, por WhatsApp. Bajar y luego buscar el archivo para
                  compartirlo son dos pasos que sobran. */}
              {inf.onMandar && (
                <button type="button" onClick={inf.onMandar} style={{
                  flex: 1, height: 48, borderRadius: 13, cursor: 'pointer',
                  background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
                  color: 'var(--cf-ink)', font: 'inherit', fontSize: 14, fontWeight: 700,
                }}>Mandar</button>
              )}
            </div>
          </div>
        )
      })}

      {crudos.length > 0 && (
        <div style={{
          flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '17px 19px 12px', flex: 'none' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)' }}>{crudosTitulo}</span>
            <span style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--cf-ink-3)' }}>{crudosNota}</span>
          </span>
          {crudos.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={c.onBajar}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                padding: '13px 19px', borderTop: '1px solid var(--cf-hairline)',
                background: 'none', border: 0, font: 'inherit', textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)' }}>
                {c.nombre}
              </span>
              {/* CUÁNTAS FILAS TRAE. Si dice 0, mejor saberlo antes de abrirlo:
                  descubrir un Excel vacío pasa fuera de la app, cuando ya no se
                  puede arreglar el filtro. */}
              <span className="cf-num" style={{
                fontSize: 12, flex: 'none',
                color: c.filas === 0 ? 'var(--cf-gold-text-2)' : 'var(--cf-ink-3)',
              }}>
                {c.filas === 0 ? 'vacío' : `${c.filas} filas`}
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
