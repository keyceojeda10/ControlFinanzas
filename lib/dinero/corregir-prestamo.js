/**
 * CORREGIR UN PRÉSTAMO EN VEZ DE BORRARLO Y CREARLO DE NUEVO (15 nov 2026).
 *
 * Borrar un préstamo de un día ya cerrado NO devuelve su desembolso (regla de
 * `reverso-del-dia.js`: esa plata salió en su día y ya se cuadró). Si después
 * se crea otra vez el mismo préstamo, el nuevo desembolsa de nuevo: la misma
 * plata sale dos veces de la bolsa. Medido en producción el 15 nov 2026: 238
 * préstamos borrados y vueltos a crear en 90 días, 32 negocios, $154 millones.
 * Créditos pete lo hizo con Otilia y Wendy y su capital quedó $2.000.000 abajo.
 *
 * Y no era descuido del prestamista: con pagos, «Editar» solo deja cambiar
 * datos sueltos, y al cobrador la propia app le dice «cancela y crea uno nuevo».
 *
 * ── CÓMO SE CORRIGE ─────────────────────────────────────────────────────────
 * El préstamo viejo se borra SIN tocar sus asientos: su desembolso y sus cobros
 * se quedan en el día en que pasaron, que es cuando pasaron. El nuevo nace como
 * un migrado (`MARCA_CORREGIDO`): su desembolso y lo ya cobrado (abono previo)
 * se apuntan sin mover el capital, porque esa plata ya está contada. Si cambia
 * el monto, solo la diferencia se apunta como «Corrección de préstamo», que
 * mueve la bolsa y no el fajo (`CORRIGEN_EL_LIBRO` en conciliacion.js).
 *
 * Hoy no entra ni sale un billete, y la bolsa queda como si el préstamo se
 * hubiera cargado bien desde el principio.
 *
 * ⚠ ESTE FICHERO ES EL ÚNICO QUE DECIDE SI UN PRÉSTAMO SE PUEDE CORREGIR. Lo
 * preguntan el modal de borrar, el formulario y el servidor al guardar.
 */
import { esDelDiaAbierto } from './reverso-del-dia.js'
import { efectivoQueSalio } from './revertir-renovacion.js'
import { esAbonoPrevio } from './abono-previo.js'

/** La marca del desembolso del préstamo que reemplaza a otro. La leen
 *  `prestamosMigrados` y `esAsientoDeMigracion` (abono-previo.js). */
export const MARCA_CORREGIDO = '(préstamo corregido)'

/** El prefijo de la diferencia de monto. `CORRIGEN_EL_LIBRO` lo reconoce. */
export const PREFIJO_CORRECCION = 'Corrección de préstamo'

/** ¿Este asiento es el desembolso de un préstamo corregido? Nace hoy, pero su
 *  plata salió el día del préstamo que reemplazó: para borrar, anular o volver
 *  a corregir cuenta como de un día cerrado. */
export function esDesembolsoCorregido(mov) {
  return typeof mov?.descripcion === 'string' && mov.descripcion.includes(MARCA_CORREGIDO)
}

const NO_SON_COBROS = ['recargo', 'descuento']

/** Los cobros de verdad de un préstamo (abono previo incluido): lo que entró. */
export function cobrosDe(prestamo) {
  return (prestamo?.pagos ?? []).filter((pg) => !NO_SON_COBROS.includes(pg.tipo))
}

/**
 * ¿Se puede corregir? Función pura para poder probarla con el día fijado.
 *
 * @param {object} p            el préstamo, con `pagos`
 * @param {Date|string|null} desembolsoEl  cuándo se asentó su desembolso
 * @param {string} pais
 * @returns {{ puede: boolean, motivo?: string, cobrado?: number }}
 */
export function puedeCorregirse(p, { desembolsoEl = null, yaCorregido = false, pais = 'co', ahora = Date.now() } = {}) {
  if (!p) return { puede: false, motivo: 'No se encontró el préstamo.' }
  if (p.estado !== 'activo') return { puede: false, motivo: 'Solo se corrige un préstamo activo.' }
  if (p.renovadoDeId) {
    return { puede: false, motivo: 'Es una renovación: se corrige desde la renovación, no aquí.' }
  }
  /* Del mismo día, borrar ya devuelve todo y crear de nuevo cuadra solo. */
  if (!yaCorregido && esDelDiaAbierto(desembolsoEl ?? p.createdAt, pais, ahora)) {
    return { puede: false, motivo: 'Es de hoy: si lo borras, la plata vuelve sola. Puedes borrarlo y crearlo de nuevo.' }
  }
  /* Un cobro de hoy está en el fajo de hoy. Pasarlo a abono previo (que no es
     caja) le quitaría al cobrador una plata que tiene en la mano. */
  /* El abono previo se escribe con la hora de hoy pero no es caja de hoy: es
     lo que ya entró antes (el de un corregido, con el préstamo que reemplazó). */
  const deHoy = cobrosDe(p)
    .filter((pg) => !esAbonoPrevio(pg))
    .filter((pg) => esDelDiaAbierto(pg.createdAt ?? pg.fechaPago, pais, ahora))
  if (deHoy.length > 0) {
    const suma = Math.round(deHoy.reduce((t, pg) => t + Number(pg.montoPagado || 0), 0))
    return {
      puede: false,
      motivo: `Tiene cobros de hoy ($${suma.toLocaleString('es-CO')}). Anúlalos primero y vuelve a cobrarlos en el préstamo corregido.`,
    }
  }
  const cobrado = Math.round(cobrosDe(p).reduce((t, pg) => t + Number(pg.montoPagado || 0), 0))
  return { puede: true, cobrado }
}

/** Lo mismo leyendo la base: el préstamo, cuándo salió y cuánto salió. */
export async function evaluarCorreccion(db, { id, organizationId, pais = 'co', ahora = Date.now() }) {
  const p = await db.prestamo.findFirst({
    where: { id, organizationId },
    select: {
      id: true, organizationId: true, clienteId: true, estado: true, renovadoDeId: true, createdAt: true,
      montoPrestado: true,
      pagos: { select: { tipo: true, montoPagado: true, fechaPago: true, createdAt: true, nota: true } },
    },
  })
  if (!p) return { puede: false, motivo: 'No se encontró el préstamo.' }
  const desembolso = await db.movimientoCapital.findFirst({
    where: { organizationId, referenciaId: id, referenciaTipo: 'prestamo', tipo: 'desembolso' },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true, descripcion: true },
  })
  const r = puedeCorregirse(p, {
    desembolsoEl: desembolso?.createdAt ?? null, yaCorregido: esDesembolsoCorregido(desembolso), pais, ahora,
  })
  if (!r.puede) return { ...r, prestamo: p }
  const salio = Math.round(await efectivoQueSalio(db, p))
  return { ...r, salio, desembolsoEl: desembolso?.createdAt ?? p.createdAt, prestamo: p }
}
