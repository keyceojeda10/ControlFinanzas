// lib/rutas/ubicacion-aproximada.js — Dónde está, más o menos, el cliente que
// no tiene ubicación guardada (18 nov 2026).
//
// El mapa grande de la ruta salía casi vacío en la mitad de las rutas: medido en
// producción ese día, solo el 40 % de los clientes en ruta tiene su ubicación
// guardada (1.479 de 3.703), pero el 73 % de los cobros del último mes trae el
// GPS del teléfono. El último cobro con GPS dice dónde se le cobró: casi siempre
// en su casa o su negocio.
//
// ⚠ ES SOLO PARA ENSEÑAR. No se guarda en el cliente ni pisa nada: el mapa lo
// pinta con otro marcador y la palabra «aproximado». Guardarlo como su
// ubicación sería inventar un dato.
//
// Dos consultas ligeras y solo para los que no tienen ubicación: el último
// cobro con GPS de cada préstamo, y sus coordenadas. Traer todos los pagos con
// GPS de una ruta grande —cientos por cliente— no cabe en la pantalla más
// abierta del sistema.

const TIPOS_DE_COBRO = ['completo', 'parcial', 'capital', 'intereses', 'liquidacion']

/**
 * @param {object} prisma  cliente de Prisma
 * @param {Array} clientes los de la ruta, ya armados (con `id`, `latitud`, `longitud`)
 * @param {Array} crudos   los de la consulta, con `prestamos: [{ id }]`
 * @param {string} organizationId
 * @returns {Promise<Array>} los mismos clientes; a los que no tienen ubicación y
 *   tienen un cobro con GPS se les añade `ubicacionAproximada: { latitud, longitud, fecha }`
 */
export async function conUbicacionAproximada(prisma, clientes, crudos, organizationId) {
  const sinUbicacion = new Set(clientes.filter((c) => c.latitud == null || c.longitud == null).map((c) => c.id))
  if (sinUbicacion.size === 0) return clientes

  const clienteDe = new Map()
  for (const c of crudos ?? []) {
    if (!sinUbicacion.has(c.id)) continue
    for (const p of c.prestamos ?? []) clienteDe.set(p.id, c.id)
  }
  if (clienteDe.size === 0) return clientes

  const donde = {
    organizationId,
    prestamoId: { in: [...clienteDe.keys()] },
    latitud: { not: null },
    longitud: { not: null },
    tipo: { in: TIPOS_DE_COBRO },
  }
  let ultimos = []
  try {
    const grupos = await prisma.pago.groupBy({ by: ['prestamoId'], where: donde, _max: { fechaPago: true } })
    if (grupos.length === 0) return clientes
    ultimos = await prisma.pago.findMany({
      where: { ...donde, OR: grupos.map((g) => ({ prestamoId: g.prestamoId, fechaPago: g._max.fechaPago })) },
      select: { prestamoId: true, latitud: true, longitud: true, fechaPago: true },
    })
  } catch {
    // El mapa es un adorno de la ruta: si esto falla, la ruta tiene que salir igual.
    return clientes
  }

  // El más reciente de todos sus préstamos.
  const mejor = new Map()
  for (const p of ultimos) {
    const cid = clienteDe.get(p.prestamoId)
    if (!cid) continue
    const previo = mejor.get(cid)
    if (!previo || new Date(p.fechaPago) > new Date(previo.fecha)) {
      mejor.set(cid, { latitud: p.latitud, longitud: p.longitud, fecha: p.fechaPago })
    }
  }
  if (mejor.size === 0) return clientes
  return clientes.map((c) => (mejor.has(c.id) ? { ...c, ubicacionAproximada: mejor.get(c.id) } : c))
}
