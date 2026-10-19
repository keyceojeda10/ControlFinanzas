// lib/adaptadores/actividad.js — T32-03 «quién hizo qué».
//
// ══ TRECE FILAS QUE DICEN LO MISMO ══════════════════════════════════════════
//
// La pantalla de hoy pinta un suceso por fila, y el resultado real —medido en
// la cartera de prueba— son TRECE renglones seguidos que dicen «Carlos Andres
// registró pago». Leerlos uno a uno no aporta nada: lo que el dueño necesita
// saber es que se registraron trece pagos, y en cuánto tiempo.
//
// La lámina lo dice con una fila: «Registró 4 pagos en un minuto».
//
// ══ Y EL CASO QUE DE VERDAD IMPORTA ═════════════════════════════════════════
//
// El otro agrupamiento no es de comodidad, es de auditoría: «Cambió 3 veces el
// día de cobro del mismo préstamo · siempre a "mensual"». Tres cambios sueltos
// en la lista pasan desapercibidos; agrupados son una pregunta — o algo no está
// guardando bien, o alguien está probando el sistema.
//
// Por eso `paraRevisar()` existe: el agrupamiento no solo comprime, también
// detecta.

import { formatMoney, getUtcOffset, inicioDiaLocal } from '@/lib/i18n'

// Cuánto tiempo puede pasar entre dos sucesos para seguir siendo «la misma
// tanda». Cinco minutos: un cobrador registrando la ruta de la mañana entra en
// esa ventana; dos pagos separados por media hora son dos visitas distintas.
const VENTANA_MS = 5 * 60 * 1000

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

// ── EL MONTO NO ES UNA COLUMNA ──
//
// PENDIENTE-BACKEND. `ActividadLog` guarda `accion`, `entidadTipo`, `entidadId`
// y un `detalle` de texto libre. NO hay campo de monto, asi que la columna que
// pide la lamina no se puede leer: hay que sacarla del texto.
//
// Se saca, y no es inventar: ese texto lo escribio la propia app a partir de la
// cifra real («Pago completo $20.000»). Pero es un apaño — el dia que alguien
// cambie el formato del detalle, la columna se queda muda. Lo correcto es una
// columna `monto Float?` en el modelo, escrita donde ya se escribe el detalle.
//
// Solo se acepta UN importe por texto. Si hay dos —«de $20.000 a $30.000»— no
// se sabe cual es el movimiento, y una cifra equivocada en una pantalla de
// auditoria es peor que ninguna.
export function montoDeDetalle(detalle) {
  if (!detalle) return 0
  const hallados = String(detalle).match(/\$\s?[\d.,]+/g)
  if (!hallados || hallados.length !== 1) return 0
  const n = Number(hallados[0].replace(/[^\d]/g, ''))
  return Number.isFinite(n) ? n : 0
}

// ── HACIA DÓNDE VA LA PLATA DE UN SUCESO ──
//
// La fila pintaba TODO importe como «+$X» en verde: `montoDeDetalle` devuelve el
// valor absoluto y nadie le ponía signo. Así «registró 2 gastos» salía «+$31.220»
// y «eliminó un préstamo» «+$500.000», en el color que en este sistema significa
// que ENTRÓ plata. El signo solo existía en `resumenDelDia`, con una lista que
// además nombraba una acción que no existe (`retiro_capital`).
//
// Medido contra el historial real (19 sep 2026, 30 días): solo estas acciones
// dicen su sentido. Las de capital y caja manual lo llevan en el TEXTO, escrito
// por la propia app («retiro salida …», «inyeccion entrada …»). Todo lo demás
// —cierres, renovaciones, ediciones, borrados, cuadres— lleva un importe pero
// no es plata que entre ni salga: va SIN signo y sin verde. Un cierre de caja son
// los mismos billetes de los pagos que cierra; pintarlo «+» invita a sumarlo dos
// veces.
const ENTRA = ['registrar_pago', 'registrar_aporte']
const SALE = ['crear_prestamo', 'registrar_gasto']
const SEGUN_EL_TEXTO = ['movimiento_capital', 'movimiento_caja_manual']

/** 'entra' | 'sale' | 'neutro' */
export function sentidoDe(accion, detalle) {
  if (ENTRA.includes(accion)) return 'entra'
  if (SALE.includes(accion)) return 'sale'
  if (SEGUN_EL_TEXTO.includes(accion)) {
    const t = String(detalle ?? '').toLowerCase()
    if (/\bsalida\b/.test(t)) return 'sale'
    if (/\bentrada\b/.test(t)) return 'entra'
    // Las filas más viejas no decían la dirección («capital_inicial $1.000.000»):
    // ahí la dice el tipo.
    if (/^(capital_inicial|inyeccion)\b/.test(t)) return 'entra'
    if (/^retiro\b/.test(t)) return 'sale'
  }
  return 'neutro'
}

// ══ LO QUE CADA SUCESO DICE, CON LAS PALABRAS DEL DUEÑO ═════════════════════
//
// QA, 19 oct 2026, con el dueño mirando el negocio de demostración. El Historial
// decía:
//
//   «Sofía Restrepo movimiento de capital · inyeccion entrada $500.000 - Plata…»
//   «Sofía Restrepo registró pago · Pago abono capital $100.000»
//   «Ruta "Ruta Sur" eliminada; 0 cliente(s) quedaron sin ruta»
//   «Sofía Restrepo creó cobrador · Cobrador Jhon Jairo Pérez creado»
//
// `inyeccion`, `entrada`, `capital_inicial`, «cliente(s)»: son los códigos y las
// plantillas con que cada endpoint ANOTA (`logActividad`), y la pantalla los
// pintaba tal cual.
//
// Se traducen AL PINTAR, no al anotar: así se leen bien también las filas que ya
// están escritas —en el espejo, 1.577 movimientos de capital y 72.857 pagos— y
// que nadie va a reescribir. Cada lector reconoce el formato EXACTO que escribe
// su endpoint (citado al lado). Si no lo reconoce devuelve `null` y la fila sale
// con su texto de siempre: un formato nuevo que nadie enseñó a leer se ve como
// antes, nunca vacío ni inventado.
//
// ⚠ NO SE PIERDE NADA de lo que decía el texto viejo: el importe, la
// descripción, la fecha de la caja y los nombres siguen ahí. Lo único que se cae
// es el id interno del préstamo en «Anuló pago … del préstamo cmve1e…», que no
// le dice nada a nadie.
//
// ⚠ EL IMPORTE DE LA COLUMNA SE SIGUE SACANDO DEL TEXTO ORIGINAL
// (`montoDeDetalle(item.detalle)`), no de la frase: la frase es para leer, y
// cambiarla no puede mover ninguna cifra.

// Los nombres de `MovimientoCapital.tipo`, los de la pestaña Capital
// (`components/capital/CapitalTab.jsx`), pero contados: allí se le habla al
// dueño («Metiste plata»); aquí se cuenta lo que hizo alguien.
const TIPO_MOVIMIENTO = {
  capital_inicial: 'Capital inicial',
  inyeccion: 'Plata metida',
  retiro: 'Retiro',
  desembolso: 'Prestado',
  recaudo: 'Cobrado',
  gasto: 'Gasto',
  ajuste: 'Ajuste',
}

// Qué hizo, según el tipo. `capital` es la pestaña Capital (`/api/capital`);
// `caja` es el mismo movimiento hecho desde la Caja (`/api/caja/ajustes`).
const FRASE_MOVIMIENTO = {
  capital: {
    inyeccion: 'metió plata al capital',
    retiro: 'sacó plata del capital',
    capital_inicial: 'puso el capital inicial',
    ajuste: 'ajustó el capital',
  },
  caja: {
    inyeccion: 'metió plata al capital desde la caja',
    retiro: 'sacó plata del capital desde la caja',
    ajuste: 'corrigió la caja',
  },
}

// `Pago.tipo` → cómo se dice. En el texto de `registrar_pago` el abono a capital
// viene como «abono capital»; en el de `anular_pago`, como «capital».
const TIPO_PAGO = {
  completo: 'Pago completo de',
  parcial: 'Pago parcial de',
  capital: 'Abono a capital de',
  'abono capital': 'Abono a capital de',
  intereses: 'Pago de intereses de',
  liquidacion: 'Liquidación del préstamo por',
  recargo: 'Recargo de',
  descuento: 'Descuento de',
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
// «2026-10-18» → «18 oct». Es un día del calendario, no un instante: se lee tal
// cual, sin pasarlo por ninguna zona.
const diaCorto = (ymd) => `${Number(ymd.slice(8, 10))} ${MESES[Number(ymd.slice(5, 7)) - 1]}`

const juntar = (...partes) => partes.map((p) => (p ?? '').trim()).filter(Boolean).join(' · ')

// «Ruta Sur» ya dice que es una ruta; «Floresta», no.
const nombreDeRuta = (nombre) => (/^ruta\b/i.test(nombre) ? nombre : `Ruta ${nombre}`)

// `/api/capital`: «inyeccion entrada $500.000 - Plata para prestar esta semana»
// `/api/caja/ajustes`: «ajuste salida $282.000 (2026-10-18) - Se contó mal»
// Las más viejas, sin dirección: «capital_inicial $1.000.000».
function leerMovimiento(texto, donde) {
  const m = /^([a-z_]+) (?:(entrada|salida) )?(\$\s?[\d.,]+)(?: \((\d{4}-\d{2}-\d{2})\))?(?: - ([\s\S]*))?$/.exec(texto)
  if (!m || !TIPO_MOVIMIENTO[m[1]]) return null
  const [, tipo, direccion, monto, dia, descripcion] = m
  const propia = FRASE_MOVIMIENTO[donde][tipo]
  // En un ajuste el tipo no dice hacia dónde fue la plata: lo dice la cifra.
  const cifra = tipo === 'ajuste' && direccion ? `${direccion === 'entrada' ? 'Sumó' : 'Restó'} ${monto}`
    : propia ? monto
    : `${TIPO_MOVIMIENTO[tipo]}: ${monto}`
  return {
    frase: propia ?? (donde === 'caja' ? 'movió la caja' : 'movió el capital'),
    detalle: juntar(cifra, dia && `caja del ${diaCorto(dia)}`, descripcion),
  }
}

// `/api/capital/plata-de-hoy`: «Plata para prestar hoy: $300.000 (la caja estaba en $250.000)»
function leerPlataDeHoy(texto) {
  const m = /^Plata para prestar hoy: (\$\s?-?[\d.,]+) \(la caja estaba en (\$\s?-?[\d.,]+)\)$/.exec(texto)
  if (!m) return null
  return { frase: 'anotó la plata que tiene hoy para prestar', detalle: juntar(m[1], `la caja estaba en ${m[2]}`) }
}

// `/api/prestamos/[id]/pagos`: «Pago abono capital $100.000»
//
// ⚠ EL RECARGO Y EL DESCUENTO NO SON PLATA. Viajan como `registrar_pago`, pero
// el recargo SUBE la deuda y el descuento la BAJA; ninguno mete un billete en la
// caja (el endpoint no les asienta recaudo). La fila los pintaba «+$X» en verde,
// como un cobro, y la tanda los sumaba a «Suman». Llevan su frase, van sin signo
// y no se juntan con los cobros.
function leerPago(texto) {
  const m = /^Pago (.+) (\$\s?[\d.,]+)$/.exec(texto)
  if (!m || !TIPO_PAGO[m[1]]) return null
  const detalle = `${TIPO_PAGO[m[1]]} ${m[2]}`
  if (m[1] === 'recargo') {
    return { frase: 'le puso un recargo a un préstamo', detalle: juntar(detalle, 'sube la deuda, no es plata cobrada'), clase: 'recargo', noEsPlata: true }
  }
  if (m[1] === 'descuento') {
    return { frase: 'le hizo un descuento a un préstamo', detalle: juntar(detalle, 'baja la deuda, no es plata cobrada'), clase: 'descuento', noEsPlata: true }
  }
  return { detalle }
}

// `/api/pagos/[id]` (DELETE): «Anuló pago de 87000 (parcial) del préstamo cmve1etw…»
// El importe va crudo (sin formato) y cierra con el id del préstamo.
function leerAnulacion(texto) {
  const m = /^Anuló pago de (-?\d+(?:\.\d+)?) \(([a-z ]+)\) del préstamo \S+$/.exec(texto)
  if (!m || !TIPO_PAGO[m[2]]) return null
  return { detalle: `${TIPO_PAGO[m[2]]} ${formatMoney(Number(m[1]))}` }
}

// `/api/rutas/[id]`: «Ruta "Ruta Sur" eliminada; 0 cliente(s) quedaron sin ruta»
function leerRutaEliminada(texto) {
  const m = /^Ruta "(.+)" eliminada; (\d+) cliente\(s\) quedaron sin ruta$/.exec(texto)
  if (!m) return null
  const n = Number(m[2])
  const quedaron = n === 0 ? 'Ningún cliente quedó sin ruta'
    : n === 1 ? '1 cliente quedó sin ruta'
    : `${n} clientes quedaron sin ruta`
  return { detalle: `${nombreDeRuta(m[1])} eliminada. ${quedaron}` }
}

// ── EL GASTO QUE EL DUEÑO RECHAZÓ SEGUÍA SALIENDO COMO PLATA QUE SALIÓ ──
//
// QA, 19 oct 2026: «Camilo Ortiz registró gasto · Gasto $25.000 -
// Pinchazo/Llanta · −$25.000», y el dueño lo había rechazado. La fila se escribe
// al ANOTAR el gasto y no se vuelve a tocar; lo que el dueño decide después vive
// en `GastoMenor.estado`. `/api/actividad` lo trae (`gastoEstado`, buscando por
// `entidadId`, que es el id del gasto) y aquí se lee:
//   · rechazado / eliminado → no es plata que salió: sin signo, tachado, y su
//     pastilla. Medido en el espejo: el `entidadId` encuentra su gasto en 1.698
//     de 1.855 filas; las 157 que no, son exactamente los 157 gastos borrados.
//   · pendiente → todavía lo puede rechazar: sale como gasto, con su pastilla.
const ESTADOS_DE_GASTO = {
  rechazado: { noEsPlata: true },
  eliminado: { noEsPlata: true },
  pendiente: { noEsPlata: false },
}

// `/api/gastos`: «Gasto $25.000 - Pinchazo/Llanta»
function leerGasto(texto, item) {
  const m = /^Gasto (\$\s?[\d.,]+) - ([\s\S]*)$/.exec(texto)
  const estado = ESTADOS_DE_GASTO[item?.gastoEstado] ? item.gastoEstado : null
  return {
    detalle: m ? juntar(`Gasto de ${m[1]}`, m[2]) : (texto || null),
    estado,
    // Uno rechazado no se suma en la misma tanda con los que sí salieron.
    clase: estado ? `registrar_gasto:${estado}` : 'registrar_gasto',
    noEsPlata: Boolean(estado && ESTADOS_DE_GASTO[estado].noEsPlata),
  }
}

// `/api/gastos/[id]`: «Gasto de Camilo Ortiz: $25.000 - Pinchazo/Llanta»
// («Gasto: $25.000 - …» cuando el gasto no es de ningún cobrador).
function leerDecisionGasto(texto, verbo) {
  const m = /^Gasto(?: de (.+?))?: (\$\s?[\d.,]+)(?: - ([\s\S]*))?$/.exec(texto)
  if (!m) return null
  return { frase: m[1] ? `${verbo} el gasto de ${m[1]}` : `${verbo} un gasto`, detalle: juntar(m[2], m[3]) }
}

const LECTORES = {
  movimiento_capital: (t) => leerMovimiento(t, 'capital') ?? leerPlataDeHoy(t),
  movimiento_caja_manual: (t) => leerMovimiento(t, 'caja'),
  registrar_pago: leerPago,
  anular_pago: leerAnulacion,
  eliminar_ruta: leerRutaEliminada,
  // `/api/rutas`: «Ruta "Ruta Sur" creada» (+ « con capital $500.000»)
  crear_ruta: (t) => {
    const m = /^Ruta "(.+)" creada(?: con capital (\$\s?[\d.,]+))?$/.exec(t)
    return m ? { frase: `creó la ${nombreDeRuta(m[1])}`, detalle: m[2] ? `Con capital de ${m[2]}` : null } : null
  },
  // `/api/rutas/[id]`: «Ruta "Zona Norte": ahora la cobra Camilo Ortiz»
  asignar_cobrador_ruta: (t) => {
    const m = /^Ruta "(.+)": (ahora la cobra .+|quedó sin cobrador)$/.exec(t)
    return m ? { detalle: `${nombreDeRuta(m[1])}: ${m[2]}` } : null
  },
  // `/api/cobradores`: «Cobrador Jhon Jairo Pérez creado»
  crear_cobrador: (t) => {
    const m = /^Cobrador (.+) creado$/.exec(t)
    return m ? { frase: `creó el cobrador ${m[1]}`, detalle: null } : null
  },
  // `/api/ver-como`: «Vio la app como Andrés Vargas» — decía lo mismo dos veces.
  ver_como_cobrador: (t) => {
    const m = /^Vio la app como (.+)$/.exec(t)
    return m ? { frase: `vio la app como ${m[1]}`, detalle: null } : null
  },
  // `/api/caja/reabrir`: «Solicitud de reapertura de caja Camilo Ortiz (2026-10-18)»
  solicitud_reapertura_cierre_caja: (t) => {
    const m = /^Solicitud de reapertura de caja (.*) \((\d{4}-\d{2}-\d{2})\)$/.exec(t)
    if (!m) return null
    return { detalle: m[1].trim() ? `Caja de ${m[1].trim()} del ${diaCorto(m[2])}` : `Caja del ${diaCorto(m[2])}` }
  },
  // `/api/capital/movimientos/[id]`: «Movimiento capital_inicial corregido: $1.000.000 -> $1.200.000»
  editar_movimiento_capital: (t) => {
    const m = /^Movimiento ([a-z_]+) corregido: (\$\s?[\d.,]+) -> (\$\s?[\d.,]+)$/.exec(t)
    return m && TIPO_MOVIMIENTO[m[1]] ? { detalle: `${TIPO_MOVIMIENTO[m[1]]}: de ${m[2]} a ${m[3]}` } : null
  },
  // `/api/capital/movimientos/[id]`: «Movimiento inyeccion $500.000 eliminado (Aporte de socio)»
  eliminar_movimiento_capital: (t) => {
    const m = /^Movimiento ([a-z_]+) (\$\s?[\d.,]+) eliminado(?: \(([\s\S]*)\))?$/.exec(t)
    return m && TIPO_MOVIMIENTO[m[1]] ? { detalle: juntar(`${TIPO_MOVIMIENTO[m[1]]}: ${m[2]}`, m[3]) } : null
  },
  registrar_gasto: leerGasto,
  aprobar_gasto: (t) => leerDecisionGasto(t, 'aprobó'),
  rechazar_gasto: (t) => leerDecisionGasto(t, 'rechazó'),
}

/**
 * Cómo se lee UN suceso:
 *   frase     — lo que va después del nombre, si la acción tiene una propia para
 *               este caso («creó el cobrador Jhon Jairo Pérez»); `null` = la del
 *               mapa de acciones.
 *   detalle   — el renglón de abajo, ya en palabras; `null` = no lleva.
 *   estado    — lo que se decidió después ('rechazado' | 'eliminado' | 'pendiente').
 *   clase     — qué sucesos pueden ir juntos en una tanda.
 *   noEsPlata — lleva importe pero no entró ni salió plata.
 */
export function leerSuceso(item) {
  const texto = String(item?.detalle ?? '').trim()
  const lector = LECTORES[item?.accion]
  const leido = lector ? lector(texto, item) : null
  return {
    frase: leido?.frase ?? null,
    detalle: leido ? (leido.detalle ?? null) : (item?.detalle ?? null),
    estado: leido?.estado ?? null,
    clase: leido?.clase ?? item?.accion ?? null,
    noEsPlata: Boolean(leido?.noEsPlata),
  }
}

// El sentido de la plata de UN suceso, ya sabiendo lo que es: un gasto rechazado
// o un descuento llevan importe, pero no entra ni sale nada.
function sentidoDeSuceso(item, leido = leerSuceso(item)) {
  return leido.noEsPlata ? 'neutro' : sentidoDe(item?.accion, item?.detalle)
}

// ══ EL DÍA ES EL DEL NEGOCIO, NO EL DE UTC ═══════════════════════════════════
//
// QA, 19 oct 2026: lo que pasó anoche después de las 7 salía bajo «HOY». La
// pantalla agrupaba con `toISOString().slice(0, 10)`, que es el día en UTC, y en
// Colombia el día UTC empieza a las 7 de la noche. Un cobrador que cerró a las
// 11:42 p. m. del 18 salía el 19, mezclado con los cobros de la mañana.
//
// La frontera es la de la caja, el cierre y «cobrar hoy»: medianoche en el país
// del negocio (`getUtcOffset`; 05:00Z en Colombia), y la calcula
// `inicioDiaLocal`, que es quien ya la calcula para todos. Si «Hoy» en el
// Historial empezara a otra hora que «hoy» en la Caja, los pagos de una lista no
// cuadrarían con los de la otra.
//
// La HORA se lee con la misma cuenta y no con la zona del teléfono: con un
// teléfono en otra hora, la fila de las 11:42 p. m. del 18 saldría bajo «Ayer»
// diciendo «4:42 a. m.».

/** «2026-10-18»: el día del negocio en que pasó (ni el de UTC, ni el del teléfono). */
export function diaDelNegocio(fecha, offsetHoras = getUtcOffset()) {
  return inicioDiaLocal(new Date(fecha), offsetHoras).toISOString().slice(0, 10)
}

/** «Hoy», «Ayer» o «sáb, 18 oct» para un día del negocio («2026-10-18»). */
export function etiquetaDelDia(dia, { offsetHoras = getUtcOffset(), ahora = Date.now() } = {}) {
  const hoy = inicioDiaLocal(new Date(ahora), offsetHoras)
  if (dia === diaDelNegocio(hoy, offsetHoras)) return 'Hoy'
  // Un milisegundo antes de que empezara hoy ya es ayer.
  if (dia === diaDelNegocio(hoy.getTime() - 1, offsetHoras)) return 'Ayer'
  // Un día del calendario, no un instante: a mediodía y en UTC, para que ninguna
  // zona lo corra al día de al lado.
  return new Date(`${dia}T12:00:00Z`).toLocaleDateString('es-CO', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  })
}

/** La lista (descendente, como llega) partida por días del negocio. */
export function agruparPorDia(items = [], { offsetHoras = getUtcOffset(), ahora = Date.now() } = {}) {
  const grupos = []
  for (const it of items) {
    const key = diaDelNegocio(it.createdAt, offsetHoras)
    if (key !== grupos[grupos.length - 1]?.key) {
      grupos.push({ key, label: etiquetaDelDia(key, { offsetHoras, ahora }), items: [] })
    }
    grupos[grupos.length - 1].items.push(it)
  }
  return grupos
}

function duracion(ms) {
  const seg = Math.round(ms / 1000)
  if (seg < 90) return 'en un minuto'
  const min = Math.round(seg / 60)
  if (min < 60) return `en ${plural(min, 'minuto', 'minutos')}`
  return `en ${plural(Math.round(min / 60), 'hora', 'horas')}`
}

// La hora en el reloj del negocio: el instante corrido por el desfase del país y
// leído en UTC, la misma cuenta que `getLocalDate`. Ver «EL DÍA ES EL DEL
// NEGOCIO» arriba: el día y la hora salen de la misma frontera.
const hora = (iso, offsetHoras = getUtcOffset()) => new Date(new Date(iso).getTime() + offsetHoras * 3600000)
  .toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })

/**
 * Junta los sucesos consecutivos que son EL MISMO usuario haciendo LA MISMA
 * acción dentro de la ventana. Devuelve filas listas para pintar.
 *
 * Cada fila:
 *   { id, accion, clase, usuario, cuantos, desde, hasta, horaTexto, detalle,
 *     frase, detalleTexto, estado, monto, sentido, items }
 *
 * `cuantos === 1` es una fila normal; más de uno es una tanda. `frase`,
 * `detalleTexto` y `estado` salen de `leerSuceso` (el primero de la fila).
 */
export function agruparRepetidos(items = [], ventanaMs = VENTANA_MS, { offsetHoras = getUtcOffset() } = {}) {
  const filas = []
  for (const it of items) {
    const leido = leerSuceso(it)
    const sentido = sentidoDeSuceso(it, leido)
    const anterior = filas[filas.length - 1]
    const mismoAutor = anterior && (anterior.usuario ?? null) === (it.user?.nombre ?? null)
    // La misma CLASE, no solo la misma acción: un gasto rechazado no va en la
    // tanda de los que sí salieron, ni un recargo en la de los cobros. Si no,
    // «Suman» metía en la cuenta los $25.000 que el dueño no aceptó.
    const mismaAccion = anterior && anterior.accion === it.accion && anterior.clase === leido.clase
    // El orden que llega es descendente (lo más nuevo primero), así que la
    // distancia se mide contra el ÚLTIMO de la tanda, que es el más antiguo.
    const cerca = anterior
      && Math.abs(new Date(anterior.hasta).getTime() - new Date(it.createdAt).getTime()) <= ventanaMs

    if (mismoAutor && mismaAccion && cerca) {
      anterior.items.push(it)
      anterior.cuantos += 1
      anterior.hasta = it.createdAt
      anterior.monto += montoDeDetalle(it.detalle)
      // Una tanda que mezcla entradas y salidas (dos movimientos de capital
      // seguidos, uno de cada) no tiene UNA cifra que decir: se queda sin ella.
      if (anterior.sentido !== sentido) anterior.mezcla = true
      continue
    }

    filas.push({
      id: it.id,
      accion: it.accion,
      clase: leido.clase,
      usuario: it.user?.nombre ?? null,
      cuantos: 1,
      desde: it.createdAt,
      hasta: it.createdAt,
      detalle: it.detalle ?? null,
      frase: leido.frase,
      detalleTexto: leido.detalle,
      estado: leido.estado,
      monto: montoDeDetalle(it.detalle),
      sentido,
      items: [it],
    })
  }

  return filas.map(({ mezcla, ...f }) => ({
    ...f,
    ...(mezcla ? { monto: 0, sentido: 'neutro' } : {}),
    // «10:22 – 11:08» cuando es una tanda: el rango dice cuánto duró, y eso es
    // parte de la información. Una tanda de cuatro pagos en un minuto y una de
    // cuatro en tres horas son dos cosas distintas.
    horaTexto: (() => {
      const a = hora(f.hasta, offsetHoras)
      const b = hora(f.desde, offsetHoras)
      return f.cuantos === 1 || a === b ? b : `${a} – ${b}`
    })(),
    duracionTexto: f.cuantos > 1
      ? duracion(Math.abs(new Date(f.desde).getTime() - new Date(f.hasta).getTime()))
      : null,
  }))
}

/**
 * Lo que la fila DICE cuando es una tanda.
 *
 * `etiquetaAccion` viene de la pantalla («Registró pago», «Cambió día de
 * cobro»…), porque el diccionario de acciones vive allí.
 */
export function textoDeFila(fila, etiquetaAccion) {
  // Una sola vez y con frase propia («creó el cobrador Jhon Jairo Pérez»), esa.
  // Sin pasarla a minúsculas: lleva nombres.
  if (fila.cuantos === 1 && fila.frase) return fila.frase
  const base = (etiquetaAccion ?? fila.accion ?? '').toLowerCase()
  if (fila.cuantos === 1) return base
  // El sustantivo se saca del propio texto: «registró pago» → «pagos».
  const sustantivo = base.split(' ').slice(1).join(' ') || 'sucesos'
  const verbo = base.split(' ')[0]
  return `${verbo} ${plural(fila.cuantos, sustantivo, enPluralDe(sustantivo))} ${fila.duracionTexto ?? ''}`.trim()
}

function enPluralDe(sustantivo) {
  // «hizo 2 movimiento de capitales»: con «X de Y» se pluraliza el núcleo, que
  // es la primera palabra — «movimientos de capital», «fechas de pago».
  const conDe = /^(\S+)( de .+)$/.exec(sustantivo)
  if (conDe) return enPluralDe(conDe[1]) + conDe[2]
  /* «cambió 3 configuracións»: el plural se hacía pegando una «s». En español
     lo que acaba en consonante lleva «es», y la tilde de «-ión» se cae. */
  return /ión$/.test(sustantivo) ? sustantivo.replace(/ión$/, 'iones')
    : /[aeiouáéíóú]$/i.test(sustantivo) ? `${sustantivo}s`
    : `${sustantivo}es`
}

/**
 * Lo que hay que mirar. Devuelve `null` cuando no hay nada raro — y eso es lo
 * normal: una tarjeta de alerta que siempre dice algo deja de leerse.
 *
 * Hoy detecta una sola cosa, la que la lámina señala: el MISMO tipo de cambio
 * repetido muchas veces sobre lo mismo. No es un fallo por sí solo, es una
 * pregunta que merece respuesta.
 */
export function paraRevisar(filas = [], { umbral = 3 } = {}) {
  const sospechosa = filas
    .filter((f) => f.cuantos >= umbral && !esDeCobro(f.accion))
    .sort((a, b) => b.cuantos - a.cuantos)[0]
  if (!sospechosa) return null

  return {
    titulo: 'Para revisar',
    texto: `Se repitió ${plural(sospechosa.cuantos, 'vez', 'veces')} la misma acción `
      + `(${(sospechosa.detalle ?? sospechosa.accion ?? '').toLowerCase()}) `
      + `${sospechosa.duracionTexto ?? ''}. `
      + 'O algo no está guardando bien, o alguien está probando el sistema.',
    fila: sospechosa,
  }
}

// Registrar pagos en tanda es lo NORMAL de una ruta: no se avisa de eso.
function esDeCobro(accion) {
  return ['registrar_pago', 'cierre_caja'].includes(accion)
}

/** El resumen de la columna derecha: qué entró, qué salió y cuántos sucesos. */
export function resumenDelDia(items = []) {
  let entro = 0
  let salio = 0
  for (const it of items) {
    // La MISMA regla que pinta la fila (`sentidoDeSuceso`). Lo neutro —un
    // cierre, un borrado, una edición, un gasto rechazado, un descuento— lleva
    // importe pero no entra ni sale: no se suma.
    const bruto = montoDeDetalle(it.detalle)
    const sentido = sentidoDeSuceso(it)
    if (sentido === 'entra') entro += bruto
    else if (sentido === 'sale') salio -= bruto
  }
  return { entro, salio, movimientos: items.length }
}

/** Quién trabajó, ordenado por cuántos sucesos dejó. */
export function quienTrabajo(items = []) {
  const cuenta = new Map()
  for (const it of items) {
    const nombre = it.user?.nombre ?? 'Sistema'
    const rol = it.user?.rol ?? null
    const previo = cuenta.get(nombre) ?? { nombre, rol, cuantos: 0 }
    previo.cuantos += 1
    cuenta.set(nombre, previo)
  }
  return [...cuenta.values()].sort((a, b) => b.cuantos - a.cuantos)
}
