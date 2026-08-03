'use client'

// components/pantallas/RutaEscritorio.jsx — T04-09 «Detalle de ruta (escritorio)».
//
// EL PIE DE LA LÁMINA DICE LAS TRES DECISIONES, Y LAS TRES SON DE SITIO:
//
//   «En 1440px la ruta es una TABLA con el orden del recorrido numerado y las
//    mismas cuatro cifras como columnas, más un botón Cobrar por fila. El
//    resumen del dueño —cartera, capital, atraso, mora— se va A LA DERECHA,
//    donde no estorba el trabajo. La fila de botones que hoy se sale de la
//    pantalla SUBE AL ENCABEZADO.»
//
// Por qué importa cada una:
//
//  · TABLA, NO TARJETAS. En móvil una tarjeta por cliente es lo correcto: se
//    lee de una en una, caminando. Sentado y con 1440px de ancho, nueve
//    tarjetas apiladas obligan a recorrer nueve bloques para comparar dos
//    cifras que están en la misma columna. La tabla es la forma de comparar.
//  · EL RESUMEN A LA DERECHA. Cartera, capital, atraso y mora son del DUEÑO
//    mirando la ruta, no del cobrador trabajándola. Arriba empujan la lista
//    fuera de la pantalla; al lado se consultan sin estorbar.
//  · LOS BOTONES AL ENCABEZADO. Hoy son una fila con scroll horizontal que se
//    sale por la derecha — «Préstamos de esta ruta» nace fuera de pantalla.
//
// NO tiene lógica propia: recibe filas ya formateadas y devuelve los clics. Lo
// que mueve plata sigue en la página.

import { formatMoney } from '@/lib/i18n'

const COL = {
  padding: '11px 14px',
  fontSize: 13,
  color: 'var(--cf-ink)',
}

function Cabecera({ children, alineado = 'left', ancho }) {
  return (
    <th style={{
      ...COL,
      width: ancho,
      textAlign: alineado,
      fontSize: 10.5,
      fontWeight: 700,
      letterSpacing: '.07em',
      textTransform: 'uppercase',
      color: 'var(--cf-ink-3)',
      borderBottom: '1px solid var(--cf-border)',
      whiteSpace: 'nowrap',
    }}>{children}</th>
  )
}

/** Una cifra de la fila. `tono` la tiñe solo cuando significa algo. */
function Celda({ children, tono, alineado = 'right', peso = 600 }) {
  return (
    <td className="cf-num" style={{
      ...COL,
      textAlign: alineado,
      fontWeight: peso,
      whiteSpace: 'nowrap',
      color: tono === 'mora' ? 'var(--cf-red-dark)'
        : tono === 'bien' ? 'var(--cf-green-dark)'
        : 'var(--cf-ink)',
    }}>{children}</td>
  )
}

function Pastilla({ children, tono }) {
  const rojo = tono === 'mora'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px',
      borderRadius: 11, flex: 'none', fontSize: 11, fontWeight: 700,
      fontVariantNumeric: 'tabular-nums',
      background: rojo ? 'color-mix(in srgb, var(--cf-red) 12%, transparent)'
        : 'color-mix(in srgb, var(--cf-green) 12%, transparent)',
      border: `1px solid ${rojo ? 'color-mix(in srgb, var(--cf-red) 25%, transparent)'
        : 'color-mix(in srgb, var(--cf-green) 25%, transparent)'}`,
      color: rojo ? 'var(--cf-red-dark)' : 'var(--cf-green-dark)',
    }}>{children}</span>
  )
}

/** Una tarjeta del carril derecho. */
function Bloque({ rotulo, children, style }) {
  return (
    <div style={{
      flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
      borderRadius: 'var(--cf-r-card)', padding: '15px 17px',
      display: 'flex', flexDirection: 'column', gap: 11,
      ...style,
    }}>
      {rotulo && (
        <span style={{
          fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em',
          textTransform: 'uppercase', color: 'var(--cf-ink-3)',
        }}>{rotulo}</span>
      )}
      {children}
    </div>
  )
}

function Linea({ texto, valor, tono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
      <span style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>{texto}</span>
      <span className="cf-num" style={{
        fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap',
        color: tono === 'mora' ? 'var(--cf-red-dark)' : 'var(--cf-ink)',
      }}>{valor}</span>
    </div>
  )
}

export default function RutaEscritorio({
  nombre, dia, subtitulo,
  migaVolver, onVolver,
  acciones = [],            // [{ id, texto, onClick, principal }]
  chips = [], chipActivo, onChip,
  onReordenar,
  filas = [],               // [{ id, orden, iniciales, nombre, donde, diasMora, cuotaHoy, atraso, cumple, debe, cobrada }]
  onCobrar, onFila,
  // El carril derecho
  porCobrarHoy, recaudadoHoy, progreso = 0, conteoCobros,
  cartera = [],             // [{ texto, valor, tono }]
  cierreTexto, onCierre, cierreListo,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* ── ENCABEZADO: miga, título y LAS ACCIONES ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {/* CON FLECHA, o no se ve que se pueda pulsar. Era un botón de verdad
              —con su `onClick`— pero pintado como una etiqueta: 10,5px, gris,
              mayúsculas y sin nada que lo distinga del texto de al lado. El
              dueño lo reportó como que no había forma de volver a la ruta «sino
              dándole al menú». La salida estaba; lo que faltaba era que
              PARECIERA una salida. */}
          {migaVolver && (
            <button
              type="button"
              onClick={onVolver}
              style={{
                alignSelf: 'flex-start', background: 'none', border: 0, padding: 0,
                cursor: 'pointer', font: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em',
                textTransform: 'uppercase', color: 'var(--cf-ink-3)',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
                <path d="M15 5l-7 7 7 7" />
              </svg>
              {migaVolver}
            </button>
          )}
          <span style={{
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 27, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)',
          }}>
            {nombre}{dia ? ` · ${dia}` : ''}
          </span>
          {subtitulo && (
            <span className="cf-num" style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>{subtitulo}</span>
          )}
        </div>

        {/* Aquí arriba, no en una fila con scroll que se sale por la derecha. */}
        <div style={{ display: 'flex', gap: 9, flex: 'none' }}>
          {acciones.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={a.onClick}
              style={{
                height: 40, padding: '0 17px', cursor: 'pointer',
                borderRadius: 'var(--cf-r-control)',
                background: a.principal ? 'var(--cf-gold)' : 'var(--cf-card)',
                border: a.principal ? 0 : '1px solid var(--cf-border-strong)',
                color: a.principal ? 'var(--cf-gold-ink)' : 'var(--cf-ink-2)',
                fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap',
              }}
            >{a.texto}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
        {/* ── LA TABLA ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', gap: 7, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
              {chips.map((c) => {
                const activo = c.id === chipActivo
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onChip?.(c.id)}
                    style={{
                      height: 34, padding: '0 13px', cursor: 'pointer', flex: 'none',
                      borderRadius: 11, fontSize: 12.5,
                      fontWeight: activo ? 700 : 600,
                      background: activo ? 'var(--cf-ink)' : 'var(--cf-card)',
                      border: activo ? '1px solid var(--cf-ink)' : '1px solid var(--cf-border)',
                      color: activo ? 'var(--cf-card)' : 'var(--cf-ink-2)',
                    }}
                  >
                    {c.texto}
                    {c.conteo != null && (
                      <span className="cf-num" style={{ marginLeft: 6, opacity: 0.65 }}>· {c.conteo}</span>
                    )}
                  </button>
                )
              })}
            </div>
            {onReordenar && (
              <button
                type="button"
                onClick={onReordenar}
                style={{
                  flex: 'none', background: 'none', border: 0, padding: 0, cursor: 'pointer',
                  font: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--cf-gold-dark)',
                }}
              >Reordenar recorrido</button>
            )}
          </div>

          <div style={{
            background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
            borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <Cabecera ancho={44}>#</Cabecera>
                  <Cabecera>Cliente</Cabecera>
                  <Cabecera alineado="right">Cuota hoy</Cabecera>
                  <Cabecera alineado="right">Atraso</Cabecera>
                  <Cabecera alineado="right">Cumple</Cabecera>
                  <Cabecera alineado="right">Debe</Cabecera>
                  <Cabecera ancho={110} />
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr
                    key={f.id}
                    onClick={() => onFila?.(f)}
                    style={{
                      cursor: onFila ? 'pointer' : 'default',
                      borderTop: i === 0 ? 'none' : '1px solid var(--cf-hairline)',
                      // El cobrado se atenúa; no se quita. Sigue siendo el mapa
                      // del recorrido aunque ya esté hecho.
                      opacity: f.cobrada ? 0.55 : 1,
                    }}
                  >
                    <td style={{ ...COL, color: 'var(--cf-ink-3)', fontWeight: 700 }} className="cf-num">{f.orden}</td>
                    <td style={COL}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 34, minWidth: 34, height: 34, borderRadius: 999, flex: 'none',
                          background: 'var(--cf-fill)', fontSize: 12.5, fontWeight: 700, color: 'var(--cf-ink-2)',
                        }}>{f.iniciales}</span>
                        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{
                            display: 'flex', alignItems: 'center', gap: 8, minWidth: 0,
                            fontSize: 13.5, fontWeight: 700, color: 'var(--cf-ink)',
                          }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nombre}</span>
                            {f.diasMora > 0
                              ? <Pastilla tono="mora">{f.diasMora}d</Pastilla>
                              : <Pastilla>Al día</Pastilla>}
                          </span>
                          {f.donde && (
                            <span className="cf-num" style={{
                              fontSize: 11.5, color: 'var(--cf-ink-3)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>{f.donde}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <Celda peso={700}>{f.cuotaHoy}</Celda>
                    <Celda tono={f.atrasoNumero > 0 ? 'mora' : undefined}>{f.atraso}</Celda>
                    <Celda tono={f.cumpleNumero != null && f.cumpleNumero >= 100 ? 'bien'
                      : f.cumpleNumero != null && f.cumpleNumero < 50 ? 'mora' : undefined}>{f.cumple}</Celda>
                    <Celda>{f.debe}</Celda>
                    <td style={{ ...COL, textAlign: 'right' }}>
                      <button
                        type="button"
                        disabled={f.cobrada}
                        onClick={(e) => { e.stopPropagation(); onCobrar?.(f) }}
                        style={{
                          height: 32, padding: '0 15px',
                          cursor: f.cobrada ? 'default' : 'pointer',
                          borderRadius: 'var(--cf-r-control)',
                          background: f.cobrada ? 'var(--cf-fill)' : 'var(--cf-card)',
                          border: '1px solid var(--cf-border-strong)',
                          fontSize: 12.5, fontWeight: 700, color: 'var(--cf-ink-2)',
                          whiteSpace: 'nowrap',
                        }}
                      >{f.cobrada ? 'Cobrado' : 'Cobrar'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filas.length === 0 && (
              <p style={{ padding: '26px 16px', textAlign: 'center', fontSize: 13.5, color: 'var(--cf-ink-3)' }}>
                Ningún cliente tiene cobro con este filtro.
              </p>
            )}
          </div>
        </div>

        {/* ── EL CARRIL DEL DUEÑO ── */}
        <div style={{ width: 264, flex: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Lo de hoy, en dorado: es la única cifra por la que se abre esta
              pantalla estando sentado. Un solo dorado en toda la vista. */}
          <div style={{
            flex: 'none', background: 'var(--cf-gold)', borderRadius: 'var(--cf-r-card)',
            padding: '15px 17px', display: 'flex', flexDirection: 'column', gap: 9,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
              <span style={{
                fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em',
                textTransform: 'uppercase', color: 'var(--cf-gold-ink)', opacity: 0.72,
              }}>Por cobrar hoy</span>
            </div>
            <span className="cf-fig" style={{
              fontSize: 27, letterSpacing: '-.025em', lineHeight: 1, color: 'var(--cf-gold-ink)',
            }}>{porCobrarHoy}</span>
            <div style={{ height: 5, borderRadius: 999, background: 'rgba(20,20,28,.14)', overflow: 'hidden', flex: 'none' }}>
              <span style={{
                display: 'block', width: `${Math.max(0, Math.min(100, progreso))}%`, height: 5,
                borderRadius: 999, background: 'var(--cf-gold-ink)',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-gold-ink)', opacity: 0.78 }}>
                Recaudado {recaudadoHoy}
              </span>
              {conteoCobros && (
                <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-gold-ink)', opacity: 0.78 }}>
                  {conteoCobros}
                </span>
              )}
            </div>
          </div>

          {cartera.length > 0 && (
            <Bloque rotulo="Cartera de la ruta">
              {cartera.map((l) => <Linea key={l.texto} {...l} />)}
            </Bloque>
          )}

          <Bloque rotulo="Cierre de caja">
            <p style={{ fontSize: 12.5, color: 'var(--cf-ink-3)', lineHeight: 1.45 }}>{cierreTexto}</p>
            <button
              type="button"
              onClick={onCierre}
              disabled={!cierreListo}
              style={{
                height: 40, width: '100%', cursor: cierreListo ? 'pointer' : 'default',
                borderRadius: 'var(--cf-r-control)',
                background: cierreListo ? 'var(--cf-ink)' : 'var(--cf-fill)',
                border: cierreListo ? 0 : '1px solid var(--cf-border)',
                color: cierreListo ? 'var(--cf-card)' : 'var(--cf-ink-3)',
                fontSize: 13.5, fontWeight: 700,
              }}
            >Registrar cierre</button>
          </Bloque>
        </div>
      </div>
    </div>
  )
}
