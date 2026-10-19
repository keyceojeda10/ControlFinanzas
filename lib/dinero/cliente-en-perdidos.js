// lib/dinero/cliente-en-perdidos.js — ¿Este cliente tiene un préstamo dado por
// perdido, todavía vivo?
//
// Lo pidió el dueño el 17 oct 2026 a partir de lo que le dijo su mejor cliente:
// en su propio negocio había clientes en perdidos («clavos») a los que otros
// cobradores les volvían a prestar, porque nada en la pantalla los marcaba como
// riesgo. Decisión: al COBRADOR se le bloquea prestarle o renovarle; el DUEÑO ve
// el aviso y solo presta si lo confirma a propósito (DETALLES-PRESTAMOS #17).
//
// Una sola pregunta para crear, aprobar y renovar, y una sola cifra para el aviso.
import { calcularSaldoPendiente } from '@/lib/calculos'

/** Los préstamos en perdidos vivos de un cliente, con lo que deben. */
export async function perdidosDelCliente(db, { organizationId, clienteId, salvo = null }) {
  if (!clienteId) return null
  const prestamos = await db.prestamo.findMany({
    where: {
      organizationId, clienteId, esClavo: true, estado: 'activo',
      ...(salvo ? { id: { not: salvo } } : {}),
    },
    select: { id: true, totalAPagar: true, totalPagado: true, clavoAt: true, pagos: { select: { montoPagado: true, tipo: true } } },
  })
  if (!prestamos.length) return null
  const saldo = Math.round(prestamos.reduce((a, p) => a + Math.max(0, calcularSaldoPendiente(p) || 0), 0))
  const desde = prestamos.map((p) => p.clavoAt).filter(Boolean).sort((a, b) => new Date(a) - new Date(b))[0] ?? null
  return { cantidad: prestamos.length, saldo, desde }
}

/** El texto del aviso, el mismo para el error del servidor y para la pantalla. */
export function textoClienteEnPerdidos(info, formatMoney) {
  if (!info) return null
  const cuanto = typeof formatMoney === 'function' ? formatMoney(info.saldo) : `$${Number(info.saldo).toLocaleString('es-CO')}`
  return `Este cliente tiene ${info.cantidad === 1 ? 'un préstamo marcado' : `${info.cantidad} préstamos marcados`} como clavo: debe ${cuanto}.`
}
