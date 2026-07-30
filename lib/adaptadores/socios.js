// lib/adaptadores/socios.js — T45. Socios y reparto de la ganancia.
//
// ══ REPARTIR NO SACA PLATA DE LA CAJA ═══════════════════════════════════════
//
// Es la nota que T45-02 llama «el error más caro»: repartir deja ANOTADO que se le
// debe al socio; el dinero sale después, cuando se le paga. Un dueño que crea que
// al repartir ya pagó, va a pagar dos veces.
//
// De ahí que la relación con un socio se cuente con dos cifras y no con un neto:
//
//     LE HAS DADO   — lo que ya salió de la caja (retiros)
//     LE DEBES      — lo repartido que todavía no se le ha pagado
//
// «Balance neto» junta las dos y esconde justo la que hay que mirar antes de que
// se la pidan. Por eso «le debes» va en dorado: es plata que va a salir.
//
// ══ EL REPARTO ES UN HECHO CON FECHA ════════════════════════════════════════
//
// No un cálculo en vivo. Se declara por período, queda registrado, y a partir de
// ahí es una deuda concreta. Si fuera un cálculo, cambiaría solo cada vez que
// entra un pago y el socio nunca sabría qué se le prometió.
//
// ⚠️ PENDIENTE-BACKEND — HOY NO HAY DÓNDE REGISTRARLO.
//
// `AporteSocio.tipo` admite 'aporte' y 'retiro', y nada más. Sin un tercer tipo:
//
//   · «le debes» no se puede calcular — no existe la deuda declarada;
//   · y si alguien implementara «repartir» como un retiro, SACARÍA PLATA DE LA
//     CAJA, que es exactamente el error que la lámina advierte.
//
// Hace falta, y es pequeño porque `tipo` ya es String libre:
//   1. `tipo: 'reparto'` — la ganancia declarada. Suma a lo que se debe, NO toca
//      la caja ni el capital.
//   2. `periodoDesde` / `periodoHasta` (DateTime?) — el reparto es de un período,
//      y sin ellos no se puede saber qué queda sin repartir ni impedir repartir
//      dos veces lo mismo.
//   3. La lectura de `AporteSocio` que hoy suma aportes menos retiros tiene que
//      IGNORAR las filas de reparto para el capital puesto: un reparto no es
//      capital, es deuda.
//
// Mientras no exista, `cuentaDelSocio` devuelve `leDebes: null` y la pantalla no
// lo dibuja. Preferible a enseñar un $0 que se lee como «no le debo nada».

function aNumero(v) {
  if (v === null || v === undefined || v === '') return NaN
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

function positivo(v) {
  const n = aNumero(v)
  return Number.isNaN(n) ? 0 : Math.max(0, n)
}

/* Los colores de la barra partida. Van por posición y no por socio: con dos socios
   son oro y verde, y a partir del tercero se repiten en el mismo orden para que la
   leyenda y la barra siempre coincidan. */
export const COLORES_SOCIO = ['#F5B824', '#2FBE6A', '#7A6CF0', '#F0575C', '#A3A8B2']

/* ── El bloque negro: lo que pusieron ─────────────────────────────────────── */

/* LA SOCIEDAD EN UNA IMAGEN. La barra partida con los dos porcentajes hace
   innecesaria la tarjeta que explicaba el modelo: el modelo se ve. */
export function loQuePusieron(socios = [], formatear = String) {
  const filas = socios.filter(Boolean).map((s) => ({
    id: s.id,
    nombre: s.nombre,
    // Lo puesto es aportes menos retiros de CAPITAL. Los repartos no cuentan: un
    // reparto es deuda, no capital puesto — mezclarlos subiría el porcentaje del
    // socio al que ya se le debe más, que es al revés de lo que debe pasar.
    puesto: positivo(s.puesto),
  }))

  const total = filas.reduce((t, f) => t + f.puesto, 0)

  const conParte = filas.map((f, i) => ({
    ...f,
    // La proporción EXACTA se guarda aparte del porcentaje que se enseña: el
    // reparto se calcula con la exacta, no con el 66,7% redondeado.
    parte: total > 0 ? f.puesto / total : 0,
    porcentaje: total > 0 ? redondearPorcentaje((f.puesto / total) * 100) : null,
    color: COLORES_SOCIO[i % COLORES_SOCIO.length],
    puestoTexto: formatear(Math.round(f.puesto)),
  }))

  return {
    etiqueta: 'Tus socios pusieron',
    total: formatear(Math.round(total)),
    socios: conParte,
    // Sin nadie que haya puesto nada no hay barra: una barra vacía no dice «no
    // hay socios», dice «algo se rompió».
    barra: total > 0 ? conParte.map((s) => ({ id: s.id, ancho: s.parte * 100, color: s.color })) : [],
    numeros: { total: Math.round(total) },
  }
}

/* «66,7%» y no «67%»: con dos socios cercanos, un punto de redondeo es la
   diferencia entre discutir y no discutir. Y sin decimal cuando es redondo. */
export function redondearPorcentaje(p) {
  const n = Math.round(p * 10) / 10
  return `${String(n).replace('.', ',')}%`
}

/* ── La cuenta de cada socio ──────────────────────────────────────────────── */

/* DOS CIFRAS, NO UN NETO. Ver la cabecera del archivo. */
export function cuentaDelSocio(socio = {}, formatear = String) {
  const puesto = positivo(socio.puesto)
  const dado = positivo(socio.pagado)

  // `repartido` es lo declarado a su favor. HOY NO EXISTE (falta el tipo de
  // movimiento), y por eso puede llegar `undefined` — que no es lo mismo que 0.
  const repartido = aNumero(socio.repartido)
  const hayRepartos = !Number.isNaN(repartido)
  const debe = hayRepartos ? Math.max(0, repartido - dado) : null

  return {
    id: socio.id,
    nombre: socio.nombre,
    iniciales: String(socio.nombre ?? '?')
      .trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join(''),
    detalle: [
      puesto > 0 ? `puso ${formatear(Math.round(puesto))}` : null,
      socio.porcentaje,
    ].filter(Boolean).join(' · '),
    dadoEtiqueta: 'Le has dado',
    dado: formatear(Math.round(dado)),
    debeEtiqueta: 'Le debes',
    // Sin repartos registrados no se enseña: un «$0» aquí se lee como «no le debo
    // nada», y lo cierto es que todavía no se ha repartido.
    debe: debe === null ? null : formatear(Math.round(debe)),
    numeros: { puesto: Math.round(puesto), dado: Math.round(dado), debe: debe === null ? null : Math.round(debe) },
  }
}

/* ── T45-02 · Repartir la ganancia ────────────────────────────────────────── */

/* EL REPARTO CUADRA AL PESO. «$826.667 + $413.333 = $1.240.000» — un reparto que
   no cuadra es una discusión familiar.
;
   Redondear cada parte por su lado NO cuadra: con 1.240.000 entre dos tercios sale
   826.667 + 413.333, pero con otras cifras la suma se pasa o se queda corta por
   uno o dos pesos. Así que se reparte por proporción exacta, se redondea, y LA
   DIFERENCIA SE LE DA AL MAYOR — que es quien menos la nota en porcentaje. */
export function repartoDe(ganancia, socios = [], formatear = String) {
  const total = Math.round(positivo(ganancia))
  const partes = socios.filter(Boolean).map((s) => ({
    id: s.id,
    nombre: s.nombre,
    iniciales: String(s.nombre ?? '?')
      .trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join(''),
    detalle: [s.porcentaje, s.puestoTexto ? `puso ${s.puestoTexto}` : null].filter(Boolean).join(' · '),
    parte: Number(s.parte) || 0,
    bruto: (Number(s.parte) || 0) * total,
  }))

  const redondeadas = partes.map((p) => ({ ...p, monto: Math.round(p.bruto) }))
  const suma = redondeadas.reduce((t, p) => t + p.monto, 0)
  const sobra = total - suma

  if (sobra !== 0 && redondeadas.length > 0) {
    // Al que más puso: unos pesos sobre 826.667 no se ven; sobre 413.333 sí.
    let mayor = 0
    for (let i = 1; i < redondeadas.length; i++) {
      if (redondeadas[i].bruto > redondeadas[mayor].bruto) mayor = i
    }
    redondeadas[mayor] = { ...redondeadas[mayor], monto: redondeadas[mayor].monto + sobra }
  }

  return {
    etiqueta: 'Vas a repartir',
    total: formatear(total),
    filas: redondeadas.map((p) => ({ ...p, montoTexto: formatear(p.monto) })),
    sumanEtiqueta: 'Suman',
    suman: formatear(redondeadas.reduce((t, p) => t + p.monto, 0)),
    // Se expone para poder afirmar en una prueba que cuadra siempre.
    numeros: { total, partes: redondeadas.map((p) => p.monto) },
  }
}

/* DE DÓNDE SALE LA CIFRA. Sin esta línea, «$1.240.000» es un número que el dueño
   no puede defender cuando un socio pregunte.
;
   Y la resta es la de `ganancia_no_es_recaudado`: la ganancia NO es lo recaudado
   menos gastos, porque lo recaudado incluye el capital que vuelve. Aquí se dice
   con esas palabras — «quitando el capital que volvió» — para que quien lo lea
   entienda por qué la cifra es mucho menor que lo que entró. */
export function deDondeSale({ entro, capitalDevuelto, gastos } = {}, formatear = String) {
  const e = positivo(entro)
  if (e <= 0) return null
  const g = positivo(gastos)
  return [
    `De ${formatear(Math.round(e))} que entró, quitando el capital que volvió`,
    g > 0 ? ` y ${formatear(Math.round(g))} de gastos.` : '.',
  ].join('')
}

/* El «antes → después» de lo que se les debe. Es lo que convierte el reparto en
   una consecuencia visible antes de confirmarlo. */
export function loQueQuedaDebiendo({ antes, reparto } = {}, formatear = String) {
  const a = aNumero(antes)
  if (Number.isNaN(a)) return null   // sin repartos previos no hay «antes»
  const r = positivo(reparto)
  return {
    etiqueta: 'Antes → después',
    antesEtiqueta: 'Les debes',
    antes: formatear(Math.round(a)),
    despuesEtiqueta: 'ahora',
    despues: formatear(Math.round(a + r)),
  }
}

export const NOTA_NO_SACA_PLATA =
  'Repartir no saca plata de tu caja: queda anotado que se lo debes. Cuando le pagues, registras el retiro.'

/* La cabecera de la lista. «Reparten por lo que pusieron» dice el modelo en cinco
   palabras — es el único que quedó tras la decisión de julio. */
export function cabeceraSocios(socios = []) {
  const activos = socios.filter((s) => s && s.activo !== false).length
  return {
    titulo: 'Socios',
    detalle: activos > 0
      ? `${activos} activo${activos === 1 ? '' : 's'} · reparten por lo que pusieron`
      : 'todavía no hay socios',
  }
}
