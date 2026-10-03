/* DE QUÉ RUTA LLEGÓ CADA CLIENTE (3 oct 2026).
 *
 * El dueño, al ver «Unir con otra ruta»:
 *
 *   «Saber que este cliente era de la ruta 10, y si la ruta 9 no está rindiendo
 *    lo suficientemente bien a partir de que le unieron la ruta 10, entonces no
 *    era la ruta o el cobrador como tal, sino eran las personas de esa ruta.»
 *
 * Se anota en `CambioRuta` cuando un cliente llega a una ruta VINIENDO DE OTRA:
 * al unir rutas, al «Agregar clientes» y al cambiarlo de ruta en su ficha.
 * Llegar sin ruta no es venir de ninguna, así que eso no se anota.
 *
 * La ficha de la ruta compara a los que llegaron con los que ya estaban, con
 * las MISMAS cifras que ya calcula por cliente (cumplimiento, atraso, cartera):
 * dos definiciones para lo mismo acaban separándose.
 */

/**
 * Anota que estos clientes llegaron a `aRutaId`. Un solo INSERT, dentro de la
 * transacción de quien los mueve: nada de una escritura por cliente
 * (ver lib/rutas/fusionar.js, 2 oct 2026).
 *
 * @param {object} tx  cliente de Prisma o transacción
 * @param {{ organizationId: string, clientes: Array<{ id: string, rutaId?: string|null, rutaNombre?: string|null }>, aRutaId: string, motivo: 'union'|'lote'|'manual', usuarioId?: string|null }} p
 * @returns {Promise<number>} cuántos se anotaron
 */
export async function anotarLlegadas(tx, { organizationId, clientes, aRutaId, motivo, usuarioId = null }) {
  const data = (clientes ?? [])
    .filter((c) => c?.id && c.rutaId && c.rutaId !== aRutaId)
    .map((c) => ({
      organizationId,
      clienteId: c.id,
      deRutaId: c.rutaId,
      deRutaNombre: c.rutaNombre ?? null,
      aRutaId,
      motivo,
      usuarioId,
    }))
  if (data.length > 0) await tx.cambioRuta.createMany({ data })
  return data.length
}

/**
 * De dónde llegó cada cliente a la ruta en la que está: el ÚLTIMO cambio hacia
 * esa ruta. Si salió y volvió, manda la última vez que entró.
 *
 * @param {Array<{ clienteId: string, deRutaId: string|null, deRutaNombre: string|null, createdAt: Date|string }>} cambios
 * @returns {Map<string, { rutaId: string, nombre: string, desde: string }>}
 */
export function vieneDePorCliente(cambios = []) {
  const m = new Map()
  const ordenados = [...cambios].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  for (const c of ordenados) {
    if (!c.deRutaId) continue
    m.set(c.clienteId, {
      rutaId: c.deRutaId,
      nombre: c.deRutaNombre || 'otra ruta',
      desde: new Date(c.createdAt).toISOString(),
    })
  }
  return m
}

/**
 * Los grupos de la ficha de la ruta: uno por ruta de la que llegaron clientes
 * y uno con los que ya estaban («propios»). `null` si nadie llegó de otra ruta:
 * entonces no hay nada que comparar y el bloque no se pinta.
 *
 * Cada cliente trae lo que la ruta YA calcula para él:
 *   - `conDeuda`: tiene un préstamo vivo que se le cobra (sin clavos).
 *   - `diasMora`, `atraso` (lo que le falta para ponerse al día), `cartera`.
 *   - `cuotasPagadas` / `cuotasVencidas`: el cumplimiento se suma así, por
 *     cuotas, y no promediando porcentajes (un cliente de 2 cuotas pesaría lo
 *     mismo que uno de 40).
 *
 * @param {Array<{ id: string, conDeuda: boolean, diasMora: number, atraso: number, cartera: number, cuotasPagadas: number, cuotasVencidas: number }>} clientes
 * @param {Map<string, { rutaId: string, nombre: string, desde: string }>} vieneDe
 */
export function compararProcedencias(clientes = [], vieneDe = new Map()) {
  if (!clientes.some((c) => vieneDe.has(c.id))) return null
  const grupos = new Map()
  const vacio = (clave, nombre, desde) => ({
    clave, nombre, desde, clientes: 0, conDeuda: 0, alDia: 0, atrasados: 0,
    atraso: 0, cartera: 0, cuotasPagadas: 0, cuotasVencidas: 0,
  })
  for (const c of clientes) {
    const v = vieneDe.get(c.id)
    const clave = v ? v.rutaId : 'propios'
    if (!grupos.has(clave)) grupos.set(clave, vacio(clave, v ? v.nombre : null, v ? v.desde : null))
    const g = grupos.get(clave)
    // La fecha del grupo es la PRIMERA llegada: «desde el 5 oct».
    if (v && v.desde < g.desde) g.desde = v.desde
    g.clientes += 1
    if (!c.conDeuda) continue
    g.conDeuda += 1
    if ((Number(c.diasMora) || 0) > 0) g.atrasados += 1
    else g.alDia += 1
    g.atraso += Number(c.atraso) || 0
    g.cartera += Number(c.cartera) || 0
    g.cuotasPagadas += Number(c.cuotasPagadas) || 0
    g.cuotasVencidas += Number(c.cuotasVencidas) || 0
  }
  const lista = [...grupos.values()].map((g) => ({
    clave: g.clave,
    nombre: g.nombre,
    desde: g.desde,
    clientes: g.clientes,
    conDeuda: g.conDeuda,
    alDia: g.alDia,
    atrasados: g.atrasados,
    // Sin nada vencido todavía no hay nada que cumplir: `null`, no 0 % ni 100 %.
    cumplimiento: g.cuotasVencidas > 0 ? Math.round((g.cuotasPagadas / g.cuotasVencidas) * 100) : null,
    pctAtrasados: g.conDeuda > 0 ? Math.round((g.atrasados / g.conDeuda) * 100) : null,
    atraso: Math.round(g.atraso),
    cartera: Math.round(g.cartera),
  }))
  // Primero los que llegaron (los más numerosos arriba), al final los propios.
  return lista.sort((a, b) => (a.clave === 'propios') - (b.clave === 'propios') || b.clientes - a.clientes)
}
