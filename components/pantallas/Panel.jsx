'use client'

// components/pantallas/Panel.jsx — El panel del dueño. Lámina T02-01.
//
// EL HERO YA NO ES DORADO — Y ESO TAMPOCO ES DECISIÓN MÍA.
//
// Aquí decía «el hero es dorado y eso no es una decisión mía», citando el pie de
// T02-01, y añadía que yo lo había cambiado por un bloque oscuro razonando por
// mi cuenta y me habían corregido. Todo eso ERA cierto, y por eso se deja
// escrito: para que nadie deshaga el cambio pensando que se coló otra vez.
//
// Lo que cambió es que llegó la ADENDA 4 («La tarjeta insignia del panel»,
// `CF Diseño 2026/Elementos/Principal dashboard/entrega-recaudado/`), que es
// posterior a T02-01 y lo revisa explícitamente:
//
//   «El fondo dorado no es un estilo, es un error de sistema. El dorado está
//    reservado al monto principal, la acción primaria y el foco del campo
//    activo. Cuando lo lleva el fondo entero, el monto queda del mismo color
//    que su contenedor y el ojo no encuentra dónde mirar.»
//
// Con su lámina de antes/después y su lista de comprobación. Así que ahora el
// titular es el bloque oscuro del sistema y el dorado vuelve a ser el acento.
//
// LOS CINCO BLOQUES, EN ESTE ORDEN:
//
//   1 · saludo + fecha        ← lo manda T40-00-a: «el saludo baja al cuerpo»
//   2 · el bloque oscuro      ← recaudado, lo que toca cobrar, %, tira y semana
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

import { Fragment, useEffect, useState } from 'react'
import { Tarjeta } from '@/components/cf/primitivos'

/* Los nombres de los siete días de la barra dorada.
   La API manda siete números pelados, sin fecha, pero el ÚLTIMO es hoy: con eso
   los días salen contando hacia atrás.

   ⚠ Esto NO se puede calcular durante el render. El día depende del reloj del
   navegador y el servidor pinta con el suyo —en Bogotá se equivocan las cinco
   primeras horas del día—, así que saldría un desajuste de hidratación. Se llama
   desde un efecto, ya montado. */
function nombresDeDias(largo) {
  const hoy = new Date()
  return Array.from({ length: largo }, (_, i) => {
    const atras = largo - 1 - i
    if (atras === 0) return 'Hoy'
    if (atras === 1) return 'Ayer'
    const d = new Date(hoy)
    d.setDate(d.getDate() - atras)
    const nombre = d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric' })
    return nombre.charAt(0).toUpperCase() + nombre.slice(1)
  })
}

/* Los mismos días, en tres letras: «jue vie sáb dom lun mar hoy».
 *
 * `nombresDeDias` da «Viernes 31», que es lo que necesitaba el pie de la
 * versión anterior. Debajo de siete barras de 96px no cabe: se pisan unos con
 * otros y dejan de leerse. La adenda los escribe abreviados por eso.
 *
 * ⚠ DEPENDE DEL RELOJ DEL NAVEGADOR, así que el servidor y el cliente pintan
 * cosas distintas y React tira el árbol (el error de hidratación). Por eso se
 * calcula en un efecto y los `<span>` llevan `suppressHydrationWarning`.
 */
function diasCortos(largo) {
  const hoy = new Date()
  return Array.from({ length: largo }, (_, i) => {
    const atras = largo - 1 - i
    if (atras === 0) return 'hoy'
    const d = new Date(hoy)
    d.setDate(d.getDate() - atras)
    return d.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '').slice(0, 4)
  })
}

/* Cuántas rutas se ven sin desplegar.
   Cinco no es un número redondo cualquiera: es lo que hace que esta tarjeta
   mida parecido a «Necesita tu atención», que es su pareja en la fila de la
   rejilla de 1440. Con diez, la columna de al lado quedaba con un hueco enorme
   debajo — que es lo que se veía desproporcionado. */
const RUTAS_VISIBLES = 5

/* ══ LA TARJETA INSIGNIA DEL PANEL (Adenda 4) ══════════════════════════════
   Era un bloque DORADO MACIZO. La adenda lo llama por su nombre: «el fondo
   dorado no es un estilo, es un error de sistema».

   El dorado está reservado en todo el sistema a tres cosas —el monto
   principal, la acción primaria y el foco del campo activo—, así que cuando lo
   lleva el fondo entero:

     · el monto queda del MISMO color que su contenedor y el ojo no encuentra
       dónde mirar;
     · el texto oscuro sobre ámbar pierde contraste, y la hora pico de cobro
       son las 17:00, bajo sol: la peor combinación posible;
     · las barras ámbar sobre fondo ámbar son invisibles.

   Ahora es el bloque oscuro del sistema y el dorado vuelve a ser solo el
   acento: la barra, el porcentaje y la cifra que falta.

   ⚠ SOBRE FONDO OSCURO LOS COLORES CAMBIAN. Los del tema claro no tienen
   contraste suficiente sobre #15161A. Van los de la adenda, fijos: esta
   tarjeta es oscura en los dos temas, así que sus colores no pueden depender
   del tema —es el mismo error que tenía la versión dorada, donde el texto
   usaba un token que en oscuro valía el mismo dorado del fondo y la tarjeta
   salía muda—. */
const BLOQUE = {
  fondo:   '#15161A',
  tinta:   '#F3F3F6',   // la cifra
  rotulo:  '#A3A8B2',   // etiquetas y prosa
  apagado: '#8A8E98',   // contexto y valores secundarios
  oro:     '#F5B824',
  rojo:    '#F0575C',
  linea:   'rgba(255,255,255,.09)',
  pista:   'rgba(255,255,255,.12)',
  barra:   'rgba(255,255,255,.34)',   // días que cobraron todo
  barraNo: 'rgba(255,255,255,.16)',   // días que no llegaron
}

/* La caja oscura, que las dos comparten.
 *
 * ⚠ EL BORDE NO ES ADORNO: EN OSCURO ES LA CAJA.
 * La adenda pide #15161A, y en tema oscuro `--cf-surface` ES #15161A: la
 * tarjeta queda del MISMÍSIMO color que el fondo de la app —ratio 1,00— y
 * desaparece. Se ve el contenido flotando sin caja.
 *
 * El sistema ya tiene esta regla escrita en `tokens-2026.css`, y viene de un
 * reporte del dueño: «el borde está del mismo color que el fondo, entonces no
 * se ve como que fuese una caja». Allí se midió que en oscuro el relleno no
 * alcanza a dibujar la caja y que el borde tiene que hacer ese trabajo, al 14%.
 */
function CajaOscura({ marca, children, className = '' }) {
  return (
    /* ⚠ `display` VA EN LA CLASE, NUNCA EN EL `style`.
       Estaba como `display: 'flex'` en línea, y el estilo en línea SIEMPRE gana
       a una clase: el `hidden` de la caja de la semana no hacía nada y la
       gráfica salía DOS VECES en el teléfono —una dentro del bloque principal y
       otra en su propia caja debajo—. Lo reportó el dueño con la captura.

       Es la segunda vez en esta misma tanda: antes fue un `display:'grid'` en
       línea comiéndose un `hidden sm:grid`. Si algo se tiene que poder esconder
       por tamaño de pantalla, su `display` no puede estar en el `style`. */
    <div data-bloque={marca} className={`flex-col gap-[14px] ${className}`} style={{
      background: BLOQUE.fondo,
      border: '1px solid rgba(255,255,255,.14)',
      borderRadius: 20,
      padding: '19px 21px',
      minWidth: 0,
    }}>{children}</div>
  )
}

/** El rótulo de arriba, con su apunte a la derecha. */
function RotuloBloque({ texto, apunte }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
        color: BLOQUE.rotulo,
      }}>{texto}</span>
      {apunte && (
        <span className="cf-num" style={{ fontSize: 12, color: BLOQUE.apagado, textAlign: 'right' }}>
          {apunte}
        </span>
      )}
    </div>
  )
}

function Hero({
  recaudado, meta, porcentaje = 0, cobrados = 0, pendientes = 0, ayer, semana, fmt,
  faltan, enMora = 0, promedio7d, esperadoCrudo, fecha,
}) {
  /* Cómo se llama cada día: largo para el `title` de la barra y corto para la
     fila de debajo. En un EFECTO porque dependen del reloj del navegador; el
     servidor no puede saberlos. */
  // Qué barra está tocada. Se reinicia sola al cambiar la semana.
  const [diaAbierto, setDiaAbierto] = useState(null)
  const [dias, setDias] = useState([])
  const [cortos, setCortos] = useState([])
  useEffect(() => {
    setDias(nombresDeDias(semana?.length ?? 0))
    setCortos(diasCortos(semana?.length ?? 0))
    setDiaAbierto(null)
  }, [semana?.length])

  /* ── LA ESCALA DE LA GRÁFICA ──
     La línea punteada tiene que caber: si un día cobró más que lo esperado, el
     tope es esa barra; si nadie llegó, el tope es la línea.

     El 1,12 es AIRE, no un número mágico. Cuando lo que toca cobrar supera a
     todas las barras —la semana floja, que es cuando más se mira esto— la línea
     queda exactamente en el techo del contenedor y se lee como el borde de la
     caja, no como una referencia. */
  const barras = semana ?? []
  const tope = Math.max(...barras, (esperadoCrudo ?? 0) * 1.12, 0)
  const alturaLinea = tope > 0 && esperadoCrudo ? (esperadoCrudo / tope) * 100 : null

  /* Cuántos días cobraron TODO lo que tocaba. La adenda insiste en que el texto
     y el gráfico cuenten la misma historia: «si dice 3 de 7, tiene que haber
     exactamente 3 barras por encima de la línea». Por eso se cuenta con la
     misma comparación con la que se pintan, y no a ojo. */
  const cumplieron = esperadoCrudo
    ? barras.filter((n) => n >= esperadoCrudo).length
    : null

  /* La tira de cifras. Tres en móvil, cinco en escritorio, y NI UNA MÁS: es un
     tope de la adenda, no una casualidad de los datos que hay hoy. Las que no
     tienen dato se caen solas en vez de dejar un hueco con un guion. */
  const cifras = [
    { rot: 'Cobrados',  val: `${cobrados} de ${cobrados + pendientes}` },
    faltan       && { rot: 'Te faltan',   val: faltan,     color: BLOQUE.oro },
    enMora > 0   && { rot: 'En mora',     val: String(enMora), color: BLOQUE.rojo, soloAncho: true },
    ayer         && { rot: 'Ayer',        val: ayer },
    promedio7d   && { rot: 'Promedio 7d', val: promedio7d, soloAncho: true },
  ].filter(Boolean)

  const hayGrafica = semana && tope > 0

  return (
    /* ── DOS BLOQUES, COMO LA LÁMINA ──
       «La gráfica sale a su propia tarjeta porque en 392px ya caben la cifra de
       la línea de meta y los nombres de los días — en 390px de móvil no
       cabían.»

       ⚠ Y POR ESO ESTE BLOQUE OCUPA LA FILA ENTERA DEL PANEL. Medido a 1440:
       la columna izquierda de la rejilla son 766px, y quitándole los 392 de la
       gráfica quedan 358 para el monto a 40px y cinco columnas de cifras — no
       caben. Con la fila entera (1142) quedan 734, que es casi lo que tenía
       antes. La partición y el `col-span` van juntos: uno sin el otro no
       funciona.

       Debajo de `lg` es una sola caja, con la gráfica dentro. */
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_392px] lg:gap-4 lg:items-stretch">
      <CajaOscura marca="recaudado" className="flex">
        <RotuloBloque texto="Recaudado hoy" apunte={<span className="hidden lg:inline">{fecha}</span>} />

        {/* ── EL MONTO Y SU CONTEXTO, EN LA MISMA LÍNEA ──
            Alineados por la base: la cifra manda y el contexto se apoya en ella.
            El copy dice «que toca cobrar», NO «meta del día»: no es una meta,
            es plata que le deben hoy. Una meta es algo a lo que uno aspira y
            que se puede no alcanzar sin consecuencia; llamarlo meta hace que
            quedarse corto se sienta normal. */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span className="cf-fig text-[34px] lg:text-[40px]" style={{
            letterSpacing: '-.035em', color: BLOQUE.tinta, lineHeight: 1,
          }}>{recaudado}</span>
          {meta && (
            <span className="cf-num text-[12px] lg:text-[14px]" style={{
              color: BLOQUE.apagado, paddingBottom: 2,
            }}>de {meta} que toca cobrar</span>
          )}
        </div>

        {/* ── LA BARRA, CON SU PORCENTAJE AL FINAL ──
            El % estaba DOS VECES: una pastilla arriba a la derecha y esta barra,
            diciendo lo mismo sin conexión visual entre las dos. Al final de la
            barra deja de ser un dato duplicado y pasa a ser su etiqueta. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span style={{
            flex: 1, height: 11, borderRadius: 999, overflow: 'hidden',
            background: BLOQUE.pista,
          }}>
            <span style={{
              display: 'block', height: 11, borderRadius: 999,
              width: `${Math.max(0, Math.min(100, porcentaje))}%`,
              background: BLOQUE.oro,
            }} />
          </span>
          <span className="cf-fig" style={{
            fontSize: 15, fontWeight: 600, letterSpacing: '-.02em',
            color: BLOQUE.oro, flex: 'none',
          }}>{porcentaje}%</span>
        </div>

        {/* ── LA TIRA DE CIFRAS ──
            Antes era «2 cobrados · 14 pendientes · ayer $460.400»: tres datos
            sueltos, sin etiqueta y todos del mismo peso. Con rótulo encima y un
            filete entre columnas se puede comparar de un vistazo.

            Las dos últimas se esconden por debajo de `lg`: tres en móvil, cinco
            en escritorio. */}
        <div style={{
          display: 'flex', gap: 8, marginTop: 'auto',
          paddingTop: 13, borderTop: `1px solid ${BLOQUE.linea}`,
        }}>
          {cifras.map((c, i) => (
            <Fragment key={c.rot}>
              {i > 0 && (
                <span className={c.soloAncho ? 'hidden lg:block' : ''}
                  style={{ width: 1, background: BLOQUE.linea, flex: 'none' }} />
              )}
              <span className={`${c.soloAncho ? 'hidden lg:flex' : 'flex'}`}
                style={{ flex: 1, minWidth: 0, flexDirection: 'column', gap: 4 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
                  textTransform: 'uppercase', color: BLOQUE.apagado,
                }}>{c.rot}</span>
                <span className="cf-fig text-[15px] lg:text-[19px]" style={{
                  fontWeight: 600, letterSpacing: '-.02em', color: c.color ?? BLOQUE.tinta,
                }}>{c.val}</span>
              </span>
            </Fragment>
          ))}
        </div>

        {/* En móvil la gráfica va DENTRO de esta caja: a 393px no hay dos
            columnas, y una segunda tarjeta solo añadiría un borde y otro
            título para lo mismo. */}
        {hayGrafica && <div className="lg:hidden"><Grafica /></div>}
      </CajaOscura>

      {/* La misma gráfica, en su propia caja, solo desde `lg`. */}
      {hayGrafica && (
        <CajaOscura marca="semana" className="hidden lg:flex">
          <RotuloBloque
            texto={`Los últimos ${semana.length} días`}
            apunte={cumplieron != null
              ? (cumplieron === 0 ? 'ningún día completo' : `cobraste todo ${cumplieron} ${cumplieron === 1 ? 'vez' : 'veces'}`)
              : null}
          />
          <Grafica />
        </CajaOscura>
      )}
    </div>
  )

  /* La gráfica se declara aquí dentro a propósito: usa ocho valores del cuerpo
     —barras, tope, la línea, los nombres— y pasarlos por props a un componente
     de fuera sería ocho props para un trozo que solo existe aquí. Y se pinta en
     DOS sitios (dentro de la caja en móvil, en la suya en escritorio), así que
     duplicar el JSX era la otra salida, peor. */
  function Grafica() {
    return (
      <>
        {/* ⚠ LA ALTURA DEL CONTENEDOR VA EN PX, NUNCA `flex:1`. Las barras
            miden su alto en porcentaje: si el contenedor colapsa, el gráfico
            desaparece entero sin que falle nada. */}
        <div className="relative h-[52px] lg:h-[96px]"
          style={{ display: 'flex', alignItems: 'flex-end', gap: 7, flex: 'none' }}>
          {alturaLinea != null && (
            <>
              <span aria-hidden="true" style={{
                position: 'absolute', left: 0, right: 0, bottom: `${Math.min(100, alturaLinea)}%`,
                borderTop: '1px dashed rgba(255,255,255,.26)', pointerEvents: 'none',
              }} />
              {/* ── LA CIFRA DE LA LÍNEA ──
                  Sin ella la línea no se entiende: a tamaño real se lee como un
                  separador de sección, no como una referencia. */}
              <span className="hidden lg:block" style={{
                position: 'absolute', right: 0, bottom: `calc(${Math.min(100, alturaLinea)}% + 3px)`,
                fontSize: 10, fontWeight: 700, color: BLOQUE.apagado,
                pointerEvents: 'none', background: BLOQUE.fondo, paddingLeft: 6,
              }}>{meta}</span>
            </>
          )}
          {/* ── SE PUEDEN TOCAR, Y ESO NO SE PODÍA PERDER ──
              Al rehacer la tarjeta las pasé de `<button>` a `<span>` con
              `title`, y el `title` es un globo de ESCRITORIO: en el teléfono no
              hay puntero, así que la función desapareció sin dejar rastro. El
              dueño lo pidió por su nombre en su día —«no es interactiva, no se
              le puede picar y ver los saldos»— y volvió a reportarlo ahora.

              La adenda quita el PIE «Martes 4 · $565.000» porque flotaba abajo
              sin conexión con ninguna barra, no la posibilidad de tocarlas. Así
              que vuelven a ser botones y la respuesta va a la frase de abajo,
              que ya está ahí y ya habla de la gráfica: el dato deja de flotar. */}
          {barras.map((n, i) => {
            const esHoy = i === barras.length - 1
            const llego = esperadoCrudo ? n >= esperadoCrudo : false
            const elegido = diaAbierto === i
            return (
              <button
                key={i}
                type="button"
                suppressHydrationWarning
                onClick={() => setDiaAbierto(elegido ? null : i)}
                aria-label={`${dias[i] ?? `día ${i + 1}`}: ${fmt ? fmt(n) : n}`}
                style={{
                  flex: 1, minWidth: 0, padding: 0, border: 0, cursor: 'pointer',
                  alignSelf: 'flex-end',
                  // Mínimo de 6px: una barra de altura cero desaparece y el día
                  // parece que no existe, cuando lo que pasa es que no se cobró
                  // nada — que es justo lo que hay que ver.
                  height: `${Math.max(6, Math.round((n / tope) * 100))}%`,
                  borderRadius: '4px 4px 0 0',
                  background: esHoy ? BLOQUE.oro : (llego ? BLOQUE.barra : BLOQUE.barraNo),
                  // La elegida se marca con un aro, no cambiando de color: el
                  // color ya significa «hoy» y «llegó», y no puede significar
                  // una tercera cosa.
                  outline: elegido ? `2px solid ${BLOQUE.tinta}` : 'none',
                  outlineOffset: 2,
                }}
              />
            )
          })}
        </div>

        {/* Debajo, solo los extremos en móvil; en escritorio caben los nombres. */}
        <div className="flex lg:hidden" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: BLOQUE.apagado }}>hace una semana</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: BLOQUE.oro }}>hoy</span>
        </div>
        <div className="hidden lg:flex" style={{ gap: 9 }}>
          {barras.map((_, i) => {
            const esHoy = i === barras.length - 1
            return (
              // `suppressHydrationWarning`: el nombre sale del reloj del
              // navegador, así que el servidor pinta vacío y el cliente el día.
              // Sin esto React tira el árbol entero al hidratar.
              <span key={i} suppressHydrationWarning style={{
                flex: 1, textAlign: 'center', fontSize: 10, fontWeight: 700,
                color: esHoy ? BLOQUE.oro : BLOQUE.apagado,
              }}>{esHoy ? 'hoy' : (cortos[i] ?? '')}</span>
            )
          })}
        </div>

        {/* ── LA LECTURA ESCRITA ──
            SIN ESTA FRASE LA GRÁFICA SIGUE SIN DECIR NADA. Un gráfico que
            necesita interpretación no informa; uno que trae su lectura sí.

            Y cuenta la MISMA historia que las barras: `cumplieron` sale de la
            misma comparación con la que se pintan. */}
        {cumplieron != null && (
          <p suppressHydrationWarning style={{ fontSize: 12, lineHeight: 1.45, color: BLOQUE.rotulo, marginTop: 'auto' }}>
            {diaAbierto != null ? (
              /* Con una barra tocada, la frase habla de ESE día. Es el sitio
                 donde el dato tiene contexto: la alternativa era el pie suelto
                 que la adenda quitó por flotar sin dueño. */
              <>
                <b style={{ color: BLOQUE.tinta }}>{dias[diaAbierto] ?? 'Ese día'}</b>
                {': '}
                <b style={{ color: BLOQUE.tinta }}>{fmt ? fmt(barras[diaAbierto]) : barras[diaAbierto]}</b>
                {esperadoCrudo ? (barras[diaAbierto] >= esperadoCrudo
                  ? <> — cobraste todo lo que tocaba.</>
                  : <> — te faltaron {fmt ? fmt(esperadoCrudo - barras[diaAbierto]) : (esperadoCrudo - barras[diaAbierto])}.</>) : null}
              </>
            ) : (
              <>
                {cumplieron === 0
                  ? <>Ningún día de los últimos {barras.length} llegó a lo que tocaba cobrar. </>
                  : <>Cobraste todo <b style={{ color: BLOQUE.tinta }}>{cumplieron} de los últimos {barras.length} días</b>. </>}
                La línea es lo que toca cada día.
              </>
            )}
          </p>
        )}
      </>
    )
  }
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
  /* LA RANURA QUE CIERRA EL HUECO DE 1440.
     Va DENTRO de la rejilla, tercera fila de la columna izquierda.

     El dueño marcó en rojo un vacío enorme debajo de «Necesita tu atención». La
     causa no era el alto de las tarjetas —achiqué «Por ruta hoy» de diez rutas
     a cinco y el hueco solo se redujo—: es que debajo de esta rejilla van
     bloques a ANCHO COMPLETO, y uno de esos no empieza hasta que acaba la celda
     MÁS ALTA de la fila. Con la celda izquierda corta, el hueco es inevitable
     mientras el contenido siga fuera.

     Por eso entra como ranura y no como un bloque más de la página: tiene que
     vivir en la columna, no debajo de ella. En móvil da igual —una sola
     columna— y cae en su sitio por orden.

     ⚠ `lg:items-stretch` NO es la alternativa: iguala los altos estirando una
     tarjeta de tres renglones hasta 290px de blanco. */
  bajoAtencion = null,
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
  /* El formateador de moneda, INYECTADO. No se importa `formatMoney` aquí
     porque el formato depende del país de la sesión, que este componente no
     conoce — la página sí. Lo usa la barra dorada para decir cuánto fue cada
     día; sin él las barras siguen saliendo, solo que sin cifra. */
  fmt,
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
        /* ⚠ LA FILA ENTERA, y no es una preferencia: es lo que hace que la
           gráfica quepa en su propia tarjeta. Medido a 1440 — la columna
           izquierda son 766px, y quitándole los 392 de la gráfica quedan 358
           para el monto a 40px y cinco columnas de cifras, que no caben. Con la
           fila entera quedan 734, casi lo que tenía antes.

           Por eso todo lo demás baja una fila. */
        <div className="lg:col-span-2 lg:row-start-1 flex flex-col">
          <Hero {...hero} fecha={fecha} fmt={fmt} />
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
        /* `lg:self-stretch` — LAS DOS BLANCAS LLENAN EL ALTO DEL HERO.
            La rejilla lleva `lg:items-start`, así que por defecto esta celda
            mide lo que su contenido y acababa 88px por encima del dorado, con
            un escalón entre las dos columnas.
            Las tarjetas ya traen `flex: 1`, que en columna reparte el alto a
            partes iguales: lo único que faltaba era que el contenedor ocupara
            la fila entera. */
        <div
          className="lg:col-start-2 lg:row-start-2 lg:flex-col"
          style={{ display: 'flex', gap: 10, flex: 'none' }}
        >
          {caja && (
            <TarjetaDato rotulo="En caja" pie="Para prestar ahora">
              <span className="cf-fig" style={{
                fontSize: 20, letterSpacing: '-.025em', color: 'var(--cf-ink)',
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
                  fontSize: 20, letterSpacing: '-.025em',
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
        /* ABARCA LAS DOS FILAS de la columna derecha.
            Con `row-start-2` a secas, la fila 2 medía lo que la tarjeta más
            alta —esta— y la celda de al lado se quedaba corta con el hueco
            debajo. Abarcando 2 y 3, la columna izquierda apila «Necesita tu
            atención» y lo que venga después a su lado, y la rejilla cuadra sin
            estirar nada. */
        <Tarjeta className="lg:col-start-2 lg:row-start-3" style={{ gap: 13, padding: 16 }}>
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

      {/* 6 · Lo que llena la columna izquierda. Ver la nota de `bajoAtencion`. */}
      {bajoAtencion && (
        <div className="lg:col-start-1 lg:row-start-3">{bajoAtencion}</div>
      )}

      </div>
    </div>
  )
}
