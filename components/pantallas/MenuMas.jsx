'use client'

// components/pantallas/MenuMas.jsx — T43-01 «el menú del +».
//
// ══ AGRUPADO POR LO QUE LE PASA A LA PLATA ══════════════════════════════════
//
// Las mismas nueve opciones de antes, pero en cuatro grupos: ENTRA PLATA, SALE
// PLATA, CREAR e IR A. Nueve verbos en una lista plana obligan a leerlos todos;
// agrupados, el ojo va directo al que buscaba.
//
// Y los grupos no son categorías de producto («pagos», «préstamos»): son lo que
// el dueño está pensando cuando abre el menú, que es si va a entrar o a salir
// dinero.
//
// ══ LAS ACCIONES Y LOS DESTINOS NO SE PARECEN ═══════════════════════════════
//
// «Registrar un pago» hace algo; «ver la caja» solo lleva. Si las dos son una fila
// blanca con flecha, compiten como si fueran lo mismo. Por eso los destinos van en
// REJILLA DE DOS COLUMNAS, más bajos y SIN FLECHA.
//
// ══ CADA OPCIÓN TRAE SU CIFRA ═══════════════════════════════════════════════
//
// «5 pendientes», «$2.5M libres», «vence en 5 días», «sin cerrar». Con la cifra al
// lado, un menú se vuelve un panel: el dueño decide desde aquí sin entrar a mirar.
// Es el mismo criterio de la pantalla «Más».
//
// ══ LO QUE NO ESTÁ, Y ES A PROPÓSITO ════════════════════════════════════════
//
// «Nueva ruta» no aparece. La lámina no la pone y tiene sentido: crear una ruta se
// hace desde la lista de rutas, con su botón «Nuevo» —igual que los socios—, no
// desde el menú de «qué voy a hacer ahora». Una ruta no se crea a diario; un pago
// sí. Meterla aquí alargaría el grupo CREAR para el 1% de las veces.

const ORO = '#E7A400'
/* Sobre el dorado a pantalla completa la tinta es la oscura de siempre, y sus dos
   grados de gris salen de bajarle alfa — no de un gris del tema, que sobre dorado
   se ensucia. */
const TINTA = 'var(--cf-gold-ink)'
const TINTA_2 = 'rgba(58,41,0,.62)'
const TINTA_3 = 'rgba(58,41,0,.55)'
/* Las tarjetas no son blanco puro: a 92% el dorado se transparenta lo justo para
   que se lean como algo puesto ENCIMA del fondo y no como agujeros. */
const TARJETA = 'rgba(255,255,255,.92)'

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(20,20,28,.28)"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

/* El icono. El de la acción principal de cada grupo va en dorado suave; los demás
   en gris. Es lo único que jerarquiza dentro del grupo, y basta. */
function Icono({ children, destacado, tamano = 38, radio = 12 }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: tamano, minWidth: tamano, height: tamano, minHeight: tamano,
      borderRadius: radio, flex: 'none',
      background: destacado ? 'var(--cf-gold-tint)' : 'var(--cf-fill)',
      color: destacado ? 'var(--cf-gold-dark)' : 'var(--cf-ink-2)',
    }}>{children}</span>
  )
}

function Rotulo({ children }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '.11em',
      textTransform: 'uppercase', color: TINTA_3,
    }}>{children}</span>
  )
}

/* ── Una acción ───────────────────────────────────────────────────────────── */

function Accion({ icono, titulo, cifra, destacado, onClick, ultima, primera }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, width: '100%',
        // Con cifra la fila crece: dos líneas necesitan sitio, y la que la tiene
        // es siempre la principal del grupo.
        height: cifra ? 62 : 56, padding: '0 18px',
        background: 'none', border: 0,
        borderTop: primera ? 'none' : '1px solid var(--cf-hairline)',
        cursor: 'pointer', textAlign: 'left', font: 'inherit',
      }}
    >
      <Icono destacado={destacado}>{icono}</Icono>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--cf-ink)' }}>{titulo}</span>
        {cifra && (
          <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{cifra}</span>
        )}
      </span>
      <Chevron />
    </button>
  )
}

function Grupo({ titulo, acciones = [], hueco = 9 }) {
  if (acciones.length === 0) return null
  return (
    <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: hueco }}>
      <Rotulo>{titulo}</Rotulo>
      <div style={{ background: TARJETA, borderRadius: 'var(--cf-r-card)', overflow: 'hidden' }}>
        {acciones.map((a, i) => (
          <Accion key={a.id} {...a} primera={i === 0} ultima={i === acciones.length - 1} />
        ))}
      </div>
    </div>
  )
}

/* ── Los destinos ─────────────────────────────────────────────────────────── */

/* REJILLA DE DOS, MÁS BAJOS Y SIN FLECHA. Un destino no hace nada: lleva. Si se
   dibujara como las acciones, «ver la caja» pesaría lo mismo que «registrar un
   pago», y no pesan lo mismo. */
function Destinos({ titulo, destinos = [] }) {
  if (destinos.length === 0) return null
  return (
    <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Rotulo>{titulo}</Rotulo>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: Math.ceil(destinos.length / 2) }, (_, fila) => (
          <div key={fila} style={{ display: 'flex', gap: 8 }}>
            {destinos.slice(fila * 2, fila * 2 + 2).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={d.onClick}
                style={{
                  flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10,
                  height: 52, padding: '0 14px', borderRadius: 14,
                  background: TARJETA, border: 0, cursor: 'pointer',
                  textAlign: 'left', font: 'inherit',
                }}
              >
                <span style={{ display: 'inline-flex', flex: 'none', color: 'var(--cf-ink-2)' }}>
                  {d.icono}
                </span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)' }}>{d.titulo}</span>
                  {d.cifra && (
                    <span className="cf-num" style={{
                      fontSize: 11,
                      // Lo que urge va en dorado oscuro y en negrita: «vence en 5
                      // días» no es un dato más.
                      fontWeight: d.urgente ? 600 : 400,
                      color: d.urgente ? 'var(--cf-gold-text-2)' : 'var(--cf-ink-3)',
                    }}>{d.cifra}</span>
                  )}
                </span>
              </button>
            ))}
            {/* Impar: el hueco se rellena para que la última no ocupe el doble. */}
            {destinos.slice(fila * 2, fila * 2 + 2).length === 1 && (
              <span aria-hidden style={{ flex: 1 }} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── La pantalla ──────────────────────────────────────────────────────────── */

export default function MenuMas({
  titulo = '¿Qué vas a hacer?', cuando,
  grupos = [],
  destinosTitulo = 'Ir a', destinos = [],
  lucas,
  onCerrar,
}) {
  return (
    <div style={{
      height: '100%', minHeight: 0, position: 'relative', overflow: 'hidden',
      // EL DORADO A PANTALLA COMPLETA: es el momento en que la app pregunta, y es
      // memorable. Único sitio del sistema donde el oro es el fondo.
      background: ORO, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 24px 92px',
        display: 'flex', flexDirection: 'column', gap: 13,
      }}>
        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 24, fontWeight: 600, letterSpacing: '-.025em', color: TINTA,
          }}>{titulo}</span>
          {/* La fecha y la hora: el menú es el sitio donde se decide qué hacer
              ahora, y «7:14 a. m.» cambia lo que tiene sentido hacer. */}
          {cuando && (
            <span className="cf-num" style={{ fontSize: 12, color: TINTA_2 }}>{cuando}</span>
          )}
        </div>

        {grupos.map((g) => (
          <Grupo key={g.titulo} {...g} hueco={g.acciones?.length > 1 ? 9 : 8} />
        ))}

        <Destinos titulo={destinosTitulo} destinos={destinos} />

        {/* LUCAS ES UNA TARJETA BLANCA COMO LAS DEMÁS, con el icono en dorado
            suave — el mismo tratamiento que la acción destacada de cada grupo. La
            versión anterior le ponía un círculo carbón encima del dorado y se leía
            como un parche: dos oscuros distintos peleando sobre el mismo fondo.

            Va al pie porque no es una acción: es otra forma de usar la app. */}
        {lucas && (
          <button type="button" onClick={lucas.onClick} style={{
            flex: 'none', display: 'flex', alignItems: 'center', gap: 13,
            height: 66, padding: '0 18px', borderRadius: 'var(--cf-r-card)',
            background: TARJETA, border: 0, cursor: 'pointer',
            textAlign: 'left', font: 'inherit',
          }}>
            <Icono destacado>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z" />
              </svg>
            </Icono>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--cf-ink)' }}>
                {lucas.titulo ?? 'Preguntarle a Lucas'}
              </span>
              {/* El ejemplo entre comillas enseña QUÉ se le puede preguntar. Sin
                  él, «preguntarle a Lucas» no dice de qué se le puede hablar. */}
              {lucas.ejemplo && (
                <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>“{lucas.ejemplo}”</span>
              )}
            </span>
            <Chevron />
          </button>
        )}
      </div>

      {/* Cerrar es un círculo carbón con la X dorada, no otro dorado: sobre un
          fondo de oro, lo único que se distingue es lo oscuro. */}
      {onCerrar && (
        <button type="button" onClick={onCerrar} aria-label="Cerrar el menú" style={{
          position: 'absolute', right: 22, bottom: 22,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 62, minWidth: 62, height: 62, minHeight: 62, borderRadius: 999,
          background: '#15161A', border: 0, padding: 0, cursor: 'pointer',
          boxShadow: '0 6px 20px rgba(58,41,0,.32)',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F5B824"
            strokeWidth="2.6" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </div>
  )
}
