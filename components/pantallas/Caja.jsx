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

/* ── Cierre de cobradores ──────────────────────────────────────────────── */

function Avatar({ iniciales, entregado }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 36, minWidth: 36, height: 36, borderRadius: 999, flex: 'none',
      background: entregado ? 'var(--cf-green-pill-bg)' : 'var(--cf-fill)',
      color: entregado ? 'var(--cf-green-dark)' : 'var(--cf-ink-2)',
      fontSize: 12, fontWeight: 700, letterSpacing: '.02em',
    }}>{iniciales}</span>
  )
}

export function CierreCobradores({
  faltaEntregar, sinEntregar, deCuantos,
  pendientes = [], yaEntregaron = [], totalEntregado,
  sinCobros = 0, onRecibir,
}) {
  const primero = pendientes[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--cf-gap-cards)', padding: '8px var(--cf-pad-screen) 16px' }}>

        {/* La única cifra que el dueño busca a las 7 de la noche. */}
        <div style={{
          background: '#15161A', borderRadius: 'var(--cf-r-hero)', padding: '19px 21px',
          display: 'flex', alignItems: 'flex-end', gap: 12, flex: 'none',
        }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#A3A8B2' }}>
              Falta que te entreguen
            </span>
            <span className="cf-fig" style={{ display: 'block', fontSize: 34, letterSpacing: '-.035em', color: '#F3F3F6', marginTop: 6 }}>
              {faltaEntregar}
            </span>
          </span>
          {/* "3 de 9" a secas, debajo de "falta que te entreguen", se puede
              leer como "3 ya entregaron". Son los que FALTAN. El verbo lo
              desambigua y cuesta una palabra. */}
          <span className="cf-num" style={{ fontSize: 13, color: '#8A8E98', flex: 'none', paddingBottom: 5 }}>
            faltan {sinEntregar} de {deCuantos}
          </span>
        </div>

        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--cf-ink-3)', padding: '0 2px', flex: 'none' }}>
          Pendientes de cierre
        </span>
        <Tarjeta plana>
          {pendientes.map((p, i) => (
            <div key={p.nombre} style={{
              display: 'flex', alignItems: 'center', gap: 12, flex: 'none',
              minHeight: 62, padding: '11px 16px',
              borderTop: i === 0 ? 0 : '1px solid var(--cf-hairline)',
            }}>
              <Avatar iniciales={p.iniciales} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  display: 'block', fontSize: 14.5, fontWeight: 600, color: 'var(--cf-ink)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{p.nombre}</span>
                <span className="cf-num" style={{
                  display: 'block', fontSize: 11.5, color: 'var(--cf-ink-3)', marginTop: 2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{p.detalle}</span>
              </span>
              <span className="cf-fig" style={{ fontSize: 15, color: 'var(--cf-ink)', flex: 'none' }}>
                {p.monto}
              </span>
            </div>
          ))}
        </Tarjeta>

        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--cf-ink-3)', padding: '0 2px', flex: 'none' }}>
          Ya entregaron · {totalEntregado}
        </span>
        <Tarjeta plana>
          {yaEntregaron.map((p, i) => (
            <div key={p.nombre} style={{
              display: 'flex', alignItems: 'center', gap: 12, flex: 'none',
              minHeight: 54, padding: '9px 16px',
              borderTop: i === 0 ? 0 : '1px solid var(--cf-hairline)',
            }}>
              <Avatar iniciales={p.iniciales} entregado />
              <span style={{
                flex: 1, minWidth: 0, fontSize: 14, color: 'var(--cf-ink-2)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{p.nombre}</span>
              <span className="cf-num" style={{ fontSize: 13.5, color: 'var(--cf-ink-3)', flex: 'none' }}>
                {p.monto}
              </span>
            </div>
          ))}

          {/* Nueve tarjetas con carita triste se vuelven ESTA línea. Un cobrador
              sin cobros no es una novedad: es la mayoría de los días. */}
          {sinCobros > 0 && (
            <div style={{
              padding: '11px 16px', borderTop: '1px solid var(--cf-hairline)', flex: 'none',
              fontSize: 12, color: 'var(--cf-ink-3)',
            }}>
              {sinCobros} cobrador{sinCobros === 1 ? '' : 'es'} sin cobros hoy
            </div>
          )}
        </Tarjeta>
      </div>

      {/* La acción lleva SU CIFRA y el nombre de quien entrega: a las 7 p. m. el
          dueño no está eligiendo, está recibiendo del que tiene enfrente. */}
      {primero && (
        <BarraAccion>
          <BotonPrimario style={{ flex: 1 }} onClick={() => onRecibir?.(primero)}>
            Recibir de {primero.nombre.split(' ')[0]} · {primero.monto}
          </BotonPrimario>
        </BarraAccion>
      )}
    </div>
  )
}
