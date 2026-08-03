// lib/adaptadores/caja-por-ruta.js — T08-02 «Caja · por ruta».
//
// ── LA PANTALLA QUE FALTABA ────────────────────────────────────────────────
//
// El pie de la lámina: «La pestaña que faltaba. Cada ruta con lo recaudado
// partido en efectivo y digital —la barra lleva los dos tramos— más lo esperado
// y lo prestado en la calle. Sin el medio de pago de la pantalla 01 esta vista
// no puede existir: hoy todo sería efectivo.»
//
// Lo que había era un `<select>` de cobrador y media pantalla en blanco hasta
// que elegías uno. El dueño: «sigue saliendo como la versión anterior, y eso
// está bastante feo».
//
// ── POR QUÉ SEPARAR EFECTIVO DE DIGITAL ────────────────────────────────────
//
// Es la pregunta que se hace al cerrar el día: de lo que cobró esta ruta,
// ¿cuánto tiene el cobrador EN LA MANO y cuánto entró por Nequi? El cobrador
// solo entrega el efectivo; lo digital ya está. Sin la partición, el dueño le
// pide una cifra que incluye plata que nunca tocó.
//
// El dato existe desde que el pago guarda `metodoPago` (T08-01). Antes de eso
// todo habría salido como efectivo, que es lo que dice el pie de la lámina.

import { formatMoney } from '@/lib/i18n'

/** Un pago cuenta como digital si no entró en efectivo. */
function esDigital(pago) {
  return pago?.metodoPago === 'transferencia'
}

/**
 * Agrupa los pagos del día por RUTA.
 *
 * @param pagos    los de `cajaData.pagosDia` (traen `rutaId`, `rutaNombre`,
 *                 `metodoPago` y `cobradorNombre`)
 * @param rutas    las de `/api/rutas`, para el esperado y los cobros del día
 * @param pais     para `formatMoney`
 *
 * Devuelve una fila por ruta CON MOVIMIENTO, más —si la hay— la fila de los
 * pagos sin ruta. Una ruta sin cobros hoy no sale: la pregunta de esta pestaña
 * es «cómo va la plata de hoy», y diez ruedas en cero no la contestan.
 */
export function agruparCajaPorRuta(
  pagos = [], rutas = [], pais, prestadoPorRuta = [],
  capitalPorRuta = null, gastosPorRuta = null,
) {
  const porRuta = new Map()
  // Lo desembolsado hoy en cada ruta, que ahora sí manda `/api/caja`.
  const prestadoPorId = new Map(
    (prestadoPorRuta || []).map((p) => [p.rutaId ?? '__sin_ruta__', p])
  )
  // El capital vivo de cada ruta (`Ruta.saldoCapital`, que la app ya mantiene)
  // y lo gastado hoy en ella.
  const capitalPorId = new Map(
    (capitalPorRuta?.porRuta || []).map((c) => [c.rutaId, c])
  )
  const gastadoPorId = new Map(
    (gastosPorRuta?.porRuta || []).map((g) => [g.rutaId, g.gastado])
  )

  for (const p of pagos) {
    // Los ajustes NO son plata que entró: mueven la deuda en los papeles y nadie
    // entrega ni recibe un billete. Es el mismo criterio que usa toda la caja.
    if (p?.tipo === 'recargo' || p?.tipo === 'descuento') continue

    const id = p?.rutaId ?? '__sin_ruta__'
    if (!porRuta.has(id)) {
      porRuta.set(id, {
        id,
        nombre: p?.rutaNombre ?? 'Sin ruta',
        sinRuta: !p?.rutaId,
        efectivo: 0,
        digital: 0,
        cobros: 0,
        cobradores: new Set(),
      clientes: new Set(),
      })
    }
    const fila = porRuta.get(id)
    const monto = Math.round(Number(p?.montoPagado) || 0)
    if (esDigital(p)) fila.digital += monto
    else fila.efectivo += monto
    fila.cobros += 1
    if (p?.cobradorNombre) fila.cobradores.add(p.cobradorNombre)
    // Personas distintas, para poder decir «2 de 5 cobros» sin pasarse.
    if (p?.clienteId) fila.clientes.add(p.clienteId)
  }

  // Una ruta donde HOY solo se prestó —sin cobrar un peso— también es movimiento
  // del día y tiene que salir: es plata que salió a la calle. Sin esto la fila
  // no existiría, porque las filas se construyen desde los pagos.
  for (const p of prestadoPorRuta || []) {
    const id = p?.rutaId ?? '__sin_ruta__'
    if (porRuta.has(id) || !(p?.prestado > 0)) continue
    const r = (rutas || []).find((x) => x.id === p?.rutaId)
    porRuta.set(id, {
      id,
      nombre: r?.nombre ?? 'Sin ruta',
      sinRuta: !p?.rutaId,
      efectivo: 0,
      digital: 0,
      cobros: 0,
      cobradores: new Set(),
      clientes: new Set(),
    })
  }

  // ── UNA RUTA CON CAPITAL PROPIO SALE SIEMPRE ──
  //
  // Su capital no es un suceso del día: está ahí a las 8 de la mañana, antes de
  // que se cobre nada. Construyendo las filas solo desde el movimiento, la
  // pantalla salía VACÍA al abrirla —«todavía no hay cobros ni préstamos»— con
  // $3.096.800 de capital sin enseñar.
  //
  // Es el mismo fallo que reportó en video el cliente con más cobradores:
  // optimizar para el día lleno y romper el día vacío, que es justo cuando se
  // abre la caja. Ver [[feedback_el_cero_es_un_dato]].
  for (const c of capitalPorRuta?.porRuta || []) {
    if (!c?.capitalHabilitado || porRuta.has(c.rutaId)) continue
    // El nombre lo manda el propio `/api/caja`; `rutas` (de `/api/rutas`) es
    // solo el respaldo. Depender de esa lista dejaba la fila sin pintar cuando
    // todavía no se había cargado — que es lo que vaciaba la pestaña.
    const nombre = c.nombre || (rutas || []).find((x) => x.id === c.rutaId)?.nombre
    if (!nombre) continue
    porRuta.set(c.rutaId, {
      id: c.rutaId,
      nombre,
      sinRuta: false,
      efectivo: 0,
      digital: 0,
      cobros: 0,
      cobradores: new Set(),
      clientes: new Set(),
    })
  }

  // Lo esperado y los cobros programados los sabe `/api/rutas`, no los pagos:
  // una ruta puede tener 5 cobros programados y 0 hechos, y eso no aparece en la
  // lista de pagos justamente porque no se pagaron.
  const porId = new Map((rutas || []).map((r) => [r.id, r]))

  const filas = [...porRuta.values()].map((f) => {
    const r = porId.get(f.id)
    const total = f.efectivo + f.digital
    const esperado = Math.round(Number(r?.esperadoHoy) || 0)
    const prestadoDeLaRuta = Math.round(Number(prestadoPorId.get(f.id)?.prestado) || 0)

    // ── EL CAPITAL DE LA RUTA Y LO QUE SE GASTÓ EN ELLA ──
    // `saldoCapital` solo significa algo si la ruta tiene capital propio
    // habilitado; si no, su plata vive en la bolsa global del negocio y pintar
    // un «$0» aquí se leería como «esta ruta no tiene nada».
    const cap = capitalPorId.get(f.id)
    const tieneCapitalPropio = !!cap?.capitalHabilitado
    const capitalRuta = tieneCapitalPropio ? Math.round(cap.saldoCapital || 0) : null
    const gastadoRuta = Math.round(gastadoPorId.get(f.id) || 0)
    // DINERO EN MANO = capital de la ruta − gastos. Es la cifra principal que
    // pidió el dueño. Solo existe si la ruta lleva capital propio: sin él no
    // hay «capital de la ruta» del que restar.
    const enMano = tieneCapitalPropio ? capitalRuta - gastadoRuta : null
    return {
      id: f.id,
      nombre: f.nombre,
      sinRuta: f.sinRuta,
      // «Pepito · 4 de 5 cobros». Con varios cobradores en la misma ruta se
      // dicen todos: es el dato que explica una diferencia al cuadrar.
      subtitulo: [
        f.cobradores.size ? [...f.cobradores].join(', ') : null,
        // ⚠ SE COMPARAN PERSONAS CON PERSONAS.
        // `cobrosHoy` de `/api/rutas` son los CLIENTES a los que toca cobrar
        // hoy; `f.cobros` eran los PAGOS. A un cliente se le puede cobrar dos
        // veces, así que salía «3 de 2 cobros» — que se lee como un error del
        // sistema. Se cuentan clientes distintos.
        r?.cobrosHoy > 0
          ? `${f.clientes.size} de ${r.cobrosHoy} cobros`
          : `${f.cobros} ${f.cobros === 1 ? 'cobro' : 'cobros'}`,
      ].filter(Boolean).join(' · '),
      total: formatMoney(total, pais),
      efectivo: formatMoney(f.efectivo, pais),
      digital: formatMoney(f.digital, pais),
      esperado: esperado > 0 ? formatMoney(esperado, pais) : null,
      // «PRESTADO»: la cuarta cifra de la lámina, que antes no estaba porque
      // ningún endpoint la mandaba. Ahora la calcula `/api/caja` préstamo a
      // préstamo, sin repartir totales a ojo.
      //
      // Es lo ENTREGADO EN MANO, no el valor de la cartulina: en una renovación
      // el monto nuevo absorbe el saldo viejo, que nunca salió de la caja. Un
      // día de puras renovaciones puede tener préstamos y $0 prestado, y está
      // bien: a la calle no salió un peso.
      prestado: prestadoDeLaRuta > 0 ? formatMoney(prestadoDeLaRuta, pais) : null,
      // El capital y los gastos de la ruta, y la resta de los dos.
      // `null` = «esta ruta no lleva capital propio», que NO es lo mismo que
      // cero: se omite la línea en vez de decir que no tiene plata.
      capital: capitalRuta != null ? formatMoney(capitalRuta, pais) : null,
      // Los gastos se pintan aunque sean cero SI la ruta lleva capital: forman
      // parte de la resta y una resta con un sumando invisible no se sigue.
      gastos: tieneCapitalPropio ? formatMoney(gastadoRuta, pais) : (gastadoRuta > 0 ? formatMoney(gastadoRuta, pais) : null),
      enMano: enMano != null ? formatMoney(enMano, pais) : null,
      enManoNegativo: enMano != null && enMano < 0,
      // Los dos tramos de la barra, en % del total cobrado. La barra dice de un
      // vistazo cuánto de lo cobrado sigue en la mano del cobrador.
      pctEfectivo: total > 0 ? Math.round((f.efectivo / total) * 100) : 0,
      pctDigital: total > 0 ? Math.round((f.digital / total) * 100) : 0,
      // Para ordenar y para el total de arriba.
      bruto: total,
      brutoEfectivo: f.efectivo,
      brutoDigital: f.digital,
      brutoPrestado: prestadoDeLaRuta,
      brutoCapital: capitalRuta ?? 0,
      brutoGastos: gastadoRuta,
    }
  })

  // La que más plata movió primero; la de «sin ruta» siempre al final, que es un
  // agujero por resolver y no una ruta más.
  //
  // «Movió» = cobrado + prestado. Ordenando solo por lo cobrado, una ruta que
  // hoy salió a prestar $2.000.000 y no cobró nada caía al último puesto,
  // debajo de otra que cobró $30.000.
  filas.sort((a, b) =>
    (a.sinRuta ? 1 : 0) - (b.sinRuta ? 1 : 0) ||
    (b.bruto + b.brutoPrestado) - (a.bruto + a.brutoPrestado))
  return filas
}

/**
 * El total de arriba: «$1.2M · efectivo $800.000 · digital $400.000».
 *
 * `capitalPorRuta` y `gastosPorRuta` son los del API. Se usan para las líneas de
 * LO NO ASIGNADO, que es lo que hace que la suma cuadre a la vista:
 *
 *   · capital sin ruta — plata del negocio que no vive en la calle de nadie.
 *     En el negocio del video son $8.803.600 de $14.357.755, o sea que sin esta
 *     línea la suma de las rutas parece que le falta más de la mitad.
 *   · gastos ambiguos — de un cobrador con VARIAS rutas. No se reparten.
 *   · gastos sin cobrador — del dueño, no de una ruta.
 *
 * Ninguna se esconde. Una cifra que no cuadra y se ve es un dato; una que no
 * cuadra y se esconde es un fallo esperando a que alguien lo encuentre.
 */
export function totalesCajaPorRuta(filas = [], pais, capitalPorRuta = null, gastosPorRuta = null) {
  const efectivo = filas.reduce((a, f) => a + (f.brutoEfectivo || 0), 0)
  const digital = filas.reduce((a, f) => a + (f.brutoDigital || 0), 0)
  const prestado = filas.reduce((a, f) => a + (f.brutoPrestado || 0), 0)
  const total = efectivo + digital
  return {
    total: formatMoney(total, pais),
    efectivo: formatMoney(efectivo, pais),
    digital: formatMoney(digital, pais),
    // Lo que salió a la calle hoy, para leerlo contra lo que entró.
    prestado: prestado > 0 ? formatMoney(prestado, pais) : null,

    // ── EL CAPITAL, Y LO QUE NO ESTÁ EN NINGUNA RUTA ──
    capitalGlobal: capitalPorRuta ? formatMoney(capitalPorRuta.global, pais) : null,
    capitalEnRutas: capitalPorRuta ? formatMoney(capitalPorRuta.enRutas, pais) : null,
    // Se pinta SIEMPRE que haya capital, aunque sea cero: es la línea que
    // explica por qué la suma de las rutas no da el total del negocio.
    capitalSinAsignar: capitalPorRuta ? formatMoney(capitalPorRuta.sinAsignar, pais) : null,
    capitalSinAsignarNegativo: !!capitalPorRuta && capitalPorRuta.sinAsignar < 0,
    // Sub-bolsas en negativo: no pueden existir en pesos físicos. Si las hay,
    // salió plata que nunca se registró como entrada.
    rutasEnNegativo: capitalPorRuta?.negativas || 0,

    // ── LOS GASTOS QUE NO SE PUDIERON ASIGNAR ──
    gastosAmbiguos: gastosPorRuta?.ambiguos > 0
      ? formatMoney(gastosPorRuta.ambiguos, pais) : null,
    gastosSinCobrador: gastosPorRuta?.sinCobrador > 0
      ? formatMoney(gastosPorRuta.sinCobrador, pais) : null,
    pctEfectivo: total > 0 ? Math.round((efectivo / total) * 100) : 0,
    pctDigital: total > 0 ? Math.round((digital / total) * 100) : 0,
    // Que haya préstamos también es movimiento del día, aunque no se cobrara.
    // Y que haya CAPITAL en las rutas basta para pintar: está ahí antes de que
    // empiece la jornada, y esconderlo dejaba la pantalla en blanco por la
    // mañana con millones de pesos sin enseñar.
    hayAlgo: total > 0 || prestado > 0 || (capitalPorRuta?.enRutas ?? 0) !== 0,
  }
}
