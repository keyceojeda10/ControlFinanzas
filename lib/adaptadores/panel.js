// lib/adaptadores/panel.js — entre /api/dashboard/resumen y <Panel>.
//
// LA PREGUNTA DE LA PANTALLA es «¿cómo va mi plata hoy?», y se responde con
// cuatro cifras: cuánto vale el negocio, cuánto hay en caja, cuánto está en la
// calle y a cuántos hay que perseguir. Todo lo demás del panel viejo —el saludo
// con subtítulo, la hora de actualización, el promotor de la app de
// escritorio— no responde ninguna pregunta.
//
// NO SE RECALCULA NADA AQUÍ. `patrimonio` viene ya calculado del servidor y se
// usa tal cual: la última vez que el panel hizo su propia aritmética restó los
// gastos dos veces. Un adaptador formatea; no opina sobre cuánto vale el
// negocio.

import { formatMoney } from '@/lib/i18n'
import { generarNarrativa } from '@/lib/adaptadores/narrativa'

const SALUDOS = [
  { hasta: 12, texto: 'Buenos días' },
  { hasta: 19, texto: 'Buenas tardes' },
  { hasta: 24, texto: 'Buenas noches' },
]

/** El saludo por la hora local del usuario, no por la del servidor. */
export function saludoDe(hora) {
  const h = Number(hora)
  if (!Number.isFinite(h)) return 'Hola'
  return (SALUDOS.find((s) => h < s.hasta) ?? SALUDOS[2]).texto
}

/** Solo el primer nombre. «Buenos días, Carlos Andrés Ojeda» no es un saludo. */
export function primerNombre(nombre = '') {
  return String(nombre).trim().split(/\s+/)[0] || ''
}

/**
 * Las filas de «Necesita tu atención». Cada una lleva su CIFRA: una lista de
 * títulos es un menú, con el número al lado es un parte de novedades.
 *
 * Y AQUÍ SE DECIDE QUÉ NO SE PINTA. Una fila «0 clientes sin ruta» en rojo dice
 * que hay un problema cuando lo cierto es que no lo hay; el panel se llenaría
 * de alarmas apagadas y dejarían de mirarse las encendidas.
 */
export function filasAtencion(alertas) {
  const filas = []

  // NO VA «N CLIENTES EN MORA». La mora ya se dice en su tarjeta blanca, con su
  // monto expuesto. El pie de T02-01 lo señala como uno de los defectos que
  // corrige: «la misma cifra de mora dejó de repetirse tres veces».
  //
  // Lo que sí va acá es un corte DISTINTO y accionable: los que pasan de 30
  // días. No es el mismo número con otra ropa: mora es «se atrasó», más de 30
  // días es «probablemente no vuelve», y son dos decisiones diferentes.
  const mora30 = alertas?.mora30plus ?? 0
  if (mora30 > 0) {
    filas.push({
      texto: `${mora30} préstamo${mora30 === 1 ? '' : 's'} con más de 30 días de mora`,
      tono: 'mora',
      destino: '/prestamos?diasMoraMin=30',
    })
  }

  const sinPagos = alertas?.prestamosSinPagosLargo ?? 0
  if (sinPagos > 0) {
    filas.push({
      // 7 días, que es el umbral que usa de verdad /api/dashboard/resumen
      // (`ultimoPagoAt < ahora - 7 días`). Yo había escrito 15 a ojo, y la
      // pantalla acababa diciendo dos umbrales distintos para el mismo número.
      texto: `${sinPagos} préstamo${sinPagos === 1 ? '' : 's'} sin pagos hace más de 7 días`,
      tono: 'atraso',
      destino: '/prestamos?sinPagosDias=7',
    })
  }

  // Verde: no es un problema, es plata esperando. Un préstamo al 80% pagado es
  // el mejor candidato a renovar, y renovar es de donde sale el crecimiento.
  const renovar = alertas?.listosParaRenovar ?? 0
  if (renovar > 0) {
    filas.push({
      texto: `${renovar} préstamo${renovar === 1 ? '' : 's'} listo${renovar === 1 ? '' : 's'} para renovar`,
      tono: 'ok',
      destino: '/prestamos?listosRenovar=1',
    })
  }

  const sinRuta = alertas?.clientesSinRuta ?? 0
  if (sinRuta > 0) {
    filas.push({
      // No es una alarma roja: el cliente existe y debe, solo que nadie lo
      // tiene asignado. Es trabajo pendiente, no plata en riesgo.
      texto: `${sinRuta} cliente${sinRuta === 1 ? '' : 's'} sin ruta asignada`,
      tono: 'atraso',
      destino: '/clientes?sinRuta=1',
    })
  }

  return filas
}

/**
 * @param datos respuesta de /api/dashboard/resumen
 * @param opts  { nombre, pais, hora, clientesHoy }
 *
 * `clientesHoy` llega aparte porque el resumen no lo trae: da la PLATA que toca
 * cobrar hoy (`esperadoHoy`) pero no A CUÁNTOS. Sin ese número la tarjeta diría
 * «Ver los cobros» sin decir cuántos son, así que la pantalla lo pasa desde
 * donde sí lo tiene.
 */
export function adaptarPanel(datos, { nombre = '', pais, hora, clientesHoy = 0 } = {}) {
  const f = datos?.finanzas
  const p = datos?.prestamos
  const c = datos?.cobros
  const cl = datos?.clientes
  const recaudado = Number(c?.hoy ?? 0)
  const esperado = Number(p?.esperadoHoy ?? 0)
  const cobrados = Number(c?.cantidadHoy ?? 0)

  return {
    saludo: saludoDe(hora),
    nombre: primerNombre(nombre),

    // ── El hero dorado (T02-01) ──
    // Recaudado, meta, progreso y cobros. El pie de la lámina lo dice: «el hero
    // dorado se queda —es el momento dorado del sistema— pero baja de 300px a
    // 150px y ahora sí INFORMA».
    hero: {
      recaudado: formatMoney(recaudado, pais),
      meta: esperado > 0 ? formatMoney(esperado, pais) : null,
      porcentaje: esperado > 0 ? Math.min(100, Math.round((recaudado / esperado) * 100)) : 0,
      cobrados,
      // «11 pendientes» = los que tocan hoy menos los que ya pagaron. Nunca
      // negativo: si cobran a alguien que no tocaba hoy, `cobrados` puede pasar
      // de `clientesHoy` y un «-2 pendientes» no significa nada.
      pendientes: Math.max(0, clientesHoy - cobrados),
      ayer: Number(c?.ayer ?? 0) > 0 ? formatMoney(c.ayer, pais) : null,
    },

    // ── Las dos tarjetas blancas ──
    // El pie: «mora y caja pasan a blanco: hoy son dos tarjetas teñidas que
    // compiten entre sí». Y la mora se dice UNA vez, no tres.
    caja: f ? formatMoney(f.cajaDisponible, pais) : null,
    mora: {
      cuantos: cl?.enMora ?? 0,
      deCuantos: cl?.total ?? 0,
      // «$3,1M expuestos». El conteo solo no dice el tamaño del problema:
      // veinte clientes debiendo $50.000 es un mal día, veinte debiendo
      // $500.000 es el negocio en peligro.
      expuesto: Number(cl?.saldoEnMora ?? 0) > 0 ? formatMoney(cl.saldoEnMora, pais) : null,
    },

    // Solo owner. El cobrador no ve el patrimonio de la organización, y el
    // servidor ya manda `finanzas: null` en ese caso: si aquí se pusiera un 0,
    // el cobrador vería un negocio quebrado.
    patrimonio: f ? formatMoney(f.patrimonio, pais) : null,
    enCaja: f ? formatMoney(f.cajaDisponible, pais) : null,
    porCobrar: formatMoney(p?.saldoPorCobrar ?? 0, pais),
    clientesEnMora: cl?.enMora ?? 0,

    hoy: {
      clientes: clientesHoy,
      // RECAUDADO NO ES GANANCIA, y no pueden parecer lo mismo: cobrar
      // $500.000 de capital propio volviendo no es ganar $500.000. Ya pasó una
      // vez —las analíticas inflaron la ganancia 7,9x y escondieron cinco
      // negocios en pérdida—, así que va al lado, no se deduce.
      ganancia: Number(c?.interesGanadoHoy ?? 0) > 0
        ? formatMoney(c.interesGanadoHoy, pais) : null,
      esperado: esperado > 0 ? formatMoney(esperado, pais) : null,
      // Lo que el panel viejo ya enseñaba y NO se pierde en la mudanza: cuántos
      // pagos, el histórico de siete días, y la frase que interpreta el día.
      pagos: Number(c?.cantidadHoy ?? 0),
      historico: Array.isArray(c?.sparkline7d) ? c.sparkline7d : null,
      narrativa: generarNarrativa({
        recaudadoHoy: recaudado,
        recaudadoAyer: Number(c?.ayer ?? 0),
        recaudadoAyerAEstaHora: Number(c?.ayerAEstaHora ?? 0),
        esperadoHoy: esperado,
        sparkline7d: c?.sparkline7d,
        formatear: (n) => formatMoney(n, pais),
      }),
      // `null`, no «$0»: la tarjeta distingue «todavía no has cobrado nada» de
      // una cifra, y un «$0» en verde se lee como si algo hubiera entrado.
      recaudado: recaudado > 0 ? formatMoney(recaudado, pais) : null,
      porcentaje: esperado > 0
        ? Math.min(100, Math.round((recaudado / esperado) * 100))
        : 0,
    },

    atencion: filasAtencion(datos?.alertas),
  }
}

/**
 * «POR RUTA HOY» — el bloque de abajo de T02-01.
 *
 * Reusa la respuesta de GET /api/rutas tal cual: `esperadoHoy` y `recaudadoHoy`
 * ya vienen calculados ahí con la misma regla que usa el hero. NO se recalcula
 * — si el panel hiciera su propia aritmética, el total de arriba y la suma de
 * las rutas de abajo se contradirían, y esa contradicción ya pasó una vez.
 *
 * EL COLOR NO ES DECORACIÓN, es la pregunta «¿a quién llamo?». La lámina pinta
 * 78% en verde, 34% en dorado y 0% en gris, así que el corte va en 60: por
 * debajo, a esta hora, la ruta no llega.
 *
 * El 0% lleva barra al 2% en gris: una barra de ancho cero desaparece y la ruta
 * parece que no existe, cuando lo que pasa es que no ha cobrado nada — que es
 * justo lo que hay que ver.
 */
export const VERDE_DESDE = 60

export function tonoDeRuta(porcentaje, inactiva = false) {
  if (inactiva) return 'inactiva'
  if (porcentaje >= VERDE_DESDE) return 'ok'
  if (porcentaje > 0) return 'oro'
  return 'nada'
}

export function porRutaHoy(rutas = [], pais) {
  const vivas = (rutas || []).filter((r) => (r.esperadoHoy || 0) > 0)
  return {
    // El encabezado repite el total del hero a propósito: es la suma de las
    // barras de abajo, y verla cuadrar es lo que hace creíble el desglose.
    recaudado: formatMoney(vivas.reduce((s, r) => s + (r.recaudadoHoy || 0), 0), pais),
    meta: formatMoney(vivas.reduce((s, r) => s + (r.esperadoHoy || 0), 0), pais),
    rutas: vivas.map((r) => {
      const esperado = r.esperadoHoy || 0
      const recaudado = r.recaudadoHoy || 0
      const pct = esperado > 0 ? Math.min(100, Math.round((recaudado / esperado) * 100)) : 0
      return { id: r.id, nombre: r.nombre, porcentaje: pct, tono: tonoDeRuta(pct) }
    }),
  }
}
