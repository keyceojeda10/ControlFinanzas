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
  }
  return 'neutro'
}

function duracion(ms) {
  const seg = Math.round(ms / 1000)
  if (seg < 90) return 'en un minuto'
  const min = Math.round(seg / 60)
  if (min < 60) return `en ${plural(min, 'minuto', 'minutos')}`
  return `en ${plural(Math.round(min / 60), 'hora', 'horas')}`
}

const hora = (iso) => new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })

/**
 * Junta los sucesos consecutivos que son EL MISMO usuario haciendo LA MISMA
 * acción dentro de la ventana. Devuelve filas listas para pintar.
 *
 * Cada fila:
 *   { id, accion, usuario, cuantos, desde, hasta, horaTexto, detalle, monto, items }
 *
 * `cuantos === 1` es una fila normal; más de uno es una tanda.
 */
export function agruparRepetidos(items = [], ventanaMs = VENTANA_MS) {
  const filas = []
  for (const it of items) {
    const anterior = filas[filas.length - 1]
    const mismoAutor = anterior && (anterior.usuario ?? null) === (it.user?.nombre ?? null)
    const mismaAccion = anterior && anterior.accion === it.accion
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
      if (anterior.sentido !== sentidoDe(it.accion, it.detalle)) anterior.mezcla = true
      continue
    }

    filas.push({
      id: it.id,
      accion: it.accion,
      usuario: it.user?.nombre ?? null,
      cuantos: 1,
      desde: it.createdAt,
      hasta: it.createdAt,
      detalle: it.detalle ?? null,
      monto: montoDeDetalle(it.detalle),
      sentido: sentidoDe(it.accion, it.detalle),
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
      const a = hora(f.hasta)
      const b = hora(f.desde)
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
  const base = (etiquetaAccion ?? fila.accion ?? '').toLowerCase()
  if (fila.cuantos === 1) return base
  // El sustantivo se saca del propio texto: «registró pago» → «pagos».
  const sustantivo = base.split(' ').slice(1).join(' ') || 'sucesos'
  const verbo = base.split(' ')[0]
  /* «cambió 3 configuracións»: el plural se hacía pegando una «s». En español
     lo que acaba en consonante lleva «es», y la tilde de «-ión» se cae. */
  const enPlural = /ión$/.test(sustantivo) ? sustantivo.replace(/ión$/, 'iones')
    : /[aeiouáéíóú]$/i.test(sustantivo) ? `${sustantivo}s`
    : `${sustantivo}es`
  return `${verbo} ${plural(fila.cuantos, sustantivo, enPlural)} ${fila.duracionTexto ?? ''}`.trim()
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
    // La MISMA regla que pinta la fila (`sentidoDe`). Lo neutro —un cierre, un
    // borrado, una edición— lleva importe pero no entra ni sale: no se suma.
    const bruto = montoDeDetalle(it.detalle)
    const sentido = sentidoDe(it.accion, it.detalle)
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
