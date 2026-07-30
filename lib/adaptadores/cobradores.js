// lib/adaptadores/cobradores.js — T09-02 cobradores · T36-03 cómo me fue hoy.
//
// ══ LO QUE DEBE ENTREGAR NO ES LO QUE RECOGIÓ ═══════════════════════════════
//
// La lámina del cobrador lo dice con las dos cifras al lado: recogió $188.000,
// pero tiene que entregar $153.000, porque $35.000 entraron por Nequi y ESOS YA
// ESTÁN EN LA CUENTA. Es la cuenta que hoy se hace de memoria al final del día y
// por la que se pelea.
//
// El API de cobradores devolvía `recaudadoHoy` a secas, sin separar por medio.
// Se añadió el desglose (`recaudadoEfectivoHoy`, `recaudadoDigitalHoy`) igual que
// en `rutas/[id]`. Sin él, «debe entregar» sería una cifra falsa siempre que el
// cliente pague por transferencia — y cada vez pagan más así.
//
// ══ LA EFECTIVIDAD ES PLATA SOBRE PLATA, Y A VECES NO EXISTE ════════════════
//
// T36-03 la define sin ambigüedad: «$188.000 de $235.000 → 80%». No es clientes
// sobre clientes —eso es la otra línea, «9 de 11 te pagaron»—. Y si hoy no se
// esperaba nada (domingo, día sin cobro, ruta vacía) el porcentaje NO ES CERO:
// no existe. Un 0% rojo por un domingo es una acusación falsa.

/** Efectividad del día: recogido sobre esperado.
 *
 *  Devuelve `null` cuando no había nada que cobrar. Quien pinta decide qué poner
 *  —una raya, nada—, pero nunca un 0%. */
export function efectividadDe(recaudado, esperado) {
  const esp = Number(esperado) || 0
  if (esp <= 0) return null
  const pct = Math.round(((Number(recaudado) || 0) / esp) * 100)
  return Math.max(0, pct)
}

/** El tono de la efectividad. El verde empieza en 70%: por debajo de ahí falta
 *  casi un tercio de la ruta y no es un buen día. */
export function tonoEfectividad(pct) {
  if (pct == null) return 'neutro'
  if (pct >= 70) return 'ok'
  if (pct >= 40) return 'aviso'
  return 'malo'
}

/** Lo que el cobrador tiene que entregar en efectivo.
 *
 *  Si el API todavía no manda el desglose, cae en el total: es lo que pasaba
 *  antes y es la suposición segura (todo en efectivo), no una cifra inventada. */
export function entregaEnEfectivo(c) {
  if (c?.recaudadoEfectivoHoy != null) return Number(c.recaudadoEfectivoHoy) || 0
  return Number(c?.recaudadoHoy) || 0
}

/** T09-02 · Los cobradores en dos grupos.
 *
 *  LA SEPARACIÓN ES EL DIAGNÓSTICO. La cuenta tiene 9 cobradores y 5 sin ruta:
 *  cuentas que no pueden cobrar nada y que hoy no avisan de nada, mezcladas en
 *  la misma lista que las que sí trabajan. Arriba, los que cobran, con sus tres
 *  cifras. Abajo, los que no, colapsados en filas de una línea con un solo botón.
 *
 *  Las inactivas no son «sin ruta»: están apagadas a propósito y no son un
 *  problema que resolver. Salen fuera de los dos grupos. */
export function agrupaCobradores(lista, formatear = (n) => String(n)) {
  const todos = Array.isArray(lista) ? lista : []
  const activos = todos.filter((c) => c?.activo !== false)

  const cobrando = []
  const sinRuta = []

  for (const c of activos) {
    if (c?.ruta?.id) {
      const recaudado = Number(c.recaudadoHoy) || 0
      const esperado = Number(c.esperadoHoy) || 0
      const pct = efectividadDe(recaudado, esperado)
      const entrega = entregaEnEfectivo(c)
      cobrando.push({
        id: c.id,
        nombre: c.nombre,
        iniciales: inicialesDe(c.nombre),
        // «Ruta 2 · 9 clientes»: sin el conteo, el nombre de la ruta no dice si
        // esa persona tiene trabajo o tiene una ruta vacía.
        detalle: `${c.ruta.nombre} · ${plural(c.cantidadClientes, 'cliente')}`,
        hoy: formatear(recaudado),
        efectividad: pct == null ? '—' : `${pct}%`,
        tonoEfectividad: tonoEfectividad(pct),
        entrega: formatear(entrega),
        // Cero por entregar no es un aviso: es que aún no ha cobrado nada.
        debeAlgo: entrega > 0,
      })
    } else {
      sinRuta.push({
        id: c.id,
        nombre: c.nombre,
        iniciales: inicialesDe(c.nombre),
      })
    }
  }

  return {
    cobrando,
    sinRuta,
    // «9 cuentas · 4 con ruta asignada». Las dos cifras juntas son las que hacen
    // evidente el hueco; cualquiera de las dos sola no dice nada.
    resumen: `${plural(activos.length, 'cuenta')} · ${cobrando.length} con ruta asignada`,
    // El aviso solo aparece si hay algo que avisar.
    aviso: sinRuta.length > 0
      ? { cuantas: sinRuta.length, texto: `${plural(sinRuta.length, 'cuenta')} sin ruta` }
      : null,
  }
}

/** T36-03 · El día del cobrador, contado para él.
 *
 *  Los 8 cobradores de la cuenta marcan $0 recogido en 26 días. Si registrar solo
 *  sirve para que el jefe vigile, nadie registra. Esta función es la que le
 *  devuelve algo a cambio: su porcentaje, su mejor día, y sobre todo la cifra por
 *  la que se pelea al final de la tarde. */
export function miDia(datos, formatear = (n) => String(n)) {
  const d = datos ?? {}
  const recaudado = Number(d.recaudadoHoy) || 0
  const esperado = Number(d.esperadoHoy) || 0
  const digital = Number(d.recaudadoDigitalHoy) || 0
  const efectivo = d.recaudadoEfectivoHoy != null
    ? Number(d.recaudadoEfectivoHoy) || 0
    : Math.max(0, recaudado - digital)
  const pct = efectividadDe(recaudado, esperado)

  const pagaron = Number(d.clientesPagaron) || 0
  const total = Number(d.clientesEsperados) || 0
  const faltaron = Math.max(0, total - pagaron)

  return {
    recogido: formatear(recaudado),
    // «de $235.000» solo se enseña si de verdad se esperaba algo.
    deEsperado: esperado > 0 ? `de ${formatear(esperado)}` : null,
    porcentaje: pct == null ? null : `${pct}%`,
    barra: pct == null ? 0 : Math.min(100, pct),
    clientes: total > 0
      ? `${pagaron} de ${total} clientes te pagaron${faltaron > 0 ? ` · ${faltaron} ${faltaron === 1 ? 'quedó pendiente' : 'quedaron pendientes'}` : ''}`
      : null,
    entrega: formatear(efectivo),
    // La segunda línea de la tarjeta dorada: por qué no entrega todo lo que
    // recogió. Sin ella la cifra parece un descuadre.
    entregaDetalle: digital > 0
      ? `efectivo · ${formatear(digital)} entraron por transferencia`
      : 'efectivo · todo lo de hoy',
  }
}

/** La semana del cobrador, con hoy marcado.
 *
 *  El «mejor día» se calcula sobre los días QUE YA PASARON. Si el miércoles va a
 *  la mitad y aún no termina, decirle que es su peor día es mentira. */
export function miSemana(dias, formatear = (n) => String(n)) {
  const lista = Array.isArray(dias) ? dias : []
  if (lista.length === 0) return { barras: [], frase: null, total: formatear(0) }

  const iHoy = lista.findIndex((d) => d?.hoy)
  const hasta = iHoy >= 0 ? iHoy : lista.length - 1
  const transcurridos = lista.slice(0, hasta + 1)
  const total = lista.reduce((a, d) => a + (Number(d?.valor) || 0), 0)

  let mejor = -1
  let mejorValor = -1
  transcurridos.forEach((d, i) => {
    const v = Number(d?.valor) || 0
    if (v > mejorValor) { mejorValor = v; mejor = i }
  })

  const hoyEsElMejor = iHoy >= 0 && mejor === iHoy && mejorValor > 0

  return {
    barras: lista.map((d, i) => ({
      etiqueta: d?.etiqueta ?? '',
      valor: Number(d?.valor) || 0,
      // El dorado marca HOY, no el máximo: es la regla del dorado único por
      // pantalla y es lo que el cobrador busca al mirar.
      tono: i === iHoy ? 'oro' : 'inactiva',
    })),
    frase: hoyEsElMejor
      ? `Hoy es tu mejor día de la semana. Llevas ${formatear(total)} recogidos.`
      : `Llevas ${formatear(total)} recogidos esta semana.`,
    total: formatear(total),
  }
}

function inicialesDe(nombre) {
  const partes = String(nombre ?? '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '··'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
}

function plural(n, palabra) {
  const cuantos = Number(n) || 0
  return `${cuantos} ${palabra}${cuantos === 1 ? '' : 's'}`
}
