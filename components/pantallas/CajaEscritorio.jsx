'use client'

// components/pantallas/CajaEscritorio.jsx — T06-05 «Caja (escritorio)».
//
// ── LO QUE DICE EL PIE DE LA LÁMINA ────────────────────────────────────────
//
// «En 1440px la caja actual gasta todo el ancho en un "$0" y cinco mosaicos, y
// deja los movimientos en un desplegable. Aquí el saldo y su desglose comparten
// una sola banda, los movimientos son una tabla con hora, concepto, cliente y
// cobrador, y el cierre de cobradores vive a la derecha — que es lo que el dueño
// mira a las siete de la tarde.»
//
// El dueño lo dijo con otras palabras: «los primeros contenedores del apartado
// de caja están muy angostos con el resto de los elementos; hay elementos que
// son más delgados que otros».
//
// ── LAS TRES DECISIONES DE SITIO ───────────────────────────────────────────
//
//  1 · EL SALDO Y SU DESGLOSE, EN UNA BANDA. En el teléfono van uno debajo del
//      otro porque no hay ancho. Sentado, la cifra grande a la izquierda y las
//      cinco líneas que la explican a la derecha se leen de un vistazo, y deja
//      de hacer falta el desplegable de «cómo se arma el saldo».
//
//  2 · LOS MOVIMIENTOS, TABLA. Hora, concepto, cliente, cobrador y monto. En el
//      móvil son tres tarjetas con todo apretado en dos renglones; aquí son
//      columnas, que es lo que permite barrer con la vista buscando un cobro.
//
//  3 · EL CIERRE A LA DERECHA. Es lo del dueño a las siete de la tarde, no del
//      cobrador trabajando. Arriba empuja los movimientos fuera de pantalla; al
//      lado se consulta sin estorbar.
//
// NO tiene lógica propia: recibe cifras ya formateadas y devuelve los clics. Lo
// que mueve plata sigue en la página.

/* Una línea del desglose: «Cobrado hoy — + $412.000». */
function Linea({ etiqueta, valor, tono, onExplicar }) {
  if (valor == null) return null
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
      <span
        onClick={onExplicar}
        style={{
          fontSize: 13, color: 'var(--cf-ink-2)', minWidth: 0,
          cursor: onExplicar ? 'pointer' : undefined,
        }}
      >{etiqueta}{onExplicar ? ' ?' : ''}</span>
      <span className="cf-fig" style={{
        fontSize: 15, fontWeight: 600, flex: 'none',
        color: tono === 'entra' ? 'var(--cf-green-dark)'
          : tono === 'sale' ? 'var(--cf-red-dark)' : 'var(--cf-ink)',
      }}>{valor}</span>
    </div>
  )
}

function Rotulo({ children }) {
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em',
      textTransform: 'uppercase', color: 'var(--cf-ink-3)',
    }}>{children}</span>
  )
}

/* Las columnas de la tabla de movimientos. Hora a ancho fijo —siempre son cinco
   caracteres— y el resto reparte. El monto a la derecha, que es donde se buscan
   las cifras. */
const COLS = '72px 1.4fr 1.2fr 1fr 120px'

function Boton({ children, onClick, principal = false }) {
  if (!onClick) return null
  return (
    <button type="button" onClick={onClick} style={{
      height: 40, padding: '0 17px', borderRadius: 'var(--cf-r-control)',
      cursor: 'pointer', font: 'inherit', fontSize: 13.5, fontWeight: 700,
      flex: 'none', whiteSpace: 'nowrap',
      ...(principal
        ? { background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', border: 0 }
        : { background: 'var(--cf-card)', color: 'var(--cf-ink-2)', border: '1px solid var(--cf-border-strong)' }),
    }}>{children}</button>
  )
}

export default function CajaEscritorio({
  fecha,
  // La banda del saldo
  saldo, baseInicial, cobrado, cobradoDigital, prestado, gastos, ajustes,
  lineas, descuadre, onExplicar,
  // La tabla
  movimientos = [], totalMovimientos, onVerMovimientos,
  // Los controles del encabezado — los compone la página
  filtros, pestanas,
  onGasto, onCerrarDia, onReporte,
  // Lo de la derecha: el cierre de cobradores, tal cual lo pinta la página
  panelDerecho,
}) {
  const visibles = movimientos.length
  const faltan = Math.max(0, (totalMovimientos ?? visibles) - visibles)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Encabezado: título y fecha a la izquierda, filtros y acciones a la
          derecha. En el móvil los filtros van en su propia franja porque no
          caben; aquí entran en la misma fila. */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <h1 style={{
            margin: 0, fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 27, fontWeight: 600, letterSpacing: '-.025em', color: 'var(--cf-ink)',
          }}>Caja</h1>
          {fecha && <span style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>{fecha}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {filtros}
          <Boton onClick={onReporte}>Reporte</Boton>
          <Boton onClick={onGasto}>Registrar gasto</Boton>
          <Boton onClick={onCerrarDia} principal>Cerrar el día</Boton>
        </div>
      </div>

      {pestanas}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
        <div style={{ flex: 1.5, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── 1 · LA BANDA: el saldo y lo que lo arma ── */}
          <div style={{
            background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
            borderRadius: 'var(--cf-r-card)', padding: '22px 24px',
            display: 'flex', gap: 30, alignItems: 'center', flexWrap: 'wrap',
          }}>
            <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
              <Rotulo>Saldo en caja</Rotulo>
              <span className="cf-fig" style={{
                fontSize: 40, fontWeight: 600, letterSpacing: '-.035em',
                lineHeight: 1, color: 'var(--cf-ink)',
              }}>{saldo}</span>
              <span style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>disponible para prestar ahora</span>
            </div>

            <div style={{
              flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 8,
              paddingLeft: 30, borderLeft: '1px solid var(--cf-border)',
            }}>
              {/* Con `lineas` manda la página —es la banda que ya sabe explicar
                  cada cifra—; si no vienen, se arma con las de siempre. */}
              {lineas?.length ? lineas.map((l) => (
                <Linea
                  key={l.clave ?? l.etiqueta}
                  etiqueta={l.etiqueta}
                  valor={l.texto}
                  tono={l.tono}
                  onExplicar={onExplicar ? () => onExplicar(l.clave ?? l.etiqueta) : undefined}
                />
              )) : (
                <>
                  <Linea etiqueta="Base inicial" valor={baseInicial} />
                  <Linea etiqueta="Cobrado hoy" valor={cobrado} tono="entra" />
                  {cobradoDigital && <Linea etiqueta="de eso, por transferencia" valor={cobradoDigital} />}
                  <Linea etiqueta="Prestado hoy" valor={prestado} tono="sale" />
                  <Linea etiqueta="Gastos" valor={gastos} tono="sale" />
                  <Linea etiqueta="Ajustes" valor={ajustes} />
                </>
              )}
            </div>
          </div>

          {descuadre}

          {/* ── 2 · LOS MOVIMIENTOS, EN TABLA ── */}
          <div style={{
            background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
            borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, padding: '16px 22px 12px',
            }}>
              <Rotulo>Movimientos del día</Rotulo>
              <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>
                {totalMovimientos ?? visibles} {(totalMovimientos ?? visibles) === 1 ? 'registro' : 'registros'}
              </span>
            </div>

            {visibles === 0 ? (
              <p style={{ padding: '22px', margin: 0, textAlign: 'center', fontSize: 13.5, color: 'var(--cf-ink-3)' }}>
                Todavía no hay movimientos hoy.
              </p>
            ) : (
              <>
                <div style={{
                  display: 'grid', gridTemplateColumns: COLS, gap: 12,
                  alignItems: 'center', height: 42, padding: '0 22px',
                  background: 'var(--cf-fill)',
                  borderTop: '1px solid var(--cf-border)',
                  borderBottom: '1px solid var(--cf-border)',
                }}>
                  {['Hora', 'Concepto', 'Cliente', 'Cobrador', 'Monto'].map((h, i) => (
                    <span key={h} style={{
                      fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em',
                      textTransform: 'uppercase', color: 'var(--cf-ink-3)',
                      textAlign: i === 4 ? 'right' : 'left',
                    }}>{h}</span>
                  ))}
                </div>

                {movimientos.map((m, i) => (
                  <div key={`${m.hora}-${i}`} style={{
                    display: 'grid', gridTemplateColumns: COLS, gap: 12,
                    alignItems: 'center', minHeight: 50, padding: '0 22px',
                    borderTop: i === 0 ? 'none' : '1px solid var(--cf-hairline)',
                  }}>
                    <span className="cf-num" style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>{m.hora ?? '—'}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)' }}>
                      <span aria-hidden style={{
                        width: 7, height: 7, borderRadius: 999, flex: 'none',
                        background: m.entra ? 'var(--cf-green)' : 'var(--cf-red)',
                      }} />
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.tipo ?? 'Movimiento'}
                      </span>
                    </span>
                    <span style={{ fontSize: 14, color: 'var(--cf-ink-2)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.cliente ?? '—'}
                    </span>
                    <span style={{ fontSize: 14, color: 'var(--cf-ink-2)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.cobrador ?? '—'}
                    </span>
                    <span className="cf-fig" style={{
                      fontSize: 15, fontWeight: 600, textAlign: 'right',
                      color: m.entra ? 'var(--cf-green-dark)' : 'var(--cf-red-dark)',
                    }}>{m.entra ? '+' : '−'}{m.monto}</span>
                  </div>
                ))}

                {/* EL TRUNCADO SE DECLARA. Es la regla del proyecto: si la lista
                    se corta, se dice cuántos faltan — si no, el dueño cuadra el
                    día creyendo que vio todos los movimientos. */}
                {(faltan > 0 || onVerMovimientos) && (
                  <button type="button" onClick={onVerMovimientos} style={{
                    width: '100%', padding: '12px', border: 0, borderTop: '1px solid var(--cf-hairline)',
                    background: 'none', cursor: onVerMovimientos ? 'pointer' : 'default',
                    font: 'inherit', fontSize: 12.5, fontWeight: 700, color: 'var(--cf-ink-2)',
                  }}>
                    {faltan > 0 ? `Ver los ${totalMovimientos} movimientos` : 'Ver todos los movimientos'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── 3 · LA DERECHA: el cierre, que es lo del dueño a las 7 ── */}
        {panelDerecho && (
          <div style={{ width: 330, flex: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {panelDerecho}
          </div>
        )}
      </div>
    </div>
  )
}
