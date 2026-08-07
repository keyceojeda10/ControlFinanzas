import { filaDeCobro, inicialesDe, fechaLargaDe } from './cobros'

// lib/adaptadores/ruta.js — lo que el detalle de una ruta enseña.
//
// ══ UNA RUTA ES PLATA PUESTA EN UN BARRIO ═══════════════════════════════════
//
// T27-02 parte el detalle en DOS TIEMPOS y los separa por color, y esa separación
// es el argumento de la pantalla:
//
//   · el bloque negro = LO ACUMULADO. Cuánto hay puesto ahí y cuánto falta ganar.
//     No cambia porque hoy se cobre o no; cambia cuando se presta o se salda.
//   · la banda blanca = LO DE HOY. Recaudado, lo que falta, en qué se cobró.
//     Se reinicia cada mañana.
//
// Mezclarlos es el error del que viene esta pantalla: un número que sube por
// cobrar al lado de otro que sube por prestar, sin nada que diga cuál es cuál.
//
// ══ POR QUÉ «POR GANAR» NO ES UNA RESTA CUALQUIERA ══════════════════════════
//
// La tentación es `carteraTotal - capitalTotal`, y está mal: `capitalTotal` es el
// monto ORIGINAL prestado, así que en cuanto un cliente abona algo, esa resta sale
// NEGATIVA y la ruta que más cobra es la que peor se ve.
//
//     presté 1.000.000 · pactado 1.200.000 · ya pagó 300.000
//     saldo pendiente 900.000 · capitalTotal 1.000.000 → «por ganar» −100.000
//
// Lo que hace falta es el capital que TODAVÍA ESTÁ EN LA CALLE, que el endpoint
// ahora devuelve como `capitalPendiente` (suma de `calcularCapitalRestante`, la
// misma cascada interés-primero que usa la ficha). Con eso la identidad se cumple
// siempre: **capitalPendiente + porGanar = cartera**.
//
// ══ «CUMPLE» ES UNA SOLA COSA Y ESTÁ ESCRITA AQUÍ ═══════════════════════════
//
// Ya hay tres funciones en la app que contestan tres preguntas distintas sobre una
// ruta y se contradicen entre sí. «Cumple» no puede ser la cuarta, así que aquí es
// una definición única y explícita:
//
//     cumple = (lo pactado − lo que falta) / lo pactado
//
// O sea qué porcentaje de todo lo que esa ruta va a cobrar ya está cobrado. NO es
// «cuántos pagaron hoy» —eso es la banda blanca— ni «cuántos están al día».

/* Un número que puede llegar como null, '' o basura. `Number(null)` es 0, y ese 0
   ya causó tres bugs de «cartera → $0», así que no se usa a pelo. */
function aNumero(v) {
  if (v === null || v === undefined || v === '') return NaN
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

function positivo(v) {
  const n = aNumero(v)
  return Number.isNaN(n) ? 0 : Math.max(0, n)
}

/* Millones abreviados: «$8.4M». Cabe en una columna de tres, que es lo que la
   lámina necesita para poner prestado, por ganar y cumple en una fila. Por debajo
   del millón no se abrevia — «$0.4M» se lee peor que «$430.000». */
export function abreviarMillones(valor, formatear) {
  const n = positivo(valor)
  if (n < 1_000_000) return formatear ? formatear(Math.round(n)) : String(Math.round(n))
  const millones = n / 1_000_000
  // Una decimal hasta 100, ninguna por encima: «$142M» y no «$142.3M».
  const texto = millones >= 100
    ? String(Math.round(millones))
    : millones.toFixed(1).replace(/\.0$/, '').replace('.', ',')
  return `$${texto}M`
}

/* ── El bloque negro: lo que tienes puesto aquí ───────────────────────────── */

/* DOS TERCERAS COLUMNAS, y son preguntas distintas:

     cumple (T27-02) = (pactado − pendiente) / pactado
       «cuánto de todo lo que esta ruta va a cobrar ya está cobrado» — 71%.
       Es avance: mide el paso del tiempo.

     rinde (T24-03)  = porGanar / capitalPuesto
       «cuánto voy a ganar sobre lo que tengo puesto» — 38%.
       Es rentabilidad: mide la decisión de poner la plata aquí.

   Las dos láminas usan las mismas cifras (8,4M puesto · 3,2M por ganar · 11,6M de
   cartera) y las dos salen bien: 3,2/8,4 = 38% y (40−11,6)/40 = 71%. Confundirlas
   sería el cuarto miembro de la familia de funciones de ruta que se contradicen,
   así que van con nombre propio y la pantalla elige cuál pide. */
export function loPuestoAqui(ruta = {}, formatear = String, metrica = 'cumple') {
  const cartera = positivo(ruta.carteraTotal)
  const puesto = positivo(ruta.capitalPendiente)
  const pactado = positivo(ruta.totalAPagarRuta)

  // El capital pendiente nunca puede pasarse del saldo: si pasara, «por ganar»
  // saldría negativo y el bloque diría una mentira sobre el negocio.
  const capital = Math.min(puesto, cartera)
  const porGanar = Math.max(0, cartera - capital)

  // Sin nada pactado no hay porcentaje que calcular: 0/0 es NaN, y un «NaN%» en
  // la pantalla es peor que no enseñar nada.
  const cumple = pactado > 0
    ? Math.round(((pactado - cartera) / pactado) * 100)
    : null

  // Lo mismo con el rinde: sin capital puesto no hay nada sobre lo que rendir.
  const rinde = capital > 0 ? Math.round((porGanar / capital) * 100) : null

  const tercera = metrica === 'rinde'
    ? (rinde === null ? null : { id: 'rinde', etiqueta: 'Rinde', valor: `${rinde}%` })
    : (cumple === null ? null : { id: 'cumple', etiqueta: 'Cumple', valor: `${cumple}%` })

  return {
    // Los nombres de arriba son los que el componente lee, y llevan el texto ya
    // formateado. Los crudos van dentro de `numeros` A PROPÓSITO: cuando estaban
    // al mismo nivel —`cartera` el número y `carteraTexto` el texto— el `{...}` del
    // componente cogía el número y la pantalla enseñaba «11600000». Es la tercera
    // vez que un adaptador y su componente no coinciden de nombres, así que aquí
    // la colisión no puede ni plantearse.
    cartera: formatear(Math.round(cartera)),
    columnas: [
      { id: 'prestado', etiqueta: 'Prestado', valor: abreviarMillones(capital, formatear) },
      // El único dorado del bloque: es lo que el dueño viene a ver.
      { id: 'porganar', etiqueta: 'Por ganar', valor: abreviarMillones(porGanar, formatear), oro: true },
      ...(tercera ? [tercera] : []),
    ],
    numeros: {
      cartera: Math.round(cartera),
      capital: Math.round(capital),
      porGanar: Math.round(porGanar),
      cumple,
      rinde,
    },
  }
}

/* ── La banda blanca: lo de hoy ───────────────────────────────────────────── */

export function loDeHoy(ruta = {}, formatear = String) {
  const recaudado = positivo(ruta.recaudadoHoy)
  const esperado = positivo(ruta.esperadoHoy)
  const falta = Math.max(0, esperado - recaudado)

  const cobros = positivo(ruta.clientesConCobroHoy)
  const pagaron = positivo(ruta.clientesPagaronHoy)

  // El desglose por medio es lo que permite cuadrar la caja de la noche: sin él,
  // el cobrador entrega efectivo y nadie sabe cuánto entró por transferencia.
  const efectivo = positivo(ruta.recaudadoEfectivoHoy)
  const digital = positivo(ruta.recaudadoDigitalHoy)
  const hayDesglose = ruta.recaudadoEfectivoHoy != null || ruta.recaudadoDigitalHoy != null

  const partes = []
  if (cobros > 0) partes.push(`${pagaron} de ${cobros} cobros`)
  if (hayDesglose) {
    partes.push(`efectivo ${formatear(Math.round(efectivo))}`)
    partes.push(`digital ${formatear(Math.round(digital))}`)
  }

  return {
    // Igual que arriba: texto en los nombres que lee el componente, crudos aparte.
    recaudado: formatear(Math.round(recaudado)),
    falta: formatear(Math.round(falta)),
    // La barra mide lo cobrado sobre lo esperado HOY, no sobre la cartera. Sin
    // nada esperado la barra va a 0 y no a 100: «nada que cobrar» no es «cobrado».
    progreso: esperado > 0 ? Math.min(100, Math.round((recaudado / esperado) * 100)) : 0,
    resumen: partes.join(' · '),
    numeros: {
      recaudado: Math.round(recaudado),
      falta: Math.round(falta),
      esperado: Math.round(esperado),
    },
  }
}

/* ── El recorrido: una parada por cliente ─────────────────────────────────── */

/* DÓNDE DEJA DE SER UN DESPISTE Y EMPIEZA A SER UN PROBLEMA DE COBRO.
   Un solo número, usado por el filete y por la pastilla. Cuando cada uno tenía el
   suyo, el mismo cliente salía con pastilla ámbar y filete rojo — que es el
   problema de las tres funciones de ruta que se contradicen, reaparecido dentro de
   un mismo archivo. */
const MORA_GRAVE = 15

/* El filete de color de la izquierda dice el estado de un vistazo, y es lo único
   que se lee mientras se camina:
     verde = ya cobrado hoy
     rojo  = mora grave
     oro   = toca ahora, al día, o atrasado de poco
   El orden importa: un cliente en mora que YA PAGÓ hoy va en verde, porque lo que
   la pantalla contesta es «¿me falta pasar por aquí?». */
export function colorDeParada(p = {}) {
  if (p.cobradoHoy) return 'verde'
  return positivo(p.diasMora) >= MORA_GRAVE ? 'rojo' : 'oro'
}

export function adaptarRecorrido(clientes = [], formatear = String, fmtHora) {
  return clientes
    .filter(Boolean)
    .map((c, i) => {
      const cobrado = Boolean(c.cobradoHoy)
      const mora = positivo(c.diasMora)

      // Debajo del nombre va lo que decide si hay que parar aquí: los días de
      // atraso, y LA DISTANCIA cuando se sabe. Caminando la distancia manda sobre
      // la dirección —ya se sabe dónde vive— y por eso desplaza a la calle en vez
      // de sumarse: dos datos de sitio en una línea de 11px no caben.
      const sitio = distanciaTexto(c.distanciaMetros) ?? c.direccion
      const abajo = cobrado
        ? [c.horaCobro && fmtHora ? `cobrado ${fmtHora(c.horaCobro)}` : c.horaCobro ? `cobrado ${c.horaCobro}` : 'cobrado', c.medio]
        : [mora > 0 ? `${mora}d de atraso` : 'al día', sitio]

      return {
        id: c.id ?? i,
        // El número es la posición en el recorrido, no el índice del array: si la
        // lista viene filtrada, seguir contando desde 1 mentiría sobre el orden.
        orden: c.orden ?? i + 1,
        nombre: c.nombre,
        detalle: abajo.filter(Boolean).join(' · '),
        monto: formatear(Math.round(positivo(c.montoACobrar ?? c.cuota))),
        color: colorDeParada(c),
        cobrado,
      }
    })
}

/* La primera parada que queda por hacer. Es el destino del botón dorado del pie
   —«Seguir con Steven»—, y da el nombre: un botón que dijera «siguiente cobro» no
   ahorra el paso de mirar quién es. */
export function siguienteParada(clientes = []) {
  return clientes.filter(Boolean).find((c) => !c.cobradoHoy) ?? null
}

/* ── El modo ruta (T28) ───────────────────────────────────────────────────── */

/* «a 410 m» hasta el kilómetro y «a 1,2 km» a partir de ahí. En metros cabe la
   precisión que sirve —si está a 410 m se decide ir andando— y en kilómetros no:
   «a 1.240 m» hay que traducirlo mentalmente. */
export function distanciaTexto(metros) {
  const m = aNumero(metros)
  if (Number.isNaN(m) || m < 0) return null
  if (m < 1000) return `a ${Math.round(m)} m`
  const km = m / 1000
  return `a ${km.toFixed(1).replace('.', ',')} km`
}

/* Cuánto llevas fuera. Va en la cabecera junto a «parada 3 de 5» porque las dos
   contestan lo mismo: cuánto queda de jornada. */
export function tiempoFuera(minutos) {
  const min = aNumero(minutos)
  if (Number.isNaN(min) || min < 0) return null
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h === 0) return `llevas ${m} min`
  // «1 h 12», no «1,2 h»: es la forma en que se dice.
  return m === 0 ? `llevas ${h} h` : `llevas ${h} h ${String(m).padStart(2, '0')}`
}

/* El estado del cliente como pastilla. Verde al día, ámbar si acaba de atrasarse,
   rojo si lleva tiempo — con EL MISMO corte que el filete de la parada, que para
   eso está en una constante. */
export function estadoDeCliente(diasMora) {
  const d = positivo(diasMora)
  if (d === 0) return { texto: 'Al día', tono: 'verde' }
  return { texto: `${d}d de atraso`, tono: d >= MORA_GRAVE ? 'rojo' : 'oro' }
}

/* La parada en la que se está. Es la única tarjeta abierta de la pantalla. */
export function adaptarParadaActual(cliente, formatear = String) {
  if (!cliente) return null
  const cobrar = positivo(cliente.montoACobrar ?? cliente.cuota)
  const debe = positivo(cliente.saldoPendiente)
  const lejos = distanciaTexto(cliente.distanciaMetros)

  return {
    orden: cliente.orden,
    nombre: cliente.nombre,
    estado: estadoDeCliente(cliente.diasMora),
    // Dirección y distancia en una línea: las dos sirven para lo mismo, que es
    // llegar. Si falta una, no queda el separador colgando.
    donde: [cliente.direccion, lejos].filter(Boolean).join(' · '),
    cobrarEtiqueta: 'Cobrarle hoy',
    cobrar: formatear(Math.round(cobrar)),
    // Lo que debe en total va pequeño y al lado: contexto para negociar, no la
    // cifra que hay que teclear.
    debe: debe > 0 ? `debe ${formatear(Math.round(debe))}` : null,
    telefono: cliente.telefono ?? null,
    numeros: { cobrar: Math.round(cobrar), debe: Math.round(debe) },
  }
}

/* Las paradas se parten en tres: la actual, las que faltan y las hechas.
   Las hechas NO se tiran — se colapsan a una línea con su total. «Hechos, pero no
   se olvidan»: es lo que se mira cuando la cuenta de la noche no cuadra. */
export function partirRecorrido(clientes = [], formatear = String, fmtHora) {
  const vivos = clientes.filter(Boolean)
  const actual = siguienteParada(vivos)
  const idDeActual = actual ? (actual.id ?? vivos.indexOf(actual)) : null

  const cobrados = vivos.filter((c) => c.cobradoHoy)
  const faltan = vivos.filter((c) => !c.cobradoHoy && (c.id ?? vivos.indexOf(c)) !== idDeActual)

  const total = cobrados.reduce((t, c) => t + positivo(c.montoCobrado ?? c.montoACobrar ?? c.cuota), 0)

  return {
    actual,
    faltan: adaptarRecorrido(faltan, formatear, fmtHora),
    cobrados: adaptarRecorrido(cobrados, formatear, fmtHora),
    cobradosTitulo: cobrados.length ? `Ya cobrados · ${cobrados.length}` : null,
    cobradosTotal: cobrados.length ? formatear(Math.round(total)) : null,
    // «parada 3 de 5» — la posición en la jornada, no el índice del array.
    posicion: actual
      ? `parada ${actual.orden ?? cobrados.length + 1} de ${vivos.length}`
      : `${vivos.length} de ${vivos.length} · ruta terminada`,
  }
}

/* ── T24-01 · Crear ruta ──────────────────────────────────────────────────── */

/* LOS COBRADORES SIN RUTA VAN PRIMERO. Es el mismo hallazgo atacado desde el otro
   lado: si hay cinco cobradores dados de alta y solo uno tiene ruta, la lista que
   empieza por los que ya tienen una esconde el problema. */
export function cobradoresParaElegir(cobradores = [], yo) {
  const filas = cobradores.filter(Boolean).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    // Iniciales para el avatar: dos letras, y una si el nombre es de una palabra.
    iniciales: String(c.nombre ?? '?')
      .trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join(''),
    detalle: c.rutas > 0
      ? `${c.rutas} ruta${c.rutas === 1 ? '' : 's'}`
      : 'sin ruta asignada',
    sinRuta: !(positivo(c.rutas) > 0),
  }))

  filas.sort((a, b) => (a.sinRuta === b.sinRuta ? 0 : a.sinRuta ? -1 : 1))

  // El dueño va al final y con su nombre debajo: «Yo mismo» es lo que se entiende,
  // pero hay que poder comprobar de quién se habla.
  if (yo) {
    filas.push({
      id: yo.id,
      nombre: 'Yo mismo',
      iniciales: String(yo.nombre ?? '?')
        .trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join(''),
      detalle: yo.nombre,
      sinRuta: false,
      esDueno: true,
    })
  }

  const libres = filas.filter((f) => f.sinRuta).length
  return {
    filas,
    // Solo se dice cuando hay alguno: «te quedan 0 cobradores sin ruta» es ruido.
    // Y el VERBO también concuerda: «te quedan 1 cobrador» es el error que sale de
    // pluralizar solo el sustantivo.
    nota: libres > 0
      ? (libres === 1
        ? 'Te queda 1 cobrador sin ruta.'
        : `Te quedan ${libres} cobradores sin ruta.`)
      : null,
  }
}

/* Cada cliente dice EN QUÉ RUTA ESTÁ HOY, porque moverlo aquí lo saca de allí. */
export function clientesParaElegir(clientes = [], elegidos = []) {
  const puestos = new Set(elegidos)
  return clientes.filter(Boolean).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    detalle: [c.direccion, c.rutaNombre ? `hoy en ${c.rutaNombre}` : 'sin ruta']
      .filter(Boolean).join(' · '),
    rutaNombre: c.rutaNombre ?? null,
    elegido: puestos.has(c.id),
  }))
}

/* LA CONSECUENCIA QUE NADIE PREVÉ, dicha antes de guardar: los clientes que ya
   tienen ruta salen de la de su cobrador. Sin este aviso, el dueño le vacía la ruta
   a Pepito sin enterarse — y Pepito se entera al día siguiente, en la calle.
;
   La lámina nombra al COBRADOR («salen de la de Pepito y la de Carlos»), no la
   ruta, y tiene razón: lo que se rompe es el día de trabajo de una persona, y un
   nombre propio se reconoce mejor que un «Ruta #1». Si no llega el cobrador se cae
   al nombre de la ruta, pero sin el «la de» delante — «la de la de Ruta 2». */
export function avisoDeRobo(clientes = [], elegidos = []) {
  const puestos = new Set(elegidos)
  const conRuta = clientes.filter((c) => c && puestos.has(c.id) && (c.rutaNombre || c.rutaCobrador))
  if (conRuta.length === 0) return null

  const nombres = [...new Set(conRuta.map((c) => (
    c.rutaCobrador ? `la de ${c.rutaCobrador}` : c.rutaNombre
  )))]
  const cuales = nombres.length === 1
    ? nombres[0]
    : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`

  return conRuta.length === 1
    ? `Uno de estos clientes ya tiene ruta. Al guardarlo aquí sale de ${cuales}.`
    : `${conRuta.length} de estos clientes ya tienen ruta. Al guardarlos aquí salen de ${cuales}.`
}

/* ── T24-02 · Reordenar el recorrido ──────────────────────────────────────── */

/* LA DISTANCIA ES DESDE LA PARADA ANTERIOR, no desde el cobrador — salvo la
   primera, que sí es «de ti». Es lo que permite juzgar si el orden es bueno: una
   lista de distancias al cobrador no dice nada del zigzag.

   `tramoMetros` lo trae el backend cuando puede calcularlo; si falta, no se
   inventa una cifra. */
export function tramosDelRecorrido(paradas = []) {
  return paradas.filter(Boolean).map((p, i) => {
    const texto = distanciaTexto(p.tramoMetros)
    return {
      id: p.id ?? i,
      orden: p.orden ?? i + 1,
      nombre: p.nombre,
      // Debajo del nombre: la dirección, y la mora cuando la hay. Aquí no se está
      // cobrando: se está decidiendo el camino, así que la dirección manda.
      detalle: [p.direccion, positivo(p.diasMora) > 0 ? `${positivo(p.diasMora)}d de atraso` : null]
        .filter(Boolean).join(' · '),
      // La primera lleva «de ti» porque el tramo sale de donde está el cobrador.
      tramo: texto ? (i === 0 ? `${texto.replace(/^a /, '')} de ti` : texto.replace(/^a /, '')) : null,
      color: colorDeParada(p),
    }
  })
}

/* Mover una parada de un sitio a otro. Devuelve el array nuevo, sin tocar el
   original: el «deshacer» del pie necesita que el anterior siga existiendo. */
export function moverParada(paradas = [], desde, hasta) {
  const n = paradas.length
  if (!Number.isInteger(desde) || !Number.isInteger(hasta)) return paradas
  if (desde < 0 || desde >= n || hasta < 0 || hasta >= n || desde === hasta) return paradas
  const copia = [...paradas]
  const [x] = copia.splice(desde, 1)
  copia.splice(hasta, 0, x)
  // El número visible se renumera: si no, el orden guardado y el que se ve dejan
  // de coincidir en cuanto se mueve algo.
  return copia.map((p, i) => ({ ...p, orden: i + 1 }))
}

/**
 * Mover una parada VIENDO SOLO UNA PARTE de la ruta.
 *
 * ══ EL FALLO QUE ARREGLA ═════════════════════════════════════════════════════
 *
 * La pantalla reordenaba sobre `clientesFiltrados` y mandaba a guardar ESA
 * lista. El servidor asigna `ordenRuta = 0,1,2…` a los ids que recibe, así que
 * con un filtro puesto —«Solo hoy», una búsqueda, un día de la semana— los
 * clientes que no salían conservaban números viejos que ahora chocan con los
 * nuevos: la ruta quedaba con posiciones repetidas y el recorrido, revuelto.
 *
 * Y no hace falta un caso raro para dispararlo: «Solo hoy» es un botón que está
 * ahí mismo, al lado de «Ordenar».
 *
 * Aquí el movimiento se traduce: se mira ENTRE QUÉ dos clientes de la lista
 * completa cae la parada, y se mueve allí. Se devuelve la ruta ENTERA, así que
 * lo que se guarda incluye a todos y ningún orden se queda a medias.
 *
 * @param {Array} completa  todos los clientes de la ruta, en su orden actual
 * @param {Array} visibles  los que el usuario está viendo (puede ser la misma)
 * @param {number} desde    índice DENTRO de `visibles`
 * @param {number} hasta    índice DENTRO de `visibles`
 */
export function moverParadaEnRuta(completa = [], visibles = [], desde, hasta) {
  if (!Array.isArray(completa) || !completa.length) return completa
  // Sin filtro las dos listas son la misma: se mueve y ya.
  if (visibles.length === completa.length) return moverParada(completa, desde, hasta)

  const n = visibles.length
  if (!Number.isInteger(desde) || !Number.isInteger(hasta)) return completa
  if (desde < 0 || desde >= n || hasta < 0 || hasta >= n || desde === hasta) return completa

  const movido = visibles[desde]
  const iEnCompleta = completa.findIndex((c) => c.id === movido?.id)
  if (iEnCompleta < 0) return completa

  // El ancla: el cliente visible junto al que hay que dejarlo. Bajando se pone
  // DESPUÉS del que ocupaba ese hueco; subiendo, ANTES.
  const baja = hasta > desde
  const ancla = visibles[hasta]
  const iAncla = completa.findIndex((c) => c.id === ancla?.id)
  if (iAncla < 0) return completa

  const copia = [...completa]
  copia.splice(iEnCompleta, 1)
  // El índice del ancla puede haberse corrido al sacar el elemento.
  const iAnclaAhora = copia.findIndex((c) => c.id === ancla?.id)
  copia.splice(baja ? iAnclaAhora + 1 : iAnclaAhora, 0, movido)

  return copia.map((p, i) => ({ ...p, orden: i + 1 }))
}

/* El atajo de abajo: la app propone y DICE CUÁNTO SE AHORRA. Sin la cifra es un
   botón que hay que probar a ver qué pasa. */
export function propuestaPorCercania({ actualMetros, propuestaMetros } = {}) {
  const hoy = aNumero(actualMetros)
  const luego = aNumero(propuestaMetros)
  if (Number.isNaN(hoy) || Number.isNaN(luego)) return null
  // Sin ahorro no se ofrece: proponer un orden que no mejora nada quema el botón.
  if (luego >= hoy) return null
  const km = (m) => `${(m / 1000).toFixed(1).replace('.', ',')} km`
  return {
    titulo: 'Ordenar por cercanía',
    detalle: `bajaría el recorrido a ${km(luego)}`,
    ahorroMetros: Math.round(hoy - luego),
  }
}

/* ── T04-03 · La ruta al cerrar el día ────────────────────────────────────── */

/* CUÁNTO ENTREGA EL COBRADOR.
   La fórmula es la del endpoint de caja y NO la de la lámina:
   `efectivo = cobrado − prestado − gastos`.

   La lámina dibuja solo dos líneas —cobrado y préstamos entregados— y encima su
   propio total no cuadra: pone «$61.500 − $200.000» y luego «a entregar $61.500».
   Sexta vez que una lámina afirma una cifra que el código contradice; aquí manda
   `app/api/caja/cobrador/[id]`, que es lo que de verdad se cobra al cerrar.

   Puede salir NEGATIVO, y eso no es un error: si prestó en la calle más de lo que
   recogió, la casa le debe a él. Un `Math.max(0, ...)` aquí escondería una deuda
   real, así que se enseña con su signo y con otro título. */
export function cierreDelDia({
  cobradoEfectivo, prestadoEfectivo, gastos,
} = {}, formatear = String) {
  const cobrado = positivo(cobradoEfectivo)
  const prestado = positivo(prestadoEfectivo)
  const gasto = positivo(gastos)
  const neto = cobrado - prestado - gasto

  const lineas = [
    { id: 'cobrado', texto: 'Cobrado en efectivo', valor: formatear(Math.round(cobrado)) },
  ]
  // Una línea de $0 no informa de nada y alarga la cuenta.
  if (prestado > 0) {
    lineas.push({
      id: 'prestado', texto: 'Préstamos entregados hoy',
      valor: `−${formatear(Math.round(prestado))}`, resta: true,
    })
  }
  if (gasto > 0) {
    lineas.push({
      id: 'gastos', texto: 'Gastos de la ruta',
      valor: `−${formatear(Math.round(gasto))}`, resta: true,
    })
  }

  return {
    rotulo: 'Cierre de caja del día',
    titulo: neto >= 0 ? 'Entrega lo que recogiste' : 'Hoy te deben a ti',
    ayuda: 'Aparece cuando terminas el recorrido, no todo el día.',
    lineas,
    totalTexto: neto >= 0 ? 'A entregar' : 'Te deben',
    total: formatear(Math.round(Math.abs(neto))),
    aFavor: neto < 0,
    numeros: { cobrado: Math.round(cobrado), prestado: Math.round(prestado), gastos: Math.round(gasto), neto: Math.round(neto) },
  }
}

/* El resumen dorado de arriba: lo recaudado sobre lo esperado, con el porcentaje. */
export function resumenDeCierre(ruta = {}, formatear = String) {
  const recaudado = positivo(ruta.recaudadoHoy)
  const esperado = positivo(ruta.esperadoHoy)
  const pagaron = positivo(ruta.clientesPagaronHoy)
  const conCobro = positivo(ruta.clientesConCobroHoy)
  const noPagaron = Math.max(0, conCobro - pagaron)

  return {
    etiqueta: 'Recaudado en la ruta',
    valor: formatear(Math.round(recaudado)),
    porcentaje: esperado > 0 ? `${Math.round((recaudado / esperado) * 100)}%` : null,
    progreso: esperado > 0 ? Math.min(100, Math.round((recaudado / esperado) * 100)) : 0,
    datos: [
      `${pagaron} cobrado${pagaron === 1 ? '' : 's'}`,
      noPagaron > 0 ? `${noPagaron} no pagó` : null,
      esperado > 0 ? `de ${formatear(Math.round(esperado))}` : null,
    ].filter(Boolean),
  }
}

/* «Lo de hoy»: qué pasó en cada casa. El que no pagó lleva SU MOTIVO entre comillas
   —eso viene de `VisitaReagendada`— y el monto en gris, porque no entró. */
export function loQuePasoHoy(visitas = [], formatear = String) {
  return visitas.filter(Boolean).map((v, i) => {
    const pago = v.pago !== false && positivo(v.monto) > 0 && v.tipo !== 'no_pago'
    const abajo = [
      v.hora,
      pago ? (v.concepto ?? 'cuota') : 'no pagó',
      !pago && v.motivo ? `“${v.motivo}”` : null,
    ].filter(Boolean).join(' · ')
    return {
      id: v.id ?? i,
      nombre: v.nombre,
      detalle: abajo,
      monto: formatear(Math.round(positivo(v.monto))),
      pago,
    }
  })
}

/* ── T11-02 · La ruta en mapa ─────────────────────────────────────────────── */

/* Los pines llevan el número del recorrido y el color del estado, así que el
   cobrador ve de golpe dónde están los morosos. El color sale de la MISMA función
   que el filete de la lista: dos vistas de lo mismo no pueden discrepar. */
export function pinesDelMapa(clientes = []) {
  return clientes.filter(Boolean).map((c, i) => ({
    id: c.id ?? i,
    orden: c.orden ?? i + 1,
    color: colorDeParada(c),
    lat: c.latitud ?? null,
    lng: c.longitud ?? null,
    nombre: c.nombre,
  }))
}

export const LEYENDA_MAPA = [
  { color: 'rojo', texto: 'Mora' },
  { color: 'oro', texto: 'Atraso leve' },
  { color: 'verde', texto: 'Al día' },
]

/* La cabecera del mapa: cobros, distancia y cuánto se va a tardar. El tiempo es
   una estimación y por eso lleva la virgulilla: «~1 h 20» promete menos que
   «1 h 20». */
export function cabeceraMapa({ cobros, metros, minutos } = {}) {
  const partes = [
    positivo(cobros) > 0 ? `${positivo(cobros)} cobro${positivo(cobros) === 1 ? '' : 's'}` : null,
    aNumero(metros) >= 0 && !Number.isNaN(aNumero(metros))
      ? `${(aNumero(metros) / 1000).toFixed(1).replace('.', ',')} km` : null,
    (() => {
      const t = tiempoFuera(minutos)
      return t ? `~${t.replace('llevas ', '')}` : null
    })(),
  ]
  return partes.filter(Boolean).join(' · ')
}

/* ── La cabecera ──────────────────────────────────────────────────────────── */

export function adaptarCabeceraRuta(ruta = {}, kmTexto) {
  const clientes = positivo(ruta.clientes?.length ?? ruta.totalClientes)
  const partes = [
    ruta.cobrador?.nombre,
    clientes > 0 ? `${clientes} cliente${clientes === 1 ? '' : 's'}` : null,
    kmTexto,
  ]
  return {
    titulo: ruta.nombre ?? 'Ruta',
    detalle: partes.filter(Boolean).join(' · '),
  }
}

/**
 * «3,4 km» · «850 m» — lo que se camina en el recorrido (T27-02).
 *
 * Por debajo de un kilómetro se dice en METROS. «0,8 km» obliga a traducir
 * mentalmente para saber si son dos cuadras o veinte, y esta cifra existe para
 * decidir de un vistazo si la ruta cabe en una mañana.
 *
 * Coma decimal, que es como se escribe en Colombia, y un solo decimal: la
 * precisión de más es falsa — la distancia sale en línea recta entre puntos,
 * no por las calles que el cobrador va a caminar de verdad.
 */
export function formatearKm(metros) {
  const m = Number(metros)
  if (!Number.isFinite(m) || m <= 0) return null
  if (m < 1000) return `${Math.round(m / 10) * 10} m`
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`
}

/* ══ LAS PARADAS DE LA RUTA (Adenda 5 · E07, E08, E09) ═══════════════════════
   La misma tarjeta que /cobros-hoy, alimentada con los datos de /api/rutas/[id].

   NO ES UN SEGUNDO ADAPTADOR DE LA TARJETA: iguala la forma del cliente de esta
   ruta a la que /api/cobros-hoy devuelve, y delega en `filaDeCobro`. Volver a
   escribir aquí las mismas veinte propiedades es exactamente cómo se llegó a lo
   que había —dos tarjetas para lo mismo, arreglada solo una—, que es el fallo
   del comprobante reportado dos días seguidos.

   ── EL REPARTO EN DOS ZONAS ──
   Arriba las VISITAS, que son las únicas que llevan número. Abajo el resto. La
   regla de la lámina: «un contador que incluye paradas que no se hacen es peor
   que no tener contador», porque el cobrador lee 16, hace 10 y se cree
   atrasado yendo al día. */

// Días sin nada a partir de los cuales el cliente deja de ser una oportunidad y
// pasa a ser una fila que nadie limpió. Tres meses es el corte que separa
// «acaba de terminar, préstale» de «esto es una ruta vieja».
const DIAS_INACTIVO = 90

export function paradasDeRuta(clientes = [], { pais } = {}) {
  const visitas = []
  const tambien = []

  for (const c of clientes.filter(Boolean)) {
    const activos = c.prestamosActivos ?? []
    const saldoTotal = activos.reduce((s, p) => s + positivo(p.saldoPendiente), 0)
    const pagado = activos.reduce((s, p) => s + positivo(p.totalPagado), 0)
    const aPagar = activos.reduce((s, p) => s + positivo(p.totalAPagar), 0)

    // «¿Me falta pasar por aquí hoy?» es la única pregunta que decide la zona.
    // Quien YA pagó sigue siendo visita: el recorrido se camina en orden y
    // sacarlo le borra al cobrador la referencia de por dónde iba.
    const pendiente = Boolean(
      c.cobroPendienteHoy ?? (!c.pagoHoy && !c.hoySinCobro && c.estado !== 'completado')
    )

    if (pendiente || c.pagoHoy) {
      visitas.push({
        ...c,
        saldoTotal,
        montoCobradoHoy: c.montoPagadoHoy,
        pagadoPct: aPagar > 0 ? Math.max(0, Math.min(100, Math.round((pagado / aPagar) * 100))) : null,
      })
      continue
    }

    tambien.push({ ...c, saldoTotal })
  }

  return {
    // El número es la posición ENTRE LAS VISITAS, por eso se asigna aquí y no
    // sobre el array entero de la ruta.
    visitas: visitas.map((c, i) => ({
      ...filaDeCobro(c, { pais }),
      orden: i + 1,
      ultima: i === visitas.length - 1,
    })),
    tambien,
  }
}

/* Cuál de los tres estados de abajo es. El orden importa: quien TIENE préstamo
   activo está al día aunque hoy no le toque; solo el que no debe nada puede ser
   oportunidad o ruta vieja, y eso lo decide cuánto lleva sin nada. */
export function zonaDe(c = {}) {
  /* ⚠ EL CLAVO NO CUENTA COMO PRÉSTAMO VIVO. `prestamosActivos` los incluye a
     propósito —el UI tiene que poder enseñar su saldo—, así que mirar solo la
     longitud ponía «Al día» con anillo VERDE a un cliente cuyo único préstamo
     está PERDIDO. Salió en el espejo: Yurber, un clavo, con la pastilla verde
     y «sin próximo cobro calculado» debajo, que era la pista.

     Y no es un matiz: si el clavo se leyera como préstamo vivo, el cliente ni
     siquiera bajaría a esta zona el día que le toque cobro. */
  const vivos = (c.prestamosActivos ?? []).filter((p) => !p?.esClavo)
  if (vivos.length > 0) return 'aldia'

  /* Cuánto lleva sin nada. Se mide sobre `terminoDePagar` y no sobre
     `diasDesdeUltimoPago` porque ese segundo campo es null justo para este
     grupo cuando el cliente no tiene ningún préstamo abierto —lo comprobé
     midiendo la ruta: 69 filas fuera de parada y las 69 con `dias:null`—, así
     que la regla de los tres meses no llegaba a dispararse nunca y quien
     terminó hace ocho meses salía tan «oportunidad» como el de la semana
     pasada. La fecha sí la tenemos; se usa la que hay. */
  if (!c.terminoDePagar) return 'inactivo'
  const dias = diasDesde(c.terminoDePagar)
  if (dias != null && dias > DIAS_INACTIVO) return 'inactivo'
  return 'sindeuda'
}

/* Días entre una fecha y hoy, en UTC. Como el resto del sistema: en producción
   el servidor corre en UTC y en desarrollo en Bogotá, así que restar en local
   da un día de diferencia que no se ve hasta que está desplegado. */
function diasDesde(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

/* Lo que dice cada fila de abajo. Las tres frases salen de la lámina y cada una
   contesta lo único que se decide en ese estado:

     al día    ¿cuándo hay que volver?      → la FECHA, y los días al lado
     sin deuda ¿cuánto le puedo prestar?    → lo que ya devolvió completo
     inactivo  ¿esto sigue siendo ruta?     → desde cuándo no tiene nada

   ── LOS DOS ARREGLOS DE COPY QUE PIDE LA LÁMINA ──
   1. «Se puede retirar» suena a que el cliente se va. Es SACARLO DE LA RUTA, y
      solo va en el inactivo: al que acaba de pagar hay que PRESTARLE. Los dos
      llevaban el mismo botón siendo opuestos.
   2. «Cobra en 13d» deja al cobrador contando con los dedos. Lo que se le dice
      al cliente en la puerta es «el 19 de agosto»; los días acompañan. */
export function filaZonaDe(c = {}, { pais, formatear = String } = {}) {
  const estado = zonaDe(c)
  const base = { id: c.id, nombre: c.nombre, iniciales: inicialesDe(c.nombre), estado }

  if (estado === 'aldia') {
    // Los vivos, no todos: contar el clavo diría «2 préstamos» de alguien que
    // solo tiene uno que se le pueda cobrar. Misma razón que en `zonaDe`.
    const cuantos = (c.prestamosActivos ?? []).filter((p) => !p?.esClavo).length
    const dias = aNumero(c.diasParaCobro)
    const fecha = fechaLargaDe(c.proximoCobroAt) ?? c.proximoCobroLabel
    // Sin fecha no se inventa una: se dice lo que se sabe. Una fecha de cobro
    // equivocada manda a tocar una puerta el día que no es.
    const cuando = !fecha
      ? 'Sin próximo cobro calculado'
      : Number.isNaN(dias)
        ? `Le cobras el ${fecha}`
        : dias === 0 ? `Le cobras hoy, ${fecha}`
        : dias === 1 ? `Le cobras mañana, ${fecha}`
        : dias < 0   ? `Debió cobrarse el ${fecha} · hace ${Math.abs(dias)} días`
        : `Le cobras el ${fecha} · en ${dias} días`

    return {
      ...base,
      subtitulo: cuando,
      detalle: `${cuantos} préstamo${cuantos === 1 ? '' : 's'} · debe ${formatear(Math.round(positivo(c.saldoTotal)))}`,
      apunte: positivo(c.cuota) > 0
        ? `cuota de ${formatear(Math.round(positivo(c.cuota)))} ${PERIODO[c.frecuencia] ?? 'al día'}`
        : null,
      accion: 'Cobrar antes',
    }
  }

  if (estado === 'sindeuda') {
    const cuantos = positivo(c.prestamosCompletados)
    const techo = positivo(c.puedePrestarHasta)
    return {
      ...base,
      subtitulo: `Terminó de pagar el ${fechaLargaDe(c.terminoDePagar)}`,
      detalle: `Pagó completos sus ${cuantos} préstamo${cuantos === 1 ? '' : 's'}.`,
      // El techo solo si se sabe. «Le puedes prestar hasta $0» es peor que
      // callarse, y es lo que saldría del cliente cuyo único préstamo cerrado
      // no tiene monto.
      apunte: techo > 0 ? `Le puedes prestar hasta ${formatear(Math.round(techo))}.` : null,
      accion: 'Prestarle',
    }
  }

  const desde = fechaLargaDe(c.terminoDePagar)
  return {
    ...base,
    subtitulo: desde ? `Sin préstamos desde el ${desde}` : 'Sin préstamos',
    accion: 'Sacar',
  }
}

// «al mes», «a la semana»… El texto de la cuota se lee entero en la frase, así
// que no valen las abreviaturas de columna («/mes») que usa la tarjeta.
const PERIODO = {
  diario: 'al día',
  semanal: 'a la semana',
  quincenal: 'cada quincena',
  mensual: 'al mes',
}
