// lib/rutas/orden-de-ruta.js — «OPTIMIZAR» SIN PERDER EL ORDEN DE NADIE.
//
// ══ LO QUE PASÓ (19 nov 2026, INVERSIONESJYM) ════════════════════════════════
//
// Ruta de 459 clientes. Solo 20 tenían ubicación. El cobrador tocó «Optimizar»
// cinco veces en una tarde: `optimizeRoute` devuelve los que tienen ubicación
// ordenados por cercanía y DETRÁS todos los demás, así que esos 20 quedaron de
// primeros y el resto corrido. Dueño y cobrador movieron clientes a mano 38 veces
// esa noche y no lograron dejarla como estaba. No había cómo volver: se sacó del
// respaldo nocturno del servidor.
//
// Tres reglas que salen de ahí (decisión del dueño, 19 nov 2026):
//   1. Con pocos clientes ubicados no se optimiza: no hay cercanía que calcular,
//      solo se revuelve. `ubicacionSuficiente`.
//   2. Antes de optimizar se guarda el orden que había, y el dueño puede volver
//      a él. `ordenConLoNuevoAlFinal`.
//   3. El cobrador PIDE optimizar y el dueño aprueba: el orden es UNO por ruta,
//      y el del cobrador es también el del dueño. Él sigue con el orden de antes
//      mientras tanto (lo eligió el dueño: «espera el aval»).

import { optimizeRoute } from '@/lib/routeOptimizer'

/** 8 de cada 10 clientes de la ruta con ubicación. */
export const MINIMO_CON_UBICACION = 0.8

const conUbicacion = (c) => c?.latitud != null && c?.longitud != null

/**
 * ¿Hay ubicaciones para ordenar por cercanía? Cuenta sobre la ruta ENTERA: los
 * que no tienen ubicación se van al final al optimizar, y si son muchos la ruta
 * queda revuelta.
 */
export function ubicacionSuficiente(clientes = []) {
  const total = clientes.length
  const con = clientes.filter(conUbicacion).length
  const faltan = Math.max(0, Math.ceil(total * MINIMO_CON_UBICACION) - con)
  return { con, total, faltan, alcanza: total >= 2 && con >= 2 && faltan === 0 }
}

/** La frase del aviso cuando no alcanza. Una sola, para la pantalla y el servidor. */
export function textoSinUbicacion({ con, total, faltan }) {
  const de = `Solo ${con} de tus ${total} clientes ${con === 1 ? 'tiene' : 'tienen'} ubicación`
  return `${de}. Para ordenar por cercanía hacen falta 8 de cada 10: ${faltan === 1 ? 'falta 1' : `faltan ${faltan}`}. `
    + 'Los que no tienen ubicación se irían al final y la ruta quedaría revuelta.'
}

/**
 * El orden guardado, con lo que cambió desde entonces: quien ya no está en la
 * ruta se salta y quien llegó después va al final, en el orden que tiene hoy.
 * Así se devuelve la ruta ENTERA — `reordenar` exige todos los ids.
 */
export function ordenConLoNuevoAlFinal(anterior = [], actual = []) {
  const hoy = new Set(actual)
  const vuelta = []
  const vistos = new Set()
  for (const id of Array.isArray(anterior) ? anterior : []) {
    if (hoy.has(id) && !vistos.has(id)) { vuelta.push(id); vistos.add(id) }
  }
  for (const id of actual) if (!vistos.has(id)) { vuelta.push(id); vistos.add(id) }
  return vuelta
}

const SELECT_CLIENTE = { id: true, nombre: true, latitud: true, longitud: true, ordenRuta: true }
const DE_LA_RUTA = (organizationId, rutaId) => ({ organizationId, rutaId, estado: { not: 'eliminado' } })

/** Los clientes de la ruta en su orden de hoy (el mismo de la pantalla). */
export function clientesEnOrden(prisma, { organizationId, rutaId }) {
  return prisma.cliente.findMany({
    where: DE_LA_RUTA(organizationId, rutaId),
    select: SELECT_CLIENTE,
    orderBy: [{ ordenRuta: 'asc' }, { nombre: 'asc' }],
  })
}

async function escribirOrden(tx, ids) {
  for (let i = 0; i < ids.length; i++) {
    await tx.cliente.update({ where: { id: ids[i] }, data: { ordenRuta: i } })
  }
}

/**
 * Optimiza la ruta guardando ANTES el orden que había. Lo usan el dueño al
 * tocar «Optimizar» y la aprobación del pedido del cobrador: una sola forma.
 *
 * @returns {{ ok: true, ... } | { ok: false, error: string, ubicacion }}
 */
export async function optimizarGuardandoElAnterior(prisma, { organizationId, rutaId, userId }) {
  const clientes = await clientesEnOrden(prisma, { organizationId, rutaId })
  if (clientes.length < 2) return { ok: false, error: 'La ruta necesita al menos 2 clientes para ordenarla.' }
  const ubicacion = ubicacionSuficiente(clientes)
  if (!ubicacion.alcanza) return { ok: false, error: textoSinUbicacion(ubicacion), ubicacion }

  const { optimized, sinCoords, distanciaAntes, distanciaDespues } = optimizeRoute(clientes)
  const antes = clientes.map((c) => c.id)

  await prisma.$transaction(async (tx) => {
    // Solo vale el último «anterior»: volver dos veces atrás no se ofrece.
    await tx.ordenRuta.updateMany({
      where: { organizationId, rutaId, clase: 'anterior', estado: 'vigente' },
      data: { estado: 'reemplazado' },
    })
    await tx.ordenRuta.create({
      data: { organizationId, rutaId, clase: 'anterior', estado: 'vigente', orden: antes, pedidoPorId: userId },
    })
    await escribirOrden(tx, optimized.map((c) => c.id))
  }, { timeout: 30000 })

  return {
    ok: true,
    optimizado: true,
    clientesReordenados: optimized.length,
    clientesSinUbicacion: sinCoords,
    distanciaAntes,
    distanciaDespues,
    ahorro: distanciaAntes > 0 ? Math.round(((distanciaAntes - distanciaDespues) / distanciaAntes) * 100) : 0,
    nuevoOrden: optimized.map((c) => ({ id: c.id, nombre: c.nombre })),
  }
}

/** Vuelve al orden que había antes del último «Optimizar». */
export async function volverAlOrdenAnterior(prisma, { organizationId, rutaId }) {
  const guardado = await prisma.ordenRuta.findFirst({
    where: { organizationId, rutaId, clase: 'anterior', estado: 'vigente' },
    orderBy: { createdAt: 'desc' },
  })
  if (!guardado) return { ok: false, error: 'No hay un orden anterior guardado para esta ruta.' }

  const actual = (await clientesEnOrden(prisma, { organizationId, rutaId })).map((c) => c.id)
  const ids = ordenConLoNuevoAlFinal(guardado.orden, actual)

  await prisma.$transaction(async (tx) => {
    await escribirOrden(tx, ids)
    await tx.ordenRuta.update({ where: { id: guardado.id }, data: { estado: 'usado', resueltoEn: new Date() } })
  }, { timeout: 30000 })

  return { ok: true, reordenados: ids.length, desde: guardado.createdAt }
}

/** Lo que la pantalla de la ruta necesita saber: si hay a dónde volver y si hay un pedido esperando. */
export async function estadoDelOrden(prisma, { organizationId, rutaId }) {
  const [anterior, solicitud] = await Promise.all([
    prisma.ordenRuta.findFirst({
      where: { organizationId, rutaId, clase: 'anterior', estado: 'vigente' },
      orderBy: { createdAt: 'desc' }, select: { createdAt: true, pedidoPorId: true },
    }),
    prisma.ordenRuta.findFirst({
      where: { organizationId, rutaId, clase: 'solicitud', estado: 'pendiente' },
      orderBy: { createdAt: 'desc' }, select: { id: true, pedidoPorId: true, createdAt: true },
    }),
  ])
  const quien = solicitud
    ? await prisma.user.findFirst({ where: { id: solicitud.pedidoPorId, organizationId }, select: { nombre: true } })
    : null
  // Quién lo cambió: el «Orden anterior» lo dice («antes de que Jhon la moviera»).
  const autorAnterior = anterior
    ? await prisma.user.findFirst({ where: { id: anterior.pedidoPorId, organizationId }, select: { nombre: true, rol: true } })
    : null
  return {
    anteriorDesde: anterior?.createdAt ?? null,
    anteriorPor: autorAnterior?.rol === 'cobrador' ? autorAnterior.nombre : null,
    solicitud: solicitud ? { id: solicitud.id, pedidoPor: quien?.nombre ?? 'El cobrador', desde: solicitud.createdAt } : null,
  }
}

/* ══ MOVER A MANO, CON VUELTA ATRÁS (19 nov 2026, decisión del dueño) ═════════
 * El cobrador sigue moviendo clientes de puesto al instante —es lo que hace en
 * la calle—, pero el orden es UNO por ruta y también es el del dueño. Así que,
 * antes del PRIMER movimiento del día de ese cobrador en esa ruta, se guarda el
 * orden que había (el mismo «anterior» de Optimizar) y se avisa al dueño UNA
 * vez. Los movimientos siguientes de ese día no guardan ni avisan: volver deja
 * la ruta como amaneció. */
export function inicioDelDiaBogota(ahora = new Date()) {
  const d = new Date(ahora.getTime() - 5 * 3600 * 1000)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 5))
}

/** @returns {Promise<{ primeroDelDia: boolean }>} */
export async function guardarAntesDeMoverAMano(prisma, { organizationId, rutaId, userId, ahora = new Date() }) {
  const ya = await prisma.ordenRuta.findFirst({
    where: { organizationId, rutaId, clase: 'anterior', pedidoPorId: userId, createdAt: { gte: inicioDelDiaBogota(ahora) } },
    select: { id: true },
  })
  if (ya) return { primeroDelDia: false }
  const antes = (await clientesEnOrden(prisma, { organizationId, rutaId })).map((c) => c.id)
  await prisma.$transaction([
    prisma.ordenRuta.updateMany({
      where: { organizationId, rutaId, clase: 'anterior', estado: 'vigente' },
      data: { estado: 'reemplazado' },
    }),
    prisma.ordenRuta.create({
      data: { organizationId, rutaId, clase: 'anterior', estado: 'vigente', orden: antes, pedidoPorId: userId },
    }),
  ])
  return { primeroDelDia: true }
}
