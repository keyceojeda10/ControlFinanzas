// lib/adaptadores/tabla.js — entre /api/prestamos/[id] y <TablaAmortizacion>.
//
// LA TABLA ES UNA BARRA PARTIDA POR CUOTA. El pie de T12-01:
//
//   «Cada cuota es una barra partida: negro el capital que vuelve, dorado la
//    ganancia. En decreciente dinámico la parte dorada se encoge mes a mes y eso
//    se ve sin leer un número. Arriba, la misma partición para el préstamo
//    entero. Deja de ser una lista de acordeones y se puede compartir.»
//
// NO SE RECALCULA NADA. Las cuotas vienen de `cuotasAmortizacion`, que es la
// tabla que el sistema GUARDÓ al crear el préstamo. Recomponerla acá con una
// fórmula daría números parecidos pero distintos, y en una pantalla que se le
// manda al cliente eso es una discusión perdida de antemano.

import { formatMoney } from '@/lib/i18n'
import { coberturaDeLaTabla } from '@/lib/calculos'

const MODO = {
  lineal: 'Decreciente',
  lineal_dinamico: 'Decreciente dinámico',
  solo_interes: 'Solo interés (globo)',
  saldo: 'Sobre saldo',
}

// Singular Y plural. Con solo el singular y una `s` pegada, «Mes» daba «6 mess»
// —lo vi en la captura, no en una prueba— y «Día» habria dado «30 días» sin tilde
// movida de sitio. En español el plural no es añadir una letra.
const PERIODO = {
  diario:    { uno: 'Día', varios: 'días' },
  semanal:   { uno: 'Semana', varios: 'semanas' },
  quincenal: { uno: 'Quincena', varios: 'quincenas' },
  mensual:   { uno: 'Mes', varios: 'meses' },
}

/** «21 de agosto». La tabla ya dice el número de período; el año sobra. */
function fechaCuota(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
}

/* La pastilla «SIGUIENTE» y el anillo dorado van a la primera cuota que lo
   pagado no alcanza a cubrir — el mismo criterio que la mora, el próximo cobro y
   «cuota N de M». Ver `coberturaDeLaTabla`. Se miraba fila por fila (`pagado`, y
   si no `interesPagado`) y con eso el anillo se le ponía a la cuota de agosto
   mientras la de julio seguía vencida y sin pagar. */

export function adaptarTabla(p, pais) {
  const cuotasCrudas = Array.isArray(p?.cuotasAmortizacion) ? p.cuotasAmortizacion : []
  const capitalNum = Number(p?.montoPrestado ?? 0)
  const totalNum = Number(p?.totalAPagar ?? 0)
  const gananciaNum = Math.max(0, totalNum - capitalNum)
  // La cobertura va POR NÚMERO DE PERÍODO, no por posición: `cobertura` viene
  // ordenada y `cuotasCrudas` llega como la mande el API. Cruzarlas por índice
  // funciona hasta el día que alguien cambie un `orderBy`, y entonces la
  // pastilla «SIGUIENTE» aparece en la cuota equivocada sin que nada falle.
  const cobertura = new Map(coberturaDeLaTabla(p).map((c) => [c.fila.numeroPeriodo, c]))
  const pagadoTotal = typeof p?.totalPagado === 'number' ? p.totalPagado : null
  const primeraSinCubrir = [...cobertura.values()].find((c) => !c.cubierta)?.fila?.numeroPeriodo ?? null
  const periodo = PERIODO[p?.frecuencia] ?? { uno: 'Cuota', varios: 'cuotas' }

  /* Lo que le falta a esta cuota: su acumulado menos todo lo que el cliente ha
     entregado, topado a la cuota. Sin `totalPagado` no hay acumulado que valga
     y se cae a la resta de siempre. */
  const faltanteDe = (c) => {
    const cuota = Number(c.cuotaTotal ?? 0)
    const acum = cobertura.get(c.numeroPeriodo)?.acumulado
    if (pagadoTotal == null || acum == null) return Math.max(0, cuota - Number(c.pagado ?? 0))
    return Math.min(cuota, Math.max(0, Math.round(acum - pagadoTotal)))
  }

  const cuotas = cuotasCrudas.map((c, i) => ({
    id: c.numeroPeriodo ?? i,
    // «Mes 1 · 21 de agosto». Los nombres son `cuando` y `cuota` porque son los
    // que LEE el componente: yo habia puesto `titulo` y `monto`, y con esos las
    // filas salen sin fecha y sin cifra. Mismo desajuste que ya tuvo la fila del
    // historial de la ficha — el adaptador y el componente tienen que hablar el
    // mismo idioma, y quien manda es el que ya existe.
    cuando: [`${periodo.uno} ${c.numeroPeriodo ?? i + 1}`, fechaCuota(c.fechaEsperada)]
      .filter(Boolean).join(' · '),
    cuota: formatMoney(Math.round(c.cuotaTotal ?? 0), pais),
    capital: formatMoney(Math.round(c.capital ?? 0), pais),
    ganancia: formatMoney(Math.round(c.interes ?? 0), pais),
    capitalNum: Number(c.capital ?? 0),
    gananciaNum: Number(c.interes ?? 0),
    // ── EL SALDO DESPUÉS (T12-03) ──
    // El pie de la lámina lo llama «la columna que hoy no existe: es lo que el
    // cliente pregunta cuando reclama». Ya está en la base
    // (`CuotaAmortizacion.saldoRestante`), solo que no salía de aquí.
    saldo: c.saldoRestante != null ? formatMoney(Math.round(c.saldoRestante), pais) : null,
    siguiente: primeraSinCubrir != null && c.numeroPeriodo === primeraSinCubrir,
    // Una cuota ya cubierta se apaga, NO se tiñe de verde: es la misma regla del
    // préstamo pagado en T02-06 —«se apagan en gris en vez de teñirse de verde»—
    // y por el mismo motivo: en verde compite por la atención con la que toca.
    pagada: cobertura.get(c.numeroPeriodo)?.cubierta ?? ((c.pagado || 0) >= (c.cuotaTotal || 0)),
    // Lo que falta de ESTA cuota. Va en número, no formateado, porque quien lo
    // consume es el modal de pago —que necesita la cifra para precargarla— y no
    // la pantalla. Sin él, tocar la fila abría el modal en cero.
    //
    // Sale del acumulado menos lo pagado, no de `c.pagado`: con `c.pagado` el
    // modal precargaba la cuota ENTERA de quien ya había abonado por otra vía.
    faltanteNum: faltanteDe(c),
  }))

  // «Carlos Prueba 1 · $1.000.000 · 20% · 6 meses». Va en la cabecera, y dice de
  // quién es la tabla: sin el nombre, una tabla compartida no se sabe a quién
  // pertenece.
  const meses = cuotasCrudas.length
  const subtitulo = [
    p?.cliente?.nombre,
    capitalNum > 0 ? formatMoney(capitalNum, pais) : null,
    Number(p?.tasaInteres ?? 0) > 0 ? `${p.tasaInteres}%` : null,
    meses > 0 ? `${meses} ${meses === 1 ? periodo.uno.toLowerCase() : periodo.varios}` : null,
  ].filter(Boolean).join(' · ')

  return {
    modo: MODO[p?.modoInteres] ?? p?.modoInteres ?? '—',
    subtitulo,
    capital: formatMoney(capitalNum, pais),
    ganancia: formatMoney(gananciaNum, pais),
    capitalNum,
    gananciaNum,
    totalCuotas: cuotasCrudas.length,
    total: formatMoney(totalNum, pais),
    cuotas,
    // Para compartir por WhatsApp cuando el navegador no tiene `share`. Texto
    // plano a propósito: es lo único que sobrevive intacto a cualquier app.
    textoParaCompartir: [
      `Tabla del préstamo · ${p?.cliente?.nombre ?? ''}`.trim(),
      subtitulo,
      '',
      ...cuotas.map((c) => `${c.cuando} — ${c.cuota}`),
      '',
      `Total: ${formatMoney(totalNum, pais)}`,
    ].join('\n'),
  }
}

/* ── T12-02 · comparar modos ─────────────────────────────────────────────────
   Lo que no existía: comparar DESPUÉS, sobre un préstamo ya hecho. Hasta ahora
   sólo se podía comparar antes de crearlo, en el paso 5. El pie de la lámina:

     «El selector del paso 5 ya está bien hecho: nombra los modos en cristiano,
      marca el recomendado y hasta trae un "¿no sabes cuál usar?". Lo que no existe
      es compararlos DESPUÉS, sobre un préstamo ya creado. Esta hoja es eso: los
      mismos nombres y la misma matemática, con la partición capital/ganancia a la
      vista. La diferencia entre el modo actual y cuota fija son $500.001.»

   ESA ÚLTIMA FRASE MANDA: la lámina compara contra CUOTA FIJA, que es el modo por
   defecto y el 54,7% de la cartera. Yo había puesto solo los cuatro que tienen
   tabla, y sin el modo por defecto la comparación no tiene contra qué: el dueño
   quiere saber «¿y si lo hubiera hecho como los demás?».

   `lineal` (decreciente plano) tampoco sale en la lámina, pero sí se enseña: es un
   modo que el sistema ofrece de verdad, y una comparación que se salta una opción
   real deja al dueño eligiendo entre menos de lo que tiene.

   LA ARITMÉTICA NO SE ESCRIBE AQUÍ. Cada opción se calcula con `calcularPrestamo`,
   que es la misma función que usa el formulario de creación y la que decide qué se
   cobra de verdad. Reescribir la fórmula daría números que no cuadran con lo que
   pasaría si el dueño acepta el cambio, y una comparación que miente es peor que no
   tenerla. */

// Los nombres de la lámina, que son los del paso 5: en cristiano, no el enum.
// «Sobre lo que falta» dice lo que hace; «Sobre saldo» es jerga de quien lo
// programó. Ninguno lleva paréntesis explicativo: la frase de abajo ya explica.
const NOMBRE_MODO = {
  fijo: 'Cuota fija',
  lineal: 'Decreciente',
  lineal_dinamico: 'Decreciente dinámico',
  saldo: 'Sobre lo que falta',
  solo_interes: 'Solo interés',
}

// La parte de la frase que NO depende de las cifras. La otra mitad —«la cuota va de
// $366.667 a $199.998»— se compone abajo con los números de ESTE préstamo, porque
// una comparación sin cifras es una definición, y definiciones ya da el paso 5.
const QUE_LE_PASA = {
  fijo: 'El recomendado y el más usado.',
  lineal: 'Cada cuota devuelve el mismo pedazo de capital y el interés se calcula una vez sobre el total.',
  lineal_dinamico: 'El interés se cobra sobre lo que aún debe.',
  saldo: 'Como los bancos: el interés se calcula sobre lo que aún debe. Si abona de más, paga menos.',
  solo_interes: 'Ojo: el capital no baja hasta el final.',
}

/** «6 meses», «30 días», «4 semanas» — el plazo en períodos, no en días crudos.
    La lámina dice «$1.000.000 al 20% · 6 meses»: nadie piensa un préstamo mensual
    en 180 días. */
function plazoEnPeriodos(p) {
  const dias = Number(p?.diasPlazo ?? 0)
  if (!(dias > 0)) return null
  const porPeriodo = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }[p?.frecuencia] ?? 1
  const n = Math.round(dias / porPeriodo)
  const periodo = PERIODO[p?.frecuencia] ?? { uno: 'período', varios: 'períodos' }
  return `${n} ${n === 1 ? periodo.uno.toLowerCase() : periodo.varios}`
}

/** «$500.001 más que ahora» / «$87.999 menos». Es la comparación de verdad: la
    resta que el dueño haría de cabeza si no estuviera hecha. */
function diferenciaContra(total, referencia, plata) {
  if (!(referencia > 0)) return ''
  const d = total - referencia
  if (d === 0) return 'Lo mismo que ahora.'
  return `${plata(Math.abs(d))} ${d > 0 ? 'más' : 'menos'} que ahora.`
}

export function adaptarComparacion(p, calcular, pais) {
  const monto = Number(p?.montoPrestado ?? 0)
  const actual = p?.modoInteres
  const base = {
    montoPrestado: monto,
    tasaInteres: Number(p?.tasaInteres ?? 0),
    diasPlazo: Number(p?.diasPlazo ?? 0),
    fechaInicio: p?.fechaInicio,
    frecuencia: p?.frecuencia ?? 'mensual',
  }
  const plata = (n) => formatMoney(Math.round(n), pais)

  // Un modo que revienta con estos términos se cae de la lista en vez de enseñarse
  // roto. Sin el `catch`, un solo modo malo tumba la hoja entera.
  const correr = (id) => {
    try { return calcular({ ...base, modoInteres: id }) } catch { return null }
  }

  // El total del modo actual se calcula UNA vez y se reusa: es la referencia de
  // todas las diferencias, y recalcularlo por fila daría el mismo número cinco
  // veces a cambio de cinco pasadas por la aritmética del préstamo.
  const totalActual = Number(correr(actual)?.totalAPagar ?? 0)

  const opciones = Object.keys(NOMBRE_MODO).map((id) => {
    const r = correr(id)
    const total = Number(r?.totalAPagar ?? 0)
    if (!(total > 0)) return null
    const gananciaNum = Math.max(0, total - monto)

    // La cuota: si se mueve, «va de X a Y»; si no, «misma cuota siempre». Sale de la
    // tabla que devuelve `calcularPrestamo`, no de dividir el total entre los
    // períodos — que en los modos decrecientes daría una cuota que no existe.
    const filas = Array.isArray(r?.tablaAmortizacion) ? r.tablaAmortizacion : []
    const cuotas = filas.map((f) => Math.round(f.cuotaTotal ?? 0)).filter((n) => n > 0)
    const primera = cuotas[0] ?? Math.round(r?.cuotaDiaria ?? 0)
    const ultima = cuotas.length ? cuotas[cuotas.length - 1] : Math.round(r?.ultimaCuota ?? r?.cuotaDiaria ?? 0)
    const comoVaLaCuota = primera && ultima && primera !== ultima
      ? `La cuota va de ${plata(primera)} a ${plata(ultima)}.`
      : primera ? `Misma cuota siempre: ${plata(primera)}.` : ''

    const esActual = id === actual
    return {
      id,
      nombre: NOMBRE_MODO[id] ?? id,
      total: plata(total),
      totalNum: total,
      capitalNum: monto,
      gananciaNum,
      esActual,
      explicacion: [
        esActual ? 'El que tiene este préstamo.' : QUE_LE_PASA[id],
        comoVaLaCuota,
        `Ganancia ${plata(gananciaNum)}.`,
        // Lo que el pie de la lámina saca a mano —«la diferencia son $500.001»— va
        // en cada fila: sin la diferencia, cinco totales son cinco cifras que hay
        // que restar de cabeza.
        esActual ? '' : diferenciaContra(total, totalActual, plata),
      ].filter(Boolean).join(' '),
    }
  }).filter(Boolean)

  // EL ACTUAL VA PRIMERO. Es el «desde dónde» de la comparación: ordenado sólo por
  // precio, el dueño no sabe cuál es el suyo hasta que encuentra el marcado. El
  // resto, de lo que menos le cuesta al cliente a lo que más.
  opciones.sort((a, b) => (Number(b.esActual) - Number(a.esActual)) || (a.totalNum - b.totalNum))

  const plazo = plazoEnPeriodos(p)
  return {
    resumen: [
      [monto > 0 ? plata(monto) : null, Number(p?.tasaInteres ?? 0) > 0 ? `al ${p.tasaInteres}%` : null]
        .filter(Boolean).join(' '),
      plazo,
    ].filter(Boolean).join(' · '),
    actual,
    // El botón de abajo dice el nombre del modo actual —«Dejar decreciente
    // dinámico»—, no «Dejar el de ahora»: al final de cuatro comparaciones el dueño
    // ya no tiene claro cuál era el suyo.
    nombreActual: NOMBRE_MODO[actual] ?? actual,
    opciones,
  }
}
