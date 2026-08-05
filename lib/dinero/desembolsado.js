// lib/dinero/desembolsado.js — cuánto EFECTIVO salió de la caja de un cobrador
// en un día.
//
// ⚠ VIVE AQUÍ PORQUE ESTABA DUPLICADA Y ESO COSTÓ $425 MILLONES.
//
// Había dos copias con el mismo nombre y los argumentos EN ORDEN DISTINTO
// —`(org, inicio, fin, cobrador)` en `caja/route.js` y
// `(org, cobrador, inicio, fin)` en `cierre-auto/route.js`—, cada una privada de
// su archivo. Cuando apareció un tercer sitio que crea cierres —`caja/cuadre`,
// el que usa el admin al recibir el efectivo— no pudo importar ninguna, y
// simplemente NO escribió el campo: Prisma lo dejó en su `@default(0)`.
//
// Resultado medido en producción: 2.485 de 2.852 cierres (87%) con el
// desembolso en cero, y $425.397.087 prestados en 60 días que ningún cierre
// registró. La caja restaba lo cobrado contra lo esperado sin descontar nunca
// lo que el cobrador había prestado ese día.
//
// Una sola definición, importada por los tres. Si mañana aparece un cuarto
// sitio que cierre cajas, tiene de dónde tomarla.
import { prisma } from '@/lib/prisma'

/**
 * @param {string} organizationId
 * @param {Date} inicio  arranque del día local (ver getLocalDayRange)
 * @param {Date} fin     fin del día local, exclusivo
 * @param {string|null} cobradorId  null = toda la organización
 * @returns {Promise<number>} efectivo que salió de la caja, sin redondear
 */
export async function calcularDesembolsadoDia(organizationId, inicio, fin, cobradorId = null) {
  const baseWherePrestamos = {
    organizationId,
    createdAt: { gte: inicio, lt: fin },
    estado: { not: 'cancelado' },
  }

  // Vista global owner: total desembolsado de todos los préstamos del día.
  if (!cobradorId) {
    const desembolsosDia = await prisma.prestamo.aggregate({
      where: baseWherePrestamos,
      _sum: { montoPrestado: true },
    })
    return desembolsosDia._sum?.montoPrestado || 0
  }

  // Vista por cobrador: combinar (a) clientes de su ruta y (b) préstamos creados por su perfil.
  // Para renovaciones, el MovimientoCapital tiene el monto real entregado en mano
  // (no el montoPrestado completo), así que se prioriza el monto del movimiento.
  // Buscar rutas del cobrador para incluir movimientos hechos por el owner en sus rutas
  const rutasCobrador = await prisma.ruta.findMany({
    where: { cobradorId, organizationId, activo: true },
    select: { id: true },
  })
  const rutaIds = rutasCobrador.map(r => r.id)

  const [prestamosRuta, movimientosDesembolso, actividadesCreador] = await Promise.all([
    prisma.prestamo.findMany({
      where: {
        ...baseWherePrestamos,
        cliente: { ruta: { cobradorId } },
      },
      select: { id: true, montoPrestado: true, renovadoDeId: true },
    }),
    // Movimientos de desembolso: por el cobrador O en sus rutas (incluye los del owner)
    prisma.movimientoCapital.findMany({
      where: {
        organizationId,
        tipo: 'desembolso',
        createdAt: { gte: inicio, lt: fin },
        referenciaTipo: 'prestamo',
        OR: [
          { creadoPorId: cobradorId },
          ...(rutaIds.length > 0 ? [{ rutaId: { in: rutaIds } }] : []),
        ],
      },
      select: { referenciaId: true, monto: true, createdAt: true },
    }),
    prisma.actividadLog.findMany({
      where: {
        organizationId,
        userId: cobradorId,
        accion: 'crear_prestamo',
        createdAt: { gte: inicio, lt: fin },
      },
      select: { entidadId: true },
    }),
  ])

  // Mapa de préstamo → monto real del movimiento (el más reciente gana si hubo edición)
  const montoRealPorPrestamo = new Map()
  for (const m of movimientosDesembolso) {
    if (!m.referenciaId) continue
    const prev = montoRealPorPrestamo.get(m.referenciaId)
    if (!prev || m.createdAt > prev.createdAt) {
      montoRealPorPrestamo.set(m.referenciaId, { monto: m.monto, createdAt: m.createdAt })
    }
  }

  const prestamoIdsActividad = actividadesCreador
    .map((a) => a.entidadId)
    .filter((id) => !!id)

  const prestamosActividad = prestamoIdsActividad.length
    ? await prisma.prestamo.findMany({
      where: {
        organizationId,
        id: { in: prestamoIdsActividad },
        createdAt: { gte: inicio, lt: fin },
        estado: { not: 'cancelado' },
      },
      select: { id: true, montoPrestado: true, renovadoDeId: true },
    })
    : []

  const idsContabilizados = new Set()
  let total = 0

  // Fallback cuando un prestamo no tiene MovimientoCapital: en un prestamo nuevo
  // el efectivo entregado ES montoPrestado, pero en una RENOVACION el monto nuevo
  // incluye el saldo viejo absorbido (que nunca salio de la caja). Asumir
  // montoPrestado ahi inflaba la salida de caja por todo el saldo absorbido
  // (renovar 160k por 160k mostraba -160.000 sin que saliera un peso).
  const montoFallback = (p) => (p.renovadoDeId ? 0 : p.montoPrestado)

  // Préstamos de la ruta: usar monto del movimiento si existe (correcto en renovaciones)
  for (const p of prestamosRuta) {
    if (idsContabilizados.has(p.id)) continue
    idsContabilizados.add(p.id)
    const mov = montoRealPorPrestamo.get(p.id)
    total += mov ? mov.monto : montoFallback(p)
  }

  // Préstamos creados por el cobrador fuera de su ruta
  for (const p of prestamosActividad) {
    if (idsContabilizados.has(p.id)) continue
    idsContabilizados.add(p.id)
    const mov = montoRealPorPrestamo.get(p.id)
    total += mov ? mov.monto : montoFallback(p)
  }

  // Movimientos del cobrador sin préstamo en ruta/actividad
  for (const mov of movimientosDesembolso) {
    if (!mov.referenciaId || idsContabilizados.has(mov.referenciaId)) continue
    idsContabilizados.add(mov.referenciaId)
    const real = montoRealPorPrestamo.get(mov.referenciaId)
    total += real ? real.monto : mov.monto
  }

  return total
}
