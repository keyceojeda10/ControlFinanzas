'use client'

// components/pantallas/Onboarding.jsx — turnos 7 y 37. Registro y arranque.
//
// ══ LA LÁMINA T37-02 ES EL ORIGEN DE LAS CIFRAS FALSAS ══════════════════════
//
// Esa lámina dibuja, literalmente:
//
//     «Usa la app completa 30 días»            → son 14
//     «Cuando pases de 20 clientes»            → el plan Inicial son 100
//     «GRATIS 30 DÍAS»                         → 14
//     «Hasta 20 / Hasta 40 / Hasta 100»        → 100 / 450 / 1.000
//
// En el intento anterior copié esas cuatro y las shipeé. No las inventé: las leí
// del handoff. Pero eso no lo arregla — el usuario ve una promesa de 30 días y la
// prueba se le vence a los 14, y ve «hasta 20 clientes» cuando le caben 100, o sea
// el producto vendido CINCO VECES PEOR de lo que es. A quien tiene 68 clientes en
// un cuaderno, un «hasta 20» le dice que no le van a caber.
//
// Por eso en este archivo NO SE ESCRIBE NINGUNA CIFRA DE PLAN NI DE PRUEBA. Todo
// llega resuelto desde `lib/adaptadores/planes` —que lo saca de `PLANES_CONFIG` y
// de los precios por país— y de `DIAS_PRUEBA`. El día que cambie un precio o un
// tope, estas pantallas cambian solas.
//
// Es la cuarta vez en este rediseño que la lámina afirma algo que el código
// contradice, y la única en la que lo que la lámina dice se le PROMETE al cliente.
// La forma se toma de la lámina; los números, del código.
//
// ══ SON PANTALLAS SIN ARMAZÓN ═══════════════════════════════════════════════
//
// Registro y onboarding pasan antes de que exista la barra de navegación, así que
// aquí no aplica la regla del doble margen: no hay armazón que ponga el relleno
// lateral, y cada pantalla es dueña de su propio alto. Por eso cada export es una
// columna de altura completa que trae su propio pie —la barra de abajo con
// `border-top`— y su propio relleno.
//
// El teclado del teléfono que dibujan T07-02 y T37-01 es andamio del mockup, como
// el marco redondeado y la hora: no se construye (`01-TOKENS.md` lo dice de las
// teclas — «solo en mockups»).

const ORO = '#E7A400'

/* Dentro del bloque carbón los tokens no sirven: `--cf-ink` y compañía cambian con
   el tema y ese bloque es oscuro siempre. Literales de la paleta oscura. */
const CARBON = '#15161A'
const CARBON_ORO = '#F5B824'
const CARBON_VERDE = '#2FBE6A'
const CARBON_TINTA = '#F3F3F6'
const CARBON_TINTA_2 = '#C4C7CD'
const CARBON_TINTA_3 = '#A3A8B2'
const CARBON_TINTA_4 = '#8A8E98'
const CARBON_FILETE = 'rgba(255,255,255,.09)'

const PAD = 20       // T37 · relleno lateral
const PAD_ANCHO = 24 // T07-02 · el registro respira un poco más

/* ── Piezas ──────────────────────────────────────────────────────────────── */

/* La barra de progreso son CUATRO SEGMENTOS SEPARADOS, no una barra continua con
   un porcentaje. Con cuatro trozos se ve de un golpe cuántos pasos quedan; con una
   barra al 75% hay que estimar. `flexShrink: 0` en cada uno (regla 3: una barra de
   progreso encogible colapsa a 0px y el estado desaparece). */
function Segmentos({ paso = 0, total = 4, alto = 4, apagado = 'var(--cf-fill-2)' }) {
  return (
    <div style={{ display: 'flex', gap: 5, flex: 'none' }}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} style={{
          flex: 1, height: alto, borderRadius: 999, flexShrink: 0,
          background: i < paso ? ORO : apagado,
        }} />
      ))}
    </div>
  )
}

function Flecha({ onClick }) {
  if (!onClick) return null
  return (
    <button type="button" onClick={onClick} aria-label="Atrás" style={{
      border: 0, background: 'none', padding: 0, cursor: 'pointer', flex: 'none',
      display: 'inline-flex', alignItems: 'center',
    }}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-2)"
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  )
}

/* Verde de marca, no token: es el logo de otra empresa. */
function IconoWhatsApp({ tamano = 16 }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="none" stroke="#25D366"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
      <path d="M20 12a8 8 0 01-11.6 7.1L4 20l.9-4.3A8 8 0 1120 12z" />
    </svg>
  )
}

function Chevron({ tamano = 15 }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="none" stroke="rgba(20,20,28,.3)"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

/* La caja blanca con un aviso dentro. Sale en las tres pantallas. */
function Nota({ icono, texto, radio = 14, relleno = '14px 16px' }) {
  if (!texto) return null
  return (
    <div style={{
      flex: 'none', display: 'flex', gap: icono ? 10 : 0, alignItems: 'flex-start',
      padding: relleno, borderRadius: radio,
      background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
    }}>
      {icono}
      <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--cf-ink-2)' }}>{texto}</span>
    </div>
  )
}

/* Columna de pantalla completa. El cuerpo scrollea, el pie se queda abajo. */
function Pantalla({ children }) {
  return (
    <div style={{
      height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column',
      color: 'var(--cf-ink)',
    }}>{children}</div>
  )
}

function Cuerpo({ relleno, hueco, children }) {
  return (
    <div style={{
      flex: 1, minHeight: 0, overflowY: 'auto', padding: relleno,
      display: 'flex', flexDirection: 'column', gap: hueco,
    }}>{children}</div>
  )
}

/* La barra de acción de abajo. En T07-02 va sobre el fondo de la app; en T37 va
   blanca. La diferencia importa: la blanca separa el precio de la decisión. */
function Pie({ fondo = 'var(--cf-card)', relleno, children }) {
  const blanca = fondo === 'var(--cf-card)'
  return (
    <div style={{
      flex: 'none', padding: relleno, background: fondo,
      borderTop: `1px solid rgba(20,20,28,${blanca ? '.09' : '.07'})`,
      display: 'flex', flexDirection: 'column', gap: 9,
    }}>{children}</div>
  )
}

function BotonOro({ onClick, children, alto = 54, ocupado }) {
  return (
    <button type="button" onClick={onClick} disabled={ocupado} style={{
      width: '100%', height: alto, border: 'none', borderRadius: 14,
      background: ORO, color: 'var(--cf-gold-ink)', font: 'inherit',
      fontSize: 16, fontWeight: 700,
      cursor: ocupado ? 'progress' : 'pointer', opacity: ocupado ? 0.6 : 1,
    }}>{children}</button>
  )
}

/* La segunda acción va como texto centrado, sin caja: existe para quien la busca,
   pero no compite con la dorada. */
function Enlace({ onClick, children }) {
  if (!onClick) return null
  return (
    <button type="button" onClick={onClick} style={{
      alignSelf: 'center', border: 0, background: 'none', padding: 0, cursor: 'pointer',
      font: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--cf-ink-3)',
    }}>{children}</button>
  )
}

function Titular({ titulo, ayuda, tamano = 25, ayudaTamano = 14, centrado }) {
  return (
    <div style={{
      flex: 'none', display: 'flex', flexDirection: 'column', gap: centrado ? 9 : 8,
      alignItems: centrado ? 'center' : 'stretch', textAlign: centrado ? 'center' : 'left',
    }}>
      <span style={{
        fontFamily: 'var(--font-space-grotesk), system-ui',
        fontSize: tamano, fontWeight: 600, letterSpacing: '-.025em', lineHeight: 1.15,
        color: 'var(--cf-ink)',
      }}>{titulo}</span>
      {ayuda && (
        <span style={{
          fontSize: ayudaTamano, lineHeight: 1.45, color: 'var(--cf-ink-2)',
          maxWidth: centrado ? '30ch' : 'none',
        }}>{ayuda}</span>
      )}
    </div>
  )
}

/* ══ T07-02 · Registro: el WhatsApp ════════════════════════════════════════
   «¿A QUÉ NÚMERO TE ESCRIBIMOS?» — la pregunta en cristiano, no «teléfono».

   El prefijo es una CAJA APARTE con su chevron, no un adorno dentro del campo. Así
   se ve que se puede cambiar —son 12 países— y el anillo dorado queda solo donde
   hay que escribir.

   Y la nota hace dos trabajos en una frase:

     · «Sin el código de país, solo el número» evita el error más común del paso,
       que es escribirlo dos veces porque el prefijo ya está puesto al lado.
     · «Nunca te vamos a escribir para venderte nada» responde a la sospecha real de
       quien acaba de dar su WhatsApp a una app. */
export function RegistroWhatsApp({
  paso = 3, total = 4, deQue = 'Tu WhatsApp',
  prefijo, onPrefijo,
  numero, onNumero,
  titulo = '¿A qué número te escribimos?', ayuda, nota,
  onAtras, onContinuar, continuando = false, error,
}) {
  return (
    <Pantalla>
      {/* Aquí la barra va ARRIBA y las etiquetas debajo; en T37-01 es al revés.
          Cada lámina tiene su orden y no lo unifico. */}
      <div style={{ flex: 'none', padding: `14px ${PAD_ANCHO}px 0` }}>
        <Segmentos paso={paso} total={total} alto={3} apagado="rgba(20,20,28,.11)" />
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

      <Cuerpo relleno={`28px ${PAD_ANCHO}px 0`} hueco={22}>
        <Titular titulo={titulo} ayuda={ayuda} />

        <div style={{ display: 'flex', gap: 10, flex: 'none' }}>
          {prefijo && (
            <button
              type="button"
              onClick={onPrefijo}
              disabled={!onPrefijo}
              aria-label="Cambiar el país"
              style={{
                flex: 'none', display: 'flex', alignItems: 'center', gap: 9,
                height: 58, padding: '0 15px', borderRadius: 14,
                background: 'var(--cf-card)', border: '1px solid rgba(20,20,28,.1)',
                font: 'inherit', color: 'var(--cf-ink)',
                cursor: onPrefijo ? 'pointer' : 'default',
              }}
            >
              <span className="cf-num" style={{ fontSize: 17, fontWeight: 700 }}>{prefijo}</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(20,20,28,.3)"
                strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          )}
          {/* `type=tel` y no `number`: el teclado numérico sin las flechas de
              incremento, que en un teléfono no sirven de nada. */}
          <div style={{
            flex: 1, minWidth: 0, display: 'flex', alignItems: 'center',
            height: 58, padding: '0 16px', borderRadius: 14,
            background: 'var(--cf-card)',
            border: `1.5px solid ${ORO}`, boxShadow: '0 0 0 3px rgba(231,164,0,.13)',
          }}>
            <input
              value={numero ?? ''}
              onChange={(e) => onNumero?.(e.target.value)}
              type="tel" inputMode="tel" autoComplete="tel"
              aria-label="Tu número de WhatsApp"
              className="cf-num"
              style={{
                flex: 1, minWidth: 0, border: 0, background: 'none', padding: 0,
                outline: 'none', font: 'inherit',
                fontFamily: 'var(--font-space-grotesk), system-ui',
                fontSize: 19, fontWeight: 500, color: 'var(--cf-ink)',
              }}
            />
          </div>
        </div>

        <Nota icono={<IconoWhatsApp />} texto={nota} />

        {error && (
          <span role="alert" style={{ fontSize: 13, color: 'var(--cf-red-dark)', flex: 'none' }}>
            {error}
          </span>
        )}
      </Cuerpo>

      <Pie fondo="var(--cf-surface)" relleno={`14px ${PAD_ANCHO}px 16px`}>
        <div style={{ display: 'flex', gap: 10 }}>
          {onAtras && (
            <button type="button" onClick={onAtras} style={{
              flex: 1, height: 48, borderRadius: 14, cursor: 'pointer',
              background: 'var(--cf-card)', border: '1px solid rgba(20,20,28,.1)',
              color: 'var(--cf-ink-2)', font: 'inherit', fontSize: 15, fontWeight: 600,
            }}>Atrás</button>
          )}
          <div style={{ flex: 2, display: 'flex' }}>
            <BotonOro onClick={onContinuar} ocupado={continuando} alto={48}>
              {continuando ? 'Enviando…' : 'Continuar'}
            </BotonOro>
          </div>
        </div>
      </Pie>
    </Pantalla>
  )
}

/* ══ T37-01 · Verificar el WhatsApp ════════════════════════════════════════
   LA FRASE QUE AHORRA SOPORTE: «casi siempre que no llega es porque el número
   quedó mal escrito. Revísalo antes de pedir otro código».

   La lámina la pone ABAJO, empujada por un espaciador, lejos de las casillas: quien
   acierta el código no la lee, y quien se queda esperando sí. Y por eso el número
   se enseña arriba con un «está mal» al lado — corregirlo es la salida real, pedir
   otro código al número equivocado no arregla nada y quema el intento. */
export function VerificarWhatsApp({
  paso = 3, total = 4,
  numero, onCorregir,
  digitos = [], enCurso = null,
  segundosParaOtro, onMandarOtro,
  consejo, error,
  onAtras,
}) {
  return (
    <Pantalla>
      <div style={{
        flex: 'none', padding: `6px ${PAD}px 14px`,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Flecha onClick={onAtras} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--cf-ink-3)' }}>
            Paso {paso} de {total}
          </span>
        </div>
        <Segmentos paso={paso} total={total} />
      </div>

      <Cuerpo relleno={`0 ${PAD}px ${PAD}px`} hueco={17}>
        <Titular
          titulo="Te mandamos un código"
          ayuda="Míralo en WhatsApp y escríbelo aquí."
          tamano={27} ayudaTamano={15}
        />

        {/* El número, con la salida al lado. */}
        <div style={{
          flex: 'none', display: 'flex', alignItems: 'center', gap: 11,
          padding: '13px 16px', borderRadius: 14,
          background: 'var(--cf-card)', border: '1px solid rgba(20,20,28,.09)',
        }}>
          <IconoWhatsApp tamano={17} />
          <span className="cf-num" style={{
            flex: 1, minWidth: 0,
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 15, fontWeight: 600, color: 'var(--cf-ink)',
          }}>{numero}</span>
          {onCorregir && (
            <button type="button" onClick={onCorregir} style={{
              border: 0, background: 'none', padding: 0, cursor: 'pointer', font: 'inherit',
              fontSize: 13, fontWeight: 700, color: 'var(--cf-gold-dark)', flex: 'none',
            }}>Está mal</button>
          )}
        </div>

        {/* Las casillas. Cada una es su propia caja de 66px: un solo campo de seis
            dígitos no deja ver cuántos van. La que toca lleva anillo dorado y un
            cursor, no un dígito — marca dónde escribir, no lo escrito. */}
        <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
          {digitos.map((d, i) => {
            const activa = enCurso === i
            return (
              <span key={i} style={{
                flex: 1, minWidth: 0, height: 66, borderRadius: 14,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--cf-card)',
                border: activa ? `1.5px solid ${ORO}` : '1px solid rgba(20,20,28,.1)',
                boxShadow: activa ? '0 0 0 3px rgba(231,164,0,.13)' : 'none',
              }}>
                {activa
                  ? <span aria-hidden style={{ width: 2, height: 28, background: 'var(--cf-ink)' }} />
                  : (
                    <span className="cf-fig" style={{
                      fontFamily: 'var(--font-space-grotesk), system-ui',
                      fontSize: 27, fontWeight: 600, color: 'var(--cf-ink)',
                    }}>{d ?? ''}</span>
                  )}
              </span>
            )
          })}
        </div>

        <div style={{
          flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        }}>
          <span className="cf-num" style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>
            {segundosParaOtro ? <>Puedes pedir otro en <strong>{segundosParaOtro}</strong></> : ''}
          </span>
          <button
            type="button"
            onClick={onMandarOtro}
            disabled={Boolean(segundosParaOtro)}
            style={{
              border: 0, background: 'none', padding: 0, font: 'inherit', flex: 'none',
              fontSize: 13, fontWeight: 700,
              color: segundosParaOtro ? 'var(--cf-ink-4)' : 'var(--cf-gold-dark)',
              cursor: segundosParaOtro ? 'not-allowed' : 'pointer',
            }}
          >Mandar otro</button>
        </div>

        {error && (
          <span role="alert" style={{ fontSize: 13, color: 'var(--cf-red-dark)', flex: 'none' }}>
            {error}
          </span>
        )}

        {/* El espaciador —el único encogible permitido— empuja el consejo al pie. */}
        <div style={{ flex: 1, minHeight: 0 }} />

        <Nota
          radio={16}
          relleno="15px 17px"
          texto={consejo}
          icono={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-3)"
              strokeWidth="2" strokeLinecap="round" style={{ flex: 'none', marginTop: 1 }}>
              <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
            </svg>
          }
        />
      </Cuerpo>
    </Pantalla>
  )
}

/* ══ T37-02 · Empieza sin pagar nada ═══════════════════════════════════════
   EL CAMBIO DE FONDO DEL TURNO. Hoy este paso pide escoger entre tres planes con
   CERO CLIENTES en la app: es adivinar, y es una pantalla de cobro puesta justo
   antes del paso que decide si el negocio se queda.

   Aquí no hay nada que elegir. La tarjeta carbón dice lo que hay —$0, todo abierto,
   sin tarjeta— y los precios van debajo como INFORMACIÓN DE LO QUE VIENE: filas de
   una tarjeta blanca, no opciones seleccionables. La acción dorada no es
   «continuar», es CARGAR MI CARTERA, porque los clientes cargados son lo que
   predice que la cuenta pague.

   El único dorado de fondo es ese botón. La tarjeta del $0 va CARBÓN con la
   pastilla verde: si fuera dorada competiría con la acción y habría dos focos.

   ⚠️ NI UNA CIFRA SE ESCRIBE AQUÍ. `dias`, `limite` y `tramos` llegan resueltos de
   `DIAS_PRUEBA` y de `lib/adaptadores/planes`. La lámina dice «30 días» y «hasta 20
   clientes»: son 14 y 100. Ver la cabecera del archivo. */
export function EmpiezaSinPagar({
  progresoTexto, paso = 3, total = 4, onAtras,
  dias, hasta, limite,
  incluye,
  tramosTitulo = 'Después, según tu cartera', tramosNota = 'al mes', tramos = [],
  sinPrisa,
  onCargarCartera, onPagarYa,
}) {
  return (
    <Pantalla>
      {/* La barra dice QUÉ FALTA, no un número de paso: «falta cargar tu cartera»
          es lo que de verdad queda por hacer, y es el argumento de la pantalla. */}
      <div style={{
        flex: 'none', padding: `6px ${PAD}px 14px`,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Flecha onClick={onAtras} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--cf-ink-3)' }}>
            {progresoTexto}
          </span>
        </div>
        <Segmentos paso={paso} total={total} />
      </div>

      <Cuerpo relleno={`0 ${PAD}px ${PAD}px`} hueco={13}>
        <Titular
          titulo="Empieza sin pagar nada"
          tamano={26}
          ayuda={
            <>
              Usa la app completa {dias} días.
              {limite != null && <> Cuando pases de {limite} clientes te decimos qué plan te sirve.</>}
            </>
          }
        />

        <div style={{
          flex: 'none', background: CARBON, borderRadius: 20, padding: '20px 22px',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
            height: 26, padding: '0 11px', borderRadius: 11,
            background: 'rgba(47,190,106,.16)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: CARBON_VERDE, flex: 'none' }} />
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '.06em', color: CARBON_VERDE,
              textTransform: 'uppercase',
            }}>Gratis {dias} días</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            <span className="cf-fig" style={{
              fontFamily: 'var(--font-space-grotesk), system-ui',
              fontSize: 34, fontWeight: 600, letterSpacing: '-.035em', lineHeight: 1,
              color: CARBON_TINTA,
            }}>$0</span>
            {hasta && (
              <span style={{ fontSize: 14, color: CARBON_TINTA_3, paddingBottom: 3, flex: 'none' }}>
                hasta el {hasta}
              </span>
            )}
          </div>
          {incluye && (
            <span style={{
              fontSize: 14, lineHeight: 1.5, color: CARBON_TINTA_2,
              paddingTop: 13, borderTop: `1px solid ${CARBON_FILETE}`,
            }}>{incluye}</span>
          )}
        </div>

        {/* LOS PRECIOS COMO INFORMACIÓN: filas de una tarjeta, sin botón por plan.
            Y la frase que la desarma va DENTRO, como última fila estirada — para
            que se lea junto a los precios y no como una nota al pie. */}
        {tramos.length > 0 && (
          <div style={{
            flex: 1, minHeight: 0, background: 'var(--cf-card)',
            border: '1px solid var(--cf-border)', borderRadius: 'var(--cf-r-card)',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '15px 18px 11px',
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
                textTransform: 'uppercase', color: 'var(--cf-ink-3)',
              }}>{tramosTitulo}</span>
              <span style={{ fontSize: 11, color: 'var(--cf-ink-3)', flex: 'none' }}>{tramosNota}</span>
            </div>
            {tramos.map((t) => (
              <div key={t.id} style={{
                flex: 'none', display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 18px', borderTop: '1px solid var(--cf-hairline)',
              }}>
                {/* El techo de clientes es la etiqueta, no el nombre del plan: a la
                    hora de mirar precios lo que se compara es cuántos caben. Y sale
                    de PLANES_CONFIG. */}
                <span className="cf-num" style={{
                  flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)',
                }}>{t.techoBreve || t.techo || t.nombre}</span>
                <span className="cf-fig" style={{
                  fontFamily: 'var(--font-space-grotesk), system-ui',
                  fontSize: 15, fontWeight: 600, color: 'var(--cf-ink)', flex: 'none',
                }}>{t.precio}</span>
              </div>
            ))}
            {sinPrisa && (
              <div style={{
                flex: 1, minHeight: 0, display: 'flex', alignItems: 'center',
                padding: '12px 18px', borderTop: '1px solid var(--cf-hairline)',
              }}>
                <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--cf-ink-2)' }}>
                  {sinPrisa}
                </span>
              </div>
            )}
          </div>
        )}
      </Cuerpo>

      {/* LA ACCIÓN DORADA ES CARGAR LA CARTERA, no «continuar». Pagar queda como
          enlace: quien de verdad quiere pagar ya, lo encuentra. */}
      <Pie relleno={`14px ${PAD}px 22px`}>
        <BotonOro onClick={onCargarCartera}>Cargar mi cartera</BotonOro>
        <Enlace onClick={onPagarYa}>Pagar un plan desde ya</Enlace>
      </Pie>
    </Pantalla>
  )
}

/* ══ T37-03 · Listo ════════════════════════════════════════════════════════
   Una pantalla de éxito que no celebra en abstracto: dice LO QUE QUEDÓ CARGADO,
   con la cartera en pesos, porque ver sus $14.280.000 dentro de la app es lo que
   convence. La moneda de arriba cierra el arco que empezó en la cartera vacía.

   La acción dorada no es «empezar» ni «ir al panel» — es VER LOS 7 COBROS DE HOY,
   el trabajo concreto que ya puede hacer.

   Y «LO QUE FALTA, CUANDO PUEDAS» son filas con chevron —se puede entrar a
   arreglarlo— cerradas por la frase que las desactiva: «nada de esto te frena.
   Puedes cobrar hoy mismo y completarlo cuando pases por su casa». Sin ella, una
   lista de pendientes en la pantalla de éxito se lee como que la carga salió mal. */
export function ListoParaCobrar({
  titulo, subtitulo, detalle,
  carteraEtiqueta = 'Tu cartera quedó en', cartera,
  cifras = [],
  faltaTitulo = 'Lo que falta, cuando puedas', falta = [], faltaNota,
  onVerCobros, cobrosHoy, onPanel,
}) {
  return (
    <Pantalla>
      <Cuerpo relleno={`16px ${PAD}px ${PAD}px`} hueco={14}>
        <div style={{
          flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 16, padding: '14px 0 6px',
        }}>
          {/* La moneda. Es el dorado más grande del rediseño y es a propósito:
              cierra el arco que empezó en la pantalla de la cartera vacía. */}
          <span aria-hidden style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 88, minWidth: 88, height: 88, minHeight: 88, flex: 'none',
            borderRadius: 999, background: ORO, border: '4px solid #F5C518',
            boxShadow: '0 10px 28px rgba(231,164,0,.32)',
          }}>
            <span style={{
              fontFamily: 'var(--font-space-grotesk), system-ui',
              fontSize: 40, fontWeight: 700, color: 'var(--cf-gold-ink)',
            }}>$</span>
          </span>
          <Titular
            centrado
            tamano={29}
            ayudaTamano={15}
            titulo={subtitulo ? <>{titulo}<br />{subtitulo}</> : titulo}
            ayuda={detalle}
          />
        </div>

        {cartera && (
          <div style={{
            flex: 'none', background: CARBON, borderRadius: 20, padding: '19px 21px',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
              textTransform: 'uppercase', color: CARBON_TINTA_3,
            }}>{carteraEtiqueta}</span>
            {/* La cartera va en ORO SOBRE CARBÓN: es la cifra que convence. */}
            <span className="cf-fig" style={{
              fontFamily: 'var(--font-space-grotesk), system-ui',
              fontSize: 34, fontWeight: 600, letterSpacing: '-.035em', lineHeight: 1,
              color: CARBON_ORO,
            }}>{cartera}</span>
            {cifras.length > 0 && (
              <div style={{
                display: 'flex', gap: 8, paddingTop: 13, borderTop: `1px solid ${CARBON_FILETE}`,
              }}>
                {cifras.map((c, i) => (
                  <span key={c.etiqueta} style={{ display: 'contents' }}>
                    {i > 0 && <span aria-hidden style={{ width: 1, background: CARBON_FILETE, flex: 'none' }} />}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
                        textTransform: 'uppercase', color: CARBON_TINTA_4,
                      }}>{c.etiqueta}</span>
                      <span className="cf-fig" style={{
                        fontFamily: 'var(--font-space-grotesk), system-ui',
                        fontSize: 16, fontWeight: 600,
                        /* Lo que ya se puede hacer hoy va en verde; lo que solo se
                           cargó, en blanco. */
                        color: c.verde ? CARBON_VERDE : CARBON_TINTA,
                      }}>{c.valor}</span>
                    </div>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {falta.length > 0 && (
          <div style={{
            flex: 1, minHeight: 0, background: 'var(--cf-card)',
            border: '1px solid var(--cf-border)', borderRadius: 'var(--cf-r-card)',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ flex: 'none', padding: '15px 18px 11px' }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
                textTransform: 'uppercase', color: 'var(--cf-ink-3)',
              }}>{faltaTitulo}</span>
            </div>
            {falta.map((f) => {
              const texto = typeof f === 'string' ? f : f.texto
              const ir = typeof f === 'string' ? null : f.onIr
              const Fila = ir ? 'button' : 'div'
              return (
                <Fila
                  key={texto}
                  {...(ir ? { type: 'button', onClick: ir } : {})}
                  style={{
                    flex: 'none', display: 'flex', alignItems: 'center', gap: 11,
                    width: '100%', padding: '12px 18px',
                    background: 'none', border: 0,
                    borderTop: '1px solid var(--cf-hairline)',
                    font: 'inherit', textAlign: 'left',
                    color: 'var(--cf-ink)', cursor: ir ? 'pointer' : 'default',
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: ORO, flex: 'none' }} />
                  <span className="cf-num" style={{
                    flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600,
                  }}>{texto}</span>
                  {ir && <Chevron />}
                </Fila>
              )
            })}
            {/* LA FRASE QUE DESACTIVA LA LISTA, dentro de la tarjeta. */}
            {faltaNota && (
              <div style={{
                flex: 1, minHeight: 0, display: 'flex', alignItems: 'center',
                padding: '12px 18px', borderTop: '1px solid var(--cf-hairline)',
              }}>
                <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--cf-ink-2)' }}>
                  {faltaNota}
                </span>
              </div>
            )}
          </div>
        )}
      </Cuerpo>

      <Pie relleno={`14px ${PAD}px 22px`}>
        {onVerCobros && (
          <BotonOro onClick={onVerCobros}>
            {cobrosHoy != null ? `Ver los ${cobrosHoy} cobros de hoy` : 'Ver los cobros de hoy'}
          </BotonOro>
        )}
        <Enlace onClick={onPanel}>Ir al panel</Enlace>
      </Pie>
    </Pantalla>
  )
}
