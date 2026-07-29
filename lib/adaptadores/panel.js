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
export function filasAtencion(alertas, clientesEnMora = 0) {
  const filas = []

  if (clientesEnMora > 0) {
    filas.push({
      texto: `${clientesEnMora} cliente${clientesEnMora === 1 ? '' : 's'} en mora`,
      tono: 'mora',
      accion: 'Ver',
      destino: '/clientes?filtro=mora',
    })
  }

  const sinPagos = alertas?.prestamosSinPagosLargo ?? 0
  if (sinPagos > 0) {
    filas.push({
      // 7 días, que es el umbral que usa de verdad /api/dashboard/resumen
      // (`ultimoPagoAt < ahora - 7 días`). Yo había escrito 15 a ojo, y la
      // pantalla acababa diciendo dos umbrales distintos para el mismo número.
      texto: `${sinPagos} sin pagar hace más de 7 días`,
      tono: 'mora',
      accion: 'Ver',
      destino: '/prestamos?sinPagosDias=7',
    })
  }

  const sinRuta = alertas?.clientesSinRuta ?? 0
  if (sinRuta > 0) {
    filas.push({
      // No es una alarma roja: el cliente existe y debe, solo que nadie lo
      // tiene asignado. Es trabajo pendiente, no plata en riesgo.
      texto: `${sinRuta} cliente${sinRuta === 1 ? '' : 's'} sin ruta asignada`,
      tono: 'atraso',
      accion: 'Asignar',
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
  const recaudado = Number(c?.hoy ?? 0)
  const esperado = Number(p?.esperadoHoy ?? 0)

  return {
    saludo: saludoDe(hora),
    nombre: primerNombre(nombre),

    // Solo owner. El cobrador no ve el patrimonio de la organización, y el
    // servidor ya manda `finanzas: null` en ese caso: si aquí se pusiera un 0,
    // el cobrador vería un negocio quebrado.
    patrimonio: f ? formatMoney(f.patrimonio, pais) : null,
    enCaja: f ? formatMoney(f.cajaDisponible, pais) : null,
    porCobrar: formatMoney(p?.saldoPorCobrar ?? 0, pais),
    clientesEnMora: datos?.clientes?.enMora ?? 0,

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

    atencion: filasAtencion(datos?.alertas, datos?.clientes?.enMora ?? 0),
  }
}
