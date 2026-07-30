'use client'

// components/pantallas/Arranque.jsx — turno 01. Los cuatro pasos del arranque.
//
// T01-01 perfil · T01-02 capital · T01-03 método de carga · T01-05 cierre.
// (T01-04 es la revisión del OCR y ya vive en `RevisionCarga.jsx`. T01-00 y T01-06
// son crear préstamo, no arranque: están en el turno 01 porque es el flujo de
// entrada, pero la pantalla es otra.)
//
// ══ POR QUÉ ESTE ES EL FLUJO MÁS IMPORTANTE DE LA APP ═══════════════════════
//
// Los clientes cargados predicen el pago: con 0 clientes paga el 0%, con 51–150
// paga el 74%. El 75% de las cuentas se quedan atascadas en cinco o menos. O sea
// que estas cuatro pantallas son el producto — todo lo demás pasa después.
//
// Eso explica dos decisiones de la lámina que sin ese dato parecerían caprichos:
//
//   · Cada paso tiene su ENLACE DE ESCAPE («ya conozco el sistema, saltar», «lo
//     registro después», «empezar con la cartera vacía»). Un flujo que no se puede
//     saltar se abandona; uno que sí, se retoma.
//   · El plan NO se elige aquí. Es la última misión de T01-05 y su pastilla dice
//     «14 días gratis», con la frase que lo justifica: «el plan se elige aquí,
//     después de ver el producto funcionando — no antes».
//
// ══ NINGUNA CIFRA DE VENTA SE ESCRIBE AQUÍ ══════════════════════════════════
//
// Los días de prueba llegan por prop desde `DIAS_PRUEBA` — la lámina T37-02 los
// dibuja como 30 y son 14, y esta pantalla no puede ser el segundo sitio donde
// eso se afirme mal. Y «19 de cada 20 negocios cobran solos» de T01-01 tampoco
// tiene valor por defecto: es una estadística que no he podido verificar contra
// la base, así que va en `nota` y quien cablee decide si la dice.

const ORO = '#E7A400'
const PAD = 24  // el relleno lateral del turno 01

/* ── Piezas compartidas por los cuatro pasos ─────────────────────────────── */

/* Barra de cuatro segmentos + «Paso N de 4» + de qué va el paso. Idéntica en los
   cuatro, y por eso vive aquí una sola vez. */
function Progreso({ paso, total = 4, deQue }) {
  return (
    <div style={{ flex: 'none', padding: `14px ${PAD}px 0` }}>
      <div style={{ display: 'flex', gap: 5 }}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} style={{
            flex: 1, height: 3, borderRadius: 999, flexShrink: 0,
            background: i < paso ? ORO : 'rgba(20,20,28,.11)',
          }} />
        ))}
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 9,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
          textTransform: 'uppercase', color: 'var(--cf-ink-3)',
        }}>Paso {paso} de {total}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--cf-ink)' }}>{deQue}</span>
      </div>
    </div>
  )
}

function Titular({ titulo, ayuda, centrado }) {
  return (
    <div style={{
      flex: 'none', display: 'flex', flexDirection: 'column', gap: centrado ? 7 : 8,
      alignItems: centrado ? 'center' : 'stretch', textAlign: centrado ? 'center' : 'left',
    }}>
      <span style={{
        fontFamily: 'var(--font-space-grotesk), system-ui',
        fontSize: 25, fontWeight: 600, lineHeight: 1.15, letterSpacing: '-.02em',
        color: 'var(--cf-ink)',
      }}>{titulo}</span>
      {ayuda && (
        <span style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--cf-ink-2)' }}>{ayuda}</span>
      )}
    </div>
  )
}

function Rotulo({ children }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
      textTransform: 'uppercase', color: 'var(--cf-ink-3)',
    }}>{children}</span>
  )
}

function Pantalla({ children }) {
  return (
    <div style={{
      height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column',
      color: 'var(--cf-ink)',
    }}>{children}</div>
  )
}

function Cuerpo({ hueco, arriba = 26, children }) {
  return (
    <div style={{
      flex: 1, minHeight: 0, overflowY: 'auto', padding: `${arriba}px ${PAD}px 0`,
      display: 'flex', flexDirection: 'column', gap: hueco,
    }}>{children}</div>
  )
}

/* EL PIE CON SU SALIDA. La acción dorada arriba y el escape debajo, en gris y sin
   caja: quien quiere seguir no lo ve, quien quiere salir lo encuentra. Un arranque
   sin salida se abandona. */
function Pie({ accion, onAccion, salida, onSalida, ocupado }) {
  return (
    <div style={{
      flex: 'none', padding: `14px ${PAD}px 22px`, background: 'var(--cf-surface)',
      borderTop: '1px solid rgba(20,20,28,.07)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <button type="button" onClick={onAccion} disabled={ocupado} style={{
        height: 48, border: 'none', borderRadius: 14,
        background: ORO, color: 'var(--cf-gold-ink)', font: 'inherit',
        fontSize: 16, fontWeight: 700,
        cursor: ocupado ? 'progress' : 'pointer', opacity: ocupado ? 0.6 : 1,
      }}>{accion}</button>
      {salida && onSalida && (
        <button type="button" onClick={onSalida} style={{
          height: 34, border: 'none', background: 'none', cursor: 'pointer',
          font: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--cf-ink-3)',
        }}>{salida}</button>
      )}
    </div>
  )
}

function Consejo({ texto }) {
  if (!texto) return null
  return (
    <div style={{ flex: 'none', display: 'flex', gap: 9, alignItems: 'flex-start', paddingTop: 2 }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-3)"
        strokeWidth="2" strokeLinecap="round" style={{ flex: 'none', marginTop: 1 }}>
        <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
      </svg>
      <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--cf-ink-3)' }}>{texto}</span>
    </div>
  )
}

/* El círculo de elegir. Elegido: relleno dorado con el visto. Sin elegir: aro. */
function Marca({ elegido, verde }) {
  const fondo = verde ? 'var(--cf-green)' : ORO
  const tinta = verde ? '#FFFFFF' : 'var(--cf-gold-ink)'
  if (!elegido) {
    return (
      <span style={{
        width: 22, height: 22, borderRadius: 999, flex: 'none',
        border: '1.5px solid rgba(20,20,28,.18)',
      }} />
    )
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 22, height: 22, borderRadius: 999, background: fondo, flex: 'none',
    }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={tinta}
        strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 13l4 4L19 7" />
      </svg>
    </span>
  )
}

function Chevron({ tamano = 18 }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="none" stroke="rgba(20,20,28,.3)"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

/* Tarjeta elegible. El anillo dorado marca la elegida; el resto queda plano. */
function Opcion({ elegida, onClick, children, relleno = 16, columna }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'flex', flexDirection: columna ? 'column' : 'row',
      alignItems: columna ? 'stretch' : 'center', gap: columna ? 14 : 14,
      width: '100%', textAlign: 'left', font: 'inherit', color: 'var(--cf-ink)',
      background: 'var(--cf-card)', borderRadius: 'var(--cf-r-card)',
      padding: relleno, cursor: 'pointer',
      border: elegida ? `1.5px solid ${ORO}` : '1px solid var(--cf-border)',
      boxShadow: elegida ? '0 0 0 3px rgba(231,164,0,.13)' : 'none',
    }}>{children}</button>
  )
}

/* ══ T01-01 · Perfil ═══════════════════════════════════════════════════════
   «CARLOS, VAMOS A CARGAR TU CARTERA» — con su nombre y diciendo a qué venimos,
   no «bienvenido». Y la promesa que baja el coste de entrar: «tres minutos. Todo
   lo que crees aquí lo puedes editar o borrar después».

   La pregunta es «¿quién cobra?» y decide el resto del arranque: si cobra solo no
   se le pide crear cobradores ni repartir rutas, que es la mitad de los pasos.

   La franja de arriba —verificar el correo— es un aviso que NO BLOQUEA: se puede
   seguir el arranque sin verificar, y se cierra. Bloquear ahí es perder la cuenta
   por un correo en spam. */
export function ArranquePerfil({
  nombre,
  titulo, ayuda = 'Tres minutos. Todo lo que crees aquí lo puedes editar o borrar después.',
  verificar,
  quienCobra, onQuienCobra,
  opciones = [],
  nota,
  onContinuar, onSaltar, continuando,
}) {
  return (
    <Pantalla>
      {/* Un aviso, no una puerta. Con su X: si ya verificó en otro aparato, la
          franja se va y no vuelve a estorbar. */}
      {verificar && (
        <div style={{
          flex: 'none', display: 'flex', alignItems: 'center', gap: 10, height: 34,
          padding: `0 ${PAD - 4}px`, background: 'var(--cf-gold-tint)',
          borderBottom: '1px solid rgba(231,164,0,.25)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--cf-gold-dark)"
            strokeWidth="2.2" strokeLinecap="round" style={{ flex: 'none' }}>
            <path d="M4 6h16v12H4z" /><path d="M4 7l8 6 8-6" />
          </svg>
          <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: '#7A5800' }}>
            {verificar.texto ?? 'Verifica tu correo'}
          </span>
          {verificar.onCodigo && (
            <button type="button" onClick={verificar.onCodigo} style={{
              border: 0, background: 'none', padding: 0, cursor: 'pointer', font: 'inherit',
              fontSize: 12, fontWeight: 700, color: 'var(--cf-gold-dark)', flex: 'none',
            }}>Ingresar código</button>
          )}
          {verificar.onCerrar && (
            <button type="button" onClick={verificar.onCerrar} aria-label="Cerrar el aviso" style={{
              border: 0, background: 'none', padding: 0, cursor: 'pointer', flex: 'none',
              display: 'inline-flex',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(122,88,0,.55)"
                strokeWidth="2.4" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>
      )}

      <Progreso paso={1} deQue="Tu forma de trabajar" />

      <Cuerpo hueco={22}>
        <Titular
          titulo={titulo ?? (nombre ? `${nombre}, vamos a cargar tu cartera` : 'Vamos a cargar tu cartera')}
          ayuda={ayuda}
        />

        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Rotulo>¿Quién cobra?</Rotulo>
          {opciones.map((o) => (
            <Opcion key={o.id} elegida={quienCobra === o.id} onClick={() => onQuienCobra?.(o.id)}>
              <Marca elegido={quienCobra === o.id} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.01em' }}>{o.titulo}</span>
                <span style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--cf-ink-2)' }}>{o.detalle}</span>
              </span>
            </Opcion>
          ))}
        </div>

        {/* Sin valor por defecto a propósito: la lámina dice «19 de cada 20
            negocios cobran solos» y esa cifra no está verificada contra la base.
            Si no llega, no se afirma. */}
        <Consejo texto={nota} />
      </Cuerpo>

      <Pie
        accion="Continuar" onAccion={onContinuar} ocupado={continuando}
        salida="Ya conozco el sistema, saltar" onSalida={onSaltar}
      />
    </Pantalla>
  )
}

/* ══ T01-02 · Capital ══════════════════════════════════════════════════════
   «¿CON CUÁNTO DINERO ARRANCAS?» y debajo qué cuenta como eso: «el efectivo que
   tienes disponible para prestar hoy». Sin esa segunda línea la gente escribe la
   cartera entera, incluyendo lo que está en la calle.

   EL AVISO ROJO NO ES DECORACIÓN: dice la consecuencia exacta de dejarlo en cero
   —«tu caja va a quedar en negativo el primer día que prestes»— y en la misma
   frase dónde se arregla. Es la diferencia entre asustar y avisar.

   Los atajos suman, no fijan: «+500k» sobre lo escrito. Sumar es lo que se hace
   con capital que llega en tandas. */
export function ArranqueCapital({
  etiqueta = 'Capital inicial', moneda,
  monto, onMonto,
  simbolo = '$',
  atajos = [], onAtajo, onBorrar,
  advertencia,
  onContinuar, onDespues, continuando,
}) {
  return (
    <Pantalla>
      <Progreso paso={2} deQue="Capital" />

      <Cuerpo hueco={24}>
        <Titular
          titulo="¿Con cuánto dinero arrancas?"
          ayuda="El efectivo que tienes disponible para prestar hoy."
        />

        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            background: 'var(--cf-card)', borderRadius: 'var(--cf-r-card)',
            border: `1.5px solid ${ORO}`, boxShadow: '0 0 0 3px rgba(231,164,0,.13)',
            padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <Rotulo>{moneda ? `${etiqueta} · ${moneda}` : etiqueta}</Rotulo>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{
                fontFamily: 'var(--font-space-grotesk), system-ui',
                fontSize: 26, fontWeight: 600, color: 'var(--cf-ink-3)', flex: 'none',
              }}>{simbolo}</span>
              {/* `type=text` con `inputMode=decimal`: un `type=number` rechaza el
                  separador que no coincide con el locale del teléfono, y son 12
                  países con dos convenios distintos de miles. */}
              <input
                value={monto ?? ''}
                onChange={(e) => onMonto?.(e.target.value)}
                type="text" inputMode="decimal"
                aria-label={etiqueta}
                className="cf-fig"
                style={{
                  flex: 1, minWidth: 0, border: 0, background: 'none', padding: 0,
                  outline: 'none', font: 'inherit',
                  fontFamily: 'var(--font-space-grotesk), system-ui',
                  fontSize: 40, fontWeight: 600, letterSpacing: '-.03em', color: 'var(--cf-ink)',
                }}
              />
            </div>
          </div>

          {(atajos.length > 0 || onBorrar) && (
            <div style={{ display: 'flex', gap: 8 }}>
              {atajos.map((a) => (
                <button
                  key={a.etiqueta ?? a}
                  type="button"
                  onClick={() => onAtajo?.(a.suma ?? a)}
                  className="cf-num"
                  style={{
                    flex: 1, minWidth: 0, height: 44, borderRadius: 14, cursor: 'pointer',
                    background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
                    fontFamily: 'var(--font-space-grotesk), system-ui',
                    fontSize: 15, fontWeight: 600, color: 'var(--cf-ink)',
                  }}
                >{a.etiqueta ?? a}</button>
              ))}
              {onBorrar && (
                <button type="button" onClick={onBorrar} style={{
                  flex: 1, minWidth: 0, height: 44, borderRadius: 14, cursor: 'pointer',
                  background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
                  font: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--cf-ink-2)',
                }}>Borrar</button>
              )}
            </div>
          )}
        </div>

        {/* La consecuencia y dónde se arregla, en la misma frase. */}
        {advertencia && (
          <div style={{
            flex: 'none', display: 'flex', gap: 10, alignItems: 'flex-start',
            padding: '14px 16px', borderRadius: 14,
            background: 'rgba(229,72,77,.08)', border: '1px solid rgba(229,72,77,.22)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E5484D"
              strokeWidth="2.2" strokeLinecap="round" style={{ flex: 'none', marginTop: 1 }}>
              <path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" />
            </svg>
            <span style={{ fontSize: 13, lineHeight: 1.45, color: '#A8353A' }}>{advertencia}</span>
          </div>
        )}
      </Cuerpo>

      <Pie
        accion="Continuar" onAccion={onContinuar} ocupado={continuando}
        salida="Lo registro después" onSalida={onDespues}
      />
    </Pantalla>
  )
}

/* ══ T01-03 · Método de carga ══════════════════════════════════════════════
   «¿CÓMO TIENES TUS CLIENTES HOY?» — se pregunta por lo que YA tiene, no por lo
   que la app sabe hacer. Y «eliges una vez. Después no vuelve a preguntar»
   convierte la decisión en algo pequeño.

   La foto de la cartulina va primera y con la insignia MÁS RÁPIDO porque es como
   están de verdad las carteras: en un cuaderno. Lleva además la frase que quita el
   miedo — «se leen los datos y tú confirmas antes de crear nada» — y una
   miniatura de qué foto se espera, que ahorra la mitad de las fotos malas.

   Y la salida es «empezar con la cartera vacía»: quien no tiene nada a mano entra
   igual. */
export function ArranqueMetodo({
  destacado, opciones = [],
  elegido, onElegir,
  accion = 'Tomar la primera foto',
  onAccion, onVacia, continuando,
}) {
  return (
    <Pantalla>
      <Progreso paso={3} deQue="Tu cartera" />

      <Cuerpo hueco={20}>
        <Titular
          titulo="¿Cómo tienes tus clientes hoy?"
          ayuda="Eliges una vez. Después no vuelve a preguntar."
        />

        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {destacado && (
            <Opcion
              columna
              relleno={18}
              elegida={elegido === destacado.id}
              onClick={() => onElegir?.(destacado.id)}
            >
              <span style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 42, height: 42, borderRadius: 14, flex: 'none',
                  background: 'var(--cf-gold-tint)', color: 'var(--cf-gold-dark)',
                }}>
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8.5A2.5 2.5 0 015.5 6h1.7l1.2-2h6.2l1.2 2h1.7A2.5 2.5 0 0121 8.5v8A2.5 2.5 0 0118.5 19h-13A2.5 2.5 0 013 16.5z" />
                    <circle cx="12" cy="12.5" r="3.4" />
                  </svg>
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.01em' }}>
                      {destacado.titulo}
                    </span>
                    {/* El único dorado de fondo de la pantalla junto al botón: los
                        dos dicen lo mismo —empieza por aquí—. */}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px',
                      borderRadius: 11, background: ORO, color: 'var(--cf-gold-ink)',
                      fontSize: 10, fontWeight: 700, letterSpacing: '.04em', flex: 'none',
                    }}>MÁS RÁPIDO</span>
                  </span>
                  <span style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--cf-ink-2)' }}>
                    {destacado.detalle}
                  </span>
                </span>
              </span>

              {/* Qué foto se espera. Enseñarlo ahorra la mitad de las fotos que el
                  OCR no puede leer. */}
              {destacado.ejemplo && (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14,
                  background: 'var(--cf-fill)', border: '1px solid var(--cf-hairline)',
                }}>
                  <span aria-hidden style={{
                    width: 52, height: 52, borderRadius: 11, flex: 'none',
                    border: '1px solid var(--cf-border)',
                    background: 'repeating-linear-gradient(135deg,#E2E2DC 0 5px,#ECECE7 5px 10px)',
                  }} />
                  <span style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 11, lineHeight: 1.4, color: 'var(--cf-ink-3)',
                  }}>{destacado.ejemplo}</span>
                </span>
              )}
            </Opcion>
          )}

          {opciones.map((o) => (
            <Opcion key={o.id} elegida={elegido === o.id} onClick={() => onElegir?.(o.id)}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 42, height: 42, borderRadius: 14, flex: 'none',
                background: 'var(--cf-fill)', color: 'var(--cf-ink-2)',
              }}>
                {o.icono}
              </span>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.01em' }}>{o.titulo}</span>
                <span style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--cf-ink-2)' }}>{o.detalle}</span>
              </span>
              <Chevron />
            </Opcion>
          ))}
        </div>
      </Cuerpo>

      <Pie
        accion={accion} onAccion={onAccion} ocupado={continuando}
        salida="Empezar con la cartera vacía" onSalida={onVacia}
      />
    </Pantalla>
  )
}

/* ══ T01-05 · Cierre y misiones ════════════════════════════════════════════
   «TU CARTERA ESTÁ CARGADA» con lo que quedó y en cuánto tiempo — «7 clientes y 7
   préstamos, en menos de tres minutos» —, y las dos cifras que resumen el negocio
   entero: EN LA CALLE y EN CAJA. Esas dos y no más: son las únicas que a esta
   altura significan algo.

   «LO QUE SIGUE» son misiones, con la primera ya tachada. Empezar con algo hecho
   no es un detalle: convierte la lista en un progreso en marcha y no en una lista
   de deberes.

   Y la última misión es elegir el plan, con su pastilla verde de días gratis y la
   frase que lo explica: «el plan se elige aquí, después de ver el producto
   funcionando — no antes». Los días llegan por prop, de `DIAS_PRUEBA`. */
export function ArranqueCierre({
  titulo = 'Tu cartera está cargada', detalle,
  cifras = [],
  misionesTitulo = 'Lo que sigue', misiones = [],
  nota,
  accion = 'Ver mi panel', onAccion,
}) {
  return (
    <Pantalla>
      <Cuerpo hueco={22} arriba={16}>
        <div style={{
          flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 16, paddingTop: 16,
        }}>
          <span aria-hidden style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 76, minWidth: 76, height: 76, minHeight: 76, flex: 'none',
            borderRadius: 999, background: ORO, border: '3px solid #F5C518',
            boxShadow: '0 6px 20px rgba(231,164,0,.32)',
          }}>
            <span style={{
              fontFamily: 'var(--font-space-grotesk), system-ui',
              fontSize: 34, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--cf-gold-ink)',
            }}>$</span>
          </span>
          <Titular centrado titulo={titulo} ayuda={detalle} />
        </div>

        {/* Las dos cifras del negocio. En la calle y en caja: juntas son todo el
            capital, y separadas dicen cuánto está trabajando. */}
        {cifras.length > 0 && (
          <div style={{ flex: 'none', display: 'flex', gap: 10 }}>
            {cifras.map((c) => (
              <div key={c.etiqueta} style={{
                flex: 1, minWidth: 0, background: 'var(--cf-card)',
                border: '1px solid var(--cf-border)', borderRadius: 'var(--cf-r-card)',
                padding: 16, display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <Rotulo>{c.etiqueta}</Rotulo>
                <span className="cf-fig" style={{
                  fontFamily: 'var(--font-space-grotesk), system-ui',
                  fontSize: 23, fontWeight: 600, letterSpacing: '-.025em', color: 'var(--cf-ink)',
                }}>{c.valor}</span>
              </div>
            ))}
          </div>
        )}

        {misiones.length > 0 && (
          <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 11 }}>
            <Rotulo>{misionesTitulo}</Rotulo>
            <div style={{
              background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
              borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
            }}>
              {misiones.map((m, i) => {
                const Fila = m.onIr ? 'button' : 'div'
                return (
                  <Fila
                    key={m.texto}
                    {...(m.onIr ? { type: 'button', onClick: m.onIr } : {})}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 13, width: '100%',
                      padding: '15px 16px', background: 'none', border: 0,
                      borderBottom: i === misiones.length - 1 ? 'none' : '1px solid rgba(20,20,28,.07)',
                      font: 'inherit', textAlign: 'left', color: 'var(--cf-ink)',
                      cursor: m.onIr ? 'pointer' : 'default',
                    }}
                  >
                    <Marca elegido={m.hecha} verde />
                    <span style={{
                      flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600,
                      /* Tachada y en gris: se lee como pasado, no como pendiente. */
                      color: m.hecha ? 'var(--cf-ink-3)' : 'var(--cf-ink)',
                      textDecoration: m.hecha ? 'line-through' : 'none',
                    }}>{m.texto}</span>
                    {m.pastilla && (
                      <span className="cf-num" style={{
                        display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px',
                        borderRadius: 11, flex: 'none',
                        background: 'rgba(18,161,80,.12)', border: '1px solid rgba(18,161,80,.25)',
                        fontSize: 11, fontWeight: 700, color: '#0D7A3C',
                      }}>{m.pastilla}</span>
                    )}
                    {m.onIr && !m.pastilla && <Chevron tamano={17} />}
                  </Fila>
                )
              })}
            </div>
            {nota && (
              <span style={{
                fontSize: 12, lineHeight: 1.45, color: 'var(--cf-ink-3)', padding: '0 2px',
              }}>{nota}</span>
            )}
          </div>
        )}
      </Cuerpo>

      <Pie accion={accion} onAccion={onAccion} />
    </Pantalla>
  )
}
