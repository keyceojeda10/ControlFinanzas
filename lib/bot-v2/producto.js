// lib/bot-v2/producto.js — Fuente unica de verdad sobre el producto.
// Todo lo que el bot puede decir sale de aqui. Si no esta aqui, NO EXISTE.
// Precios se importan de lib/planes.js para evitar duplicacion.

import { PLANES_CONFIG } from '@/lib/planes'

export const EMPRESA = {
  nombre: 'Control Finanzas',
  descripcion: 'Sistema de cartera y cobros para prestamistas',
  linkRegistro: 'https://app.control-finanzas.com/registro?r=2',
  linkApp: 'https://app.control-finanzas.com',
  telefonoSoporte: '301 199 3001',
  horarioSoporte: '7am a 10pm',
  waSoporte: 'https://wa.me/573011993001',
  diasPrueba: 14,
  linkCalendario15: 'https://cal.com/control-finanzas/15min',
  /* ⚠ ESTE ES EL ÚNICO ENLACE DE VÍDEO QUE EL BOT PUEDE MANDAR.
     Cualquier otro que se le ocurra al modelo es inventado. Ver la nota de
     abajo sobre por qué estuvieron prohibidos hasta hoy. */
  linkTutoriales: 'https://youtube.com/playlist?list=PLOttIYxPScdU&si=p50ySB1TZkf_HhAW',
}

const PLANES_VISIBLES = ['starter', 'basic', 'growth', 'standard', 'professional']

export const PLANES = PLANES_VISIBLES.map(key => {
  const p = PLANES_CONFIG[key]
  return {
    key,
    nombre: p.nombre,
    precio: p.precio,
    clientes: p.maxClientes,
    rutas: p.maxRutas,
    usuarios: p.maxUsuarios,
    cobradorExtra: p.cobradorExtra,
    rutaExtra: p.rutaExtra,
  }
})

export const EXTRAS = { cobradorExtra: 19000, rutaExtra: 29000 }

export const PRECIOS_VALIDOS = new Set(PLANES.map(p => p.precio))

/* ══ LOS VÍDEOS VUELVEN, Y ESTA VEZ SON DE VERDAD ═══════════════════════════
 *
 * Aquí hubo enlaces de YouTube y se quitaron con esta nota:
 *
 *   «Los videos son de marzo y enseñan la interfaz de antes del rediseño de
 *    julio. Este prompt ya llevaba la regla "NUNCA ofrezcas ni envies videos",
 *    pero la constante y su import seguían puestos: dejar la munición cargada
 *    es como vuelve a dispararse.»
 *
 * Ya no es el caso: los diecisiete tutoriales están rehechos sobre la interfaz
 * actual, con voz y subtítulos, y publicados en una lista de reproducción.
 *
 * ⚠ VOLVER A ABRIRLO TOCA CUATRO SITIOS, no uno. Lo aprendimos al cerrarlo:
 *   la constante se quitó y las reglas se quedaron, así que ahora al revés hay
 *   que mirar los cuatro o el enlace se manda y algo lo borra por el camino:
 *
 *     1. `EMPRESA.linkTutoriales`, aquí arriba.
 *     2. `clasificador.js` — reconoce a quien PIDE vídeos.
 *     3. `respuestas-fijas.js` — la respuesta, sin pasar por el modelo.
 *     4. `prompts.js` Y `sanitizador.js` — el prompt lo prohibía y el
 *        sanitizador BORRABA la frase entera («le comparto el video…»), así
 *        que sin tocar los dos el enlace desaparecía después de generarse.
 */

// WHITELIST: lo unico que el bot puede mencionar como funcion del sistema
export const FUNCIONES = [
  'Registrar prestamos diarios, semanales, quincenales o mensuales',
  'Cobros: calcula cuotas automaticamente, acepta pagos parciales y recargos',
  'Mercancia: entregar articulos a cuotas con ganancia automatica',
  'Cobradores con su propio acceso (solo ven sus clientes asignados)',
  'Rutas de cobro por zona, cada una con su capital independiente',
  'Recibos de pago listos para enviar por WhatsApp',
  'Control de capital y caja diaria',
  'Seguro por prestamo (registra la ganancia extra)',
  'Reportes de ingresos, mora y cobros',
  'Funciona sin internet despues de cargar',
  'Importar clientes desde cartulinas con foto (la IA los lee)',
  'GPS del cobrador en tiempo real (el administrador ve donde esta el cobrador en el mapa)',
  'Firma digital del cliente al recibir el prestamo',
  'Exportar datos a Excel (clientes, prestamos, pagos, cobradores)',
  'Reporte diario imprimible con pagos, pendientes y gastos',
  'Hoja de ruta imprimible para entregar al cobrador en papel',
  // Lucas IA existe de verdad (lib/asistente*.js) y es lo que diferencia los
  // planes altos, pero no estaba en esta lista: el bot tenia prohibido nombrar
  // el mayor argumento de venta que tiene el producto.
  'Lucas IA: un asistente dentro de la app al que le pregunta por su negocio y le registra pagos por chat. Viene desde el plan Crecimiento en adelante (no esta en Inicial ni Basico)',
]

// BLACKLIST: cosas que NO existen y el bot JAMAS debe mencionar
export const NO_EXISTE = [
  'pago en tiendas', 'corresponsales', 'Efecty', 'Baloto', 'puntos de pago',
  'pasarela de pago', 'PSE', 'Nequi', 'Daviplata', 'pago con tarjeta',
  'notificaciones automaticas a deudores',
  'recordatorio automatico', 'recordatorios automaticos',
  'recordatorio de cobro', 'recordatorios de cobro',
  'aviso automatico de pago', 'aviso automatico de cobro',
  'aviso automatico el dia del pago',
  'envia recordatorios', 'recibe su aviso',
  'integracion con bancos', 'integracion con billeteras',
  // El cobro NO es automatico: en Colombia se paga por checkout de Wompi cuando el
  // prestamista decide (el recurrente de MercadoPago esta desactivado). El bot
  // llego a decirle a una lead "se debita de tu cuenta bancaria todos los meses",
  // que es falso y es justo la pregunta mas sensible del embudo.
  'debito automatico', 'debito de tu cuenta', 'debito de su cuenta',
  'se debita de tu cuenta', 'se debita de su cuenta',
  'cobro automatico', 'se cobra automaticamente', 'descuento automatico de la cuenta',
  'app en Play Store', 'app en App Store', 'App Store', 'Play Store', 'Google Play',
  'descargar la app', 'descargar app', 'descargar desde',
  'chat con deudores',
  'modulo contable', 'facturacion electronica',
  'inteligencia artificial para el prestamista',
]

export function planRecomendado(cantClientes) {
  if (!cantClientes) return PLANES[0]
  if (typeof cantClientes === 'number') {
    return _planPorCantidad(cantClientes)
  }
  const s = String(cantClientes).toLowerCase()
  const nums = s.match(/\d+/g)
  /* ⚠ «MÁS DE 100» NO ES 100: ES UN SUELO, NO UN TECHO.
   *
   * La expresión sacaba el número antes de mirar el «más de», así que
   * `mas_de_100` —el rango que declara el 17% de los leads de agosto— se
   * trataba como exactamente 100 y caía en el plan que corta JUSTO en 100. El
   * lead pagaba $39.000, llegaba al tope el primer día y no podía registrar
   * más. La rama de abajo que devuelve el plan grande era inalcanzable para
   * cualquier texto que trajera un número, que son todos los de Meta.
   *
   * Es el mismo fallo que el comentario de `_planPorCantidad` dice haber
   * corregido ya una vez —«el bot llevaba meses vendiendo un tope que la
   * aplicación no daba»—: se arregló el umbral y se dejó el «más de». */
  const esSuelo = /\b(mas|más|superior|arriba|encima)\b|^mas_|_mas_/.test(s)
  if (nums) {
    const n = Math.max(...nums.map(Number))
    return esSuelo ? _planPorEncimaDe(n) : _planPorCantidad(n)
  }
  if (s.includes('menos') || s.includes('pocos') || s.includes('poco')) return PLANES[0]
  if (esSuelo || s.includes('muchos') || s.includes('bastantes')) return PLANES[2]
  return PLANES[0]
}

/* ══ EL PLAN QUE SE RECOMIENDA SALE DEL TOPE REAL ════════════════════════════
 *
 * ⚠ DECÍA `n <= 150` Y EL INICIAL CORTA EN 100. El bot le recomendaba el plan
 * de $39.000 a quien decía tener 120 o 150 clientes: pagaba, llegaba a 100 y no
 * podía registrar más. Es exactamente el fallo que `lib/bot/prompts/contexto.js`
 * ya documenta como ocurrido —«el bot llevaba meses vendiendo un tope que la
 * aplicación no daba»—: allí se corrigió el dato y AQUÍ SE QUEDÓ el umbral.
 *
 * Salió al revisar de dónde más venía el «hasta 150 clientes» que el dueño vio
 * en la pantalla de cambiar plan, el 19 ago 2026. Los otros cuatro umbrales sí
 * coincidían con su tope.
 *
 * Ahora se deriva: el primer plan cuyo tope alcanza. Si mañana se mueve un cupo
 * en `PLANES_CONFIG`, la recomendación se mueve sola. */
function _planPorCantidad(n) {
  return PLANES.find((p) => n <= p.clientes) ?? PLANES[PLANES.length - 1]
}

/* «Más de N»: el primer plan cuyo tope PASA de N, no el que se queda justo en
   N. Sin esto, quien dice «más de 100» recibe el plan de hasta 100. Se deriva
   de `PLANES_CONFIG` igual que el de arriba: si mañana se mueve un cupo, la
   recomendación se mueve sola. */
function _planPorEncimaDe(n) {
  return PLANES.find((p) => p.clientes > n) ?? PLANES[PLANES.length - 1]
}

export function formatPrecio(n) {
  return '$' + n.toLocaleString('es-CO')
}

export function textoPlanes() {
  return PLANES.map(p =>
    `${p.nombre}: ${formatPrecio(p.precio)}/mes (${p.clientes} clientes, ${p.rutas} ruta${p.rutas > 1 ? 's' : ''}, ${p.usuarios} usuario${p.usuarios > 1 ? 's' : ''})`
  ).join('\n')
}

export function textoPlanesConExtras() {
  return PLANES.map(p => {
    let linea = `${p.nombre}: ${formatPrecio(p.precio)}/mes (${p.clientes} clientes, ${p.rutas} ruta${p.rutas > 1 ? 's' : ''}, ${p.usuarios} usuario${p.usuarios > 1 ? 's' : ''})`
    if (p.cobradorExtra > 0) {
      linea += ` — permite agregar cobradores extra (${formatPrecio(p.cobradorExtra)}/mes c/u) y rutas extra (${formatPrecio(p.rutaExtra)}/mes c/u)`
    }
    return linea
  }).join('\n')
}

export function textoPreciosAnuales() {
  return PLANES.map(p => {
    const anual = p.precio * 10
    return `${p.nombre}: ${formatPrecio(anual)} al año (UN SOLO PAGO de ${formatPrecio(anual)}, equivale a 10 meses, 2 meses gratis). OJO: NO es ${formatPrecio(p.precio)}/año.`
  }).join('\n')
}
