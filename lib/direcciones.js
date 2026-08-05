// lib/direcciones.js — cómo se leen la dirección y el teléfono de un cliente.
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

/**
 * El teléfono, para LEERLO. «300 887 5156», no «3008875156».
 *
 * ⚠ NO CONFUNDIR CON `formatearTelefonoIntl` de `lib/i18n`: esa añade el
 * prefijo del país para MARCAR o abrir WhatsApp, y devuelve «573008875156».
 * Usarla en pantalla pone el 57 pegado delante y sin separar, que es justo lo
 * que se veía en la ficha del cliente.
 *
 * Se agrupa 3-3-4, que es como se dicta un celular en Colombia. Si el número
 * no tiene diez cifras se devuelve tal cual: mejor enseñarlo raro que
 * inventarle una forma.
 *
 * @param {string|number|null|undefined} tel
 * @returns {string} listo para pintar
 */
export function telefonoLegible(tel) {
  if (!tel) return ''
  let d = String(tel).replace(/\D/g, '')
  // Viene con el prefijo pegado («573008875156»): se quita para leerlo.
  if (d.length === 12 && d.startsWith('57')) d = d.slice(2)
  if (d.length !== 10) return String(tel).trim()
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`
}
