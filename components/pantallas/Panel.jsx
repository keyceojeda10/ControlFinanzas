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

import { useState } from 'react'
import { Tarjeta } from '@/components/cf/primitivos'

/* Cuántas rutas se ven sin desplegar.
   Cinco no es un número redondo cualquiera: es lo que hace que esta tarjeta
   mida parecido a «Necesita tu atención», que es su pareja en la fila de la
   rejilla de 1440. Con diez, la columna de al lado quedaba con un hueco enorme
   debajo — que es lo que se veía desproporcionado. */
const RUTAS_VISIBLES = 5

/* ══ El hero dorado ══
   Sobre dorado el texto es #3A2900 y los rótulos #7A5800 — NUNCA blanco. Y la
   barra va en #3A2900 sobre una pista del mismo tono al 16%: sobre dorado, un
   relleno blanco no se ve. */
function Hero({ recaudado, meta, porcentaje = 0, cobrados = 0, pendientes = 0, ayer, semana }) {
  // La barra mas alta manda la escala. Con todo en cero no se pinta nada: siete
  // barras planas no son un grafico, son ruido.
  const tope = Math.max(...(semana ?? [0]))
  const pie = [
    `${cobrados} cobrado${cobrados === 1 ? '' : 's'}`,
    `${pendientes} pendiente${pendientes === 1 ? '' : 's'}`,
    ayer ? `ayer ${ayer}` : null,
  ].filter(Boolean)

  return (
    /* EL DORADO NO CRECE CON LA PANTALLA.
       En un teléfono son 350px de ancho y funciona: la cifra llena el bloque. A
       1440 el mismo bloque son 1.560px de oro macizo con «$0» solo en la esquina
       izquierda y medio metro de amarillo vacío a la derecha — la pantalla entera
       gritando por una cifra que cabe en dos dedos.

       Se le pone tope. El resto del ancho lo aprovechan las tarjetas de abajo,
       que sí tienen dos columnas que llenar. */
    <div style={{
      background: 'var(--cf-gold)',
      borderRadius: 'var(--cf-r-card)',
      padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 14,
      flex: 'none', maxWidth: 720,
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

      {/* LOS SIETE DIAS. Contestan «¿hoy es un buen día o es un día normal?»,
          que la cifra sola no contesta. El de hoy va en carbón y los seis
          anteriores en dorado quemado: sin esa diferencia la barra de hoy se
          pierde entre las otras seis.

          ⚠ ANTES ESTO ERA `hidden lg:flex`: las siete barras solo se pintaban en
          escritorio, porque se construyeron contra T02-07, que es la lámina de
          1440. En el teléfono —que es donde el dueño mira— el historial de la
          semana no existía.

          El dueño lo pidió por su nombre: «cuánto está cobrando en el día, con
          un pequeño historial de una semana; eso era lo que teníamos antes y
          funcionaba bien». Una lámina de escritorio no decide qué ve el que va
          en la calle. En móvil van más bajas (44px) para no empujar las dos
          tarjetas blancas fuera de la primera pantalla. */}
      {semana && tope > 0 && (
        <div
          className="flex h-[44px] lg:h-[62px]"
          style={{ gap: 8, alignItems: 'flex-end', flex: 'none' }}
          aria-hidden
        >
          {semana.map((n, i) => (
            <span key={i} style={{
              flex: 1, minWidth: 0,
              // `flex: none` en el alto y un minimo de 6px: una barra de altura
              // cero desaparece y el dia parece que no existe, cuando lo que
              // pasa es que no se cobro nada — que es justo lo que hay que ver.
              height: `${Math.max(6, Math.round((n / tope) * 100))}%`,
              borderRadius: '6px 6px 0 0',
              background: i === semana.length - 1 ? 'var(--cf-gold-ink)' : 'rgba(58,41,0,.16)',
            }} />
          ))}
        </div>
      )}
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
// EN CORTO. La lamina escribe «$1.84M», no «$1.840.000»: en una fila que ya
// lleva una frase larga, la cifra exacta la alarga sin decir nada mas. Del
// millon para arriba se abrevia; por debajo va entera, porque «$0.84M» no se
// lee.
function compacto(n) {
  const v = Math.round(Number(n) || 0)
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2).replace('.', ',')}M`
  return `$${v.toLocaleString('es-CO')}`
}

// `monto` es LA PLATA QUE HAY DETRAS de la alerta, y es lo que decide cual se
// mira primero. Trece prestamos de $50.000 y tres de $2.000.000 se leian igual;
// con la cifra al lado dejan de leerse igual. En movil se pinta debajo del
// texto, que a 390 no caben las dos cosas en una linea.
function FilaAtencion({ tono = 'atraso', texto, monto, onIr }) {
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
      {monto > 0 && (
        <span className="cf-fig" style={{
          flex: 'none', fontSize: 13, fontWeight: 600, color: 'var(--cf-ink-2)',
        }}>{compacto(monto)}</span>
      )}
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
  // ── T02-07 · LAS ACCIONES DE LA FILA DEL TITULO ──
  // En 1440 la lamina pone «Actualizar» y «Nuevo prestamo» A LA DERECHA DEL
  // SALUDO. En movil no van ahi —para eso esta el FAB— asi que la pagina solo
  // las pasa cuando hay sitio.
  acciones,
}) {
  // Cinco rutas visibles y el resto a un toque. Ver .
  const [verTodasRutas, setVerTodasRutas] = useState(false)

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 12,
      padding: sinMargen ? '8px 0 0' : '8px var(--cf-pad-screen) 0',
    }}>

      {/* 1 · El saludo va en el CUERPO, no en la cabecera. Lo manda T40-00-a:
             «el saludo baja al cuerpo, donde puede ser grande». */}
      <div
        className="flex items-start justify-between gap-4"
        style={{ flex: 'none' }}
      >
        <div style={{ minWidth: 0 }}>
          {/* MAS GRANDE EN 1440. A 22px sobre 1.400 de ancho el saludo se pierde;
              la lamina lo pone a 34. */}
          <h1 className="text-[22px] lg:text-[34px]" style={{
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontWeight: 600, letterSpacing: '-.025em', lineHeight: 1.15,
            color: 'var(--cf-ink)', margin: 0,
          }}>{saludo}, {nombre}</h1>
          {fecha && (
            <span className="cf-num lg:text-[13px]" style={{ display: 'block', fontSize: 12, color: 'var(--cf-ink-3)', marginTop: 2 }}>
              {fecha}
            </span>
          )}
        </div>
        {acciones && (
          <div className="hidden lg:flex items-center gap-2" style={{ flex: 'none' }}>{acciones}</div>
        )}
      </div>

      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-4 lg:items-start">

      {/* 2 · El hero dorado */}
      {hero && (
        <div className="lg:col-start-1 lg:row-start-1 flex flex-col">
          <Hero {...hero} />
        </div>
      )}

      {/* 3 · Las dos tarjetas blancas.
             `caja` solo la ve el owner: al cobrador el servidor le manda
             `finanzas: null`, y un «$0 para prestar» le enseñaría un negocio
             quebrado. Sin ella, la de mora ocupa el ancho entero. */}
      {(caja || mora) && (
        // EN 1440 SE APILAN. Una al lado de otra en una columna de 360 deja dos
        // cifras de 21px con la mitad del aire que necesitan; la lamina las pone
        // una encima de la otra, cada una con su tarjeta entera.
        <div
          className="lg:col-start-2 lg:row-start-1 lg:flex-col"
          style={{ display: 'flex', gap: 10, flex: 'none' }}
        >
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
        <div className="lg:col-start-1 lg:row-start-2" style={{
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
        <Tarjeta className="lg:col-start-2 lg:row-start-2" style={{ gap: 13, padding: 16 }}>
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
          {/* ⚠ SE MUESTRAN CINCO, NO LAS DIEZ.
              Con diez rutas esta tarjeta medía el doble que «Necesita tu
              atención», que es su pareja en la fila de la rejilla
              (`[1fr | 360px]`, `items-start`), y la columna izquierda quedaba
              con un hueco enorme debajo. Eso es lo que se ve desproporcionado
              en 1440.

              Y no es solo simetría: diez barras iguales seguidas son un muro,
              no un desglose. Van las que peor van —el adaptador ya las ordena
              así— que son a las que hay que llamar. El resto, a un toque.

              El total de arriba sigue siendo el de TODAS: es la suma que tiene
              que cuadrar, y recortarla haría que no cuadrase. */}
          {porRuta.rutas.slice(0, verTodasRutas ? porRuta.rutas.length : RUTAS_VISIBLES).map((r) => <FilaRuta key={r.id ?? r.nombre} {...r} />)}
          {!verTodasRutas && porRuta.rutas.length > RUTAS_VISIBLES && (
            <button
              type="button"
              onClick={() => setVerTodasRutas(true)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                minHeight: 36, marginTop: 2, borderRadius: 'var(--cf-r-pill)',
                background: 'var(--cf-fill)', border: 0, cursor: 'pointer',
                fontSize: 12, fontWeight: 600, color: 'var(--cf-ink-2)',
              }}
            >
              Ver las otras {porRuta.rutas.length - RUTAS_VISIBLES}
            </button>
          )}
          {porRuta.nota && (
            <span style={{
              fontSize: 12, lineHeight: 1.45, color: 'var(--cf-ink-3)',
              paddingTop: 4,
            }}>{porRuta.nota}</span>
          )}
        </Tarjeta>
      )}

      </div>
    </div>
  )
}
