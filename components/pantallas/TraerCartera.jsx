'use client'

// components/pantallas/TraerCartera.jsx — T22-00 «Trae tus préstamos y empezamos».
//
// ══ LA PANTALLA QUE DECIDE SI UN CLIENTE PAGA ══════════════════════════════
//
// Medido sobre la base real: los clientes cargados predicen el pago. Con 0
// clientes cargados la conversión es 0%; entre 51 y 150, el 74%. Y el 75% de las
// organizaciones se quedan atascadas en 5 clientes o menos.
//
// O sea: esta pantalla no es el paso previo al producto, ES el producto. Todo lo
// que se rediseñó antes —el panel, las rutas, los cobros— solo empieza a existir
// cuando esta pantalla se completa.
//
// ══ POR QUÉ TRES CAMINOS Y NO UNO ══════════════════════════════════════════
//
// Quien llega tiene su cartera en una libreta, en un Excel, o en la cabeza. Un
// único «crea tu primer cliente» obliga a los dos primeros a teclear cuarenta
// préstamos a mano, y ahí es donde se abandona.
//
// La foto va primera y es la única dorada: es la más rápida —unos 20 minutos
// para 40 préstamos— y la que más gente puede usar. «Empezar de cero» va última
// a propósito: es la que menos cartera trae.
//
// ══ Y LA COLUMNA DERECHA NO ES DECORACIÓN ══════════════════════════════════
//
// «Cuando termines vas a ver» enseña el panel que va a tener, con las cifras en
// gris y a cero. Es lo que convierte «sube tu cartera» en una razón: se ve para
// qué sirve el trabajo que se está pidiendo.

const CARBON = '#15161A'

function Tarjeta({ children, destacada = false, style }) {
  return (
    <div style={{
      background: 'var(--cf-card)',
      border: destacada ? '1.5px solid var(--cf-gold)' : '1px solid var(--cf-border)',
      borderRadius: 'var(--cf-r-card)',
      padding: destacada ? '22px 24px' : '18px 20px',
      flex: 'none',
      ...style,
    }}>{children}</div>
  )
}

function Paso({ hecho, actual, texto }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 'none' }}>
      <span aria-hidden style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 24, height: 24, minWidth: 24, borderRadius: 999, flex: 'none',
        background: hecho ? 'var(--cf-gold)' : 'transparent',
        border: hecho ? 'none' : `2px solid ${actual ? 'var(--cf-gold)' : 'var(--cf-border-strong)'}`,
      }}>
        {hecho && (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--cf-gold-ink)"
            strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      <span style={{
        fontSize: 14.5,
        fontWeight: actual ? 700 : 600,
        color: hecho || actual ? 'var(--cf-ink)' : 'var(--cf-ink-4)',
      }}>{texto}</span>
    </div>
  )
}

export default function TraerCartera({
  nombre,
  onFoto, onWhatsApp, onExcel, onCero, onEscribirnos,
  // Lo que ya está hecho. Se pinta con lo que la app sabe, no con una lista fija:
  // quien llegó aquí ya creó la cuenta, y decirle que le falta es mentir.
  pasos = [],
  moneda = '$',
  // «Sin costo el primer mes» es una promesa comercial: solo se pinta si quien
  // monta la pantalla la pasa. Inventarla aquí sería comprometer al negocio.
  ayudaTexto,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ flex: 'none' }}>
        {nombre && (
          <span style={{
            display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.09em',
            textTransform: 'uppercase', color: 'var(--cf-ink-3)',
          }}>Bienvenida, {nombre}</span>
        )}
        <h1 className="text-[26px] lg:text-[36px]" style={{
          fontFamily: 'var(--font-space-grotesk), system-ui',
          fontWeight: 600, letterSpacing: '-.025em', lineHeight: 1.1,
          color: 'var(--cf-ink)', margin: '4px 0 0',
        }}>Trae tus préstamos y empezamos</h1>
        {/* LA RAZON, no la instruccion. «Sube tu cartera» es una orden; esto
            dice por que, y da el criterio para elegir camino. */}
        <p className="text-[14px] lg:text-[16px]" style={{
          color: 'var(--cf-ink-2)', margin: '10px 0 0', maxWidth: '62ch', lineHeight: 1.55,
        }}>
          Tu cartera vieja tiene que entrar antes de que la app te sirva de algo.
          Escoge por dónde: casi todos empiezan escribiendo los de esta semana.
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-5 lg:items-start">
        <div className="flex flex-col gap-3 lg:col-start-1">
          {/* ── ESCRIBIRLOS, PRIMERA Y LA ÚNICA DORADA ──────────────────────
              Aquí estaba la foto, con el rótulo «lo más rápido» y el único botón
              dorado, y «empezar de cero» iba de última con un texto que sonaba a
              rendirse: «voy metiendo los préstamos uno por uno».

              El dueño lo corrigió: «la opción recomendada por defecto debería
              ser manual». Y los datos le dan la razón — medido en producción:

                  clientes creados de a poco   5.026  (97%)
                  en ráfaga de 5+ por minuto     152  (3%)

              De los 78 negocios que llegaron a 10 clientes, NINGUNO cargó
              mayoritariamente en bloque. Estábamos recomendando de primeras la
              vía que usa el 3%, y a quien la rechazaba lo mandábamos a una
              opción redactada como si fuera darse por vencido. */}
          <Tarjeta destacada>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className="text-[19px] lg:text-[21px]" style={{
                fontFamily: 'var(--font-space-grotesk), system-ui',
                fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)',
              }}>Escribe tu primer cliente</span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px',
                borderRadius: 999, background: 'var(--cf-gold-tint)',
                fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
                textTransform: 'uppercase', color: 'var(--cf-gold-text)',
              }}>Recomendado</span>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--cf-ink-2)', margin: '10px 0 0' }}>
              Nombre, teléfono y cuánto le prestaste. Es como lo hace casi todo el mundo:
              se empieza con los de esta semana y el resto entra solo, según se van cobrando.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 16 }}>
              <button type="button" onClick={onCero} style={{
                height: 48, padding: '0 22px', borderRadius: 14, border: 0, cursor: 'pointer',
                background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
                font: 'inherit', fontSize: 15.5, fontWeight: 700,
              }}>Crear el primero</button>
            </div>
          </Tarjeta>

          {/* ── LA FOTO: SIGUE SIENDO LO MÁS VISTOSO, Y VA MARCADA ───────────
              «Trata de destacar un poco más la opción de imagen, porque es algo
              novedoso, pero ojo, que la opción recomendada debería ser la
              manual». Son dos jerarquías distintas: el oro marca lo que se
              recomienda, la pastilla marca lo que es nuevo. A quien tiene la
              libreta llena de verdad le sigue ahorrando la tarde. */}
          <Tarjeta>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <p style={{ fontSize: 16.5, fontWeight: 700, color: 'var(--cf-ink)', margin: 0 }}>
                    Tómale foto a tu libreta
                  </p>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px',
                    borderRadius: 999, background: 'var(--cf-gold-tint)',
                    fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
                    textTransform: 'uppercase', color: 'var(--cf-gold-dark)',
                  }}>Nuevo</span>
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--cf-ink-3)', margin: '3px 0 0' }}>
                  La IA lee los datos. Si tienes 40 préstamos en una libreta, unos 20 minutos.
                </p>
                {onWhatsApp && (
                  <button type="button" onClick={onWhatsApp} style={{
                    background: 'none', border: 0, padding: 0, marginTop: 8, cursor: 'pointer',
                    font: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--cf-gold-dark)',
                  }}>Mandarlas desde el teléfono</button>
                )}
              </div>
              <button type="button" onClick={onFoto} style={{
                height: 44, padding: '0 18px', borderRadius: 13, flex: 'none', cursor: 'pointer',
                background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
                font: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)',
              }}>Subir fotos</button>
            </div>
          </Tarjeta>

          {[
            { id: 'excel', titulo: 'Ya lo tengo en Excel', ayuda: 'Sube tu archivo y emparejamos las columnas contigo.', accion: 'Subir archivo', on: onExcel },
          ].filter((o) => o.on).map((o) => (
            <Tarjeta key={o.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 16.5, fontWeight: 700, color: 'var(--cf-ink)', margin: 0 }}>{o.titulo}</p>
                  <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--cf-ink-3)', margin: '3px 0 0' }}>{o.ayuda}</p>
                </div>
                <button type="button" onClick={o.on} style={{
                  height: 44, padding: '0 18px', borderRadius: 13, flex: 'none', cursor: 'pointer',
                  background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
                  font: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)',
                }}>{o.accion}</button>
              </div>
            </Tarjeta>
          ))}

          {/* SE PUEDE CERRAR Y VOLVER. Sin esta linea, la pantalla se lee como un
              trámite obligatorio de una sentada, y la cartera de cuarenta
              préstamos no entra de una sentada. */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flex: 'none',
            padding: '13px 16px', borderRadius: 'var(--cf-r-card)',
            background: 'var(--cf-gold-tint-2)', border: '1px solid var(--cf-gold-border)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cf-gold-dark)"
              strokeWidth="2" strokeLinecap="round" style={{ flex: 'none' }}>
              <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
            </svg>
            <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--cf-gold-text)' }}>
              Puedes cerrar esto y volver cuando quieras: lo que subas se guarda a medida que avanzas.
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:col-start-2">
          {/* ── PARA QUE SIRVE EL TRABAJO QUE SE PIDE ──
              El panel que va a tener, con las cifras a cero y en gris. Sin esto,
              «sube tu cartera» es una orden sin recompensa a la vista. */}
          <div style={{
            background: CARBON, borderRadius: 'var(--cf-r-card)', padding: '20px 22px',
            display: 'flex', flexDirection: 'column', gap: 14, flex: 'none',
          }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
              textTransform: 'uppercase', color: '#A3A8B2',
            }}>Cuando termines vas a ver</span>
            <div>
              <span style={{ display: 'block', fontSize: 12.5, color: '#8A8E98' }}>Tu cartera en la calle</span>
              <span className="cf-fig" style={{
                display: 'block', fontFamily: 'var(--font-space-grotesk), system-ui',
                fontSize: 30, fontWeight: 600, letterSpacing: '-.03em', color: '#54585F', marginTop: 3,
              }}>{moneda}00.000.000</span>
            </div>
            <div style={{
              display: 'flex', gap: 24, paddingTop: 13,
              borderTop: '1px solid rgba(255,255,255,.09)',
            }}>
              <span>
                <span style={{ display: 'block', fontSize: 12, color: '#8A8E98' }}>A cobrar hoy</span>
                <span className="cf-fig" style={{ display: 'block', fontSize: 16, color: '#54585F', marginTop: 2 }}>{moneda}00.000</span>
              </span>
              <span>
                <span style={{ display: 'block', fontSize: 12, color: '#8A8E98' }}>En mora</span>
                <span className="cf-fig" style={{ display: 'block', fontSize: 16, color: '#54585F', marginTop: 2 }}>0</span>
              </span>
            </div>
            <span style={{ fontSize: 12.5, lineHeight: 1.5, color: '#A3A8B2' }}>
              Estas cifras se llenan solas con lo que subas. Nadie más ve tus datos.
            </span>
          </div>

          {pasos.length > 0 && (
            <Tarjeta>
              <span style={{
                display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
                textTransform: 'uppercase', color: 'var(--cf-ink-3)', marginBottom: 14,
              }}>Lo que ya hiciste</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                {pasos.map((p) => <Paso key={p.texto} {...p} />)}
              </div>
            </Tarjeta>
          )}

          {onEscribirnos && (
            <Tarjeta>
              <p style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--cf-ink)', margin: 0 }}>
                ¿Te ayudamos a subirla?
              </p>
              <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--cf-ink-2)', margin: '5px 0 0' }}>
                {ayudaTexto ?? 'Mándanos las fotos por WhatsApp y te la dejamos lista.'}
              </p>
              <button type="button" onClick={onEscribirnos} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 14,
                height: 44, padding: '0 18px', borderRadius: 13, cursor: 'pointer',
                background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
                font: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#25D366"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 12a8 8 0 01-11.6 7.1L4 20l.9-4.3A8 8 0 1120 12z" />
                </svg>
                Escribirnos
              </button>
            </Tarjeta>
          )}
        </div>
      </div>
    </div>
  )
}
