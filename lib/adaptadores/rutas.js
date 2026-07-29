// lib/adaptadores/rutas.js
//
// El puente entre lo que devuelve /api/rutas y lo que pinta <ListaRutas>.
//
// POR QUÉ UN MÓDULO APARTE Y NO DENTRO DE LA PÁGINA:
// aquí es donde viven los bugs de verdad. El componente ya está verificado
// visualmente; lo que se puede equivocar es el porcentaje, el redondeo, o —el
// caso que importa— decidir que una ruta sin cobros programados "va al 0%".
// En una función pura eso se puede probar; dentro de un JSX de 600 líneas, no.

import { formatMoney } from '@/lib/i18n'

/**
 * Una ruta a la que hoy no se le esperaba nada NO está fallando: no hay nada
 * que cumplir. Es la misma regla que ya está en la tarjeta, pero calculada
 * aquí para que la pantalla no tenga que volver a decidirlo.
 */
export function sinNadaQueCobrar(esperadoHoy) {
  return !esperadoHoy || esperadoHoy <= 0
}

/** Cumplimiento del día. Se acota a 100: cobrar de más no es cumplir 140%. */
export function porcentajeDelDia(recaudadoHoy, esperadoHoy) {
  if (sinNadaQueCobrar(esperadoHoy)) return 0
  return Math.min(100, Math.round(((recaudadoHoy || 0) / esperadoHoy) * 100))
}

/**
 * @param {Array}  rutas   respuesta cruda de GET /api/rutas
 * @param {string} pais    código de país de la organización
 */
export function adaptarRutas(rutas = [], pais) {
  return rutas.map((r) => {
    const esperado = r.esperadoHoy || 0
    const recaudado = r.recaudadoHoy || 0
    return {
      id: r.id,
      nombre: r.nombre,
      // El componente espera un nombre o nada: `null` es lo que dispara la
      // pastilla "sin cobrador", que es un agujero y se muestra como tal.
      cobrador: r.cobrador?.nombre ?? null,
      clientes: r.cantidadClientes ?? 0,
      recaudado: formatMoney(recaudado, pais),
      esperado: formatMoney(esperado, pais),
      porcentaje: porcentajeDelDia(recaudado, esperado),
      inactiva: sinNadaQueCobrar(esperado),
    }
  })
}

/**
 * Los clientes sin ruta no son una fila más de la lista: son un agujero, y sus
 * cobros no salen en la pantalla de nadie. Sin monto, la tarjeta no dice cuánta
 * plata está sin recorrer.
 */
export function adaptarSinRuta(recomendaciones, pais) {
  const cantidad = recomendaciones?.totalSinRuta ?? 0
  if (cantidad <= 0) return null
  const monto = recomendaciones?.montoSinRuta
  return {
    cantidad,
    monto: monto != null ? formatMoney(monto, pais) : null,
  }
}
