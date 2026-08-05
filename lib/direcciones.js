// lib/direcciones.js — qué se puede hacer con la dirección de un cliente.
//
// Vive aquí y no dentro del componente por dos motivos: es una regla de
// negocio —cuándo una dirección sirve para llegar— y así se puede probar sin
// montar React. Las pruebas de este proyecto corren en `environment: 'node'`.

/**
 * ¿A esta dirección le falta el número para poder llegar?
 *
 * ⚠ ESTE ES EL AVISO QUE LA FICHA CALLABA. «Calle 9» no es una dirección: sin
 * número no se puede llegar ni sale en el mapa, y ese es el motivo real de que
 * un cobrador se pierda dando vueltas por el barrio.
 *
 * La regla es práctica, no un análisis del callejero: se da por buena la
 * dirección que traiga un separador de número (#, No, un guion entre cifras) o
 * DOS grupos de dígitos —la calle y la casa—. Con un solo número, casi seguro
 * es el nombre de la vía y le falta el portal.
 *
 * Prefiere callar antes que molestar: sin dirección no avisa nada, porque ahí
 * el hueco ya se ve solo.
 *
 * @param {string|null|undefined} dir
 * @returns {boolean} true si conviene pedirle que la complete
 */
export function direccionIncompleta(dir) {
  if (!dir) return false
  const t = String(dir).trim()
  if (t.length < 4) return true
  if (/[#]|(\bn(o|ro|°)\.?\s*\d)|(\d\s*-\s*\d)/i.test(t)) return false
  const grupos = t.match(/\d+/g) ?? []
  return grupos.length < 2
}
