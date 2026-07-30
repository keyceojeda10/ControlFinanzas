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

export function loPuestoAqui(ruta = {}, formatear = String) {
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
      ...(cumple === null ? [] : [{ id: 'cumple', etiqueta: 'Cumple', valor: `${cumple}%` }]),
    ],
    numeros: {
      cartera: Math.round(cartera),
      capital: Math.round(capital),
      porGanar: Math.round(porGanar),
      cumple,
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
