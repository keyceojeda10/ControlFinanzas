// lib/dinero/permiso-prestamo.js — ¿Este cobrador puede hacerle otra cartulina
// a un cliente que ya debe?
//
// Lo pidió el mejor cliente del dueño el 27 oct 2026: «los muchachos me le hacen
// de a dos créditos en la tarjeta al cliente, pero hay clientes que no se le
// pueden tener dos cartulinas […] que tenga que llamarme a mí para yo darle el
// permiso». Decisión del dueño: un permiso por cobrador
// (`User.puedePrestarConPrestamoActivo`, encendido por defecto para no cambiarle
// nada a nadie) y, apagado, una solicitud en la app que el dueño aprueba con un
// toque (`PermisoPrestamo`).
//
// ⚠ LA RENOVACIÓN NO SE FRENA (decisión del dueño, 27 oct 2026). Renovar cierra
// el préstamo anterior: el cliente sigue con UNA cartulina. Si algún día lo
// piden también para renovar, la pregunta es la misma y el sitio es
// `app/api/prestamos/[id]/renovar/route.js`, junto a `perdidosDelCliente`.
//
// Una sola pregunta para la pantalla y para el servidor: `situacionParaPrestar`.
import { calcularSaldoPendiente } from '@/lib/calculos'
import { getLocalDateStr, getLocalDayRange } from '@/lib/i18n'

/** Lo que cuenta como «ya tiene un préstamo»: el que se cobra y el que espera aprobación. */
export const ESTADOS_QUE_OCUPAN = ['activo', 'pendiente_aprobacion']

/** Los préstamos vivos del cliente y lo que debe en ellos. */
export async function prestamosVivosDelCliente(db, { organizationId, clienteId }) {
  const prestamos = await db.prestamo.findMany({
    where: { organizationId, clienteId, estado: { in: ESTADOS_QUE_OCUPAN } },
    select: { id: true, totalAPagar: true, totalPagado: true, pagos: { select: { montoPagado: true, tipo: true } } },
  })
  const saldo = Math.round(prestamos.reduce((a, p) => a + Math.max(0, calcularSaldoPendiente(p) || 0), 0))
  return { cantidad: prestamos.length, saldo }
}

/** El permiso de hoy de este cobrador para este cliente, el más reciente. */
export async function permisoDeHoy(db, { organizationId, clienteId, cobradorId, country }) {
  const { inicio } = getLocalDayRange(getLocalDateStr(country), country)
  return db.permisoPrestamo.findFirst({
    where: { organizationId, clienteId, cobradorId, createdAt: { gte: inicio } },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * ¿Hace falta permiso, y en qué va? `{ necesita, cantidad, saldo, permiso }`.
 * `necesita` es false para el dueño, para el cobrador con el permiso encendido
 * y para el cliente que no debe nada. Con `necesita` y un `permiso` en estado
 * `aprobado`, puede prestar (una vez).
 */
export async function situacionParaPrestar(db, { organizationId, clienteId, userId, rol, country }) {
  const nada = { necesita: false, cantidad: 0, saldo: 0, permiso: null }
  if (rol !== 'cobrador' || !clienteId) return nada
  const quien = await db.user.findUnique({
    where: { id: userId },
    select: { puedePrestarConPrestamoActivo: true, organization: { select: { permisoParaPrestarConDeuda: true } } },
  })
  if (!quien || prestaSinPermiso(quien, quien.organization)) return nada
  const vivos = await prestamosVivosDelCliente(db, { organizationId, clienteId })
  if (vivos.cantidad === 0) return nada
  const permiso = await permisoDeHoy(db, { organizationId, clienteId, cobradorId: userId, country })
  return { necesita: true, ...vivos, permiso }
}

/**
 * ¿Este cobrador puede prestarle a quien ya debe sin pedir permiso?
 *
 * ⚠ DOS LLAVES (28 oct 2026). La del cobrador (`User.puedePrestarConPrestamoActivo`)
 * y la del negocio (`Organization.permisoParaPrestarConDeuda`, en Configuración,
 * junto a «Aprobar préstamos del cobrador»). PRESTA MIL tenía a sus 10 cobradores
 * con la llave abierta, que es como nacen, y cero solicitudes: el permiso existía
 * pero se apagaba cobrador por cobrador en una pantalla donde nadie lo buscó. Con
 * la del negocio encendida, piden permiso todos. La usan la sesión (lib/auth.js,
 * lib/auth-sesion.js) y `situacionParaPrestar`: una sola regla.
 */
export function prestaSinPermiso(user, org) {
  return user?.puedePrestarConPrestamoActivo !== false && !org?.permisoParaPrestarConDeuda
}

/** El texto del freno, el mismo para el servidor y para la pantalla. */
export function textoNecesitaPermiso({ cantidad, saldo }, formatMoney) {
  const cuanto = typeof formatMoney === 'function' ? formatMoney(saldo) : `$${Number(saldo).toLocaleString('es-CO')}`
  const tiene = cantidad === 1 ? 'ya tiene un préstamo activo' : `ya tiene ${cantidad} préstamos activos`
  return `Este cliente ${tiene} y debe ${cuanto}. Para hacerle otro necesitas el permiso del administrador.`
}
