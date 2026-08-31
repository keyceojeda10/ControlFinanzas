// lib/cartulina-dudas.js — QUÉ DATO DE LA FOTO NO HAY QUE CREERSE, Y POR QUÉ.
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Un cliente dice que el sistema no está reconociendo de forma correcta los
//  valores ni las fechas… algunos números parecen corresponder, pero no estoy
//  seguro.»                                              — el dueño, 31 ago 2026
//
// Ése «no estoy seguro» es el problema entero. El lector devolvía 21 clientes
// con un semáforo por FILA —rojo, ámbar, verde— y ninguna pista de QUÉ celda
// mirar. Con cuarenta filas, revisarlas todas es más trabajo que teclearlas.
//
// Aquí se marca el CAMPO, no la fila, y se dice qué dice el papel al lado de lo
// que entendió el sistema. El prestamista tiene la foto delante: si le enseñas
// «el papel dice 16/ · lo entendí como día 16», lo confirma de un vistazo.
//
// ⚠ LAS REGLAS SON DETERMINISTAS, NO SE LE PREGUNTAN AL MODELO. Un modelo que
// se autoevalúa dice que está seguro justo cuando más se equivoca. Todo lo de
// aquí se decide con lo que hay escrito: el texto de la celda, el valor
// interpretado y las filas vecinas.
//
// Medido contra las dos capturas reales del 31 ago 2026 (una tabla de 40
// clientes con una columna por mes).

/* Cada duda: el campo que hay que mirar, qué pasa, y qué se vio en el papel.
   `dato` es lo que se enseña entre comillas: sin eso, «revisa la fecha» obliga
   a buscar en la foto qué fecha. */
const duda = (campo, texto, dato) => ({ campo, texto, dato: dato ?? null })

/* Una celda de fecha que NO trae mes. En la tabla del cliente la columna
   «Fecha» es el DÍA DEL MES en que cobra —«26/», «16/», «5/»— y el lector,
   obligado a devolver una fecha completa, se inventaba el mes: a «09-04» le
   puso marzo Y le dio la vuelta al día. */
const SOLO_DIA = /^\s*(\d{1,2})\s*[/\-.]?\s*$/

export function esSoloDia(texto) {
  const m = String(texto ?? '').match(SOLO_DIA)
  if (!m) return null
  const d = Number(m[1])
  return d >= 1 && d <= 31 ? d : null
}

/**
 * Las dudas de UN cliente leído.
 *
 * @param {object} c        el cliente ya normalizado
 * @param {object} crudo    lo que dijo el modelo, con los textos literales
 * @param {object} vecinos  {anterior, siguiente} para detectar contagio
 * @returns {Array<{campo:string, texto:string, dato:string|null}>}
 */
export function dudasDe(c = {}, crudo = {}, vecinos = {}) {
  const out = []

  /* ── LA FECHA QUE NO ERA UNA FECHA ──
     El fallo más repetido de las dos capturas: 19 de 21 filas. */
  const textoFecha = crudo.textoFecha ?? crudo.fechaTexto ?? null
  const dia = esSoloDia(textoFecha)
  if (dia && c.fechaInicio) {
    out.push(duda('fechaInicio',
      `En el papel solo está el día ${dia}, no el mes. Puede ser el día en que le cobras, no la fecha en que empezó.`,
      textoFecha))
  }

  /* ── LA ESCALA: EL FALLO DE DINERO MÁS CARO ──
     «14500» puede ser catorce mil quinientos o catorce millones y medio, y la
     app no puede saberlo: el umbral de los miles deja pasar todo lo que supere
     10.000. Un préstamo de 14 millones se guardaba como 14 mil. */
  const textoMonto = crudo.textoMonto ?? crudo.montoTexto ?? null
  if (c.montoPrestado > 0 && !String(textoMonto ?? '').includes('.') && c.montoPrestado < 100000) {
    out.push(duda('monto',
      `¿Son ${fmt(c.montoPrestado)} o ${fmt(c.montoPrestado * 1000)}? En el papel está sin puntos y no se puede saber.`,
      textoMonto))
  }

  /* ── DOS PRÉSTAMOS EN UNA CELDA ──
     «500.000 + 1.500.000» y «1.500.000 1.500.000». El lector se quedaba con uno
     y el otro desaparecía de la cartera sin que nadie lo notara. */
  if (/[+]|\d[\s.]\d{3}[.\s]\d{3}\s+\d/.test(String(textoMonto ?? ''))) {
    out.push(duda('monto',
      'En esta celda hay más de una cifra: puede que sean dos préstamos de la misma persona.',
      textoMonto))
  }

  /* ── CIFRAS QUE NADIE ESCRIBIÓ ──
     El lector devolvía «saldo 8.410.000» y «pagado 6.090.000» calculándolos él
     (cuota × meses). Números inventados con pinta de leídos: los peores. */
  for (const [campo, rotulo] of [['saldoPendiente', 'saldo'], ['montoPagadoHasta', 'lo abonado']]) {
    if (c[campo] > 0 && crudo[`${campo}Texto`] == null && crudo.calculados?.includes?.(campo)) {
      out.push(duda(campo, `Este ${rotulo} no está escrito en el papel: lo dedujo el lector. Compruébalo.`))
    }
  }

  /* ── CONTAGIO ENTRE FILAS ──
     A Velez, que tiene «16/», el lector le puso el 26 de las filas de abajo.
     Cuando un valor coincide con el de las dos filas vecinas Y el texto del
     papel dice otra cosa, casi siempre es que se copió del renglón de al lado. */
  const anterior = vecinos.anterior
  if (anterior && dia && c.diaCobro && c.diaCobro !== dia) {
    out.push(duda('diaCobro',
      `El papel dice ${dia} y se leyó ${c.diaCobro}. Puede haberse copiado del renglón de arriba.`,
      textoFecha))
  }

  /* ── SIN CIFRA NO HAY PRÉSTAMO ──
     Esto ya lo marcaba el semáforo en rojo, pero sin decir cuál falta. */
  if (!(c.montoPrestado > 0) && !(c.totalAPagar > 0)) {
    out.push(duda('monto', 'No se pudo leer cuánto le prestaste. Sin eso no se puede crear el préstamo.'))
  }
  if (!c.nombre) out.push(duda('nombre', 'No se pudo leer el nombre.'))

  return out
}

function fmt(n) {
  return '$' + Math.round(Number(n) || 0).toLocaleString('es-CO')
}

/**
 * ⚠ LA COMPROBACIÓN QUE VALE MÁS QUE TODAS LAS DEMÁS.
 *
 * Estas tablas traen su PROPIO total escrito abajo («TOTAL 86.814.000»). Sumar
 * lo que se leyó y compararlo con ese total dice, al peso, si falta alguien.
 *
 * Medido contra la captura real del 31 ago 2026: el lector sacó 21 clientes que
 * sumaban 79.814.000 y el papel decía 86.814.000. La diferencia era 7.000.000
 * EXACTOS, y correspondía a los tres que se había dejado —dos clientes enteros
 * y el segundo préstamo de un tercero—. Ninguna heurística de confianza habría
 * encontrado eso; una resta sí.
 *
 * @param {number} totalDelPapel  el TOTAL escrito en la hoja
 * @param {Array}  clientes       lo que se leyó
 */
export function cuadreDelTotal(totalDelPapel, clientes = []) {
  const total = Number(totalDelPapel) || 0
  if (!(total > 0) || !clientes.length) return null

  const suma = clientes.reduce((a, c) => a + (Number(c.montoPrestado) || Number(c.totalAPagar) || 0), 0)
  const falta = Math.round(total - suma)

  /* Un peso de diferencia es redondeo, no un cliente perdido. El corte va en el
     0,5 % del total: por debajo de eso no hay ningún préstamo que quepa. */
  const margen = Math.max(1000, total * 0.005)
  if (Math.abs(falta) <= margen) {
    return { cuadra: true, suma, total, falta: 0, texto: `Cuadra con el total del papel (${fmt(total)}).` }
  }

  /* ⚠ SI LA DIFERENCIA ES ENORME, EL TOTAL NO ES DE ESTOS CLIENTES.
   *
   * Salió verificando de punta a punta con la segunda captura del cliente: esa
   * foto trae el FINAL de una tabla —con su total de 86.814.000— y debajo una
   * tabla NUEVA con sus propios veinte préstamos y su propio total. El cuadre
   * comparó el total de la primera con los clientes de la segunda y anunció que
   * faltaban 56 millones. Cierto en la resta y falso en la conclusión.
   *
   * Cuando lo leído no llega ni al 40 % del total declarado, lo más probable no
   * es que se hayan perdido dos tercios de la hoja: es que ese total es de otra
   * tabla. Callar es mejor que un aviso falso — una alarma que se equivoca
   * enseña a ignorar todas las demás. */
  if (suma < total * 0.4) return null

  return {
    cuadra: false, suma, total, falta,
    texto: falta > 0
      ? `El papel suma ${fmt(total)} y aquí hay ${fmt(suma)}: faltan ${fmt(falta)}. Revisa si se quedó algún cliente sin leer.`
      : `El papel suma ${fmt(total)} y aquí hay ${fmt(suma)}: sobran ${fmt(-falta)}. Puede haber una cifra leída de más.`,
  }
}
