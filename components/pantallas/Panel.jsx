'use client'

// components/pantallas/Panel.jsx — El panel del dueño. Lámina T02-01.
//
// EL HERO ES DORADO, y eso no es una decisión mía. El pie de T02-01 lo explica:
//
//   «El hero dorado se queda —es el momento dorado del sistema— pero baja de
//    300px a 150px y ahora sí informa: recaudado, meta, progreso y cobros.
//    Mora y caja pasan a blanco: hoy son dos tarjetas teñidas que compiten
//    entre sí. La misma cifra de mora dejó de repetirse tres veces.»
//
// «Hoy» ahí significa la app EN PRODUCCIÓN, no un intento anterior: el dorado
// viene de la pantalla que el usuario ya tiene, y se queda por continuidad. Yo
// lo había cambiado por un bloque oscuro razonando por mi cuenta.
//
// LOS CINCO BLOQUES, EN ESTE ORDEN:
//
//   1 · saludo + fecha        ← lo manda T40-00-a: «el saludo baja al cuerpo»
//   2 · hero dorado           ← recaudado, meta, %, cobrados/pendientes/ayer
//   3 · dos tarjetas blancas  ← en caja · en mora (con su monto expuesto)
//   4 · necesita tu atención  ← con contador y chevrones
//   5 · por ruta hoy          ← una barra por ruta, con su color
//
// LA MORA SE DICE UNA VEZ. Está en su tarjeta con «20 de 25 · $3,1M expuestos»,
// y NO vuelve a salir en «Necesita tu atención»: ahí va un corte distinto —los
// que pasan de 30 días— porque «se atrasó» y «probablemente no vuelve» son dos
// decisiones diferentes.
//
// UNA DISCREPANCIA DEL PAQUETE, dicha para que nadie la descubra a medias:
// T40-00-a dibuja este panel con un bloque OSCURO de «Patrimonio» como titular.
// Es turno 40, posterior a este. Pero la guía dice que el turno 40 es «la
// cabecera definitiva» y su pie habla solo de la cabecera: el cuerpo que enseña
// es andamio para mirar el encabezado. La guía también dice, literal, que el
// panel es `T02-01`. Así que manda T02-01 para el cuerpo y T40 para la cabecera.
//
// Presentacional a propósito: recibe todo por props. Así se puede ver y ajustar
// contra la lámina sin depender de la base de datos.

import { Tarjeta } from '@/components/cf/primitivos'

/* ══ El hero dorado ══
   Sobre dorado el texto es #3A2900 y los rótulos #7A5800 — NUNCA blanco. Y la
   barra va en #3A2900 sobre una pista del mismo tono al 16%: sobre dorado, un
   relleno blanco no se ve. */
function Hero({ recaudado, meta, porcentaje = 0, cobrados = 0, pendientes = 0, ayer }) {
  const pie = [
    `${cobrados} cobrado${cobrados === 1 ? '' : 's'}`,
    `${pendientes} pendiente${pendientes === 1 ? '' : 's'}`,
    ayer ? `ayer ${ayer}` : null,
  ].filter(Boolean)

  return (
    <div style={{
      background: 'var(--cf-gold)',
      borderRadius: 'var(--cf-r-card)',
      padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 14,
      flex: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.11em', textTransform: 'uppercase',
            color: 'var(--cf-gold-text)',
          }}>Recaudado hoy</span>
          <span className="cf-fig" style={{
            fontSize: 38, letterSpacing: '-.03em', color: 'var(--cf-gold-ink)',
          }}>{recaudado}</span>
          {/* La meta va DEBAJO de la cifra, no al lado: «$412.000 de $872.867»
              en una línea hace dudar de cuál de los dos es lo cobrado. */}
          {meta && (
            <span className="cf-num" style={{
              fontSize: 13, fontWeight: 600, color: 'var(--cf-gold-text)',
            }}>de {meta} · meta del día</span>
          )}
        </div>
        <span className="cf-fig" style={{
          display: 'inline-flex', alignItems: 'center', flex: 'none',
          height: 26, padding: '0 11px', borderRadius: 'var(--cf-r-pill)',
          background: 'rgba(58,41,0,.14)',
          fontSize: 14, fontWeight: 700, color: 'var(--cf-gold-ink)',
        }}>{porcentaje}%</span>
      </div>

      <div style={{
        height: 8, borderRadius: 999, overflow: 'hidden', flex: 'none',
        background: 'rgba(58,41,0,.16)',
      }}>
        <span style={{
          display: 'block', height: 8, borderRadius: 999,
          width: `${Math.max(0, Math.min(100, porcentaje))}%`,
          background: 'var(--cf-gold-ink)',
        }} />
      </div>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        {pie.map((t, i) => (
          <span key={i} className="cf-num" style={{
            fontSize: 12, fontWeight: 600, color: 'var(--cf-gold-text)',
          }}>{t}</span>
        ))}
      </div>
    </div>
  )
}

/* ══ Las dos tarjetas blancas ══
   Antes eran dos tarjetas TEÑIDAS —una verde y una roja— y competían entre sí:
   con las dos gritando, ninguna era la importante. En blanco, el color queda
   solo en la cifra que de verdad lo necesita. */
function TarjetaDato({ rotulo, children, pie }) {
  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: 'var(--cf-card)',
      border: '1px solid var(--cf-border)',
      borderRadius: 'var(--cf-r-card)',
      padding: 15,
      display: 'flex', flexDirection: 'column', gap: 7,
    }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
        color: 'var(--cf-ink-3)',
      }}>{rotulo}</span>
      {children}
      {pie && <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{pie}</span>}
    </div>
  )
}

/* ══ Fila de «Necesita tu atención» ══
   El punto de 7px dice la gravedad sin teñir la fila, y el chevrón dice que se
   entra. Antes llevaba un botón de texto «Ver →»: cuatro botones seguidos son
   cuatro decisiones, y la fila entera ya es el objetivo. */
function FilaAtencion({ tono = 'atraso', texto, onIr }) {
  const color = tono === 'mora' ? 'var(--cf-red)' : tono === 'ok' ? 'var(--cf-green)' : 'var(--cf-gold)'
  return (
    <button type="button" onClick={onIr} style={{
      display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left',
      padding: '12px 16px', flex: 'none',
      borderTop: '1px solid var(--cf-hairline)',
      borderLeft: 0, borderRight: 0, borderBottom: 0,
      background: 'none', cursor: onIr ? 'pointer' : 'default',
      fontFamily: 'var(--font-manrope), system-ui',
    }}>
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: color, flex: 'none' }} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: 'var(--cf-ink)', lineHeight: 1.35 }}>
        {texto}
      </span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cf-chevron)"
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
        <path d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

/* ══ Por ruta hoy ══
   El color responde «¿a quién llamo?»: verde va bien, dorado va corto, gris no
   ha empezado. Y el 0% lleva barra al 2%: una barra de ancho cero desaparece y
   la ruta parece que no existe, cuando lo que pasa es que no ha cobrado nada —
   que es justo lo que hay que ver. */
const COLOR_RUTA = {
  ok:   { texto: 'var(--cf-green-dark)', barra: 'var(--cf-green)' },
  oro:  { texto: 'var(--cf-gold-dark)',  barra: 'var(--cf-gold)' },
  nada: { texto: 'var(--cf-ink-3)',      barra: 'var(--cf-ink-4)' },
}

function FilaRuta({ nombre, porcentaje = 0, tono = 'oro' }) {
  const c = COLOR_RUTA[tono] || COLOR_RUTA.oro
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span style={{
          fontSize: 13, fontWeight: 600, color: 'var(--cf-ink)',
          minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{nombre}</span>
        <span className="cf-num" style={{ fontSize: 12, fontWeight: 700, color: c.texto, flex: 'none' }}>
          {porcentaje}%
        </span>
      </div>
      <div style={{ height: 5, borderRadius: 999, background: 'var(--cf-fill)', overflow: 'hidden', flex: 'none' }}>
        <span style={{
          display: 'block', height: 5, borderRadius: 999,
          width: `${Math.max(2, Math.min(100, porcentaje))}%`,
          background: c.barra,
        }} />
      </div>
    </div>
  )
}

export default function Panel({
  saludo = 'Buenos días',
  nombre = '',
  fecha = '',
  hero,
  caja,
  mora,
  atencion = [],
  porRuta,
  // DOBLE MARGEN, y era visible: el hero medía 310px de ancho empezando en x40
  // cuando la lámina lo pone a 350 empezando en x20.
  //
  // El layout del dashboard ya pone 20px laterales con su `px-5`, así que el
  // `var(--cf-pad-screen)` de acá los sumaba: 40 a cada lado. La convención del
  // sistema es que la pantalla nueva suelte SU relleno con `sinMargen` —
  // PantallaMas ya lo hacía— y este componente no declaraba la prop. La página
  // se la pasaba desde el primer día; simplemente se caía al suelo.
  //
  // Cuarta vez el mismo patrón en esta sesión (el FAB, la campana, las props de
  // la barra lateral, y esto): prop pasada, prop no consumida, y nada falla —
  // solo queda mal. De ahí la prueba de lib/__tests__/sin-margen.test.js.
  sinMargen = false,
  onIr,
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 12,
      padding: sinMargen ? '8px 0 0' : '8px var(--cf-pad-screen) 0',
    }}>

      {/* 1 · El saludo va en el CUERPO, no en la cabecera. Lo manda T40-00-a:
             «el saludo baja al cuerpo, donde puede ser grande». */}
      <div style={{ flex: 'none' }}>
        <h1 style={{
          fontFamily: 'var(--font-space-grotesk), system-ui',
          fontSize: 22, fontWeight: 600, letterSpacing: '-.02em', lineHeight: 1.2,
          color: 'var(--cf-ink)', margin: 0,
        }}>{saludo}, {nombre}</h1>
        {fecha && (
          <span className="cf-num" style={{ display: 'block', fontSize: 12, color: 'var(--cf-ink-3)', marginTop: 2 }}>
            {fecha}
          </span>
        )}
      </div>

      {/* 2 · El hero dorado */}
      {hero && <Hero {...hero} />}

      {/* 3 · Las dos tarjetas blancas.
             `caja` solo la ve el owner: al cobrador el servidor le manda
             `finanzas: null`, y un «$0 para prestar» le enseñaría un negocio
             quebrado. Sin ella, la de mora ocupa el ancho entero. */}
      {(caja || mora) && (
        <div style={{ display: 'flex', gap: 10, flex: 'none' }}>
          {caja && (
            <TarjetaDato rotulo="En caja" pie="Para prestar ahora">
              <span className="cf-fig" style={{
                fontSize: 21, letterSpacing: '-.025em', color: 'var(--cf-ink)',
              }}>{caja}</span>
            </TarjetaDato>
          )}
          {mora && (
            <TarjetaDato rotulo="En mora" pie={mora.expuesto ? `${mora.expuesto} expuestos` : null}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                {/* El conteo en rojo, el total en gris: son dos cifras y solo
                    una es la mala noticia. «20 de 25» todo en rojo se lee como
                    si los 25 estuvieran en mora. */}
                <span className="cf-fig" style={{
                  fontSize: 21, letterSpacing: '-.025em',
                  color: mora.cuantos > 0 ? 'var(--cf-red)' : 'var(--cf-ink)',
                }}>{mora.cuantos}</span>
                {mora.deCuantos > 0 && (
                  <span className="cf-num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--cf-ink-3)' }}>
                    de {mora.deCuantos}
                  </span>
                )}
              </div>
            </TarjetaDato>
          )}
        </div>
      )}

      {/* 4 · Necesita tu atención. Si no hay nada, no se pinta: una tarjeta
             vacía con el rótulo puesto dice que hay algo que mirar. */}
      {atencion.length > 0 && (
        <div style={{
          background: 'var(--cf-card)',
          border: '1px solid var(--cf-border)',
          borderRadius: 'var(--cf-r-card)',
          overflow: 'hidden', flex: 'none',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px 10px',
          }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
              color: 'var(--cf-ink-3)',
            }}>Necesita tu atención</span>
            <span className="cf-num" style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 20, height: 20, padding: '0 6px', borderRadius: 999,
              background: 'var(--cf-fill)', fontSize: 11, fontWeight: 700, color: 'var(--cf-ink-2)',
            }}>{atencion.length}</span>
          </div>
          {atencion.map((a, i) => (
            <FilaAtencion key={i} {...a} onIr={a.destino ? () => onIr?.(a.destino) : undefined} />
          ))}
        </div>
      )}

      {/* 5 · Por ruta hoy */}
      {porRuta?.rutas?.length > 0 && (
        <Tarjeta style={{ gap: 13, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
              color: 'var(--cf-ink-3)',
            }}>Por ruta hoy</span>
            {/* Repite el total del hero A PROPÓSITO: es la suma de las barras de
                abajo, y verla cuadrar es lo que hace creíble el desglose. */}
            <span className="cf-num" style={{ fontSize: 12, fontWeight: 600, color: 'var(--cf-ink-3)', flex: 'none' }}>
              {porRuta.recaudado} de {porRuta.meta}
            </span>
          </div>
          {porRuta.rutas.map((r) => <FilaRuta key={r.id ?? r.nombre} {...r} />)}
        </Tarjeta>
      )}
    </div>
  )
}
