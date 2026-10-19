/* ══ CUÁNDO EMPEZÓ UNA RUTA A LLEVAR SU PROPIA PLATA ═══════════════════════════
 *
 * Sin capital propio, `Ruta.saldoCapital` NO es plata de la ruta: es la cuenta
 * interna de lo que movieron sus préstamos con la plata del negocio, a menudo
 * muy negativa (52 rutas en 41 negocios el 18 oct 2026). Cuando la ruta empieza
 * a llevar su propia plata —al unirle una que la traía (DETALLES-RUTAS #39) o
 * al meterle plata desde Capital (#10)— esa cuenta se pone en CERO con un par
 * de correcciones que dicen «… empieza su capital propio» (lib/rutas/traslado.js).
 *
 * Lo que la ruta tenía antes de esa marca no es de su bolsa: ni el «descontar
 * los préstamos activos» de Capital ni el resumen por ruta lo cuentan como un
 * descuento ya hecho.
 *
 * ⚠ Módulo HOJA, sin importar lib/capital.js: lib/capital.js lo usa, y al revés
 * sería un ciclo.
 */

/** El final de la descripción del asiento que pone la ruta en cero. */
export const EMPIEZA_SU_CAPITAL = 'empieza su capital propio'

/** Cuando se le mete plata desde Capital a una ruta que no tenía la suya (#10). */
export const PREFIJO_CAPITAL_PROPIO = 'Capital propio'

/** Cuando un cliente con préstamos cambia de ruta y su préstamo cambia de bolsa (#8). */
export const PREFIJO_TRASLADO = 'Traslado de clientes'

/**
 * La última vez que cada ruta se puso en cero al empezar su capital propio.
 * @returns {Promise<Map<string, Date>>} rutaId → fecha; las que nunca, no están.
 */
export async function ultimasPuestasEnCero(db, organizationId, rutaIds = null) {
  if (Array.isArray(rutaIds) && !rutaIds.length) return new Map()
  const filas = await db.movimientoCapital.findMany({
    where: {
      organizationId,
      tipo: 'ajuste',
      referenciaTipo: 'ruta',
      descripcion: { endsWith: EMPIEZA_SU_CAPITAL },
      rutaId: Array.isArray(rutaIds) ? { in: rutaIds } : { not: null },
    },
    select: { rutaId: true, createdAt: true },
  })
  const porRuta = new Map()
  for (const f of filas) {
    const antes = porRuta.get(f.rutaId)
    if (!antes || f.createdAt > antes) porRuta.set(f.rutaId, f.createdAt)
  }
  return porRuta
}
