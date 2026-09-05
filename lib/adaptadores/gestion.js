// lib/adaptadores/gestion.js — el «antes → después» de las ocho hojas de T13/T19.
//
// LO QUE HACE QUE ESTAS PANTALLAS EXISTAN es el bloque negro: cada una cambia algo
// de un préstamo EN MARCHA, y hoy la consecuencia no se ve hasta después de
// confirmar. Estas funciones son esa consecuencia, y por eso están aquí y probadas
// en vez de calculadas dentro del JSX.
//
// ── TRES REGLAS ─────────────────────────────────────────────────────────────
//
// 1 · NO SE REESCRIBE LA ARITMÉTICA DEL PRÉSTAMO. Lo que ya calcula `lib/calculos`
//     —el plazo, la liquidación, la mora— se le pide a él. Aquí solo se compone la
//     frase y se hacen restas sobre cifras que ya vienen calculadas.
//
// 2 · SI FALTA EL DATO, NO HAY FILA. Ninguna de estas funciones inventa. Una
//     consecuencia a medias en una pantalla que mueve plata es peor que ninguna:
//     el dueño confirma creyendo que ya vio lo que pasaba.
//
// 3 · EL COLOR DESCRIBE LA FILA, NO EL JUICIO. «Le queda debiendo» baja con un
//     descuento y eso es verde, aunque al dueño le cueste plata: lo que le pasa a
//     él lo dicen las líneas de abajo. Un color no sabe decir «esto es mala idea»;
//     una frase sí.

import { formatMoney } from '@/lib/i18n'

/**
 * A número, y `NaN` cuando NO HAY DATO.
 *
 * `Number(null)` es 0 y `Number('')` es 0. En este archivo eso es un bug de plata,
 * no una curiosidad: con `Number.isFinite(Number(null))` dando `true`, la fila de
 * cartera salía «$38.4M → $0» cuando no se sabía la cartera, y el selector de día
 * decía «le cobras los domingos» cuando el préstamo no tiene día ancla.
 *
 * Tres funciones distintas tenían el mismo fallo por la misma razón. Ahora todas
 * preguntan por aquí, y la regla «si falta el dato, no hay fila» se cumple de
 * verdad en vez de solo estar escrita en la cabecera.
 */
function aNumero(v) {
  if (v === null || v === undefined || v === '') return NaN
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

/** Días de calendario de un período, por frecuencia. */
const DIAS_POR_PERIODO = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }

/** «cobros», «cuotas diarias», «cuotas semanales»… en plural y singular. */
const NOMBRE_CUOTA = {
  diario: { uno: 'cuota diaria', varios: 'cuotas diarias' },
  semanal: { uno: 'cuota semanal', varios: 'cuotas semanales' },
  quincenal: { uno: 'cuota quincenal', varios: 'cuotas quincenales' },
  mensual: { uno: 'cuota mensual', varios: 'cuotas mensuales' },
}

const DIAS_SEMANA = [
  { id: 0, etiqueta: 'D', nombre: 'domingo' },
  { id: 1, etiqueta: 'L', nombre: 'lunes' },
  { id: 2, etiqueta: 'M', nombre: 'martes' },
  { id: 3, etiqueta: 'M', nombre: 'miércoles' },
  { id: 4, etiqueta: 'J', nombre: 'jueves' },
  { id: 5, etiqueta: 'V', nombre: 'viernes' },
  { id: 6, etiqueta: 'S', nombre: 'sábado' },
]

/**
 * A `Date`, tratando un `YYYY-MM-DD` PELADO como día local.
 *
 * `new Date('2026-08-02')` se parsea como MEDIANOCHE UTC, y en cualquier zona al
 * oeste de Greenwich eso es el día anterior: en Bogotá, 1 de agosto a las 19:00. La
 * hoja de aplazar enseñaba «En 3 días · dom 2» en la casilla y «ahora sáb 1» en el
 * bloque negro, con un día de diferencia entre los dos.
 *
 * Se ancla al MEDIODÍA local, no a las 00:00: a mediodía ningún cambio de horario
 * de verano puede empujar la fecha al día de al lado. Las cadenas con hora —las que
 * vienen de la base con el convenio T05:00Z— se parsean tal cual, que ya son
 * instantes y no días.
 *
 * Es el mismo fallo que la nota de fechas del proyecto avisa que en desarrollo es
 * invisible porque la máquina corre en Bogotá y producción en UTC. Aquí se vio
 * porque las dos mitades de la pantalla lo mostraban distinto.
 */
function aFecha(v) {
  if (!v) return null
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v
  const s = String(v)
  const soloDia = /^\d{4}-\d{2}-\d{2}$/.exec(s)
  const d = soloDia ? new Date(`${s}T12:00:00`) : new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

/** «viernes 31 de julio». Sin año: en estas pantallas todo pasa este mes o el
    siguiente, y el año solo hace la línea más larga. */
export function fechaLarga(iso) {
  const d = aFecha(iso)
  if (!d) return null
  return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
}

/** «vie 31». Para las casillas de «¿para cuándo?», donde no cabe más. */
export function fechaCorta(iso) {
  const d = aFecha(iso)
  if (!d) return null
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' }).replace('.', '')
}

/* ══ T13-01 · Recargo ══════════════════════════════════════════════════════
   El titular es EL SALDO, no la cuota. Un recargo hace `totalAPagar += monto` y
   la cuota no se toca, así que con la cuota arriba salían dos veces el mismo
   número, uno tachado.

   Y las dos líneas de abajo son la respuesta a la pregunta del cobrador —qué le
   pido mañana—: lo mismo, durante N cobros más. */
export function adaptarRecargo(p, monto, pais) {
  const m = Math.max(0, Math.round(Number(monto) || 0))
  const saldo = aNumero(p?.saldoPendiente)
  const cuota = Math.round(Number(p?.cuotaDiaria ?? 0))
  if (!Number.isFinite(saldo)) return null
  // SIN MONTO NO HAY BLOQUE. Con 0 salía «$480.000 tachado → $480.000»: el mismo
  // número a los dos lados, uno tachado, que se lee como una avería. Lo vi al abrir
  // la hoja en la app. Este bloque proyecta un cambio; sin cambio no hay nada que
  // proyectar, y una caja negra vacía es menos ruido que una que se contradice.
  if (!(m > 0)) return null

  return {
    saldoAntes: formatMoney(Math.round(saldo), pais),
    saldoDespues: formatMoney(Math.round(saldo + m), pais),
    cuotaIgual: cuota > 0 ? `sigue en ${formatMoney(cuota, pais)}` : null,
    // Cuántos cobros MÁS. Se redondea hacia arriba porque el último cobro parcial
    // también es un viaje que el cobrador tiene que hacer.
    cobrosDeMas: cuota > 0 && m > 0 ? (() => {
      const n = Math.ceil(m / cuota)
      return `${n} ${n === 1 ? 'cobro' : 'cobros'} más`
    })() : null,
  }
}

/** Los atajos de recargo. Salen de la CUOTA del préstamo, no de una lista fija:
    $5.000 es un recargo razonable con cuota de $20.000 y una broma con cuota de
    $400.000. La lámina dibuja 5/10/15 mil porque su ejemplo tiene cuota $14.500. */
/* ══ EL 15 % LO CALCULA EL SISTEMA, NO LA PERSONA ═══════════════════════════
   Un prestamista (5 sep 2026): «el cliente me debía 2.070, me abonó 600, quedó
   en 1.470, necesito a ese saldo sumarle el 15 %». Escribió eso en el buscador
   y no encontró nada; y la hoja de recargo solo aceptaba una cifra, así que el
   15 % lo tenía que sacar él con la calculadora. El dueño: «si no, qué gracia
   tendría pagarnos por un sistema que no hace esos cálculos».

   Sobre el SALDO PENDIENTE —lo que le falta pagar, con intereses—, que es «lo
   que ya debe». Redondeado a $100, como todo el dinero de este sistema. */
export function montoDesdePorcentaje(saldo, porcentaje) {
  const s = aNumero(saldo)
  const p = aNumero(porcentaje)
  if (!(s > 0) || !(p > 0)) return 0
  return Math.max(100, Math.round((s * p) / 100 / 100) * 100)
}

export function atajosDeRecargo(p, pais) {
  const cuota = Math.round(Number(p?.cuotaDiaria ?? 0))
  if (!(cuota > 0)) return [{ id: 'otro', etiqueta: 'Otro' }]
  // Media cuota, una cuota, dos cuotas. Redondeadas a $100 como todo el dinero
  // de este sistema.
  const redondo = (n) => Math.max(100, Math.round(n / 100) * 100)
  const valores = [redondo(cuota / 2), redondo(cuota), redondo(cuota * 2)]
  const vistos = new Set()
  const atajos = []
  for (const v of valores) {
    if (vistos.has(v)) continue
    vistos.add(v)
    atajos.push({ id: `m${v}`, etiqueta: formatMoney(v, pais), monto: v })
  }
  atajos.push({ id: 'otro', etiqueta: 'Otro' })
  return atajos
}

/* ══ T19-03 · Perdonarle una parte ═════════════════════════════════════════
   VERDE en «le queda debiendo», y no es una contradicción con «acabas de regalar
   plata»: esa fila mide LO QUE DEBE EL CLIENTE, y eso baja. Lo que le pasa al
   dueño lo dicen las dos líneas de abajo, que son las que la lámina quiere que se
   vean: tu ganancia baja a X de Y, tu capital lo sigues recuperando.

   El tope es real y lo pone el servidor: un descuento mayor que
   `totalAPagar − totalPagado` se rechaza con DESCUENTO_EXCESIVO. Se dice ANTES,
   no después de que el dueño le prometió el perdón al cliente. */
export function adaptarDescuento(p, monto, pais) {
  const m = Math.max(0, Math.round(Number(monto) || 0))
  const saldo = aNumero(p?.saldoPendiente)
  const capital = aNumero(p?.montoPrestado)
  const total = aNumero(p?.totalAPagar)
  if (!Number.isFinite(saldo)) return null

  const gananciaPactada = Number.isFinite(total) && Number.isFinite(capital)
    ? Math.max(0, total - capital) : null

  // Mismo criterio que el recargo: sin monto no se proyecta.
  if (!(m > 0)) return null

  return {
    debeAntes: formatMoney(Math.round(saldo), pais),
    debeDespues: formatMoney(Math.max(0, Math.round(saldo - m)), pais),
    gananciaLinea: gananciaPactada != null
      ? `${formatMoney(Math.max(0, gananciaPactada - m), pais)} de ${formatMoney(gananciaPactada, pais)}`
      : null,
    // «Sigues recuperando tus $500.000» — pero SOLO mientras el descuento no se
    // coma la ganancia entera. Pasado eso, el dueño empieza a perder capital y
    // decirle que lo recupera sería mentira.
    capitalLinea: Number.isFinite(capital)
      ? (gananciaPactada != null && m > gananciaPactada
          ? `pierdes ${formatMoney(m - gananciaPactada, pais)} de capital`
          : `tus ${formatMoney(Math.round(capital), pais)}`)
      : null,
    // El tope del servidor, dicho antes.
    tope: Math.max(0, Math.round(saldo)),
    excede: m > Math.round(saldo),
  }
}

/** Los atajos de descuento: todo el atraso, una cuota, otro. */
export function atajosDeDescuento(p, pais) {
  const atajos = []
  const mora = Math.round(Number(p?.montoEnMora ?? 0))
  const cuota = Math.round(Number(p?.cuotaDiaria ?? 0))
  const saldo = Math.round(Number(p?.saldoPendiente ?? 0))
  if (mora > 0 && mora <= saldo) atajos.push({ id: 'atraso', etiqueta: 'Todo el atraso', monto: mora })
  if (cuota > 0 && cuota <= saldo) atajos.push({ id: 'cuota', etiqueta: 'Una cuota', monto: cuota })
  atajos.push({ id: 'otro', etiqueta: 'Otro' })
  return atajos
}

/* ══ T13-02 · Modificar el plazo ═══════════════════════════════════════════
   LA LÍNEA QUE EVITA LA PELEA: «lo que vas a recibir es igual». Estirar el plazo
   reparte el mismo total en más cuotas; no cobra más intereses.

   ── LA FÓRMULA ES LA DEL ENDPOINT, NO UNA MÍA ──────────────────────────────

   Mi primera versión dividía `saldoPendiente` entre las cuotas que faltan. El que
   guarda hace otra cosa: `totalAPagar / períodos TOTALES desde la fecha de inicio`,
   redondeado a $50. Con mi fórmula la pantalla habría enseñado una cuota y el
   préstamo habría quedado con otra, en la hoja cuyo único motivo de existir es
   enseñar la consecuencia antes de confirmar.

   Y por eso «igual» no siempre es verdad: el redondeo a $50 por cuota mueve el
   total unos pesos. Cuando se mueve SE DICE, en vez de escribir «igual» sobre una
   cifra que cambió. */
export function adaptarPlazo(p, cuotasQueFaltan, pais) {
  const total = aNumero(p?.totalAPagar)
  const pendientes = aNumero(p?.cuotasPendientes)
  const n = Math.max(1, Math.round(Number(cuotasQueFaltan) || 0))
  if (!Number.isFinite(total) || !(total > 0)) return null

  const porPeriodo = DIAS_POR_PERIODO[p?.frecuencia] ?? 1
  const nombre = NOMBRE_CUOTA[p?.frecuencia] ?? { uno: 'cuota', varios: 'cuotas' }
  const cuotaActual = Math.round(Number(p?.cuotaDiaria ?? 0))

  // Los períodos ya corridos, para poder contar los TOTALES: el endpoint mide desde
  // la fecha de inicio, no desde hoy.
  const corridos = Number.isFinite(pendientes) && p?.diasPlazo
    ? Math.max(0, Math.ceil(Number(p.diasPlazo) / porPeriodo) - pendientes)
    : 0
  const totalesNuevos = Math.max(1, corridos + n)

  // La fórmula del endpoint, literal: media a $50 hacia el múltiplo más cercano y
  // mínimo $50.
  const cuotaDespues = Math.max(50, Math.round((total / totalesNuevos) / 50) * 50)
  const totalDespues = cuotaDespues * totalesNuevos

  // La fecha de fin se mueve tantos períodos como cuotas se añadan sobre las que
  // faltaban.
  const finAntes = aFecha(p?.fechaFin)
  const finDespues = finAntes && Number.isFinite(pendientes)
    ? new Date(finAntes.getTime() + (n - pendientes) * porPeriodo * 86400000)
    : null

  return {
    unidad: nombre.varios,
    cuotaAntes: cuotaActual > 0 ? formatMoney(cuotaActual, pais) : null,
    cuotaDespues: formatMoney(cuotaDespues, pais),
    // MEJORA cuando la cuota baja: es el hecho que mide esa fila.
    tono: cuotaActual > 0 && cuotaDespues < cuotaActual ? 'mejora' : 'neutro',
    terminaAntes: finAntes ? fechaCorta(finAntes.toISOString()) : null,
    terminaDespues: finDespues ? fechaCorta(finDespues.toISOString()) : null,
    // «igual: $130.500» solo cuando de verdad lo es. Si el redondeo lo movió, se
    // dice cuánto: escribir «igual» sobre una cifra que cambió es lo que convierte
    // una pantalla de confianza en una discusión.
    totalIgual: totalDespues === Math.round(total)
      ? `igual: ${formatMoney(Math.round(total), pais)}`
      : `${formatMoney(Math.round(total), pais)} → ${formatMoney(totalDespues, pais)}`,
    totalCambia: totalDespues !== Math.round(total),
    // No se puede bajar de las que ya faltan: eso sería ACORTAR el plazo, que es
    // otra operación y sube la cuota.
    minimo: Number.isFinite(pendientes) && pendientes > 0 ? pendientes : 1,
    cuotasAntes: Number.isFinite(pendientes) ? pendientes : null,
  }
}

/* ══ T19-01 · Aplazar el cobro ═════════════════════════════════════════════
   APLAZAR NO PERDONA EL ATRASO. La mora sigue contando desde el día que debió
   pagar; esto solo lo saca de la lista de hoy. Sin esa frase se usaría para tapar
   mora, y la mora tapada es la que se convierte en pérdida.

   Y las demás cuotas no se mueven: aplazar no es estirar el plazo. */
export function adaptarAplazar(p, fechaNueva, cobrasHoyAntes, cobrasHoyDespues, pais) {
  const actual = aFecha(p?.proximoCobro)
  const nueva = aFecha(fechaNueva)
  if (!nueva) return null

  const hoy = new Date()
  const esHoy = actual && actual.toDateString() === hoy.toDateString()

  return {
    cobrasAntes: actual
      ? (esHoy ? `hoy, ${fechaCorta(actual.toISOString())}` : fechaCorta(actual.toISOString()))
      : null,
    cobrasDespues: fechaCorta(nueva.toISOString()),
    // «$145.000 → $107.000»: lo que se cae de la lista de hoy. Solo si se sabe:
    // esa cifra la tiene la pantalla de cobrar hoy, no la ficha.
    cobrasHoyLinea: cobrasHoyAntes != null && cobrasHoyDespues != null
      ? `${formatMoney(Math.round(cobrasHoyAntes), pais)} → ${formatMoney(Math.round(cobrasHoyDespues), pais)}`
      : null,
  }
}

/** Las tres casillas de «¿para cuándo?»: mañana, en 3 días, otra fecha. Las dos
    primeras traen SU FECHA debajo, porque «en 3 días» obliga a contar y contar con
    el cliente delante es cómo se equivoca uno de día. */
export function cuandosDeAplazar(desde = new Date()) {
  const base = new Date(desde)
  const mas = (n) => new Date(base.getTime() + n * 86400000)
  return [
    { id: 'manana', etiqueta: 'Mañana', nota: fechaCorta(mas(1).toISOString()), fecha: mas(1) },
    { id: 'tres', etiqueta: 'En 3 días', nota: fechaCorta(mas(3).toISOString()), fecha: mas(3) },
    { id: 'otra', etiqueta: 'Otra fecha', nota: 'elegir' },
  ]
}

/* ══ T19-02 · El día de cobro ══════════════════════════════════════════════
   «PARA SIEMPRE, NO SOLO ESTA VEZ.» Es lo que la separa de aplazar.

   Los días sin cobro de la organización salen APAGADOS, no escondidos: si falta un
   día en la fila, el dueño se pregunta si la app está rota; apagado, entiende que
   él lo apagó y dónde cambiarlo.

   `diasSinCobro` se guarda como cadena —«0,6»— porque así está en el schema. Se
   parsea aquí y no en el componente para que la pantalla no tenga que saberlo. */
export function diasDeCobro(p, diasSinCobroCrudo) {
  // EL FORMATO ES UN ARRAY JSON EN CADENA: `"[]"`, `"[0,6]"`. Lo comprobé contra la
  // base, porque lo había supuesto separado por comas y eso habría dejado los
  // apagados sin detectar en todas las organizaciones. Se acepta también la lista
  // con comas y el array de verdad: tres formas de lo mismo cuestan seis líneas y
  // evitan que esto se rompa si algún día cambia una de las tres vías de escritura.
  //
  // OJO con lo que significa: `lib/calculos` solo aplica `diasSinCobro` a la
  // frecuencia DIARIA. En semanal y quincenal —donde vive esta pantalla— el motor lo
  // ignora. Se apagan igual, porque elegir como día fijo de cobro un día que el
  // dueño declaró que no trabaja es una contradicción, la aplique el motor o no.
  const apagados = new Set(
    (() => {
      if (Array.isArray(diasSinCobroCrudo)) return diasSinCobroCrudo
      const t = String(diasSinCobroCrudo ?? '').trim()
      if (!t) return []
      if (t.startsWith('[')) {
        try {
          const j = JSON.parse(t)
          return Array.isArray(j) ? j : []
        } catch { return [] }
      }
      return t.split(',')
    })()
      .map((x) => String(x).trim())
      .filter(Boolean)
      .map(aNumero)
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
  )
  // La fila empieza en LUNES, como un calendario, no en domingo: el domingo al
  // principio deja la semana laboral partida por la mitad.
  const orden = [1, 2, 3, 4, 5, 6, 0]
  return orden.map((id) => {
    const d = DIAS_SEMANA.find((x) => x.id === id)
    return { ...d, apagado: apagados.has(id) }
  })
}

export function adaptarDiaDeCobro(p, diaNuevo, proximoCobroNuevo, diasSinCobroCrudo) {
  const actual = aNumero(p?.diaCobroSemana)
  const nombreDe = (id) => DIAS_SEMANA.find((x) => x.id === id)?.nombre ?? null
  const apagados = diasDeCobro(p, diasSinCobroCrudo).filter((d) => d.apagado)

  return {
    cobraAntes: Number.isInteger(actual) ? nombreDe(actual) : null,
    cobraDespues: nombreDe(Number(diaNuevo)),
    proximoCobro: proximoCobroNuevo ? fechaLarga(proximoCobroNuevo) : null,
    // «Hoy le cobras los martes. Domingo está apagado en tu configuración.»
    nota: [
      Number.isInteger(actual) ? `Hoy le cobras los ${nombreDe(actual)}.` : null,
      apagados.length > 0
        ? `${apagados.map((d) => d.nombre[0].toUpperCase() + d.nombre.slice(1)).join(' y ')} ${apagados.length === 1 ? 'está' : 'están'} apagado${apagados.length === 1 ? '' : 's'} en tu configuración.`
        : null,
    ].filter(Boolean).join(' ') || null,
  }
}

/* ══ T13-03 · Mover a perdidos ═════════════════════════════════════════════
   Lo único de las ocho donde el ROJO es el color correcto: la cartera baja de
   verdad y esa plata se registra como pérdida del mes.

   «A veces la respuesta es que nadie fue.» La línea de contacto es la que convierte
   una decisión de cabreo en una decisión informada, y se calla si no se sabe: decir
   «le escribiste hace 0 días» cuando no hay dato es peor que no decir nada. */
export function adaptarPerdidos(p, carteraActual, ultimoMensaje, ultimaVisita, pais) {
  const enJuego = aNumero(p?.saldoPendiente)
  if (!Number.isFinite(enJuego)) return null

  const dias = (iso) => {
    const d = aFecha(iso)
    if (!d) return null
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000))
  }
  const dMsg = dias(ultimoMensaje)
  const dVis = dias(ultimaVisita)

  const mes = new Date().toLocaleDateString('es-CO', { month: 'long' })

  return {
    montoEnJuego: formatMoney(Math.round(enJuego), pais),
    contactoLinea: (dMsg == null && dVis == null)
      ? 'No hay registro de que se le haya escrito ni visitado.'
      : [
          dMsg != null ? `Le escribiste hace ${dMsg} ${dMsg === 1 ? 'día' : 'días'}` : 'Nunca le escribiste',
          dVis != null ? `lo visitaron hace ${dVis}` : 'nadie lo ha visitado',
        ].join(' · '),
    carteraAntes: Number.isFinite(aNumero(carteraActual))
      ? formatMoney(Math.round(aNumero(carteraActual)), pais) : null,
    carteraDespues: Number.isFinite(aNumero(carteraActual))
      ? formatMoney(Math.round(aNumero(carteraActual) - enJuego), pais) : null,
    perdidaEtiqueta: `Pérdida de ${mes}`,
    perdidaValor: formatMoney(Math.round(enJuego), pais),
  }
}

export const MOTIVOS_PERDIDA = [
  { id: 'mudo', etiqueta: 'Se mudó' },
  { id: 'nocontesta', etiqueta: 'No contesta' },
  { id: 'niega', etiqueta: 'Se niega a pagar' },
  { id: 'otro', etiqueta: 'Otro' },
]

/* ══ T19-04 · Cerrar anticipado ════════════════════════════════════════════
   Éste sí está modelado: `calcularLiquidacionAnticipada` decide los montos y el
   endpoint acepta el tipo `liquidacion`. Aquí solo se le pone la frase.

   ── LAS ETIQUETAS DE LA LÁMINA NO SE PUEDEN USAR TAL CUAL ──────────────────

   La lámina ofrece «Solo el capital que debe» / «Todo lo pactado» / «Un punto
   medio». Pero el modelo NO calcula «solo capital»: calcula capital MÁS el interés
   que ya se devengó, en dos modalidades —el mes en curso completo, o prorrateado
   por días—. Poner «solo el capital que debe» sobre una cifra que lleva interés
   dentro sería mentir sobre plata en la pantalla donde se cierra un préstamo, y el
   cliente que sume por su cuenta va a notar la diferencia.

   Así que se enseñan las tres que EXISTEN, ordenadas de la que más perdona a la que
   menos, y cada una dice cuánto interés perdona:

     proporcional   interés exacto por los días transcurridos     perdona más
     mes completo   el mes en curso cuenta entero
     todo lo pactado  el saldo tal cual                            no perdona nada

   La tercera es la de la lámina, literal. Las dos primeras son lo que la lámina
   llamaba «solo el capital» y «un punto medio», con el nombre correcto.

   Y si el modo es `manual` o `saldo`, el propio cálculo se marca `aproximado`: eso
   se dice, porque cerrar por una cifra aproximada y no avisar es cómo se generan
   las discusiones que acaban en el préstamo reabierto. */
export function adaptarCerrar(liq, pais) {
  if (!liq) return null
  const saldo = aNumero(liq?.saldoActual)
  const filas = [
    ['proporcional', liq?.proporcional, 'Prorrateado por días'],
    ['mesCompleto', liq?.mesCompleto, 'Contando el mes completo'],
  ]

  const opciones = []
  for (const [id, m, etiqueta] of filas) {
    const monto = aNumero(m?.restanteHoy)
    if (!Number.isFinite(monto)) continue
    const perdona = Number(m?.interesPerdonado ?? 0)
    opciones.push({
      id,
      etiqueta,
      nota: perdona > 0
        ? `Le perdonas ${formatMoney(Math.round(perdona), pais)} de interés que no llegó a correr`
        : 'No queda interés futuro por perdonar',
      valor: formatMoney(Math.round(monto), pais),
      monto: Math.round(monto),
      perdona: Math.round(perdona),
    })
  }

  /* «Todo lo pactado», la de la lámina literal. Va siempre que se sepa el saldo:
     es la opción de no perdonar nada, y tiene que estar para que las otras dos se
     entiendan como lo que son.

     ⚠ SALVO EN EL ABIERTO, DONDE NO HAY «TODO LO PACTADO». Ese préstamo no tiene
     final del plazo —es su razón de ser— y su saldo NO incluye el interés que está
     corriendo, así que esta opción saldría la más barata de las tres y cerraría el
     préstamo sin cobrar el mes en curso. O sea: el hueco que se acaba de tapar,
     servido como opción del menú y encima la primera de la lista. */
  if (Number.isFinite(saldo) && !liq?.abierto) {
    opciones.push({
      id: 'todo',
      etiqueta: 'Todo lo pactado',
      nota: 'Como si pagara hasta el final del plazo',
      valor: formatMoney(Math.round(saldo), pais),
      monto: Math.round(saldo),
      perdona: 0,
    })
  }

  // De la que más perdona a la que menos: así la primera es la más barata para el
  // cliente y la última la que más deja al dueño, que es el orden en que se decide.
  opciones.sort((a, b) => a.monto - b.monto)

  // SIN OPCIONES REPETIDAS. En un préstamo que ya pasó su plazo el interés está todo
  // devengado, así que las tres modalidades dan LA MISMA cifra: el préstamo de prueba
  // enseñaba tres filas de $480.000 con tres nombres distintos, que es una elección
  // falsa. Se queda la última —la que no promete perdonar nada—, porque cuando no hay
  // interés futuro que perdonar, decir «le perdonas $0» sobra.
  const porMonto = new Map()
  for (const o of opciones) porMonto.set(o.monto, o)
  const unicas = [...porMonto.values()]

  return {
    opciones: unicas,
    // Cuando se colapsan todas, la pantalla deja de ser una elección y pasa a ser una
    // confirmación. Quien la monta lo necesita para no enseñar un selector de una
    // sola opción, que es una pregunta cuya respuesta ya se sabe.
    sinEleccion: unicas.length <= 1,
    // Se marca aparte y no como una opción más: no es una alternativa, es una
    // advertencia sobre TODAS.
    aproximado: Boolean(liq?.aproximado),
    modo: liq?.modo ?? null,
  }
}

/** El bloque «si cierra hoy», para la opción elegida.

    `dejasDeGanar` es el interés perdonado que trae el propio cálculo —no una resta
    mía—, y `gananciaTotal` es el interés devengado de esa modalidad. Las dos vienen
    del modelo; lo único que se hace aquí es formatearlas. Si falta una, se calla:
    son las cifras que pueden hacer cambiar de opinión. */
export function resumenCerrar(liq, idOpcion, pais) {
  const m = liq?.[idOpcion]
  const monto = idOpcion === 'todo'
    ? aNumero(liq?.saldoActual)
    : aNumero(m?.restanteHoy)
  if (!Number.isFinite(monto)) return null

  const perdonado = idOpcion === 'todo' ? 0 : aNumero(m?.interesPerdonado)
  const devengado = idOpcion === 'todo'
    ? aNumero(liq?.interesTotalPactado)
    : aNumero(m?.interesDevengado)

  return {
    recibes: formatMoney(Math.round(monto), pais),
    dejasDeGanar: Number.isFinite(perdonado) && perdonado > 0
      ? formatMoney(Math.round(perdonado), pais) : null,
    gananciaTotal: Number.isFinite(devengado)
      ? formatMoney(Math.round(devengado), pais) : null,
    // No «hoy, no en 3 meses»: el plazo que falta depende del préstamo, y decir
    // «3 meses» a quien le faltan dos semanas es inventarse el dato.
    cuandoVuelve: 'hoy, no al final del plazo',
  }
}

/* ══ T19-05 · Corregir el préstamo ═════════════════════════════════════════
   La pantalla más peligrosa: se parte en lo que RECALCULA los pagos hacia atrás y
   lo que no. La consecuencia va CAMPO POR CAMPO con el número de pagos real — un
   aviso genérico se lee una vez y se olvida. */
/* ── LA LÁMINA Y EL CÓDIGO NO ESTÁN DE ACUERDO, Y EL CÓDIGO TIENE RAZÓN ──────
   T19-05 dibuja el monto y el interés EDITABLES con 22 pagos encima, avisando de que
   «recalcula 22 pagos». El modal de verdad los BLOQUEA en cuanto hay un pago, y su
   comentario dice por qué: «cambiarlos recalculaba mal (re-cobraba interés) e
   inflaba la deuda». O sea que la lámina, construida tal cual, reintroduciría un bug
   de plata que ya se arregló prohibiéndolo.

   Así que se queda la FORMA de la lámina —los campos agrupados, con su consecuencia
   al lado campo por campo— y la SEGURIDAD del código: con pagos, la pastilla dice
   «Bloqueado: ya hay 22 pagos» en vez de prometer un recálculo que no va a pasar.
   Sin pagos, corregir es seguro y se dice.

   El `bloqueado` que devuelve esta función es lo que el montaje usa para decidir si
   los campos se pueden tocar, así que la pantalla y la regla no se pueden separar. */
export function adaptarCorregir(p, pais) {
  const pagos = (p?.pagos ?? []).filter((x) => !['recargo', 'descuento'].includes(x?.tipo)).length
  const bloqueado = pagos > 0
  const recalcula = bloqueado
    ? `Bloqueado: ya hay ${pagos} ${pagos === 1 ? 'pago' : 'pagos'}`
    : 'Recalcula el préstamo'

  const capital = aNumero(p?.montoPrestado)
  const tasa = aNumero(p?.tasaInteres)

  return {
    bloqueado,
    aviso: bloqueado
      ? `Ya hay ${pagos} ${pagos === 1 ? 'pago' : 'pagos'} registrados, así que el monto y el interés no se pueden tocar: cambiarlos recalcularía la deuda hacia atrás y la inflaría. Para renegociar están las otras siete hojas.`
      : 'Todavía no hay pagos registrados: corregir un dato mal metido es seguro. Esto es para arreglar errores de digitación, no para renegociar.',
    peligrosos: [
      Number.isFinite(capital)
        ? { clave: 'monto', etiqueta: 'Monto prestado', valor: formatMoney(Math.round(capital), pais), consecuencia: recalcula }
        : null,
      Number.isFinite(tasa)
        ? { clave: 'interes', etiqueta: 'Interés', valor: `${tasa}%`, consecuencia: recalcula }
        : null,
      p?.fechaInicio
        ? {
            clave: 'inicio', etiqueta: 'Fecha de inicio',
            valor: fechaLargaConAno(p.fechaInicio),
            // La fecha SÍ se puede corregir con pagos: mueve el calendario, no
            // recalcula lo cobrado. Es la única de las tres que sigue viva.
            consecuencia: 'Mueve las fechas', texto: true,
          }
        : null,
    ].filter(Boolean),
    pagosAfectados: pagos,
  }
}

/** «4 de julio de 2026». Con año, a diferencia del resto: en la fecha de inicio el
    año SÍ importa, porque el error de digitación típico es justo el año. */
export function fechaLargaConAno(iso) {
  const d = aFecha(iso)
  if (!d) return null
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
}
