'use client'

// components/cf/ParadaDeCobro.jsx — la tarjeta de una parada de ruta.
//
// LA MISMA TARJETA EN DOS PANTALLAS, y por eso vive aqui y no dentro de una de
// ellas. La adenda 5 la describe como «la tarjeta de cliente dentro de una
// ruta», y esa tarjeta sale en dos sitios:
//
//   /cobros-hoy       las paradas de hoy de TODAS las rutas del cobrador
//   /rutas/[id]       las paradas de UNA ruta
//
// Estaba escrita entera dentro de `CobrarHoy.jsx`, asi que la de `/rutas/[id]`
// era otra tarjeta distinta —con el numero de orden como marca de agua al 8%,
// nueve cifras y colores fijos de tema oscuro— y arreglar una no arreglaba la
// otra. Es el mismo fallo del comprobante: lo mismo visto por dos caminos, y
// solo uno corregido.
//
// Lo de aqui son E07 (la tarjeta), E08 (el carril numerado) y E09 (los que
// estan en la ruta pero no son visita de hoy).

import { useState } from 'react'
import { EtiquetaClavo, TiraCifras } from '@/components/cf/primitivos'

export const COLOR_ESTADO = {
  mora:   'var(--cf-red)',
  atraso: 'var(--cf-gold)',
  aldia:  'var(--cf-green)',
}

export const PASTILLA = {
  mora:   { bg: 'var(--cf-red-pill-bg)',   bd: 'var(--cf-red-pill-border)',   fg: 'var(--cf-red-dark)' },
  atraso: { bg: 'var(--cf-gold-bg)',       bd: 'var(--cf-gold-border)',       fg: 'var(--cf-gold-text-2)' },
  aldia:  { bg: 'var(--cf-green-pill-bg)', bd: 'var(--cf-green-pill-border)', fg: 'var(--cf-green-dark)' },
  // Los dos que trajo el reparto por zonas: «sin préstamo» reciente —una
  // oportunidad, va destacada— y «sin préstamo» viejo, que es una fila que
  // nadie limpió y no debe competir con nada.
  destacado: { bg: 'var(--cf-gold-tint)', bd: 'var(--cf-gold-border)', fg: 'var(--cf-gold-text)' },
  neutro:    { bg: 'var(--cf-fill)',      bd: 'var(--cf-border)',      fg: 'var(--cf-ink-3)' },
}

/* El anillo del avatar cuando la fila NO es visita de hoy. Mismo papel que
   `COLOR_ESTADO`: el color va pegado a lo que identifica la fila. */
export const COLOR_ZONA = {
  aldia:    'var(--cf-green)',
  clavo:    'var(--cf-red)',
  sindeuda: 'var(--cf-gold)',
  inactivo: 'var(--cf-ink-4)',
}

/* ══ EL CARRIL DE RECORRIDO (Adenda 5 · E08) ══════════════════════════════
   «El orden no es un dato del cliente: es dónde está en la fila. Por eso vive
   fuera de la tarjeta.» Dentro competía con el nombre y el monto; fuera, en
   columna, se lee sin mirar nada más — que es lo que hace un cobrador cuando
   levanta la vista de la moto.

   Se paga solo porque el carril TAMBIÉN da el progreso: sin contar nada se ve
   cuántas paradas van con check y cuántas quedan huecas.

   ⚠ SOLO EN EL TELÉFONO, y esto no lo dice la lámina: en escritorio la lista
   va a DOS COLUMNAS (`lg:grid-cols-2`), y un carril con línea conectora
   necesita una sola secuencia — con dos columnas la línea uniría paradas que
   no van seguidas y el número diría una posición falsa. La propia adenda pone
   la condición: «B en la ruta de cobro, donde el orden manda y HAY UNA SOLA
   SECUENCIA». En escritorio no la hay, así que allí no se pinta. Y no se
   pierde nada: la ruta se cobra caminando, con el teléfono.

   Los tres estados y sus medidas salen de la adenda. El número pendiente va en
   `--cf-ink-2` y no en gris claro a propósito: son los que el cobrador mira
   POR DELANTE para saber cuánto le falta, y en gris claro quedan a 3,12:1 y no
   se leen bajo sol. */
export function Carril({
  orden, cobrada, actual, ultima, ancla, resaltada, tenue = false,
  // Los dos estados del arrastre por pulsación larga. `resto` recoge los
  // manejadores del gesto (`useArrastreLargo`), que van en ESTE nodo porque es
  // el que se mide para saber sobre cuál se soltó.
  levantada = false, destino = false, style, children, ...resto
}) {
  /* ── `tenue`: LLEVA NÚMERO, PERO NO ES PARADA DE HOY ──
     El dueño quiere a todos numerados —«así el primero fuera uno que estuviese
     con clavo, así en el dos estuviese un cliente que no tenía préstamo»— y
     tiene razón: ese número es la POSICIÓN EN LA RUTA, con la que se orienta
     entre 142 clientes.

     Pero un círculo idéntico al de una parada pendiente diría que hay que
     tocar esa puerta hoy. Así que va con el mismo número y menos peso: sin
     borde grueso y en gris. Se sigue contando, deja de llamar. */
  /* ⚠ EL COBRADO CONSERVA SU NÚMERO. Llevaba un check en vez de la cifra, y el
     dueño lo reportó: «no sale qué número de lista es en ruta, y eso es
     importantísimo, así haya pagado». Tiene razón — el número es por dónde va
     caminando, y una parada hecha sigue ocupando su sitio en el recorrido.
     Que está hecha lo dice el VERDE del círculo, el check del avatar, el nombre
     tachado y el monto en verde. El número no le quitaba sitio a nada. */
  const circulo = cobrada
    ? { w: 30, bg: 'var(--cf-green)', bd: 'none', fg: '#FFF' }
    : actual
      ? { w: 34, bg: 'var(--cf-ink)', bd: 'none', fg: 'var(--cf-card)' }
      : tenue
        ? { w: 26, bg: 'var(--cf-fill)', bd: 'none', fg: 'var(--cf-ink-3)' }
        : { w: 30, bg: 'var(--cf-card)', bd: '2px solid var(--cf-border-strong)', fg: 'var(--cf-ink-2)' }

  return (
    <div id={ancla} className="flex lg:contents" {...resto} style={{
      gap: 10, alignItems: 'stretch',
      // El aterrizaje al volver de cobrar. `scroll-margin` para que no quede
      // pegada al borde de arriba cuando el navegador la trae a la vista.
      scrollMarginTop: 90, scrollMarginBottom: 90,
      /* ── LO QUE SE VE MIENTRAS SE ARRASTRA ──
         La que se mueve se levanta y se aclara; la de destino se marca con un
         filete dorado. No se reordena en vivo: con treinta filas, recolocarlas
         en cada píxel va a tirones en el teléfono en el que se cobra. */
      ...(levantada ? {
        transform: 'scale(1.02)', opacity: .92,
        boxShadow: '0 10px 24px rgba(20,20,28,.18)',
        borderRadius: 'var(--cf-r-card)',
        position: 'relative', zIndex: 3,
      } : null),
      ...(destino ? {
        outline: '2px dashed var(--cf-gold)', outlineOffset: 2,
        borderRadius: 'var(--cf-r-card)',
      } : null),
      transition: 'transform .12s, box-shadow .12s',
      ...style,
      ...(resto.style ?? null),
    }}>
      {/* ⚠ `flex flex-col items-center` EN LA CLASE, NO EN EL `style`.
          Un `display` en línea SIEMPRE gana a una clase, así que con
          `display: 'flex'` en el `style` el `lg:hidden` no hacía nada y el
          carril se pintaba también en escritorio —729 círculos donde no hay una
          sola secuencia—.

          Es la TERCERA vez hoy: antes fue `display:'grid'` comiéndose un
          `hidden sm:grid`, y luego `display:'flex'` en la caja del panel
          duplicando la gráfica en el teléfono. Hay una prueba que lo barre
          entero para que no haya una cuarta. */}
      <div className="lg:hidden flex flex-col items-center" style={{ width: 34, flex: 'none' }}>
        <span className="cf-num" style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: circulo.w, height: circulo.w, minWidth: circulo.w, minHeight: circulo.w,
          aspectRatio: '1', borderRadius: 999, flex: 'none',
          background: circulo.bg, border: circulo.bd, color: circulo.fg,
          fontSize: actual ? 16 : tenue ? 12.5 : 14, fontWeight: 700,
        }}>
          {orden}
        </span>
        {/* El conector no va en la última: una línea que sale de la última
            parada y no llega a nada dice que falta algo. */}
        {!ultima && (
          <span aria-hidden style={{
            flex: 1, width: 2, minHeight: 8, marginTop: 4,
            borderRadius: 999, background: 'var(--cf-border-strong)',
          }} />
        )}
      </div>
      <div style={{
        flex: 1, minWidth: 0, borderRadius: 'var(--cf-r-card)',
        // Dos segundos de halo al volver: dice CUÁL era sin tener que releer
        // nombres en una lista de doscientas iguales.
        boxShadow: resaltada ? '0 0 0 3px var(--cf-gold-focus)' : undefined,
        transition: 'box-shadow .25s',
      }}>{children}</div>
    </div>
  )
}


/* La marca de que ese nombre LLEVA A ALGÚN SITIO. Sin ella el destino existe
   pero no se ve: la tarjeta ya se puede tocar entera, así que nada distingue el
   nombre del resto y nadie lo prueba. Va pegada al texto y no como icono suelto
   a la derecha —ahí competiría con el monto—, y en `ink-4` para que sea una
   pista y no un adorno.

   ⚠ `display:'inline'` y `verticalAlign`, no un flex: el nombre baja de renglón
   cuando es largo —los apellidos no se recortan nunca— y una flecha en su
   propia caja se quedaría arriba, separada de la última palabra. */
function FlechaFicha({ tam = 13 }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-4)"
      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden
      style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 4, marginBottom: 2 }}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

/* ══ La fila de cobro ══ */
export function FilaCobro({
  nombre, iniciales, estado = 'aldia', etiquetaEstado, donde, distancia,
  avisoMora, avisos = [], prestamos = [],
  cuota, periodo, debe, cobrada = false, abonoHoy, cerradaPorHoy, abonadoAntesDeCerrar,
  onReabrir, onCerrarVisita,
  cobradoA, montoCobrado, cifras, pagadoPct, vida, onClick,
  /* ── ⚠ EL NOMBRE Y LA FOTO ABREN LA FICHA ────────────────────────────────
     Reportado por el dueño con el caso que lo hace evidente:

       «si hay un usuario que está en modo que hay que prestarle, esa tarjeta
        queda totalmente muerta. Solamente sirve el botón de prestarle, pero si
        yo quiero ver la información detallada de ese cliente, no le puedo dar
        al nombre e ir a verlo.»

     Y es literal, no una impresión: el `onClick` de la tarjeta abre el cobro
     rápido, y `abrirPagoRapido` empieza por `if (activos.length === 0) return`.
     Quien no tiene préstamo vivo —que es justo quien sale en la tarjeta
     compacta— tocaba la tarjeta y no pasaba NADA. Sin error y sin pista.

     La salida no es un botón más ni la tarjeta entera: es lo que ya identifica
     a la fila —su foto y su nombre—, que es lo que él pidió y lo que se toca
     por instinto. */
  onAbrirCliente,
  /* ── QUIEN HOY NO TIENE COBRO USA ESTA MISMA TARJETA ──
     `contextoZona()` en `adaptadores/ruta.js`. Trae la pastilla, la frase que
     explica por qué hoy no le toca, qué va a la derecha y qué dice el botón.
     `null` en las visitas de hoy, que es el caso normal.

     Antes esto era OTRA tarjeta —`FilaFueraDeParada`, sin número, sin cifras y
     sin acciones— y el dueño lo reportó: «salen hasta abajo, sin ninguna
     numeración, sin ningún dato de sus préstamos, sin ningún contexto, nada».
     Una segunda tarjeta para lo mismo es el fallo del comprobante otra vez. */
  contexto = null,
  onAccion,
  // ── LA PARADA ACTUAL (T03-01) ──
  // Marca dónde está el cobrador AHORA: borde dorado y aviso de mora. Ya NO
  // decide quién tiene botones —eso era así y el dueño lo rebatió con el caso
  // real; ver la nota larga junto a la fila de acciones—.
  activa = false, onLlamar, onWhatsApp, onMapa, onMas,
}) {
  const color = contexto
    ? (COLOR_ZONA[contexto.zona] || COLOR_ESTADO.aldia)
    : (COLOR_ESTADO[estado] || COLOR_ESTADO.aldia)
  // UNA sola pastilla: con contexto manda la de la zona («Al día», «Clavo»,
  // «Sin préstamo»). La de los días de atraso sobra ahí —quien no tiene cobro
  // hoy no lleva atraso del día— y dos pastillas seguidas se leen como dos
  // estados distintos de la misma persona.
  const p = PASTILLA[contexto?.pastilla?.tono ?? estado] || PASTILLA.aldia
  const textoPastilla = contexto ? contexto.pastilla?.texto : etiquetaEstado
  // El plegador de préstamos. Arranca cerrado: se abre «solo si el cliente
  // discute», que es lo que dice la adenda y lo que pasa en la calle.
  const [abierto, setAbierto] = useState(false)

  /* Los manejadores de «abrir la ficha». `stopPropagation` es obligatorio: la
     tarjeta entera ya es un botón y sin él el toque haría las dos cosas.
     `role="link"` y el teclado porque esto es un destino de navegación
     —cambia de pantalla— y no una acción sobre la fila. */
  const irAFicha = onAbrirCliente
    ? (e) => { e.stopPropagation(); onAbrirCliente() }
    : null
  const identidad = irAFicha
    ? {
      onClick: irAFicha,
      onKeyDown: (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        irAFicha(e)
      },
      role: 'link',
      tabIndex: 0,
    }
    : null
  /* ⚠ LA FOTO NO ES UNA SEGUNDA PARADA DEL TABULADOR. Lleva el mismo toque
     —el dueño pidió las dos: «si le pico al nombre o al perfil»— pero declararla
     otra vez como destino pondría DOS paradas por cliente, y en la ruta medida
     son 203: 406 paradas para llegar al mismo sitio dos veces. El nombre, que
     está pegado y sí dice a quién se va, se queda con el papel. */
  const identidadMuda = irAFicha ? { onClick: irAFicha } : null

  /* ══ QUIEN NO HAY QUE VISITAR PESA MENOS ══════════════════════════════════
   *
   * Lo pidió el cliente más grande, y la razón es de la calle: «en ruta los
   * cobradores se enredan mucho», porque el que ya terminó de pagar salía del
   * mismo tamaño que el que debe. Medido en producción: la RUTA #4 tiene 45 de
   * 140 así (32%) y la #1, 56 de 206. Son decenas de tarjetas de media pantalla
   * de gente a la que hoy no hay que tocarle la puerta.
   *
   * No se distingue con un color más —el filete lateral ya se quitó en E10 por
   * ser el cuarto sitio diciendo lo mismo— sino con lo único que no se puede
   * confundir de un vistazo: PESO. La de cobro es blanca, alta y con botón
   * dorado; ésta es plana, baja y sin botón grande. La diferencia se ve con el
   * teléfono a un brazo de distancia y bajo sol.
   *
   * ⚠ NO PIERDE NADA, y esto importa porque ya pasó una vez: rediseñar y
   * llevarse funciones en silencio. Sigue teniendo su número en el carril, su
   * nombre entero —nunca cortado—, su estado, su acción propia («Prestarle» /
   * «Sacar de la ruta») y la tarjeta entera sigue abriendo la ficha del cliente
   * al tocarla, que es donde viven el teléfono, el mapa y el historial. Lo que
   * se va es lo que aquí no se usa: la dirección para ir a cobrar, la rejilla
   * de cifras del cobro y la barra de progreso de un préstamo que ya no existe.
   */
  const compacta = contexto?.zona === 'sindeuda' || contexto?.zona === 'inactivo'

  if (compacta) {
    const esListo = contexto.zona === 'sindeuda'
    return (
      <div
        /* ⚠ AQUÍ LA TARJETA ENTERA SÍ ABRE LA FICHA, y es la excepción a
           «solo el nombre y la foto». En las demás la tarjeta lleva al cobro y
           hay dos destinos que repartir; en ésta no hay cobro que abrir —por
           definición no tiene préstamo vivo— así que `onClick` se sale por el
           `return` y el toque no hace nada. Una tarjeta muerta de lado a lado
           es peor que una con un solo destino. */
        onClick={irAFicha ?? onClick}
        role="button"
        tabIndex={0}
        style={{
          position: 'relative',
          /* Plana sobre el fondo de la pantalla, no blanca: las de cobro son
             las que se levantan. */
          background: 'var(--cf-surface)',
          border: '1px solid var(--cf-border)',
          borderRadius: 'var(--cf-r-card)',
          padding: '10px 12px',
          display: 'flex', alignItems: 'center', gap: 11,
          flex: 'none', cursor: 'pointer', overflow: 'hidden',
        }}
      >
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 34, height: 34, minWidth: 34, minHeight: 34, aspectRatio: '1',
          borderRadius: 999, flex: 'none',
          background: 'var(--cf-fill)', fontSize: 12, fontWeight: 700,
          color: 'var(--cf-ink-3)',
          border: `1.5px solid ${color}`,
        }}>{iniciales}</span>

        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* El nombre entero. Con 143 clientes en una ruta, un apellido
              cortado es tocar la puerta equivocada. */}
          <span style={{
            fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)', lineHeight: 1.25,
            /* Parte por donde sea antes que salirse: hay negocios que meten
               el monto en el nombre («YUSMARY MIRANDA $ 500») y aquí al lado
               hay un botón. Recortar no es opción: el apellido es lo que
               distingue a dos clientes con el mismo nombre. */
            overflowWrap: 'anywhere',
          }}>{nombre}{irAFicha && <FlechaFicha tam={11} />}</span>
          <span style={{ fontSize: 11, color: 'var(--cf-ink-3)', lineHeight: 1.3 }}>
            {esListo ? 'Pagó completo' : 'Sin préstamo'}
            {contexto.cifras?.length ? ` · ${contexto.cifras[contexto.cifras.length - 1].etiqueta.toLowerCase()} ${contexto.cifras[contexto.cifras.length - 1].valor}` : ''}
          </span>
        </span>

        {/* La acción, en pequeño. «Prestarle» es la única de las cuatro zonas
            que gana dinero, así que se queda en dorado —aquí el dorado sí es la
            acción principal de la tarjeta—; «Sacar de la ruta» va apagada. */}
        {contexto.accion && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAccion?.() }}
            style={{
              flex: 'none', height: 34, padding: '0 13px',
              borderRadius: 'var(--cf-r-control)', cursor: 'pointer',
              font: 'inherit', fontSize: 12, fontWeight: 700,
              /* ⚠ PERFILADO, NO RELLENO, y va contra mi primer intento.
                 Lo puse en dorado macizo porque «Prestarle» es la acción que
                 gana dinero. En la captura el ojo iba a los DOS «Prestarle»
                 antes que al «Cobrar» de abajo, y eso invierte la prioridad de
                 quien va en ruta: el trabajo del día es cobrar. La fila entera
                 existe para pesar menos; un botón macizo la devuelve al frente.
                 Se queda el dorado en el texto y el borde: se identifica sin
                 competir. */
              background: 'var(--cf-card)',
              color: esListo ? 'var(--cf-gold-text-2)' : 'var(--cf-ink-2)',
              border: `1px solid ${esListo ? 'var(--cf-gold-border)' : 'var(--cf-border-strong)'}`,
            }}
          >{contexto.accion.texto}</button>
        )}
      </div>
    )
  }

  return (
    <div
      onClick={cobrada ? undefined : onClick}
      role={cobrada ? undefined : 'button'}
      tabIndex={cobrada ? undefined : 0}
      style={{
        position: 'relative',
        background: 'var(--cf-card)',
        // El anillo dorado marca dónde está parado. Sin él, veinte tarjetas
        // iguales y hay que acordarse de por cuál se iba.
        border: activa && !cobrada ? '1.5px solid var(--cf-gold)' : '1px solid var(--cf-border)',
        boxShadow: activa && !cobrada ? '0 0 0 3px var(--cf-gold-focus)' : undefined,
        borderRadius: 'var(--cf-r-card)',
        // Sin hueco abajo: la barra a sangre del pie va pegada al borde.
        padding: '14px 16px 0 16px',
        // COLUMNA, no fila. Antes era una sola fila —avatar, nombre, cuota— y
        // T03-01 le pone debajo la tira de cifras. La fila de siempre baja un
        // nivel y se queda igual; lo que cambia es que ahora tiene hermana.
        display: 'flex', flexDirection: 'column', gap: 11,
        overflow: 'hidden', flex: 'none',
        /* El cobrado se atenúa, no se borra. La lámina dice .6, y con la fila
           reducida de antes bastaba: solo llevaba el nombre y la hora.
           ⚠ Ahora lleva sus cifras —atraso, cumplimiento, último pago— y a .6
           el «$850.000» en rojo sobre blanco se queda por debajo del contraste
           que se lee bajo sol, que es donde se usa esta pantalla. Sube a .72:
           sigue leyéndose «hecha» —el círculo verde, el check, el nombre
           tachado y el monto en verde— sin que los números haya que adivinarlos. */
        opacity: cobrada ? 0.72 : 1,
        cursor: cobrada ? 'default' : 'pointer',
      }}
    >
      {/* ── ADENDA 5 · E10 · FUERA EL RIEL LATERAL ──
          Aquí había un filete de color pegado al borde izquierdo. La adenda lo
          quita en todas las listas, y la razón es que era el CUARTO sitio donde
          se decía lo mismo —ya está la pastilla, la cifra de atraso en rojo y
          el progreso— y el único sin dato. Además iba a sangre con las esquinas
          rectas, peleando con el radio de la tarjeta.

          Lo sustituyen dos acentos que SÍ dicen cosas distintas: el anillo del
          avatar dice cómo está, y la barra del pie cuánto lleva pagado. La
          regla de la adenda es que «el estado lo llevan los elementos que ya
          identifican a la fila, nunca uno añadido para pintarlo». */}

      {/* ⚠ `flex-start`, NO `center`. Con el nombre y la dirección enteros esta
          fila pasa a tres renglones, y centrando el avatar quedaba a media
          altura —junto al apellido en vez de junto al nombre— y el monto
          flotando en medio del hueco. Es la misma decisión que ya está escrita
          en `TarjetaCliente`: arriba, todo empieza a la altura de la primera
          línea, que es la que se lee. */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>

      {/* El avatar del cobrado es un CHECK, no sus iniciales: la fila ya está
          tachada, y un avatar normal invita a volver a tocarla. */}
      {cobrada ? (
        <span aria-hidden style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 40, height: 40, minWidth: 40, borderRadius: 999, flex: 'none',
          background: 'var(--cf-green-pill-bg)',
        }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--cf-green)"
            strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </span>
      ) : (
        /* EL ANILLO LLEVA EL ESTADO. `aspectRatio: 1` con `minWidth` y
           `minHeight` no es de adorno: sin ellos el avatar se aplasta en cuanto
           el nombre de al lado es largo, y con el anillo puesto un óvalo se ve
           roto. Lo dice la lista de comprobación de la adenda. */
        <span
          {...identidadMuda}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40, minWidth: 40, minHeight: 40, aspectRatio: '1',
            borderRadius: 999, flex: 'none',
            background: 'var(--cf-fill)', fontSize: 15, fontWeight: 700, color: 'var(--cf-ink-2)',
            border: `2px solid ${color}`,
            cursor: irAFicha ? 'pointer' : undefined,
          }}>{iniciales}</span>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
        {/* ── ⚠ EL NOMBRE NO SE CORTA NUNCA ────────────────────────────────
            Iba con `nowrap` + puntos suspensivos y salía «Carlos Prueb…». El
            dueño lo reportó con el motivo exacto, que no es de estética:

              «si hay varios Carlos y lo que los diferencia es el apellido, y
               el apellido sale cortado, es difícil identificarlos»

            En una ruta de 143 clientes eso es tocar la puerta equivocada. La
            tarjeta de las listas ya lo tenía resuelto así desde que se reportó
            allí; ésta se había quedado atrás.

            `anywhere` y no `break-word`: una cédula o un apellido compuesto sin
            espacios se desbordaría igual. Pasa a dos renglones si hace falta —
            una tarjeta pareja que no dice a quién estás mirando no sirve. */}
        {/* ⚠ Y ES EL DESTINO DE «VER A ESTE CLIENTE». Ver la nota de
            `onAbrirCliente` arriba: la tarjeta lleva al cobro, el nombre lleva
            a la persona. Son dos preguntas distintas en la misma fila. */}
        <span
          {...identidad}
          style={{
            fontSize: 17, fontWeight: 700, letterSpacing: '-.015em', color: 'var(--cf-ink)',
            minWidth: 0, overflowWrap: 'anywhere',
            textDecoration: cobrada ? 'line-through' : 'none',
            cursor: irAFicha ? 'pointer' : undefined,
          }}>{nombre}{irAFicha && <FlechaFicha />}</span>

        {cobrada ? (
          <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>
            {cerradaPorHoy
              /* CERRADA A MANO, y se dice con esas palabras. «Cobrado» a
                 secas sobre alguien que todavía debe es mentira: lo que pasó
                 es que el cobrador siguió camino. */
              ? (abonadoAntesDeCerrar
                  ? `Abonó ${abonadoAntesDeCerrar} · cerrado por hoy`
                  : 'Cerrado por hoy')
              : cobradoA ? `Cobrado ${cobradoA}` : 'Cobrado'}
          </span>
        ) : (
          /* ── Y LA DIRECCIÓN TAMPOCO ──
             «La dirección tiene que verse y el nombre tiene que verse completo.»
             Con `nowrap` salía «CALLE 31 CON AVENI…», que en la calle no lleva
             a ninguna puerta. La fila envuelve: la pastilla y la distancia son
             `flex: none` y se quedan arriba; lo que baja de renglón es la
             dirección, que es lo único que se lee entero o no sirve. */
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7, minWidth: 0,
            flexWrap: 'wrap', rowGap: 3,
          }}>
            {textoPastilla && (
              <span className="cf-num" style={{
                display: 'inline-flex', alignItems: 'center', flex: 'none',
                height: 20, padding: '0 8px', borderRadius: 'var(--cf-r-pill)',
                background: p.bg, border: `1px solid ${p.bd}`, color: p.fg,
                fontSize: 11, fontWeight: 700,
              }}>{textoPastilla}</span>
            )}
            {donde && (
              <span style={{
                fontSize: 12, lineHeight: 1.35, color: 'var(--cf-ink-3)',
                minWidth: 0, overflowWrap: 'anywhere',
              }}>{donde}</span>
            )}
            {/* ── LA DISTANCIA (E07) ──
                «El cobrador decide el orden real con ella»: con dos clientes
                igual de atrasados, va primero el que tiene al lado.

                `flex: none` para que NO se recorte: es la dirección la que se
                acorta con puntos suspensivos si no cabe, porque de ella basta
                con el principio. La distancia son cinco caracteres y o se ve
                entera o no dice nada.

                Sin GPS el adaptador manda `null` y la línea queda como estaba:
                inventar una distancia manda a caminar mal, que es justo lo que
                esto viene a evitar. */}
            {distancia && (
              <span className="cf-num" style={{
                fontSize: 12, color: 'var(--cf-ink-3)', flex: 'none', opacity: .85,
              }}>· {distancia}</span>
            )}
          </div>
        )}
      </div>

      {cobrada ? (
        <span className="cf-fig" style={{
          fontSize: 20, letterSpacing: '-.025em', color: 'var(--cf-green-dark)', flex: 'none',
        }}>{montoCobrado}</span>
      ) : contexto?.monto === 'ninguno' ? null : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flex: 'none' }}>
          {/* ── DE QUÉ PERIODO ES ESTA CUOTA ──
              Reportado por un cobrador: «solo dice Rosa Suárez, $8.000, pero no
              se sabe si esa cuota es diaria, semanal, quincenal o mensual».
              Tenía razón: $8.000 al día y $8.000 al mes son dos negocios
              distintos, y sin el periodo el número no se puede ni cobrar ni
              comparar con la tarjeta de al lado.

              ⚠ Va ENCIMA y no pegado a la cifra. Como sufijo —«$8.000/qna»— se
              come el ancho del nombre, que es `flex: 1` y ya baja de renglón:
              los apellidos son lo que identifica y no se recortan.

              `null` cuando el cliente tiene varios préstamos con periodos
              distintos, y cuando el monto no es una cuota (un clavo enseña lo
              perdido, no una cuota). */}
          {periodo && !(contexto?.monto && contexto.monto !== 'defecto') && (
            <span style={{
              fontSize: 10, lineHeight: 1.1, color: 'var(--cf-ink-4)',
              textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600,
            }}>{periodo}</span>
          )}
          {/* EN NEGRO. Era un botón rojo en cada fila, y con veinte filas eso
              era el muro: rojo es mora, no «cobrar». */}
          <span className="cf-fig" style={{ fontSize: 20, letterSpacing: '-.025em', color: 'var(--cf-ink)' }}>
            {contexto?.monto && contexto.monto !== 'defecto' ? contexto.monto.cifra : cuota}
          </span>
          {/* ⚠ 13px, NO 11. «El valor que dice debe sale muy pequeño», y es la
              cifra con la que se negocia en la puerta: $8.000 sobre una deuda
              de $60.000 y sobre una de $600.000 son dos visitas distintas.
              También sube de `ink-3` a `ink-2`: a 11px y en gris claro, al sol
              y con el teléfono en la mano, no se leía. */}
          {(contexto?.monto && contexto.monto !== 'defecto' ? contexto.monto.pie : debe) && (
            <span className="cf-num" style={{ fontSize: 13, color: 'var(--cf-ink-2)', marginTop: 1 }}>
              {contexto?.monto && contexto.monto !== 'defecto' ? contexto.monto.pie : debe}
            </span>
          )}
        </div>
      )}
      </div>

      {/* «Atraso $48.000 · Cumple 62% · Cuota 13/24 · Últ. pago 21 jun».
          El adaptador no la manda en el cobrado: ya está tachado y con su hora,
          y enseñarle el atraso a alguien que acaba de pagar es ruido. */}
      {/* ── EL AVISO DE MORA, EN UNA FRASE (E07) ──
          «Lleva 28 días sin pagar. Debe $960.000 en total.» Dice de una vez
          cuánto lleva sin pagar y cuánto debe EN TOTAL, que es lo que se dice
          en voz alta en la puerta. Y con la palabra «en total» pegada a la
          cifra: el fallo que la adenda denuncia es justo un saldo leído como si
          fuera la mora, y ahí el cobrador le pide al cliente diez veces de más.

          ⚠ SOLO EN LA PARADA ACTUAL, y esto lo aprendí MIRANDO la pantalla, no
          contando. Puesto en todas salían 472 franjas rojas seguidas: la lista
          entera en rojo es el muro que esta pantalla vino a quitar, y en cada
          tarjeta la frase repetía con más palabras lo que ya dicen la pastilla
          («19d») y el saldo («debe $240.000») dos renglones más arriba.

          Es el mismo defecto que E10 le reprocha al riel —«el cuarto sitio
          donde se dice lo mismo»—, así que ponerlo en todas era cambiar un
          duplicado por otro. En la parada actual sí aporta: es donde el
          cobrador está parado y va a hablar. */}
      {avisoMora && activa && !cobrada && (
        <div style={{
          flex: 'none', display: 'flex', alignItems: 'flex-start', gap: 9,
          padding: '10px 13px', borderRadius: 12,
          background: 'var(--cf-red-pill-bg)',
          border: '1px solid color-mix(in srgb, var(--cf-red-dark) 22%, transparent)',
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cf-red-dark)"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ flex: 'none', marginTop: 1 }}>
            <path d="M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
          </svg>
          <span style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--cf-red-dark)', minWidth: 0 }}>
            Lleva <b>{avisoMora.dias} días sin pagar</b>. Debe {avisoMora.total} en total.
          </span>
        </div>
      )}

      {/* ── DESHACER EL CIERRE ────────────────────────────────────────────
          Se cierra «con la opción de si él quiere realizar otro abono,
          poderle abonar». Sin esta salida, decir «ya no paga más» sería
          irreversible por una decisión que se toma de pie en una puerta, y
          el cliente que saca otro billete a los dos minutos dejaría al
          cobrador teniendo que buscar la ficha por otro camino.

          Discreto y en su propia línea: la fila cerrada tiene que seguir
          leyéndose como hecha. */}
      {cerradaPorHoy && onReabrir && (
        <div style={{ flex: 'none' }} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onReabrir}
            style={{
              width: '100%', height: 38, borderRadius: 11, cursor: 'pointer',
              background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
              font: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--cf-ink-2)',
            }}
          >Volver a abrir · cobrarle más</button>
        </div>
      )}

      {/* Los renglones de arriba. Van en TODAS las fichas, no solo en la
          actual, porque cambian la cifra que se pide: enterarse de la cuota
          extra al llegar a la puerta es tarde. */}
      {!cobrada && avisos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 'none' }}>
          {avisos.map((a, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '7px 11px', borderRadius: 10,
              background: a.tono === 'contra' ? 'var(--cf-red-pill-bg)' : 'var(--cf-gold-bg)',
              border: `1px solid ${a.tono === 'contra' ? 'var(--cf-red-pill-border)' : 'var(--cf-gold-border)'}`,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke={a.tono === 'contra' ? 'var(--cf-red-dark)' : 'var(--cf-gold-text-2)'}
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
                <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" />
              </svg>
              <span style={{
                fontSize: 11.5, lineHeight: 1.3, minWidth: 0,
                color: a.tono === 'contra' ? 'var(--cf-red-dark)' : 'var(--cf-gold-text-2)',
              }}>{a.texto}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── ABONÓ HOY, PERO SIGUE PENDIENTE ──
          El caso que se había perdido. Un cliente con tres préstamos abona
          $8.000 de uno: entró plata suya hoy, pero todavía le toca cobro. La
          fila queda VIVA —con su cuota y su botón— y lo dice, para que el
          cobrador no le vuelva a cobrar lo mismo sin darse cuenta.

          Verde y no rojo: es dinero que YA entró. Lo que avisa no es un
          problema del cliente, es un dato de la visita. */}
      {abonoHoy && !cobrada && (
        <div style={{
          flex: 'none', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 11,
          background: 'var(--cf-green-pill-bg)',
          border: '1px solid var(--cf-green-pill-border)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--cf-green-dark)"
            strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
            <path d="M5 13l4 4L19 7" />
          </svg>
          <span style={{ flex: 1, fontSize: 12, lineHeight: 1.35, color: 'var(--cf-green-dark)', minWidth: 0 }}>
            Ya abonó <b>{abonoHoy}</b> hoy · sigue pendiente
          </span>
          {/* ── «HASTA AQUÍ POR HOY» ──────────────────────────────────────
              Reportado con el caso exacto: debe $100.000, la cuota es de
              $10.000 y ya abonó $20.000 —dos cuotas—. Está bien que siga
              apareciendo, pero si el cliente ya dijo que no da más, el
              cobrador necesita seguir su ruta sin tenerlo eternamente de
              primero como pendiente.

              Va AQUÍ y no entre las acciones a propósito: solo tiene sentido
              cuando ya entró plata, y pegado a la frase que dice cuánta. Como
              botón suelto invitaría a saltarse clientes sin cobrarles. */}
          {onCerrarVisita && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onCerrarVisita() }}
              style={{
                flex: 'none', height: 30, padding: '0 11px', cursor: 'pointer',
                borderRadius: 9, font: 'inherit', fontSize: 12, fontWeight: 700,
                background: 'var(--cf-card)',
                border: '1px solid var(--cf-green-pill-border)',
                color: 'var(--cf-green-dark)', whiteSpace: 'nowrap',
              }}
            >Hasta aquí hoy</button>
          )}
        </div>
      )}

      {/* ── POR QUÉ HOY NO LE TOCA ──
          «Le cobras el 20 de diciembre · en 500 días», «Préstamo dado por
          perdido», «Terminó de pagar el 3 de julio». Es la línea que convierte
          una fila muda en una decisión: si vale la pena adelantarle, si hay que
          volver a prestarle o si la ruta está sin limpiar.

          Va en gris y sin caja: no es una alarma —para eso están los `avisos`,
          que sí llevan fondo— sino el estado normal de esa persona. */}
      {contexto?.nota && !cobrada && (
        <span style={{
          flex: 'none', fontSize: 12, lineHeight: 1.4, color: 'var(--cf-ink-3)',
        }}>{contexto.nota}</span>
      )}

      {/* Las de la zona cuando las trae —al día usa las de siempre, porque
          atraso y cumplimiento son ciertos y son lo que decide renovarle—. */}
      <TiraCifras columnas={contexto?.cifras ?? cifras} enTarjeta />

      {/* ── LOS PRÉSTAMOS, PLEGADOS (E07) ──
          «Se pliegan y se abren solo si el cliente discute.» El titular de la
          tarjeta es lo que se le pide HOY; los saldos son para cuando hay que
          defender la cifra.

          Solo con MÁS DE UNO: con un solo préstamo no hay nada que plegar —el
          saldo ya está arriba, en «debe $92.000»— y un desplegable que abre una
          sola fila es un toque de más para nada. */}
      {prestamos.length > 1 && (
        <div style={{ flex: 'none' }} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: 0,
              background: 'none', border: 0, cursor: 'pointer', font: 'inherit',
              fontSize: 12, color: 'var(--cf-ink-3)',
            }}
          >
            {prestamos.length} préstamos
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {abierto && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
              {prestamos.map((p) => (
                <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: 6, minWidth: 0,
                      fontSize: 13, fontWeight: 700, color: 'var(--cf-ink)',
                    }}>
                      {p.desde ? `Del ${p.desde}` : 'Préstamo'}
                      {/* CUÁL de los dos es el perdido. Arriba ya avisa que
                          tiene uno; aquí se dice cuál, que es lo que hacía
                          falta para no volver a prestarle sobre él. */}
                      {p.esClavo && <EtiquetaClavo />}
                    </span>
                    <span className="cf-fig" style={{ fontSize: 15, color: 'var(--cf-ink)', flex: 'none' }}>
                      {p.saldo}
                    </span>
                  </div>
                  <span style={{
                    display: 'block', height: 4, borderRadius: 999,
                    background: 'var(--cf-fill)', overflow: 'hidden', flex: 'none',
                  }}>
                    <span style={{
                      display: 'block', height: 4, borderRadius: 999,
                      width: `${p.pagadoPct}%`, background: color,
                    }} />
                  </span>
                  {/* ⚠ EN PESOS Y NO SOLO EN PORCENTAJE. Decía «63% pagado de
                      $1.200.000», y el cliente en la puerta no pregunta un
                      porcentaje: pregunta cuánto lleva puesto. El porcentaje se
                      queda —es lo que se lee de un vistazo y lo que dibuja la
                      barra de encima— pero delante va la cifra.
                      Y su tramo de fechas, que aquí es donde puede decirse: con
                      varios préstamos la línea de abajo no sabe de cuál hablar. */}
                  <span className="cf-num" style={{ fontSize: 11, color: 'var(--cf-ink-3)' }}>
                    Pagado {p.pagado}{p.pagadoDe ? ` de ${p.pagadoDe}` : ''} · {p.pagadoPct}%
                    {p.tramo ? ` · ${p.tramo}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Las acciones de la parada actual. Solo aquí: en las demás filas serían
          sesenta botones en una pantalla que se opera caminando.

          ── E07 · Y LA PRINCIPAL, EN DORADO ──
          Cobrar era lo ÚNICO que no tenía botón: se hacía tocando la tarjeta
          entera, que es un gesto que hay que saberse. Los tres iconos de al
          lado —WhatsApp, mapa, más— son las secundarias y llevaban todo el peso
          visual de la fila.

          ⚠ DORADO, NUNCA VERDE. En el sistema el verde significa «al día,
          pagado»; usarlo como color de acción rompe esa lectura justo donde más
          importa, que es la pantalla donde se decide si alguien pagó. */}
      {/* ── EN TODAS LAS FICHAS, NO SOLO EN LA ACTUAL ──
          Estaban solo en la parada actual, con este argumento: «una lista de
          veinte tarjetas con tres botones cada una es un muro». El dueño lo
          rebate con el caso real, y tiene razón: «alguien se quiere saltar un
          cliente y entonces a aquel no lo puede gestionar; no le va a dar la
          opción de tocarle el WhatsApp, la ubicación o el cobro rápido».

          El orden de la ruta es una SUGERENCIA, no un carril: el cobrador se
          salta al que no está, vuelve luego, cobra al que le sale al paso. Una
          pantalla que solo deja operar la fila número uno le obliga a cobrar en
          un orden que la calle no respeta.

          El muro sigue evitado por otro lado: la parada actual conserva su
          borde dorado y su aviso de mora, así que se distingue igual. Lo que
          cambia es que las demás dejan de estar mudas. */}
      {/* ── ⚠ Y EN LA COBRADA TAMBIÉN, PERO SIN EL BOTÓN GRANDE ──
          Iba con `!cobrada` entero, así que una parada hecha se quedaba sin
          forma de escribirle el recibo por WhatsApp ni de abrir su ficha: había
          que buscar al cliente por otro camino justo después de cobrarle.
          Lo que NO vuelve es el botón dorado: ahí ya no hay nada que cobrar hoy
          y un «Cobrar» sobre una fila tachada invita a cobrar dos veces. */}
      {(onLlamar || onWhatsApp || onMapa || onMas) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 'none' }}
          onClick={(e) => e.stopPropagation()}>
          {/* ── DOS FILAS, Y NO UNA ────────────────────────────────────────
              Estaban los cinco controles en una sola fila con «Cobrar» a
              `flex: 1`, quedándose con lo que sobrara. Con tres iconos aún
              respiraba; al entrar el de llamar —que la tarjeta vieja tenía y
              se había perdido— se quedó en unos 90px y el botón principal
              pasó a ser el más pequeño de la fila. Reportado: «el botón de
              cobrar quedó justificadamente pequeño».

              Las secundarias se reparten el ancho arriba y COBRAR SE LLEVA UN
              RENGLÓN ENTERO. Cuesta unos 50px de alto por ficha, y los vale:
              es la acción por la que se abre esta pantalla, y con las
              acciones ya en todas las fichas es la que más se pulsa. */}
          <div style={{ display: 'flex', gap: 8 }}>
          {/* ── SOLO EL ICONO, y no es cosmético ──
              Con el carril, la tarjeta pierde 46px de ancho —la propia adenda
              lo avisa: «quedan 304px de los 350»— y los cuatro controles dejan
              de caber: medido, «WhatsApp» se salía de su botón y pisaba
              «Mapa».

              La lámina de E07 los dibuja así: tres iconos cuadrados de 44 y el
              botón de cobrar llevándose el resto. El texto sobra porque el
              logo de WhatsApp y el pin de mapa se reconocen solos, y lo que sí
              tiene que leerse —«Cobrar»— gana el sitio que sueltan. */}
          {/* LLAMAR. Estaba en la tarjeta vieja de la ruta y se perdió en la
              sustitución: se llama antes de llegar, para no subir la loma y
              encontrarse la casa cerrada. */}
          {onLlamar && (
            <AccionParada onClick={onLlamar} soloIcono aria-label="Llamar">
              <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </AccionParada>
          )}
          {onWhatsApp && (
            <AccionParada onClick={onWhatsApp} tono="verde" relleno soloIcono aria-label="WhatsApp">
              {/* EL LOGO DE VERDAD. Lo que había era una burbuja de trazo
                  dibujada a mano: no es el logo de WhatsApp, y encima el trazo
                  tocaba el borde del viewBox y salía cortado. */}
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </AccionParada>
          )}
          {onMapa && (
            <AccionParada onClick={onMapa} soloIcono aria-label="Ver en el mapa">
              <path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" />
              <circle cx="12" cy="10" r="2.6" />
            </AccionParada>
          )}
          {onMas && (
            <AccionParada onClick={onMas} soloIcono aria-label="Más opciones">
              <circle cx="12" cy="5" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="12" cy="19" r="1.4" />
            </AccionParada>
          )}

          </div>

          {/* Sigue funcionando tocar la tarjeta entera —el gesto de siempre no
              se quita—; esto solo lo hace visible, y ahora con el tamaño que
              le corresponde. */}
          {/* ── NO SIEMPRE DICE «COBRAR» ──
              A quien está al día se le ADELANTA, al que terminó se le PRESTA y
              al que lleva un año sin nada se le SACA de la ruta. Con el mismo
              botón dorado en los cuatro, el cobrador le pide la cuota a quien
              no debe nada.

              Y el dorado sólido se lo queda quien gana dinero: la cuota de hoy
              y «Prestarle». «Cobrar antes» va secundario porque es un adelanto,
              no la cuota. */}
          {!cobrada && (
          <button
            type="button"
            onClick={contexto?.accion ? onAccion : onClick}
            style={{
              width: '100%', height: 46, borderRadius: 12,
              border: contexto?.accion?.tono === 'apagado' ? '1px solid var(--cf-border-strong)' : 'none',
              background: contexto?.accion?.tono === 'apagado' ? 'var(--cf-card)' : 'var(--cf-gold)',
              color: contexto?.accion?.tono === 'apagado' ? 'var(--cf-ink-2)' : 'var(--cf-gold-ink)',
              font: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              letterSpacing: '-.01em',
            }}
          >{contexto?.accion?.texto ?? 'Cobrar'}</button>
          )}
        </div>
      )}

      {/* ── EL RÓTULO DE LA BARRA (ago 2026) ─────────────────────────────
          «Pagado $28.000 de $120.000 · 11 jun → 23 sep»

          Dos cosas que pidió el cliente que camina la ruta, y las dos por el
          mismo motivo: no entrar y salir de la ficha estando de pie en una
          puerta.

            «el usuario le pregunta que cuánto ya ha pagado»
            «tiene que poderse ver la fecha de inicio y la de finalización»

          ⚠ NO ES UN BLOQUE NUEVO: ES EL RÓTULO DE UNA BARRA QUE YA ESTABA.
          Justo debajo va la barra a sangre cuyo relleno es `pagadoPct`, y su
          propio comentario dice «dice CUÁNTO LLEVA PAGADO» — pero va
          `aria-hidden` y sin un solo número. El dato estaba dibujado y no
          estaba dicho. Ponerlo aquí cuesta un renglón y convierte la barra en
          la ilustración de la frase, en vez de en un adorno.

          POR QUÉ ABAJO Y NO EN LA TIRA DE CIFRAS. La tira responde a HOY
          —atraso, cumplimiento, cuota, último pago— con cuatro columnas de
          ~78px que ya se estrecharon una vez. Esto es el préstamo ENTERO: otra
          pregunta, otro registro. Y arriba no cabía sin robarle sitio al
          nombre y al monto, que son lo que se lee primero.

          En gris y a 12px a propósito: es el dato que se consulta cuando lo
          preguntan, no el que decide la visita. Si compitiera con el monto,
          la tarjeta dejaría de leerse de un vistazo — que es lo único que el
          dueño pidió no perder. */}
      {vida && !cobrada && (
        <span style={{
          flex: 'none', fontSize: 12, lineHeight: 1.35, color: 'var(--cf-ink-3)',
          display: 'flex', flexWrap: 'wrap', columnGap: 6, rowGap: 2,
        }}>
          {/* La cifra que preguntan, en `ink-2`: dentro de una línea gris tiene
              que poder encontrarse sin leer la frase entera. */}
          <span>
            Pagado <b className="cf-num" style={{ color: 'var(--cf-ink-2)', fontWeight: 700 }}>{vida.pagado}</b> de {vida.total}
          </span>
          {vida.tramo && (
            <span className="cf-num" style={{ whiteSpace: 'nowrap' }}>· {vida.tramo}</span>
          )}
        </span>
      )}

      {/* ── LA BARRA A SANGRE (Adenda 5 · E10) ──
          Último hijo de la tarjeta, pegada al borde de lado a lado. El
          `margin` negativo anula el padding lateral: sin él quedaría un
          renglón de color flotando con 16px de aire a cada lado, que se lee
          como un elemento más y no como el borde de la tarjeta.

          ⚠ `flex: none` es obligatorio. La tarjeta es una columna flex y sin
          él la barra se encoge hasta desaparecer en cuanto el contenido de
          arriba pide sitio — y el fallo es invisible: no se rompe nada, solo
          deja de estar.

          Dice CUÁNTO LLEVA PAGADO, que es lo que la distingue del anillo del
          avatar. Si algún día las dos dijeran lo mismo, sobraría una. Desde
          ago 2026 lleva ADEMÁS su rótulo, justo encima. */}
      <span aria-hidden style={{
        flex: 'none', display: 'block', height: 5,
        margin: '0 -16px', background: 'var(--cf-fill)',
      }}>
        <span style={{
          display: 'block', height: 5,
          width: `${Math.max(0, Math.min(100, pagadoPct ?? 0))}%`,
          background: cobrada ? 'var(--cf-green)' : color,
        }} />
      </span>
    </div>
  )
}

/* Un botón de la parada actual. Alto 42 —el dedo necesita 44 y va dentro de una
   tarjeta que ya se puede pulsar entera—, y el de tres puntos cuadrado. */
/* `relleno` para los glifos de marca —el de WhatsApp es una SILUETA, no un
   trazo—. Pintado con `stroke` salía como un contorno raro, y además RECORTADO:
   ese dibujo llega justo al borde de su viewBox, así que el grosor de línea se
   sale del lienzo y la parte de fuera se corta. Reportado en la captura.
   El mapa y los tres puntos siguen siendo trazo, que es como se dibujan. */
export function AccionParada({ children, texto, tono, soloIcono, relleno, onClick, ...resto }) {
  const pincel = relleno
    ? { fill: 'currentColor', stroke: 'none' }
    : { fill: 'none', stroke: 'currentColor', strokeWidth: '1.9', strokeLinecap: 'round', strokeLinejoin: 'round' }
  return (
    <button
      type="button"
      onClick={onClick}
      {...resto}
      style={{
        // `flex: 1` también con solo icono: ahora comparten su propia fila y
        // se reparten el ancho, en vez de quedarse en 46px fijos dejando un
        // hueco muerto a la derecha.
        height: 42, flex: 1, minWidth: soloIcono ? 44 : undefined,
        minWidth: 0, cursor: 'pointer', borderRadius: 'var(--cf-r-control)',
        background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        font: 'inherit', fontSize: 13, fontWeight: 700,
        /* `--cf-green-dark`, el verde del sistema, NO `--cf-whatsapp` (#25D366):
           ese es el verde de marca de ellos y sobre blanco no da contraste de
           lectura para un texto de 13px. El icono ya identifica la app. */
        color: tono === 'verde' ? 'var(--cf-green-dark)' : 'var(--cf-ink-2)',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" {...pincel} style={{ flex: 'none' }}>
        {children}
      </svg>
      {texto}
    </button>
  )
}

/* ══ LA SEGUNDA ZONA (Adenda 5 · E09) ═══════════════════════════════════════
   «El carril numera VISITAS, no clientes.» Es la regla de la lámina y la razón
   de que esto exista: quien hoy no tiene nada que recoger sale del carril y
   baja aquí, sin número.

   Y no es una cuestión de orden. Un contador que incluye paradas que no se
   hacen es PEOR que no tener contador: el cobrador lee «16 cobros», hace los
   diez que había de verdad y se cree atrasado yendo al día. */
export function SeparadorZona({ children = 'También en esta ruta' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 2px' }}>
      <span aria-hidden style={{ flex: 1, height: 1, background: 'var(--cf-border)' }} />
      <span style={{
        flex: 'none', fontSize: 11, fontWeight: 800, letterSpacing: '.07em',
        textTransform: 'uppercase', color: 'var(--cf-ink-3)',
      }}>{children}</span>
      <span aria-hidden style={{ flex: 1, height: 1, background: 'var(--cf-border)' }} />
    </div>
  )
}

/* ⚠ AQUÍ VIVÍA `FilaFueraDeParada`, la tarjeta reducida del fondo de la lista.
   Enseñaba nombre, una frase y un botón: sin número, sin cifras, sin los
   préstamos y sin las acciones. El dueño lo reportó con la pantalla delante —
   «salen hasta abajo, sin ninguna numeración, sin ningún dato de sus préstamos,
   sin ningún contexto, nada»— y tiene razón: un cliente al día con $149.000
   pendientes no es menos información que uno que se cobra hoy.

   Ahora es LA MISMA `FilaCobro`, con `contexto` diciendo en qué situación está.
   Ver `contextoZona()` en `lib/adaptadores/ruta.js`.

   Se borra en vez de dejarse sin usar a propósito: dos tarjetas para lo mismo
   es como se llegó al comprobante que se arregló por un camino y siguió roto
   por el otro, reportado dos días seguidos. */
