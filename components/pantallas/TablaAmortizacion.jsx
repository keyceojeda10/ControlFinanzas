'use client'

// components/pantallas/TablaAmortizacion.jsx — turno 12 · 01 y 02.
//
// ⚠️ ESTO ES LA VARIANTE, NO LA NORMA. Solo 4 de los 8 modos tienen tabla, y
// suman el 6,2% de la cartera. La ficha por defecto es la de `fijo`, en
// FichaPrestamo.jsx. `05-PANTALLAS.md` los presenta al revés.
//
// LA DECISIÓN: cada cuota se dibuja como UNA BARRA PARTIDA — negro el capital
// que vuelve, dorado la ganancia. El desglose anterior era una lista de meses
// plegables con capital, interés y cuota en tres columnitas de 11px: servía
// para consultar un mes, no para lo que la gente de verdad quiere saber, que es
// cuánto de cada cuota es ganancia. En decreciente dinámico la parte dorada se
// encoge mes a mes y eso SE VE sin leer un número.
//
// Y deja de ser un acordeón, así que se puede compartir con el cliente. Esta es
// la tabla que el cliente pide cuando reclama.
//
// ── Lo que el cotejo contra T12-01 corrigió, con las cifras del archivo ──────
//
// Yo había construido esto como filas dentro de UNA tarjeta plana separadas por
// filetes. La lámina hace algo distinto y por un motivo: **cada cuota es su
// propia tarjeta** (fondo blanco, borde, radio 18, relleno 15/17, hueco de 10
// entre tarjetas). Con filas pegadas, la cuota que toca no se puede destacar sin
// romper la caja; con tarjetas sueltas, la siguiente lleva **anillo dorado**
// —borde 1,5px `#E7A400` más `box-shadow: 0 0 0 3px rgba(231,164,0,.13)`— y se
// encuentra de un vistazo entre treinta.
//
// Y EL DORADO ES UNO SOLO, el de ese anillo. Yo tenía tres: «Comparar» en texto
// dorado, el botón primario dorado de la barra, y ningún anillo. En la lámina
// «Comparar modos» es una pastilla GRIS de 32px y los dos botones de abajo son
// IGUALES —los dos con borde, fondo blanco, `flex: 1`, ninguno primario—. En una
// pantalla de leer y mandar, compartir no compite con nada: lo único que pide
// atención es la cuota que viene.
//
// El pie de cada cuota va a los dos extremos (`space-between`) y SIN puntos de
// color: los puntos están arriba, en el resumen, donde se explica qué es cada
// color. Repetirlos doce veces es ruido. «ganancia» va en `#B07D00` con peso
// 600, que es lo que la ata al tramo dorado sin necesitar el punto.

import { BarraAccion, BotonSecundario, Pastilla } from '@/components/cf/primitivos'

const NEGRO = '#15161A'
const ORO   = '#E7A400'

/* La barra partida. Local y a propósito: la del sistema trae leyenda debajo y
   aquí la leyenda va a los dos lados, así que encenderla pintaría las mismas dos
   cifras dos veces. Y `flex: none` en el tramo negro más `flex: 1` en el dorado,
   que es cómo la lámina evita que un capital de 0 —la cuota de un globo— colapse
   la barra entera a nada. */
function Barra({ capital, ganancia, alto = 10 }) {
  const total = Number(capital) + Number(ganancia)
  const pct = total > 0 ? (Number(capital) / total) * 100 : 0
  return (
    <span aria-hidden style={{
      display: 'flex', height: alto, borderRadius: 999, overflow: 'hidden', flex: 'none',
      // El fondo importa cuando los dos tramos son 0 (una cuota de $0 en una
      // tabla a medio construir): sin él la barra desaparece y la fila parece
      // rota en vez de vacía.
      background: 'var(--cf-fill-2)',
    }}>
      <span style={{ width: `${pct}%`, background: NEGRO, flex: 'none' }} />
      <span style={{ flex: 1, background: ORO }} />
    </span>
  )
}

/* DOS MONTAJES, UN COMPONENTE.
   Dentro de la ficha del préstamo lleva `onTocarCuota` y las filas se pueden
   pulsar para dejar el pago listo; en su propia ruta (T12-01) lleva
   `onCompartir`/`onImprimir` y la tabla es de LEER y MANDAR. La lámina no dibuja
   ningún botón de pagar por cuota, pero el montaje viejo sí lo tenía y esa es una
   función real que no se pierde por rehacer la pantalla.

   Todo control va detrás de su handler. Sin eso la ruta de compartir sale con un
   «Comparar» que no compara, y el montaje inline con una barra de «Compartir
   tabla» que no comparte — el patrón del control muerto, que ya lleva seis
   apariciones en este rediseño. */
export default function TablaAmortizacion({
  modo, capital, ganancia, capitalNum, gananciaNum,
  totalCuotas, total, cuotas = [], montoOculto,
  onComparar, onCompartir, onImprimir, onTocarCuota, onVerTodas,
}) {
  const conBarra = Boolean(onCompartir || onImprimir)

  /* EL ALTO SE DECIDE POR MONTAJE.
     La lámina es una pantalla completa —cuotas que scrollean con la barra de acción
     clavada abajo—, y eso se arma con `height: 100%` arriba más `flex: 1` en la zona
     de cuotas. Montada dentro de la ficha eso no aplica: ahí la tabla es un bloque
     más de una página que ya scrollea, y su alto lo pone su contenido.

     Con barra: dueña del viewport, la zona de cuotas scrollea por su cuenta.
     Sin barra: bloque de flujo normal, crece con su contenido.

     Hoy `height: 100%` sobre un padre de alto automático resuelve a `auto` y no
     rompe nada — lo comprobé midiendo, la tabla ya salía a 649px dentro de la
     ficha—. Es explícito porque el día que ese padre reciba un alto, el `100%`
     empezaría a resolver contra él y la tabla se recortaría sin que nada avise. */
  const dueñaDelAlto = conBarra

  return (
    // ── T12-03 · EN 1440, EL RESUMEN A LA DERECHA ──
    // En el telefono el resumen va ARRIBA porque es la referencia contra la que
    // se lee cada cuota y no puede irse con el scroll. Sentado no hace falta
    // sacrificar el sitio de la primera fila: cabe al lado, y las cuotas
    // empiezan en la primera linea de la pantalla.
    //
    // El orden del DOM no cambia —resumen primero, cuotas despues— porque en
    // movil ese orden es el correcto. La rejilla las coloca.
    //
    // OJO: el `display` va POR CLASE en las dos disposiciones. Ponerlo en el
    // `style` gana sobre la clase y `lg:grid` no llegaria a aplicarse; lo hice
    // tres veces en esta tanda y ahora lo prohibe `display-en-linea.test.js`.
    <div
      className="flex flex-col lg:grid lg:gap-4 lg:items-start"
      style={{
        gridTemplateColumns: 'minmax(0,1fr) 340px',
        ...(dueñaDelAlto ? { height: '100%' } : {}),
      }}>

      {/* EL RESUMEN NO SCROLLEA. Va en la zona fija, pegado a la cabecera: es el
          reparto del préstamo ENTERO, y si se va con el scroll se pierde la
          referencia contra la que se lee cada cuota. Lo scrolleable son las
          cuotas, que es lo que puede tener treinta filas. */}
      {/* SIN relleno lateral: el armazon YA da los 20px de `--cf-pad-screen`, y
          poniendolos otra vez aqui dejaba las tarjetas en x40 con 310px de ancho
          cuando la lamina las quiere en x20 con 350. Es el margen doble, y van
          tres: el panel (310 en x40), cobrar hoy (302 en x44) y esta. La regla:
          el relleno lateral lo pone el armazon, el componente NO. */}
      <div className="lg:col-start-2 lg:row-start-1" style={{ flex: 'none', padding: '6px 0 12px' }}>
        <div style={{
          background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          borderRadius: 'var(--cf-r-card)', padding: '16px 18px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
                Modo de interés
              </span>
              {/* Una sola línea con elipsis: partido en dos, el nombre del modo
                  descuadra la tarjeta y la barra se va para abajo. */}
              <span style={{
                fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{modo}</span>
            </span>

            {/* «Comparar» a secas. La lámina dice «Comparar modos», que sugiere
                los ocho cuando enseña cuatro; «Comparar calendarios» arregla eso
                pero es tan ancho que parte «Decreciente dinámico» en dos líneas —lo
                vi en la captura— y ahí es justo donde ese modo se distingue de
                «Decreciente». Es el mismo motivo por el que la pastilla de T12-02
                no va en la fila del nombre. Dentro de una tarjeta titulada «Modo de
                interés» no hace falta repetir qué se compara.
                Pastilla GRIS, no texto dorado: el único dorado de esta pantalla es
                el anillo de la cuota que viene. */}
            {onComparar && (
              <button type="button" onClick={onComparar} style={{
                display: 'inline-flex', alignItems: 'center', height: 32, padding: '0 12px',
                borderRadius: 11, background: 'var(--cf-fill)', border: '1px solid var(--cf-border)',
                fontSize: 12, fontWeight: 700, color: 'var(--cf-ink-2)', cursor: 'pointer', flex: 'none',
              }}>Comparar</button>
            )}
          </div>

          <Barra capital={capitalNum} ganancia={gananciaNum} alto={12} />

          {/* Las dos leyendas van JUNTAS, con hueco de 16, no repartidas a los
              extremos: aquí se están definiendo los colores, y una definición se
              lee de corrido. Repartidas a los bordes parecen dos datos que se
              comparan, que es lo que sí hacen en el pie de cada cuota. */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 'none' }}>
              <span aria-hidden style={{ width: 9, height: 9, borderRadius: 3, background: NEGRO, flex: 'none' }} />
              <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-2)' }}>
                Capital <strong className="cf-fig">{capital}</strong>
              </span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 'none' }}>
              <span aria-hidden style={{ width: 9, height: 9, borderRadius: 3, background: ORO, flex: 'none' }} />
              <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-2)' }}>
                Ganancia <strong className="cf-fig">{ganancia}</strong>
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Las cuotas ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:col-start-1 lg:row-start-1" style={{
        gap: 10,
        padding: `0 0 ${conBarra ? 20 : 0}px`,
        ...(dueñaDelAlto ? { flex: 1, minHeight: 0, overflowY: 'auto' } : { flex: 'none' }),
      }}>

        {/* El encabezado va SOBRE EL FONDO, no dentro de una tarjeta, con el
            filete que estira entre la etiqueta y el total. Así el total queda
            atado al grupo de cuotas y no parece el total de otra cosa. */}
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 9, padding: '0 2px' }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--cf-ink-3)', flex: 'none' }}>
            Las {totalCuotas} cuotas
          </span>
          <span aria-hidden style={{ flex: 1, height: 1, background: 'var(--cf-hairline)' }} />
          <span className="cf-num" style={{ fontSize: 11, fontWeight: 700, color: 'var(--cf-ink-3)', flex: 'none' }}>
            total {total}
          </span>
        </div>

        {cuotas.map((c, i) => {
          // Pulsable solo lo que se puede pagar: una cuota ya cubierta no abre
          // nada, y un botón que al pulsarlo no hace nada se siente roto.
          const pulsable = Boolean(onTocarCuota) && !c.pagada
          const Fila = pulsable ? 'button' : 'div'
          return (
            <Fila
              key={c.id ?? i}
              type={pulsable ? 'button' : undefined}
              onClick={pulsable ? () => onTocarCuota(c) : undefined}
              style={{
                flex: 'none', display: 'flex', flexDirection: 'column', gap: 10,
                background: 'var(--cf-card)', borderRadius: 'var(--cf-r-card)',
                padding: '15px 17px', width: '100%', textAlign: 'left', font: 'inherit',
                cursor: pulsable ? 'pointer' : 'default',
                // EL ANILLO DORADO de la cuota que viene. Borde de 1,5px más un
                // halo de 3px al 13%: es lo que la encuentra de un vistazo entre
                // treinta filas iguales, y es el único dorado de la pantalla.
                border: c.siguiente ? `1.5px solid ${ORO}` : '1px solid var(--cf-border)',
                boxShadow: c.siguiente ? '0 0 0 3px rgba(231,164,0,.13)' : 'none',
                // Una cuota ya cubierta se APAGA, no se tiñe de verde: en verde
                // competiría por la atención con la que toca. Regla de T02-06.
                opacity: c.pagada ? 0.5 : 1,
              }}
            >
              {/* ── LOS TRES NO SIEMPRE CABEN EN UN RENGLÓN ──
                  Reportado con captura: el monto se salía por la derecha, y solo
                  en la fila que lleva pastilla. Medido a 393px, quedan 317
                  útiles y las tres piezas piden:

                      «Mes 1 · 5 de septiembre»  157      ← ni se recorta
                      SIGUIENTE                   69
                      $105.000                    68
                      dos huecos de 10            20
                                                 ───
                                                 314  ← cabe por 3px

                  La lámina lo dibuja así, pero con un caso que cabe («Mes 1 · 21
                  de agosto» y $366.667). Con «septiembre» o «Quincena 12» y una
                  cuota de millones se pasa de largo: 3px de margen no es un
                  diseño que funcione, es uno que aguanta por casualidad.

                  `wrap`, y la fecha DEJA de encogerse. Con `flex: 1` cedía ella
                  primera y salía «Quincena 12 · 30 de …»: el día es EL dato —es
                  cuándo hay que cobrar— y perder el mes por caber es peor que
                  usar dos renglones. Medido en los tres casos: los dos primeros
                  siguen en un renglón, idénticos a la lámina, y solo el peor se
                  parte, bajando el monto (que con `marginLeft:auto` queda solo y
                  alineado a la derecha, mejor que una pastilla huérfana). */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{
                  flex: 'none', minWidth: 0, fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{c.cuando}</span>

                {/* El monto va ANTES en el orden del DOM para que, al partirse,
                    lo que baje sea la pastilla y no la cifra: el monto es lo
                    último de la fila en todas las demás pantallas y tiene que
                    seguir estando arriba, a la derecha de la fecha.
                    `order` lo devuelve a su sitio visual cuando sí cabe. */}
                <span className="cf-fig" style={{
                  fontSize: 18, fontWeight: 600, letterSpacing: '-.025em',
                  color: 'var(--cf-ink)', flex: 'none', order: 2, marginLeft: 'auto',
                }}>{c.cuota}</span>

                {/* La pastilla a mano, no la del sistema: la de la lámina es
                    fondo dorado plano con letra `#3A2900`, y el tono `destacado`
                    del sistema no es ese. */}
                {c.siguiente && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px',
                    borderRadius: 11, background: ORO, color: '#3A2900',
                    fontSize: 10, fontWeight: 700, letterSpacing: '.02em', flex: 'none', order: 1,
                  }}>SIGUIENTE</span>
                )}
              </div>

              <Barra capital={c.capitalNum} ganancia={c.gananciaNum} />

              {/* A los dos extremos y SIN puntos: cada cifra queda bajo su tramo,
                  y «ganancia» en dorado oscuro es lo que la ata al tramo dorado.
                  Con puntos serían doce repeticiones de lo que el resumen ya
                  explicó una vez. */}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-2)', flex: 'none' }}>
                  capital {c.capital}
                </span>
                <span className="cf-num" style={{ fontSize: 12, fontWeight: 600, color: 'var(--cf-gold-dark)', flex: 'none' }}>
                  ganancia {c.ganancia}
                </span>
              </div>

              {/* ── EL SALDO DESPUÉS (T12-03) ──
                  El pie de la lámina: «una columna que hoy no existe: el saldo
                  después, que es lo que el cliente pregunta cuando reclama».
                  Estaba en la base (`CuotaAmortizacion.saldoRestante`) y no
                  salía del adaptador.

                  Va en su propio renglón y no como cuarta columna: en un
                  teléfono, cuatro cifras en una fila se cortan — es lo que ya
                  pasó con las tarjetas de ruta. */}
              {/* Sin filete: `tabla-cotejo` fija que cada cuota sea SU PROPIA
                  tarjeta y no filas separadas por líneas dentro de una caja
                  plana —con filetes, la cuota que toca no se puede destacar sin
                  romper la caja—. El renglón se separa con aire, que consigue
                  lo mismo sin contradecir esa decisión. */}
              {c.saldo && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between', gap: 10,
                  marginTop: 2,
                }}>
                  <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>Le queda debiendo</span>
                  <span className="cf-num" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--cf-ink)' }}>
                    {c.saldo}
                  </span>
                </div>
              )}
            </Fila>
          )
        })}

        {/* LA SUMA DE LO VISIBLE MÁS LO DECLARADO TIENE QUE DAR EL TOTAL DE
            ARRIBA. La lámina enseña 4 cuotas bajo un «total $1.699.999» y las 4
            suman $1.266.668: sin decir que faltan dos, el dueño se queda creyendo
            que ya vio la tabla entera.

            Y sin `onVerTodas` esto NO es un botón. Era uno sin `onClick` —dorado,
            con cursor de mano, y al pulsarlo nada—. Cuando hay a dónde ir es
            botón; cuando no, es el aviso de que la tabla sigue. */}
        {totalCuotas > cuotas.length && (() => {
          const Aviso = onVerTodas ? 'button' : 'div'
          return (
            <Aviso
              type={onVerTodas ? 'button' : undefined}
              onClick={onVerTodas || undefined}
              style={{
                flex: 'none', width: '100%', padding: '11px 12px', font: 'inherit',
                background: 'none', border: 0, textAlign: 'center',
                cursor: onVerTodas ? 'pointer' : 'default',
                fontSize: 12.5, fontWeight: 700,
                color: onVerTodas ? 'var(--cf-ink-2)' : 'var(--cf-ink-3)',
              }}
            >
              {/* SI ES BOTÓN, DICE LO QUE HACE. «Ves 4 de las 6» describe un
                  estado, y el dueño lo reportó como confuso: no se entiende que
                  se pueda pulsar ni qué pasa si lo pulsas. Cuando NO hay a dónde
                  ir sigue siendo la declaración de lo truncado, que es la regla
                  del proyecto: todo truncado se declara con su monto. */}
              {onVerTodas ? (
                `Ver las ${totalCuotas} cuotas`
              ) : (
                `Ves ${cuotas.length} de las ${totalCuotas}${montoOculto ? ` · faltan ${totalCuotas - cuotas.length} por ${montoOculto}` : ''}`
              )}
            </Aviso>
          )
        })()}
      </div>

      {/* LOS DOS BOTONES SON IGUALES: los dos con borde, fondo de tarjeta y
          `flex: 1`. Ninguno primario, porque en una pantalla de leer y mandar
          compartir no compite con nada — y porque el dorado de esta pantalla ya
          está gastado en el anillo de la cuota que viene.

          Y la barra solo cuando hay algo que compartir o imprimir: montada dentro
          de la ficha sobraba, la ficha tiene la suya y salían dos pegadas, igual
          que los cuatro botones de cobrar que dejó el montaje de FichaPrestamo. */}
      {conBarra && (
        <BarraAccion>
          {onCompartir && <BotonSecundario style={{ flex: 1 }} onClick={onCompartir}>Compartir tabla</BotonSecundario>}
          {onImprimir && <BotonSecundario style={{ flex: 1 }} onClick={onImprimir}>Imprimir</BotonSecundario>}
        </BarraAccion>
      )}
    </div>
  )
}


/* ── Comparar modos (turno 12 · 02) ────────────────────────────────────────
   SE LLAMA «MODOS», que es como lo llama la lámina. Yo lo había renombrado a
   «calendarios» razonando que solo cuatro de los ocho tienen calendario y que
   «modos» prometía más de lo que enseñaba. Ese razonamiento se cayó cuando el
   cotejo metió CUOTA FIJA en la comparación: cuota fija no tiene calendario, así
   que lo que la hoja compara son modos de cobrar, no calendarios. La lámina lo
   tenía bien y yo lo «arreglé» hacia el lado equivocado.

   Lo que NO existía: comparar DESPUÉS, sobre un préstamo ya creado. El selector
   del paso 5 ya nombra los modos en cristiano y marca el recomendado; esta hoja
   usa los mismos nombres y la misma matemática, con la partición a la vista.

   Lo que el cotejo contra la lámina corrigió, con sus cifras:

   · UN RADIO DE 20px al principio de cada fila. Yo había puesto una pastilla «el
     de ahora» debajo del nombre. El radio dice dos cosas que la pastilla no: que
     esto es una ELECCIÓN —hay que marcar una— y cuál está marcada ahora. El del
     actual es un círculo dorado relleno con un check `#3A2900`; los otros, un
     anillo vacío de 1,5px.
   · EL ACTUAL LLEVA ANILLO DORADO, borde 1,5px más halo de 3px al 13%: el mismo
     tratamiento que la cuota que viene en T12-01. Yo le había puesto borde negro,
     que en este sistema significa «pulsado», no «el tuyo».
   · EL BOTÓN DE ABAJO ES DORADO y dice el nombre —«Dejar decreciente dinámico»—.
     Después de cinco comparaciones, «Dejar el de ahora» obliga a subir a buscar
     cuál era el de ahora.
   · La frase de cada opción trae LAS CIFRAS de este préstamo. Sin ellas es una
     definición, y definiciones ya da el paso 5.

   La pastilla no va en la fila del nombre —le roba ~85px y corta «Decreciente
   dinámico» justo donde se distingue de «Decreciente»—: por eso el estado vive en
   el radio de la izquierda, que ocupa 20px fijos. */
export function CompararModos({ resumen, opciones = [], actual, nombreActual, onDejar, onElegir }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      <span className="cf-num" style={{ fontSize: 13, color: 'var(--cf-ink-3)', flex: 'none' }}>
        {resumen}
      </span>

      {opciones.map((o) => {
        // `esActual` lo trae el adaptador ya resuelto; el `||` es para quien monte
        // esta hoja pasando solo `actual`, que es como estaba antes.
        const esActual = o.esActual ?? (o.id === actual)
        return (
          <button key={o.id} type="button" onClick={() => onElegir?.(o)} style={{
            display: 'flex', flexDirection: 'column', gap: 11, flex: 'none',
            padding: '16px 18px', cursor: 'pointer', textAlign: 'left',
            background: 'var(--cf-card)',
            borderRadius: 'var(--cf-r-card)',
            border: esActual ? `1.5px solid ${ORO}` : '1px solid var(--cf-border)',
            boxShadow: esActual ? '0 0 0 3px rgba(231,164,0,.13)' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* El radio. Relleno dorado con check si es el actual; anillo vacío si
                  no. `flex: none` porque 20px son 20px: encogido a 14 deja de
                  leerse como un control de selección. */}
              <span aria-hidden style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 20, height: 20, borderRadius: 999, flex: 'none',
                background: esActual ? ORO : 'transparent',
                // `.18` de la lámina no tiene token: `--cf-border-strong` está en `.12` y a
                // ese contraste el anillo vacío casi no se ve sobre blanco. `color-mix`
                // en vez de un literal para que el tema oscuro lo resuelva solo, que es
                // lo que pide el canon.
                border: esActual ? 'none' : '1.5px solid color-mix(in srgb, var(--cf-ink) 18%, transparent)',
              }}>
                {esActual && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                       stroke="#3A2900" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span style={{
                flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{o.nombre}</span>
              <span className="cf-fig" style={{
                fontSize: 17, fontWeight: 600, letterSpacing: '-.02em',
                color: 'var(--cf-ink)', flex: 'none',
              }}>{o.total}</span>
            </div>

            <Barra capital={o.capitalNum} ganancia={o.gananciaNum} alto={9} />

            <span style={{ fontSize: 12, color: 'var(--cf-ink-2)', lineHeight: 1.45 }}>
              {o.explicacion}
            </span>
          </button>
        )
      })}

      {/* DORADO y con el nombre. Es la salida sin consecuencias de una hoja donde
          todo lo demás cambia el préstamo, así que es la acción segura y va marcada
          como tal — no escondida en un secundario gris entre cinco tarjetas. */}
      <button type="button" onClick={onDejar} style={{
        width: '100%', height: 52, border: 'none', borderRadius: 14,
        background: ORO, color: '#3A2900', flex: 'none',
        font: 'inherit', fontSize: 16, fontWeight: 700, cursor: 'pointer',
      }}>
        Dejar {(nombreActual || 'el de ahora').toLowerCase()}
      </button>
    </div>
  )
}
