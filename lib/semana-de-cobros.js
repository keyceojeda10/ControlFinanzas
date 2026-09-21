/* LA GEOMETRÍA DE LA GRÁFICA DE LOS 7 DÍAS.
 *
 * Vive fuera del componente para poder probarla con números: vitest no compila
 * JSX, y esto es justo lo que se rompe en silencio.
 *
 * La regla que defiende, de la adenda de diseño: «si el texto dice 3 de 7,
 * tiene que haber exactamente 3 barras por encima de la línea». Medido en el
 * espejo el 20 sep 2026, un negocio la rompía: meta de $15.000 contra una semana
 * de $1,2M dejaba la línea a 1,26 px del suelo, y las cinco barras vacías —que
 * se pintan con 3px de mínimo para que el día se vea— quedaban por encima. El
 * gráfico enseñaba siete días completos donde el texto decía dos.
 */

/* Una barra de altura cero desaparece y el día parece no existir, cuando lo que
   pasa es que no se cobró nada — que es justo lo que hay que ver. */
export const MINIMO_CON_PLATA = 6
export const MINIMO_SIN_PLATA = 3

/** Dónde va la línea de «lo que toca cobrar», medida sobre la base de las barras.
 *  Con suelo: por debajo del mínimo de una barra, la línea no puede separar nada. */
export function alturaDeLaLinea({ meta, tope, altoBarra }) {
  if (!meta || !tope || tope <= 0) return null
  return Math.max((meta / tope) * altoBarra, MINIMO_CON_PLATA)
}

/** El alto de una barra, en px.
 *  Dos reglas que se pisan: el mínimo para que el día vacío se vea, y que un día
 *  que NO llegó a la meta no se dibuje por encima de la línea. Manda la segunda:
 *  si no, el gráfico contradice a su propia frase. */
export function altoDeBarra({ monto = 0, meta = null, tope = 1, altoBarra = 104 }) {
  const suyo = Math.max(monto > 0 ? MINIMO_CON_PLATA : MINIMO_SIN_PLATA, Math.round((monto / tope) * altoBarra))
  const linea = alturaDeLaLinea({ meta, tope, altoBarra })
  if (linea == null || monto >= meta) return suyo
  return Math.max(MINIMO_SIN_PLATA, Math.min(suyo, Math.floor(linea) - 1))
}

/** El tope de la escala. La línea tiene que caber: si un día cobró más, manda esa
 *  barra; si nadie llegó, manda la línea. El 1,12 es AIRE — sin él, en la semana
 *  floja la línea queda pegada al techo y se lee como el borde de la caja. */
export function topeDeLaEscala(montos = [], meta = null) {
  return Math.max(...montos, (meta ?? 0) * 1.12, 1)
}
