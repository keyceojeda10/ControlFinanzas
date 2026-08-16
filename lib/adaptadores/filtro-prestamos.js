/* ══ EL MISMO FILTRO, TAMBIÉN SIN CONEXIÓN ═══════════════════════════════════
 *
 * Los chips de la lista de préstamos son de dos clases:
 *
 *   · los que SÍ son un estado en la base —activos, completados, cancelados—;
 *   · y los DERIVADOS —en mora, renovar, perdidos, de hoy, por vencer—, que
 *     salen de algo calculado y que con conexión resuelve el servidor.
 *
 * ⚠ SIN CONEXIÓN LOS DERIVADOS ESTABAN ROTOS, y en silencio. El bloque de
 *   respaldo hacía `est === 'mora' ? 'activo' : est` y después filtraba por
 *   `pr.estado === apiEstado`: para «renovar», «clavo» y «de hoy» eso es
 *   comparar el estado del préstamo con la palabra «renovar», que no coincide
 *   con ninguno. La lista salía VACÍA — no daba error, no avisaba, sencillamente
 *   no había préstamos.
 *
 * Y estaba escrito DOS VECES, una para el arranque sin red y otra para cuando
 * la petición falla. Aquí es una sola, y por eso los cinco chips funcionan en
 * los dos sitios.
 *
 * Salió al añadir «por vencer»: una prueba mía recortaba mal el archivo porque
 * `const apiEstado` aparecía tres veces. El recorte estaba mal; lo que enseñó,
 * no.
 */

/** Los chips que NO son un estado de la base. */
export const CHIPS_DERIVADOS = ['mora', 'renovar', 'clavo', 'nuevos', 'vence5', 'vence10']

/** Mismo umbral que el servidor: al día y por encima del 80% pagado. */
const RENOVAR_DESDE = 80

/**
 * Filtra la lista guardada en el teléfono como lo haría el servidor.
 *
 * @param {Array} lista        préstamos de IndexedDB
 * @param {object} f
 * @param {string} [f.est]     el chip
 * @param {Date}   [f.inicioHoy] arranque del día del país
 * @returns {Array}
 */
export function filtrarPrestamosGuardados(lista = [], { est = '', inicioHoy = null } = {}) {
  if (!est) return lista
  const hoy = inicioHoy ?? new Date(new Date().setHours(0, 0, 0, 0))

  // Los derivados arrancan todos de los vivos, igual que en el servidor.
  if (CHIPS_DERIVADOS.includes(est)) {
    const vivos = lista.filter((p) => est === 'nuevos' || p.estado === 'activo')
    switch (est) {
      case 'mora':
        return vivos.filter((p) => (p.diasMora ?? 0) > 0)
      case 'renovar':
        return vivos.filter((p) => (p.diasMora ?? 0) === 0 && (p.porcentajePagado ?? 0) >= RENOVAR_DESDE)
      case 'clavo':
        return vivos.filter((p) => !!p.esClavo)
      case 'nuevos':
        return lista.filter((p) => p.createdAt && new Date(p.createdAt) >= hoy)
      case 'vence5':
      case 'vence10': {
        const ventana = est === 'vence5' ? 5 : 10
        return vivos
          .filter((p) => {
            if ((p.diasMora ?? 0) > 0 || !p.proximoCobro) return false
            const dias = Math.ceil((new Date(p.proximoCobro) - hoy) / 86400000)
            return dias >= 0 && dias <= ventana
          })
          // El más cercano primero, como los devuelve el servidor.
          .sort((a, b) => new Date(a.proximoCobro) - new Date(b.proximoCobro))
      }
      default:
        return vivos
    }
  }

  return lista.filter((p) => p.estado === est)
}
