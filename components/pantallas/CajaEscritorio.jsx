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
/* ── UN GRUPO DE LA CUENTA: «Entra» o «Sale», con su subtotal ──────────────
   El signo lo dice el grupo, no cada renglón. Antes cada línea llevaba su «+»
   o su «−» y no había subtotales: para comprobar la cuenta había que sumar de
   cabeza, que es exactamente lo que el dueño hacía con la calculadora. */
function Grupo({ titulo, tono, total, children }) {
  const color = tono === 'entra' ? 'var(--cf-green-dark)' : 'var(--cf-red-dark)'
  return (
    <div style={{
      background: 'var(--cf-fill)', borderRadius: 'var(--cf-r-control)',
      padding: '10px 13px', display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      <span style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: '.09em',
        textTransform: 'uppercase', color,
      }}>{titulo}</span>
      {children}
      {total != null && (
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          gap: 12, marginTop: 3, paddingTop: 7, borderTop: '1px solid var(--cf-hairline)',
        }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--cf-ink)' }}>
            Total que {titulo.toLowerCase()}
          </span>
          <span className="cf-num" style={{ fontSize: 15, fontWeight: 700, color }}>{total}</span>
        </div>
      )}
    </div>
  )
}

function Linea({ etiqueta, valor, tono, onExplicar }) {
  if (valor == null) return null
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
      <span
        onClick={onExplicar}
        title={onExplicar ? 'De dónde sale esta cifra' : undefined}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0,
          fontSize: 13, color: 'var(--cf-ink-2)',
          cursor: onExplicar ? 'pointer' : undefined,
        }}
      >
        {etiqueta}
        {/* El «?» en su círculo, no pegado al texto: suelto se lee como parte
            del rótulo —«Gastos ?»— en vez de como algo que se pulsa. */}
        {onExplicar && (
          <span aria-hidden style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 15, height: 15, borderRadius: 999, flex: 'none',
            border: '1px solid var(--cf-border-strong)',
            fontSize: 11, fontWeight: 700, color: 'var(--cf-ink-3)',
          }}>?</span>
        )}
      </span>
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
  // Cómo se escribe una cifra. La pantalla NO formatea —el padre le manda todo
  // ya formateado— pero los subtotales de «Entra» y «Sale» son un cálculo
  // nuevo, y tienen que salir escritos igual que los renglones que suman.
  formatear = (n) => String(Math.round(n || 0)),
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
              {/* La banda REAL viene de `lineasDeLaBanda` y sus campos son
                  `id`, `rotulo` y `signo` —no `etiqueta`/`clave`/`tono`, que fue
                  lo que supuse y dejó la columna entera en «?»—. El signo ya
                  dice si suma o resta, así que el color sale de ahí y no de un
                  campo aparte. */}
              {/* ── AGRUPADO EN «ENTRA» Y «SALE», COMO EN EL TELÉFONO ────────
                  Esta pantalla se quedó con los renglones sueltos y un «+» o un
                  «−» por línea, que es justo lo que el dueño describió con la
                  calculadora en la mano: «hay que agrupar bien todas las sumas,
                  agrupar bien todas las restas… estos dos números me toca a mí
                  ponerme a sumarlos».

                  Lo de móvil ya está así (`CajaCobradorDetalle`) y esta es la
                  que él abre desde el computador. El signo lo dice el GRUPO, no
                  cada renglón. */}
              {lineas?.length ? (() => {
                const entra = lineas.filter((l) => l.signo >= 0)
                const sale = lineas.filter((l) => l.signo < 0)
                const sumaTexto = (ls) => formatear(ls.reduce((a, l) => a + (l.monto || 0), 0))
                return (
                  <>
                    <Grupo titulo="Entra" tono="entra" total={sumaTexto(entra)}>
                      {entra.map((l) => (
                        <Linea key={l.id} etiqueta={l.rotulo} valor={l.texto}
                          onExplicar={onExplicar ? () => onExplicar(l.id) : undefined} />
                      ))}
                    </Grupo>
                    <Grupo titulo="Sale" tono="sale" total={sumaTexto(sale)}>
                      {sale.map((l) => (
                        <Linea key={l.id} etiqueta={l.rotulo} valor={l.texto}
                          onExplicar={onExplicar ? () => onExplicar(l.id) : undefined} />
                      ))}
                    </Grupo>
                  </>
                )
              })() : (
                <>
                  <Grupo titulo="Entra" tono="entra">
                    <Linea etiqueta="Base inicial" valor={baseInicial} />
                    <Linea etiqueta="Cobrado hoy" valor={cobrado} />
                    {/* Como RENGLÓN, no como nota: es la cifra que el cobrador
                        reporta y que no se entrega en billetes. */}
                    {cobradoDigital && <Linea etiqueta="De eso, por transferencia" valor={cobradoDigital} />}
                  </Grupo>
                  <Grupo titulo="Sale" tono="sale">
                    <Linea etiqueta="Prestado hoy" valor={prestado} />
                    <Linea etiqueta="Gastos" valor={gastos} />
                  </Grupo>
                  <Linea etiqueta="Ajustes" valor={ajustes} />
                </>
              )}
            </div>
          </div>

          {/* ⚠ `descuadre` ES UN OBJETO `{texto, diferencias}`, NO UN NODO.
              Pintarlo a pelo con `{descuadre}` hace que React reviente al
              renderizar un objeto como hijo, así que el dueño que abre la caja
              en el computador el día que no cuadra no veía un aviso: veía la
              pantalla caerse. Se pinta el texto, con el mismo aviso rojo que
              usa el móvil. */}
          {descuadre?.texto && (
            <div style={{
              background: 'var(--cf-red-pill-bg)',
              border: '1px solid color-mix(in srgb, var(--cf-red-dark) 30%, transparent)',
              color: 'var(--cf-red-dark)',
              borderRadius: 12, padding: '12px 16px', fontSize: 14,
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                   style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>{descuadre.texto}</span>
            </div>
          )}

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
