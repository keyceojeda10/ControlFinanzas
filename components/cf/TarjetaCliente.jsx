'use client'

// components/cf/TarjetaCliente.jsx
//
// LA PIEZA MÁS REPETIDA DEL SISTEMA. Receta en 03-COMPONENTES.md §3.
//
// ⚠ LA MANDA EL TURNO 03, NO EL 02. La dibujan T02-05/06/02 y, DESPUÉS,
// T03-03 (clientes), T03-04 (préstamos) y T03-01 (cobrar hoy) — que la
// corrigen. La construí contra el turno 02 porque en el inventario anoté que
// las del 03 eran «las mismas con datos de ejemplo»; no lo eran, y el usuario
// lo vio de inmediato. El pie de T03-04 lo dice sin rodeos:
//
//   «Faltaba lo más básico: la cuota. Y la ganancia acumulada, que es la razón
//    de ser del préstamo y no aparecía en ninguna lista.»
//
// Tres cambios del 03 sobre el 02, y son de estructura:
//   1. El monto sube a la fila del nombre, a la derecha, con su subtítulo
//      debajo («de $1.200.000»). Ya no tiene fila propia.
//   2. La pastilla de estado baja a la segunda línea, junto al contexto.
//   3. Aparece la TIRA DE CIFRAS: cuatro columnas con filete, sobre un borde.
//      Es lo que el usuario echaba en falta, y es la mitad de la tarjeta.
//
// LAS DOS VARIANTES CONVERGEN. Con el turno 02 se separaban en seis numeros
// (relleno 15 vs 14, riel 14 vs 13, monto 23 vs 21, y la de cliente llevaba un
// rotulo «DEUDA TOTAL» encima del monto). T03-03 y T03-04 las dibujan con el
// mismo relleno y el mismo riel, y ninguna lleva rotulo. Lo unico que las
// separa hoy es el avatar —solo la de cliente— y el hueco que necesita al lado.
//
// DOS NIVELES DE INFORMACIÓN, NUNCA TRES:
//   nivel 1 — quién:  nombre + UNA pastilla
//   nivel 2 — qué:    una línea de contexto
//   y debajo, el monto con su barra.
//
// DECISIONES QUE NO SON OPCIONALES (salieron de defectos reales):
//
//  · UNA sola pastilla, en la primera línea, con los días DENTRO del texto:
//    «10d mora», «6d vencido», «36d de atraso». Yo tenía dos —el estado arriba y
//    los días abajo— y eso mete un segundo portador de color en una tarjeta que
//    ya tiene tres (riel, pastilla, barra).
//  · EL AVATAR NO LLEVA BORDE DE COLOR. La receta lo permite («cuando el estado
//    importa»), pero ninguna de las tres láminas lo usa: los nueve avatares son
//    #F3F3EF pelado. Con riel, pastilla y barra ya hay tres sitios diciendo lo
//    mismo; el cuarto es ruido.
//  · El «% pagado» va al lado de la BARRA, con la cuota exacta: «cuota 13/24 ·
//    54%». Las dos dicen cosas distintas y las dos hacen falta — por donde va el
//    calendario y por donde va la plata.
//  · La tarjeta es `flex:none`. Con `flex:1` dentro de una columna saturada
//    absorbe todo el déficit, se aplasta y su texto se sale del overflow.
//  · La barra de progreso es `flex:none`. Si es encogible colapsa a 0px y con
//    ella desaparece el estado de la fila.
//  · El fondo es SIEMPRE blanco. El estado va en el riel de 4px, nunca tiñendo
//    la tarjeta: eso era el muro chillón que este rediseño corrige.

import { BarraProgreso, Pastilla, TiraCifras, EtiquetaClavo, EstrellaCliente } from './primitivos'
import OfflineBadge from '@/components/offline/OfflineBadge'
import { Metadatos, Dato, ModoInteres, CreadoPor, TRAZO } from './Metadatos'
import DesglosePrestamos from './DesglosePrestamos'

const COLOR_ESTADO = {
  mora:   'var(--cf-red)',
  atraso: 'var(--cf-gold)',
  aldia:  'var(--cf-green)',
  // `renovar` es al día Y por encima del 80% pagado: mismo verde, otra pastilla.
  // No es un estado de riesgo, es una oportunidad — de renovar sale el
  // crecimiento del negocio.
  renovar: 'var(--cf-green)',
  // EL PAGADO SE APAGA EN GRIS, no se tiñe de verde. El pie de T02-06 lo dice
  // literal: «los pagados se apagan al 60% en gris en vez de teñirse de verde».
  // Y es la diferencia entre «va bien» y «esto ya terminó»: en verde, un
  // préstamo cerrado compite por la atención con uno al día que sí hay que
  // seguir cobrando.
  pagado: 'var(--cf-ink-4)',
}

/* `Pastilla` solo conoce mora/atraso/aldia/neutro/destacado, así que los dos
   estados propios de T02-06 hay que traducirlos: `renovar` toma el verde de «al
   día», y `pagado` la neutra — no hay «color de terminado», hay ausencia de
   alarma. */
const TONO_PASTILLA = { mora: 'mora', atraso: 'atraso', aldia: 'aldia', renovar: 'aldia', pagado: 'neutro' }

const TONO_BARRA = { mora: 'mal', atraso: 'oro', aldia: 'ok', renovar: 'ok', pagado: 'neutro' }

/** Los seis números que cambian entre las dos láminas, juntos y con nombre. */
const MEDIDAS = {
  // Con la tira del turno 03 las dos convergen: T03-03 y T03-04 dibujan el
  // mismo relleno y el mismo riel. Lo único que las separa es el avatar, que
  // solo lleva la de cliente, y el hueco que necesita a su lado.
  cliente:  { hueco: 12, huecoFila: 12, monto: 20, huecoSub: 4 },
  prestamo: { hueco: 12, huecoFila: 10, monto: 20, huecoSub: 4 },
}

/* El relleno, en piezas sueltas y no en una cadena.
 *
 * La barra a sangre del pie necesita SUS NÚMEROS para anularlo con un margen
 * negativo: escritos aparte se separan del padding en cuanto se toca uno, y la
 * barra queda flotando con aire a un lado.
 *
 * ⚠ Y EL IZQUIERDO BAJA DE 19 A 16. Los 3px de más eran «el hueco que deja
 * sitio al riel», y el riel se fue con E10: sin él, la tarjeta quedaba con el
 * texto descentrado —tres píxeles más lejos del borde izquierdo que del
 * derecho— sin nada que lo justificara. */
const RELLENO_LATERAL = { arriba: 15, der: 16, abajo: 15, izq: 16 }

export default function TarjetaCliente({
  // `id`: para decir si hay un cobro SUYO guardado en este teléfono sin subir.
  id,
  nombre,
  iniciales,
  // La foto del cliente, si la subió. Va DENTRO del círculo de iniciales, no en
  // vez de él: ver la nota de abajo, donde se pinta.
  foto,
  // 'cliente' → con avatar. 'prestamo' → sin él: el dueño ya sabe de quién es,
  // y ese ancho se lo lleva la línea de condiciones, que es más larga.
  variante = 'cliente',
  estado = 'aldia',        // 'mora' | 'atraso' | 'aldia' — solo el COLOR
  // El TEXTO de la pastilla lo compone la pantalla, porque cambia en cada una:
  // «10d mora» en clientes, «36d mora» en préstamos, «36d de atraso» en cobrar
  // hoy. Meterlo acá obligaría a la tarjeta a saber en qué pantalla está.
  etiquetaEstado,
  contexto,                // «Ana María · 3 préstamos»
  // Lo MISMO que `contexto` pero en piezas, para pintarlo con icono y con aire
  // en vez de una cadena gris separada por puntos. Lo componen los adaptadores
  // (`piezasDe` / `piezasDeCliente`). Si no llega, se pinta `contexto`.
  piezas,
  // ── DE HOY ──
  // Un punto verde al lado del nombre, no una pastilla: la pastilla de estado
  // ya está a la derecha y dos pastillas en la misma fila compiten. El punto
  // dice «mira aquí» sin quitarle sitio al nombre, que es lo que se lee.
  nuevo = false,
  /* ── DADO POR PERDIDO ──
     Va al lado de la pastilla de estado, no en su lugar: un clavo puede además
     estar en mora, y las dos cosas hacen falta. La compone `adaptarPrestamos`
     desde `esClavo`, así que sale igual en la lista de préstamos y en la ficha
     del cliente — que son dos de las cinco pantallas donde el dueño no podía
     saber cuál de los dos préstamos era el perdido. */
  clavo = false,
  /* ── CÓMO HA PAGADO LO ANTERIOR ──
     `{ nivel, numero }` de `lib/calificacion.js`. La compone el adaptador desde
     el historial, así que sale igual en la lista, en la ficha del cliente y en
     la parada de la ruta — que son los tres sitios donde se ve un cliente y
     donde este repo ya pagó tres veces arreglar un camino y dejar los otros. */
  calificacion = null,
  tituloCalificacion,
  monto,
  // Debajo del monto y alineado a su derecha: «de $1.200.000» en préstamos,
  // «3 préstamos» en clientes.
  detalle,
  // ── LA TIRA DEL TURNO 03 ──
  // Cuatro columnas: [{ etiqueta, valor, tono }], el mismo formato que ya usa
  // `TiraCifras` en el bloque oscuro. `tono` es 'contra' | 'favor' | 'oro'.
  // Las compone la pantalla porque cambian en cada una: cuota / atraso /
  // ganancia / vence en préstamos, y atraso / cumple / pagado / próximo cobro
  // en clientes.
  cifras,
  porcentaje = 0,
  // Lo que se lee al lado de la barra: «cuota 13/24 · 54%».
  avance,
  // `unico` no tiene cuotas: estaría en 0% durante todo el plazo. Mostrar una
  // barra vacía acá reintroduce en la lista la misma alarma falsa que la ficha
  // elimina — y son 882 préstamos. La reemplaza el vencimiento.
  sinProgreso = false,
  nota,                    // «vence en 18 días»

  // ── EL DESPLEGABLE ──
  // `{ rotulo, prestamos: [ficha] }`, lo que devuelven `desgloseDe()` (varios,
  // en la lista de clientes) y `fichaDe(…, { largo: true })` (uno, en la de
  // préstamos). La tarjeta no sabe cuál de los dos le llegó: pinta lo que hay.
  //
  // Existe porque la tira de cuatro columnas es un TITULAR. Un cliente con tres
  // préstamos enseñaba UN atraso, UN cumplimiento y UN «cobra el» —y ese último
  // ni siquiera es de nadie: cada préstamo tiene su propio día de cobro— así
  // que para saber cuál iba mal había que entrar a la ficha.
  desglose,
  // Qué hace cada ficha del desplegable. Sin ellas se pinta el desglose y ya:
  // los botones no aparecen. Ver `DesglosePrestamos`.
  onPrestamo,              // entrar a ESE préstamo
  onWhatsAppPrestamo,      // abrir las plantillas con ESE préstamo de contexto
  onCobrarPrestamo,        // cobro rápido de ESE préstamo

  onClick,
  /* El id con el que la lista vuelve a encontrar esta tarjeta al regresar de la
     ficha. `data-ancla-lista` le pone el `scroll-margin` para que no aterrice
     pegada a la cabecera. La `Carril` de la ruta tiene su equivalente desde el
     principio; aquí faltaba, y por eso clientes y préstamos perdían el sitio. */
  ancla,
  style,
}) {
  const color = COLOR_ESTADO[estado] || COLOR_ESTADO.aldia
  const m = MEDIDAS[variante] || MEDIDAS.cliente
  // .6 de la lámina. Atenuar la fila entera dice «terminado» sin quitarla de la
  // lista: sigue siendo historia consultable, pero deja de pedir atención.
  const apagada = estado === 'pagado'
  const conAvatar = variante === 'cliente' && !!iniciales
  // Bajo el monto. Antes este hueco cargaba con todo —el detalle, la nota Y el
  // porcentaje— porque no había dónde más ponerlo. Ahora el porcentaje vive al
  // lado de la barra (`avance`) y la nota tiene su propia línea, así que aquí
  // queda solo lo que la lámina pone: el total del que sale ese saldo.
  const derecha = detalle

  return (
    <div
      id={ancla}
      data-ancla-lista={ancla ? '' : undefined}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        position: 'relative',
        background: 'var(--cf-card)',
        border: '1px solid var(--cf-border)',
        borderRadius: 'var(--cf-r-card)',
        // Sin hueco abajo: la barra a sangre va pegada al borde inferior.
        padding: `${RELLENO_LATERAL.arriba}px ${RELLENO_LATERAL.der}px 0 ${RELLENO_LATERAL.izq}px`,
        display: 'flex', flexDirection: 'column', gap: m.hueco,
        overflow: 'hidden',
        flex: 'none',
        opacity: apagada ? 0.6 : 1,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {/* ── ADENDA 5 · E10 · FUERA EL RIEL ──
          Aquí vivía el filete de 4px pegado al borde izquierdo, y la adenda lo
          quita en las dos variantes: «el estado lo llevan los elementos que ya
          identifican a la fila — nunca uno añadido para pintarlo».

          Era el CUARTO sitio donde se decía lo mismo —ya están la pastilla, la
          cifra de atraso en rojo y la barra de progreso— y el único sin dato.
          Y encima iba a sangre con las esquinas rectas, peleando con el radio
          de 16px de la tarjeta.

          Lo sustituyen:
            · cliente (tiene avatar) → anillo de 2px + la barra, ahora a sangre
            · préstamo (sin avatar)  → solo la barra a sangre

          ⚠ DOS ACENTOS SOLO CONVIVEN SI DICEN COSAS DISTINTAS: el anillo dice
          CÓMO ESTÁ y la barra CUÁNTO LLEVA PAGADO. Añadir un riel encima sería
          decir la pastilla por cuarta vez. */}

      {/* ── Nivel 1 · quién, y cuánto ──
          EL TURNO 03 MANDA SOBRE EL 02, Y ESTO ES LO QUE CAMBIA.
          T02-05/06 ponían el monto en su propia fila debajo, y la pastilla de
          estado a la derecha del nombre. T03-03 y T03-04 lo reordenan: el monto
          sube a esta fila, alineado a la derecha con su subtítulo debajo, y la
          pastilla baja a la segunda línea junto al contexto.
          Gana una fila entera de alto, que es la que ocupan las cifras. */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: m.huecoFila }}>
        {conAvatar && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            /* `relative` porque la foto va encima en absoluto: sin esto se
               anclaría a la tarjeta entera y saldría en una esquina. */
            position: 'relative',
            width: 40, minWidth: 40, height: 40, minHeight: 40, aspectRatio: '1',
            borderRadius: 999, flex: 'none', overflow: 'hidden',
            background: 'var(--cf-fill)',
            fontSize: 15, fontWeight: 700, color: 'var(--cf-ink-2)',
            /* ── EL ANILLO DE ESTADO (Adenda 5 · E10) ──
               Aquí decía «gris pelado, el borde de color sobra», y era cierto
               MIENTRAS existía el riel: con riel, pastilla y barra ya había
               tres sitios diciendo el estado y el anillo habría sido el cuarto.

               La adenda invierte el reparto: quita el riel y le da el estado al
               avatar, que es lo primero que se mira de cada fila. Ahora el
               anillo no es el cuarto portador, es el primero — y el borde
               izquierdo de la tarjeta queda limpio, que es lo que hace que una
               lista de treinta clientes se vea ordenada en vez de rayada. */
            border: `2px solid ${color}`,
          }}>
            {/* LA FOTO NUNCA SE PINTABA. El cliente la sube, la base la guarda
                (163 clientes la tienen) y esta tarjeta enseñaba las iniciales
                igual: no había un solo `<img>` en el archivo. El dueño lo
                reportó — «la foto de perfil del cliente creado no está trayendo
                la foto».

                Las iniciales siguen DEBAJO, no como alternativa condicional: si
                la URL está rota o el servidor no responde, la imagen se cae y lo
                que queda es el círculo con las iniciales, que es exactamente lo
                de antes. Un avatar vacío se lee como un cliente sin datos. */}
            {foto && (
              <img
                src={foto}
                alt=""
                loading="lazy"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
                style={{
                  position: 'absolute', width: 40, height: 40,
                  borderRadius: 999, objectFit: 'cover',
                }}
              />
            )}
            {iniciales}
          </span>
        )}

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: m.huecoSub }}>
          {/* ── EL NOMBRE, LA LÍNEA ENTERA PARA ÉL ───────────────────────────
              La pastilla «NUEVO» iba AQUÍ, delante del nombre, con `flex: none`
              y un comentario que decía que así no le robaba ancho. `flex: none`
              impide que la pastilla se encoja, no que ocupe: son dos cosas
              distintas y me lo creí sin medirlo.

              Reportado: «la etiqueta de Nuevo desplaza mucho el nombre».
              Medido a 393px con el caso de su captura —cliente nuevo CON
              préstamo, así que el monto ocupa la derecha—:

                  sin la pastilla   nombre 160px · 1 renglón
                  con la pastilla   nombre  79px · 3 renglones

              Le robaba 81px, más de la mitad. «Carlos Andres Ojeda» salía en
              tres líneas.

              Ahora baja a la fila de estado, con «Al día». No pierde nada: esa
              fila es justo donde el ojo va a buscar en qué situación está el
              cliente, y las dos pastillas juntas se leen de una pasada. */}
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            {/* EL NOMBRE NO SE CORTA NUNCA. Iba con `nowrap` + puntos
                suspensivos y los nombres largos salían partidos. El dueño:
                «el nombre nunca se debe cortar, porque es para la fácil
                identificación del cliente en esa ficha».

                Y tiene razón por encima de la simetría: una tarjeta que mide
                igual que las demás pero dice «Jannette Alexandra Rodrí…» no
                sirve para lo único que hace falta al recorrer la lista, que es
                saber a quién estás mirando. Pasa a dos renglones si hace falta.

                `anywhere` y no `break-word` porque una cédula o un apellido
                compuesto sin espacios se desbordaría igual. */}
            <span style={{
              fontSize: 16, fontWeight: 700, letterSpacing: '-.015em',
              color: 'var(--cf-ink)',
              minWidth: 0, overflowWrap: 'anywhere',
            }}>{nombre}</span>
          </span>

          {/* Nivel 2 · UNA línea, que no se parte en dos. Antes iba con
              `WebkitLineClamp: 2` y las tarjetas cambiaban de alto según lo
              larga que fuera la dirección: una lista de alturas distintas se
              recorre peor, y la lámina las dibuja todas iguales. */}
          {/* La pastilla y el contexto comparten esta línea. El contexto se
              encoge, la pastilla no: con un nombre de ruta largo se recorta la
              ruta, nunca los días de mora. */}
          {(etiquetaEstado || contexto || piezas || nuevo) && (
            // `flex-start` y no `center`: cuando los metadatos ocupan dos
            // renglones, centrar deja la pastilla flotando a media altura de un
            // hueco blanco. Arriba queda a la altura del primer dato.
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, minWidth: 0, flexWrap: 'wrap', rowGap: 4 }}>
              {/* «NUEVO» SE LEE, no se adivina. Era un punto verde de 7px sin
                  texto: en una lista de 1.315 clientes eso no se distingue de
                  una mota, y el dueño lo reportó como que no salía.

                  Va PRIMERA de la fila —antes que «Al día»— porque es lo que
                  hace saltar el renglón al recorrer la lista. Aquí sí puede ir
                  delante: esta fila envuelve (`flexWrap`), así que si no cabe
                  baja de renglón en vez de estrujar a su vecina. */}
              {nuevo && (
                <span aria-label="Creado en las últimas 24 horas" title="Creado en las últimas 24 horas" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, flex: 'none',
                  height: 19, padding: '0 8px 0 6px', borderRadius: 999,
                  background: 'var(--cf-green-tint, color-mix(in srgb, var(--cf-green) 14%, transparent))',
                  border: '1px solid color-mix(in srgb, var(--cf-green) 32%, transparent)',
                }}>
                  <span aria-hidden style={{
                    width: 5, height: 5, borderRadius: 999, flex: 'none',
                    background: 'var(--cf-green-dark)',
                  }} />
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '.04em',
                    color: 'var(--cf-green-dark)', textTransform: 'uppercase',
                  }}>Nuevo</span>
                </span>
              )}
              {etiquetaEstado && (
                // El pagado lleva pastilla NEUTRA (gris), no una de su color: no
                // hay «color de terminado», hay ausencia de alarma.
                <Pastilla tono={TONO_PASTILLA[estado] ?? 'neutro'} numerica style={{ flex: 'none' }}>
                  {etiquetaEstado}
                </Pastilla>
              )}
              {clavo && <EtiquetaClavo />}
              {/* ⚠ UN COBRO DE ESTE CLIENTE ESTÁ EN EL TELÉFONO, NO EN EL SISTEMA.
                  La lista lo mostraba en mora sin decir por qué: el cobro sin
                  señal solo se veía en una pastilla sobre la barra. Va junto al
                  estado, que es la pregunta que responde. */}
              <OfflineBadge id={id} texto="Cobro sin subir" />
              {/* ⚠ AQUÍ, Y POR LA MISMA RAZÓN QUE EL CLAVO: la estrella dice
                  cómo PAGÓ LO ANTERIOR y la pastilla cómo va HOY. Un buen
                  cliente puede estar en mora esta semana, y las dos cosas hacen
                  falta — la estrella nunca tapa el estado ni al revés.

                  Va después del clavo porque el clavo es más urgente: si el
                  préstamo está dado por perdido, el historial ya no decide nada.

                  Solo se pinta cuando hay algo que decir: sin préstamos
                  terminados no hay estrella, y son 4.675 de 7.624 clientes. */}
              {calificacion?.nivel && (
                <EstrellaCliente
                  nivel={calificacion.nivel}
                  titulo={tituloCalificacion}
                />
              )}
              {/* ⚠ ESTA LÍNEA YA NO SE RECORTA, Y ES UN CAMBIO DELIBERADO.
                  Arriba está escrito por qué iba a una sola línea: las tarjetas
                  cambiaban de alto según lo larga que fuera la dirección, y una
                  lista de alturas distintas se recorre peor.

                  Sigue siendo cierto, pero perdía contra lo otro. El dueño lo
                  vio en pantalla: «CC 1003003897 · 300887515…» y «Mensual 20%
                  Decr. dinámico · c…» — la cédula a medias, la ruta invisible y
                  el cobrador tampoco. Información que la app tiene, que el
                  usuario pidió, y que se estaba tirando por un píxel de
                  simetría. Una tarjeta pareja que no dice a qué ruta pertenece
                  el cliente no sirve para salir a cobrar.

                  La cargué yo de más al añadir el modo de interés y el autor, y
                  esto es pagar esa cuenta en vez de esconderla. */}
              {/* SIN PIEZAS se pinta la cadena de siempre, aquí al lado de la
                  pastilla. Con piezas, los metadatos NO van aquí: van debajo,
                  a todo el ancho de la tarjeta. Medido en el espejo, esta
                  posición les dejaba **109px** —la pastilla y el avatar se
                  llevan el resto— y los cuatro datos piden 359: se apilaban de
                  uno en uno y la cédula salía cortada aun sobrando sitio en la
                  tarjeta. Ver el bloque de abajo. */}
              {!piezas && contexto && (
                <span className="cf-num" style={{
                  fontSize: 12, color: 'var(--cf-ink-3)',
                  minWidth: 0, overflowWrap: 'anywhere',
                }}>{contexto}</span>
              )}
            </div>
          )}
        </div>

        {monto != null && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
            gap: 2, flex: 'none',
          }}>
            <span className="cf-fig" style={{
              fontSize: m.monto, letterSpacing: '-.025em', lineHeight: 1, color: 'var(--cf-ink)',
            }}>{monto}</span>
            {derecha && (
              <span className="cf-num" style={{
                fontSize: 11, color: 'var(--cf-ink-3)', whiteSpace: 'nowrap',
              }}>{derecha}</span>
            )}
          </div>
        )}
      </div>

      {/* ── LOS METADATOS, A TODO EL ANCHO ──
          Cédula, teléfono, ruta, modo de interés y quién lo creó, cada uno con
          su icono. El dueño: «toda esa información sale, pero está muy apretada;
          le podríamos dar un poco de aire y definirlas mejor».

          VAN AQUÍ Y NO ARRIBA, y es una decisión medida: al lado de la pastilla
          les quedaban **109px** de los 393 —el avatar y el monto se llevan el
          resto— así que los cuatro datos, que piden 359, se apilaban de uno en
          uno y la cédula salía cortada con media tarjeta vacía al lado. Aquí
          tienen el ancho entero y caben en dos renglones.

          El separador de arriba los despega del nombre sin gastar alto: son
          datos de apoyo, no la cabecera. */}
      {piezas && (
        <Metadatos style={{ paddingTop: 2 }}>
          <ModoInteres {...(piezas.modo ?? {})} />
          <Dato trazo={TRAZO.cedula}>{piezas.cedula}</Dato>
          <Dato trazo={TRAZO.telefono}>{piezas.telefono}</Dato>
          <Dato trazo={TRAZO.ruta}>{piezas.ruta}</Dato>
          <CreadoPor nombre={piezas.autor} />
          <Dato trazo={TRAZO.fecha}>
            {piezas.terminado ? `terminado ${piezas.terminado}` : null}
          </Dato>
        </Metadatos>
      )}

      {/* ── La tira de cifras ──
          «Faltaba lo más básico: la cuota. Y la ganancia acumulada, que es la
          razón de ser del préstamo y no aparecía en ninguna lista» (T03-04).
          Cuatro columnas iguales separadas por filetes de 1px. Van sobre un
          borde superior, así que la tarjeta se lee en dos bloques: quién y
          cuánto arriba, los números del negocio abajo. */}
      {/* La pinta `TiraCifras`, en primitivos: la comparte con la FilaCobro de
          cobrar hoy, que no tiene esta estructura pero sí esta tira. */}
      <TiraCifras columnas={cifras} enTarjeta />

      {/* ── EL DESPLEGABLE ──
          Va DEBAJO de la tira y ENCIMA del avance, y ese sitio es el argumento:
          la tira es el titular y esto es el detalle del titular. Puesto arriba
          separaría el nombre de sus cifras; puesto al final, después de la
          barra, quedaría colgando bajo el borde de color que cierra la tarjeta.

          Cerrado ocupa un renglón de 12px. Es el precio de que el dueño pueda
          ver el estado de los tres préstamos de alguien sin abrir su ficha. */}
      {desglose?.prestamos?.length > 0 && (
        <DesglosePrestamos
          desglose={desglose}
          onAbrir={onPrestamo ? (f) => onPrestamo(f) : undefined}
          onWhatsApp={onWhatsAppPrestamo ? (f) => onWhatsAppPrestamo(f) : undefined}
          onCobrar={onCobrarPrestamo ? (f) => onCobrarPrestamo(f) : undefined}
        />
      )}

      {/* ── El avance ──
          La barra y su lectura en la MISMA fila. Antes la barra iba sola y el
          «54% pagado» vivía arriba, al lado del monto; la lámina los junta y
          añade la cuota exacta, que es lo que dice por dónde va el cliente. */}
      {/* La lectura del avance se queda donde estaba —«cuota 13/24 · 54%»—; lo
          que baja al borde es la BARRA. */}
      {!sinProgreso && monto != null && avance && (
        <span className="cf-num" style={{
          fontSize: 11, fontWeight: 700, color: 'var(--cf-ink-3)',
          alignSelf: 'flex-end', whiteSpace: 'nowrap',
        }}>{avance}</span>
      )}

      {/* `unico` no tiene cuotas: sin barra, la nota ocupa su sitio. */}
      {sinProgreso && nota && (
        <span className="cf-num" style={{ fontSize: 11, fontWeight: 700, color: 'var(--cf-ink-3)' }}>{nota}</span>
      )}

      {/* ── LA BARRA A SANGRE (Adenda 5 · E10) ──
          Último hijo, pegada al borde de lado a lado. El `margin` negativo
          anula el relleno lateral: sin él quedaría un renglón de color flotando
          con 16px de aire a cada lado, que se lee como un elemento más y no
          como el borde de la tarjeta.

          «Encierran la tarjeta arriba a la izquierda y abajo a lo ancho, así
          que el color aparece donde el ojo entra y donde sale.»

          ⚠ `flex: none` es obligatorio y ya está escrito en la cabecera de este
          archivo: la tarjeta es una columna flex y sin él la barra se encoge
          hasta desaparecer cuando el contenido de arriba pide sitio. El fallo
          es invisible — no rompe nada, solo deja de estar. */}
      {!sinProgreso && monto != null && (
        <span aria-hidden style={{
          flex: 'none', display: 'block', height: 5,
          margin: `0 -${RELLENO_LATERAL.der}px 0 -${RELLENO_LATERAL.izq}px`,
          background: 'var(--cf-fill)',
        }}>
          <span style={{
            display: 'block', height: 5,
            width: `${Math.max(0, Math.min(100, porcentaje ?? 0))}%`,
            background: color,
          }} />
        </span>
      )}
    </div>
  )
}
