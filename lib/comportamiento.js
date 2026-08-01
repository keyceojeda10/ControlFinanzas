// lib/comportamiento.js — los 12 meses de un cliente.
//
// ══ QUE MIDE, Y POR QUE ASI ════════════════════════════════════════════════
//
// La barra de T15-01 dice «cumplió 92%» mes a mes. El «cumplimiento» que ya
// existe en la app (`/api/clientes`) mira HOY —de las cuotas que ya debian
// estar pagadas, cuantas lo estan— y por eso no sirve hacia atras: no se puede
// preguntar «cuantas cuotas debia en marzo» a una formula que solo sabe de hoy.
//
// Se necesitaba entonces un «cuanto le tocaba pagar en el mes M». Medido contra
// la cartera real el 1 de agosto de 2026:
//
//     5.097 prestamos activos · 406 con tabla de amortizacion (8%)
//     30.636 pagos en los ultimos 12 meses
//
// Es decir: comparar contra las cuotas guardadas seria exacto al peso y dejaria
// la barra VACIA para el 92% de los clientes. Asi que:
//
//     cumplio(M) = pagado en M ÷ (cuota × cobros que tocaban en M)
//
// Lo pagado es dato duro. Lo que tocaba se deriva del calendario que la app ya
// usa: `obtenerDiasPorPeriodo(frecuencia)` para el paso, y los dias sin cobro de
// la organizacion descontados cuando el cobro es diario.
//
// ⚠ ES UNA APROXIMACION, Y SE DICE: no reconstruye festivo por festivo ni los
// aplazamientos uno a uno. Sirve para leer la TENDENCIA —que es para lo que
// existe la barra— no para liquidar una deuda. Ninguna pantalla debe cobrar
// nada a partir de esto.

import { obtenerDiasPorPeriodo } from './calculos'

const INICIALES = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

// Los dias sin cobro llegan como nombres ('domingo'); aqui hacen falta indices
// de `Date.getDay()`, donde 0 es domingo.
const DIA_A_INDICE = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, miércoles: 3,
  jueves: 4, viernes: 5, sabado: 6, sábado: 6,
}

/** Los 12 meses que se pintan, del mas viejo al mas nuevo. */
export function mesesDe(hasta) {
  const fin = new Date(hasta)
  const salida = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth() - i, 1))
    salida.push({
      anio: d.getUTCFullYear(),
      mes: d.getUTCMonth(),
      etiqueta: INICIALES[d.getUTCMonth()],
      desde: d,
      // El dia 0 del mes siguiente es el ultimo de este, y asi no hay que saber
      // cuantos dias tiene febrero. Una prueba de esta casa ya se rompio por
      // construir un 31 de abril a mano.
      //
      // ── EL MES EN CURSO SE CORTA HOY, NO A FIN DE MES ──
      // Medido contra datos reales: el 1 de agosto la barra pedia los 806.000
      // del mes ENTERO y el cliente salia «cumpliendo el 1%» por llevar un dia.
      // Un prestamista que vea eso cree que se le cayo, y actua. Lo que aun no
      // ha vencido no se puede contar como incumplido.
      hasta: (() => {
        const finDeMes = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999))
        return finDeMes > fin ? fin : finDeMes
      })(),
    })
  }
  return salida
}

/** Cuantos dias del mes caen dentro de la vida del prestamo, sin dias sin cobro. */
export function diasCobrablesEnMes({ desde, hasta }, prestamo, diasSinCobro = []) {
  const inicio = prestamo.fechaInicio ? new Date(prestamo.fechaInicio) : null
  if (!inicio) return 0

  // El prestamo solo cuenta desde que empezo y hasta que se cerro.
  const fin = prestamo.fechaCierre ? new Date(prestamo.fechaCierre) : null
  const desdeReal = inicio > desde ? inicio : desde
  const hastaReal = fin && fin < hasta ? fin : hasta
  if (desdeReal > hastaReal) return 0

  const excluidos = new Set(
    (diasSinCobro || [])
      .map((d) => DIA_A_INDICE[String(d).toLowerCase()])
      .filter((n) => n !== undefined),
  )

  let dias = 0
  const cursor = new Date(Date.UTC(
    desdeReal.getUTCFullYear(), desdeReal.getUTCMonth(), desdeReal.getUTCDate(),
  ))
  const tope = new Date(Date.UTC(
    hastaReal.getUTCFullYear(), hastaReal.getUTCMonth(), hastaReal.getUTCDate(),
  ))
  while (cursor <= tope) {
    if (!excluidos.has(cursor.getUTCDay())) dias++
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dias
}

/** Lo que tocaba pagar en el mes por UN prestamo. */
export function esperadoDelMes(mes, prestamo, diasSinCobro = []) {
  const cuota = Number(prestamo.cuotaDiaria) || 0
  if (cuota <= 0) return 0

  const paso = obtenerDiasPorPeriodo(prestamo.frecuencia) || 1

  // ── LOS DIAS SIN COBRO SOLO SE DESCUENTAN EN EL DIARIO ──
  // En un prestamo semanal la cuota no cambia porque el domingo no se cobre: se
  // corre al lunes. Descontarlos ANTES de dividir entre 7 le quitaba una semana
  // entera al mes —de 4 cobros a 3, un 25% de menos— y el cliente saldria
  // incumpliendo por un domingo que a el no le afecta.
  const dias = diasCobrablesEnMes(mes, prestamo, paso === 1 ? diasSinCobro : [])
  if (dias <= 0) return 0

  return cuota * (paso === 1 ? dias : Math.floor(dias / paso))
}

/* ── Los tres estados de la barra ───────────────────────────────────────────
   Los cortes NO salen de la lamina, que solo pinta colores. Se eligen para que
   digan lo que un prestamista entiende:

     bien  ≥ 90  — cerro el mes
     tarde 60-89 — pago, pero no todo
     mal   < 60  — se le fue de las manos

   Si se cambian, se cambian AQUI y en ningun otro sitio. */
export function estadoDe(cumplio) {
  if (cumplio === null) return 'sin'
  if (cumplio >= 90) return 'bien'
  if (cumplio >= 60) return 'tarde'
  return 'mal'
}

/**
 * Los 12 meses listos para la barra.
 *
 * @param {object[]} prestamos - con fechaInicio, fechaCierre, cuotaDiaria, frecuencia
 * @param {object[]} pagos     - con fechaPago y montoPagado
 */
export function comportamiento12Meses({ prestamos = [], pagos = [], diasSinCobro = [], hasta = new Date() } = {}) {
  const meses = mesesDe(hasta)

  return meses.map((m) => {
    const pagado = pagos.reduce((suma, p) => {
      const f = new Date(p.fechaPago)
      return f >= m.desde && f <= m.hasta ? suma + (Number(p.montoPagado) || 0) : suma
    }, 0)

    const esperado = prestamos.reduce(
      (suma, p) => suma + esperadoDelMes(m, p, diasSinCobro), 0,
    )

    // Sin nada que pagar ese mes no hay nada que cumplir: `null`, no 0%. Un 0%
    // en un mes en que el cliente ni tenia prestamo lo pinta como moroso, y es
    // justo al reves. Es la misma regla que ya usa `/api/clientes`.
    const cumplio = esperado > 0
      // Se recorta a 100: pagar de mas es adelantarse, no cumplir el 340%. La
      // barra se leeria rota y el numero diria algo que no es.
      ? Math.min(100, Math.round((pagado / esperado) * 100))
      : null

    return {
      etiqueta: m.etiqueta,
      cumplio,
      estado: estadoDe(cumplio),
      pagado: Math.round(pagado),
      esperado: Math.round(esperado),
    }
  })
}

/**
 * La frase de debajo de la barra. Describe lo que se ve; no aconseja ni predice.
 *
 * «Pagaba tarde pero cerraba el mes. Desde mayo viene fallando» es lo que la
 * lamina pide: que el prestamista no tenga que interpretar doce barras.
 */
export function lecturaDe(meses = [], nombresMes = INICIALES) {
  const conDato = meses.filter((m) => m.cumplio !== null)
  if (conDato.length < 3) return 'Todavía no hay historial suficiente para leer una tendencia.'

  const ultimos = conDato.slice(-3)
  const previos = conDato.slice(0, -3)
  const media = (xs) => Math.round(xs.reduce((s, m) => s + m.cumplio, 0) / xs.length)

  const mediaUltimos = media(ultimos)
  if (!previos.length) {
    return mediaUltimos >= 90 ? 'Viene cumpliendo.' : 'Viene fallando.'
  }
  const mediaPrevios = media(previos)
  const salto = mediaUltimos - mediaPrevios

  // El primero de los ultimos tres que se torcio, para poder decir «desde X».
  const desde = ultimos.find((m) => m.cumplio < 90)
  const nombre = desde
    ? { E: 'enero', F: 'febrero', M: 'marzo', A: 'abril', J: 'junio', S: 'septiembre', O: 'octubre', N: 'noviembre', D: 'diciembre' }[desde.etiqueta]
    : null

  if (salto <= -20) {
    return nombre
      ? `Venía cumpliendo. Desde ${nombre} viene fallando.`
      : 'Venía cumpliendo y últimamente viene fallando.'
  }
  if (salto >= 20) return 'Venía fallando y últimamente se ha puesto al día.'
  if (mediaUltimos >= 90) return 'Cumple mes a mes.'
  if (mediaUltimos >= 60) return 'Paga, pero rara vez cierra el mes completo.'
  return 'Lleva meses sin cerrar el mes.'
}
