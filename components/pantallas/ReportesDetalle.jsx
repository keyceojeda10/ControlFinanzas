'use client'

/* ══ T33-01 · Lo que queda de reportes ══════════════════════════════════════
   La gráfica de ingresos, los seguros por ruta y los cobros del mes eran las
   tres últimas piezas del diseño anterior en esta pantalla. Lo que cambia:

   1. LA GRÁFICA NO ES UNA LIBRERÍA. Eran barras de Recharts con un color por
      barra —verde fuerte la última, verde claro las demás— y ningún número
      encima. Aquí son barras planas de UN SOLO dorado, y debajo va la frase que
      la gráfica tenía que decir y no decía: cuál fue el día grande y cuánto se
      promedia. Nadie mira veinte barras para sacar la media.

   2. LOS PERÍODOS NO SON DESPLEGABLES DEL TELÉFONO. Eran `<select>` nativos,
      que en cada sistema se ven distintos y en ninguno se ven como la app.

   3. LOS COBROS DEL MES LLEVAN SU CIFRA ARRIBA Y EN OSCURO, con lo que ya
      entró al lado. Antes era un título, un desplegable y una tabla: había que
      sumar mentalmente para saber si el mes iba bien. */

const CARBON = '#15161A'
const CARBON_ORO = '#F5B824'
const CARBON_VERDE = '#2FBE6A'
const CARBON_APAGADO = '#8A8E98'
const CARBON_ROTULO = '#A3A8B2'

function Rotulo({ children, sobreOscuro = false }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '.09em',
      textTransform: 'uppercase',
      color: sobreOscuro ? CARBON_ROTULO : 'var(--cf-ink-3)',
    }}>{children}</span>
  )
}

/** Los períodos, como pastillas del sistema y no como desplegable del teléfono. */
function Periodos({ valor, onCambio, opciones = [] }) {
  return (
    <div style={{ display: 'flex', gap: 5, flex: 'none' }}>
      {opciones.map((o) => {
        const activo = valor === o.valor
        return (
          <button
            key={o.valor}
            type="button"
            onClick={() => onCambio?.(o.valor)}
            style={{
              display: 'inline-flex', alignItems: 'center', flex: 'none',
              height: 26, padding: '0 9px', borderRadius: 9, cursor: 'pointer',
              font: 'inherit', fontSize: 11, fontWeight: activo ? 700 : 600,
              background: activo ? 'var(--cf-ink)' : 'var(--cf-fill)',
              color: activo ? 'var(--cf-surface)' : 'var(--cf-ink-2)',
              border: activo ? 'none' : '1px solid var(--cf-border)',
            }}
          >{o.texto}</button>
        )
      })}
    </div>
  )
}

function Marco({ children }) {
  return (
    <div style={{
      background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
      borderRadius: 'var(--cf-r-card)', padding: 20,
      display: 'flex', flexDirection: 'column', gap: 13,
    }}>{children}</div>
  )
}

/* ══ Cómo va entrando ══════════════════════════════════════════════════════
   Un solo dorado en toda la gráfica. Pintar la última barra de otro color
   sugiere que hoy es especial, y no lo es: es la barra que aún no ha terminado.
   Lo que sí importa —el día grande y la media— va escrito debajo. */
export function ComoVaEntrando({
  titulo = 'Cómo va entrando',
  periodo, onPeriodo,
  periodos = [
    { valor: 'diario', texto: 'Día' },
    { valor: 'semanal', texto: 'Semana' },
    { valor: 'mensual', texto: 'Mes' },
  ],
  barras = [],
  desde, hasta,
  nota,
  vacio = 'Todavía no hay pagos en este período',
}) {
  const tope = Math.max(...barras.map((b) => b.valor ?? 0), 1)

  return (
    <Marco>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <Rotulo>{titulo}</Rotulo>
        <Periodos valor={periodo} onCambio={onPeriodo} opciones={periodos} />
      </div>

      {barras.length === 0 ? (
        <span style={{
          fontSize: 13, color: 'var(--cf-ink-3)', textAlign: 'center', padding: '24px 0',
        }}>{vacio}</span>
      ) : (
        <>
          <div style={{ flex: 'none', height: 104, display: 'flex', alignItems: 'flex-end', gap: 3 }}>
            {barras.map((b, i) => (
              <span
                key={b.id ?? i}
                title={b.titulo}
                style={{
                  // `flex: none` no: aquí las barras SÍ se reparten el ancho.
                  // Lo que no puede encogerse es el alto, y por eso va en px.
                  flex: 1, minWidth: 0,
                  // Un pelo de alto siempre, para que un día de cero se vea
                  // como un día de cero y no como un día que falta.
                  height: `${Math.max(2, Math.round(((b.valor ?? 0) / tope) * 100))}%`,
                  borderRadius: '2px 2px 0 0',
                  background: 'var(--cf-gold)',
                }}
              />
            ))}
          </div>

          {(desde || hasta) && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="cf-num" style={{ fontSize: 11, color: 'var(--cf-ink-3)' }}>{desde}</span>
              <span className="cf-num" style={{ fontSize: 11, color: 'var(--cf-ink-3)' }}>{hasta}</span>
            </div>
          )}

          {/* LO QUE LA GRÁFICA TENÍA QUE DECIR Y NO DECÍA. */}
          {nota && (
            <span className="cf-num" style={{
              fontSize: 12, lineHeight: 1.45, color: 'var(--cf-ink-2)',
            }}>{nota}</span>
          )}
        </>
      )}
    </Marco>
  )
}

/* ══ Seguros cobrados ══════════════════════════════════════════════════════ */
export function SegurosCobrados({
  titulo = 'Seguros cobrados',
  periodo, onPeriodo,
  periodos = [
    { valor: 'dia', texto: 'Hoy' },
    { valor: 'semana', texto: '7 d' },
    { valor: 'mes', texto: '30 d' },
    { valor: 'todo', texto: 'Todo' },
  ],
  filas = [],
  total,
  totalEtiqueta = 'Total seguros',
  vacio = 'Sin seguros cobrados en este período',
}) {
  return (
    <Marco>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <Rotulo>{titulo}</Rotulo>
        <Periodos valor={periodo} onCambio={onPeriodo} opciones={periodos} />
      </div>

      {filas.length === 0 ? (
        <span style={{
          fontSize: 13, color: 'var(--cf-ink-3)', textAlign: 'center', padding: '18px 0',
        }}>{vacio}</span>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {filas.map((f) => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)' }}>{f.nombre}</span>
                  {/* SIN COBRADOR VA EN ROJO. Una ruta que cobra seguros y no
                      tiene quién los cobre es un problema, no un detalle. */}
                  <span style={{
                    fontSize: 11, fontWeight: f.huerfana ? 600 : 400,
                    color: f.huerfana ? 'var(--cf-red-dark)' : 'var(--cf-ink-3)',
                  }}>{f.detalle}</span>
                </span>
                <span className="cf-fig" style={{
                  fontFamily: 'var(--font-space-grotesk), system-ui',
                  fontSize: 15, fontWeight: 600, flex: 'none', color: 'var(--cf-ink)',
                }}>{f.monto}</span>
              </div>
            ))}
          </div>

          {total && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              paddingTop: 11, borderTop: '1px solid var(--cf-hairline)',
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--cf-ink-2)' }}>
                {totalEtiqueta}
              </span>
              <span className="cf-fig" style={{
                fontFamily: 'var(--font-space-grotesk), system-ui',
                fontSize: 15, fontWeight: 600, color: 'var(--cf-ink)',
              }}>{total}</span>
            </div>
          )}
        </>
      )}
    </Marco>
  )
}

/* ══ Cobros del mes ════════════════════════════════════════════════════════
   La cifra manda y va en oscuro, con lo que ya entró al lado. Antes era un
   título, un desplegable y una tabla: había que sumar mentalmente para saber
   si el mes iba bien o mal. */
export function CobrosDelMes({
  rotulo = 'Cobros del mes',
  titulo,
  resumenLinea,
  mes, onMes, meses = [],
  totalEtiqueta = 'Total esperado',
  total,
  yaEntro, falta,
  rutas = [],
  onImprimir,
  imprimirTexto = 'Imprimir',
  vacio = 'Nadie tiene cuota este mes',
  cargando = false,
}) {
  return (
    <div style={{
      background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
      borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        flex: 'none', padding: '17px 19px 14px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <Rotulo>{rotulo}</Rotulo>
          {meses.length > 0 && (
            <div style={{ position: 'relative', flex: 'none' }}>
              <select
                value={mes}
                onChange={(e) => onMes?.(e.target.value)}
                aria-label="Mes"
                style={{
                  appearance: 'none', WebkitAppearance: 'none',
                  height: 30, padding: '0 26px 0 11px', borderRadius: 10,
                  background: 'var(--cf-fill)', border: '1px solid var(--cf-border)',
                  font: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--cf-ink)',
                  cursor: 'pointer',
                }}
              >
                {meses.map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
              </select>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-3)"
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                style={{ position: 'absolute', right: 9, top: 9, pointerEvents: 'none' }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          )}
        </div>
        {titulo && (
          <span style={{
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)',
          }}>{titulo}</span>
        )}
        {resumenLinea && (
          <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>
            {resumenLinea}
          </span>
        )}
      </div>

      {cargando ? (
        <div style={{ padding: '26px 19px', textAlign: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>Cargando…</span>
        </div>
      ) : rutas.length === 0 ? (
        <div style={{ padding: '26px 19px', textAlign: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>{vacio}</span>
        </div>
      ) : (
        <>
          <div style={{
            flex: 'none', display: 'flex', alignItems: 'flex-end',
            justifyContent: 'space-between', gap: 12,
            padding: '17px 19px', background: CARBON,
          }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <Rotulo sobreOscuro>{totalEtiqueta}</Rotulo>
              <span className="cf-fig" style={{
                fontFamily: 'var(--font-space-grotesk), system-ui',
                fontSize: 26, fontWeight: 600, letterSpacing: '-.035em', lineHeight: 1,
                color: CARBON_ORO,
              }}>{total}</span>
            </span>
            {yaEntro && (
              <span style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end', flex: 'none' }}>
                <span style={{ fontSize: 11, color: CARBON_APAGADO }}>Ya entró</span>
                <span className="cf-fig" style={{
                  fontFamily: 'var(--font-space-grotesk), system-ui',
                  fontSize: 17, fontWeight: 600, lineHeight: 1, color: CARBON_VERDE,
                }}>{yaEntro}</span>
                {falta && (
                  <span className="cf-num" style={{ fontSize: 11, color: CARBON_APAGADO }}>{falta}</span>
                )}
              </span>
            )}
          </div>

          {rutas.map((r) => (
            <div key={r.id}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '9px 19px', background: 'var(--cf-fill)',
                borderBottom: '1px solid var(--cf-hairline)',
              }}>
                {/* El nombre no se encoge; el detalle sí y se corta. Al revés
                    —que es como salía— «Carlos Andres · 2 clientes» partía la
                    fila en dos renglones y el grupo dejaba de leerse como una
                    sola línea. */}
                <span style={{
                  flex: 'none', maxWidth: '52%', fontSize: 13, fontWeight: 700,
                  color: 'var(--cf-ink)', whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{r.nombre}</span>
                <span style={{
                  flex: 1, minWidth: 0, fontSize: 11, color: 'var(--cf-ink-3)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{r.detalle}</span>
                <span className="cf-fig" style={{
                  fontFamily: 'var(--font-space-grotesk), system-ui',
                  fontSize: 14, fontWeight: 600, flex: 'none', color: 'var(--cf-gold-text)',
                }}>{r.total}</span>
              </div>
              {r.clientes?.map((c) => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 19px 11px 30px',
                  borderBottom: '1px solid var(--cf-hairline)',
                }}>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 14, color: 'var(--cf-ink)' }}>{c.nombre}</span>
                    <span className="cf-num" style={{ fontSize: 11, color: 'var(--cf-ink-3)' }}>
                      {c.detalle}
                    </span>
                  </span>
                  <span className="cf-fig" style={{
                    fontFamily: 'var(--font-space-grotesk), system-ui',
                    fontSize: 14, fontWeight: 600, flex: 'none', color: 'var(--cf-ink)',
                  }}>{c.monto}</span>
                </div>
              ))}
            </div>
          ))}

          {onImprimir && (
            <button
              type="button"
              onClick={onImprimir}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', height: 46, background: 'none', border: 0,
                cursor: 'pointer', font: 'inherit', fontSize: 14, fontWeight: 600,
                color: 'var(--cf-ink)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-2)"
                strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
                <path d="M7 9V4h10v5M7 15h10v5H7z" /><rect x="4" y="9" width="16" height="6" rx="1.5" />
              </svg>
              {imprimirTexto}
            </button>
          )}
        </>
      )}
    </div>
  )
}
