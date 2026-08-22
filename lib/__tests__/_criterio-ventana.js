/* Saca del endpoint la función que decide si un préstamo cae dentro de la
 * ventana de cobro, y la devuelve EJECUTABLE.
 *
 * Es la salida a un problema que ya rompió cuatro pruebas de este repo: cuidar
 * el filtro con expresiones regulares sobre el código fuente. La regla queda
 * fijada por lo que la función HACE, así que reescribirla no rompe nada y
 * equivocarse sí. */
import { readFileSync } from 'fs'
import { join } from 'path'

export const FUENTE_API = readFileSync(
  join(process.cwd(), 'app/api/prestamos/route.js'), 'utf8')

export function criterioDelEndpoint({ inicioHoy, desde, hasta }) {
  const i = FUENTE_API.indexOf('((p) => {\n      if (p.estado !== \'activo\'')
  if (i < 0) throw new Error('el endpoint ya no tiene el criterio de la ventana')
  const fin = FUENTE_API.indexOf('\n    })', i)
  if (fin < 0) throw new Error('no se encontró el final del criterio')
  const flecha = FUENTE_API.slice(i, fin + '\n    })'.length)
  const fn = new Function('inicioHoy', 'ventanaDesde', 'ventanaHasta', `return ${flecha}`)
  return fn(inicioHoy, desde, hasta)
}
