// lib/clientes/misma-persona.js — UNA PERSONA, UNA FICHA POR RUTA.
//
// ══ POR QUÉ (5 nov 2026) ═══════════════════════════════════════════════════
//
// PRESTA MIL: «tenemos un cliente bueno a un millón en la ruta 1 y nos pide
// 500 mil más. Para no subirle la cuota se lo mandamos a un compañero de la
// ruta 8 […] pero no lo puede registrar con la misma cédula». El cobrador le
// cambiaba un número a la cédula, y con eso un clavo en una ruta dejaba de
// verse en la otra: medido, 2 parejas así en su negocio.
//
// Ahora la cédula es única por RUTA (`@@unique([organizationId, cedula, rutaId])`)
// y un buen cliente puede tener ficha en dos rutas. Lo que no puede pasar es que
// los controles miren una sola ficha: el clavo, el reporte y «prestarle a quien
// ya debe» preguntan por la PERSONA. Esta es la única forma de saber quién es.
//
// ⚠ Una cédula vacía o «SIN-…» no junta a nadie: cada ficha es su propia persona.

export const sinCedula = (c) => !c || String(c).trim().length < 5 || String(c).trim().startsWith('SIN-')

/**
 * Los ids de todas las fichas de la persona en este negocio, la pedida incluida.
 * Sirve con el cliente de Prisma o con una transacción.
 *
 * @param {object} db
 * @param {{ organizationId: string, clienteId?: string|null, cedula?: string|null }} a
 * @returns {Promise<string[]>}
 */
export async function fichasDeLaPersona(db, { organizationId, clienteId = null, cedula = null }) {
  let doc = cedula != null ? String(cedula).trim() : null
  if (!doc && clienteId) {
    const c = await db.cliente.findFirst({ where: { id: clienteId, organizationId }, select: { cedula: true } })
    doc = c?.cedula ?? null
  }
  if (sinCedula(doc)) return clienteId ? [clienteId] : []
  const filas = await db.cliente.findMany({ where: { organizationId, cedula: doc }, select: { id: true } })
  const ids = filas.map((f) => f.id)
  if (clienteId && !ids.includes(clienteId)) ids.push(clienteId)
  return ids
}

/**
 * ¿Qué pasa si se registra esta cédula en esta ruta? La MISMA respuesta para la
 * tarjeta de «nuevo cliente» y para el servidor que lo guarda.
 *
 *   · 'misma'     — ya tiene ficha ahí (o, para el cobrador, en una de sus
 *                   rutas): no se crea otra. Si estaba borrada, se reactiva.
 *   · 'otra'      — tiene ficha en otra ruta y paga bien (o lo hace el dueño):
 *                   se registra también aquí, con la misma cédula.
 *   · 'bloqueada' — tiene ficha en otra ruta y paga mal: el cobrador no puede;
 *                   le avisa al dueño, que sí puede.
 *   · null        — no está en el negocio.
 *
 * «Paga mal» es el rojo del reporte en ESTE negocio: clavo abierto, más de 30
 * días de atraso o la estrella roja (lib/reporte-cliente.js). El ámbar pasa.
 *
 * @param {{ fichas: Array<{clienteId:string, rutaId:string|null, eliminado:boolean}>,
 *   rutaPedida: string|null, esDueno: boolean, rutasDelUsuario?: string[], pagaMal: boolean }} a
 * @returns {{ caso: 'misma'|'otra'|'bloqueada'|null, ficha: object|null }}
 */
export function casoDeLaCedula({ fichas = [], rutaPedida = null, esDueno = false, rutasDelUsuario = [], pagaMal = false }) {
  if (!fichas.length) return { caso: null, ficha: null }
  const enEsaRuta = fichas.find((f) => (f.rutaId ?? null) === (rutaPedida ?? null))
  if (enEsaRuta) return { caso: 'misma', ficha: enEsaRuta }
  // Al cobrador que ya la tiene en OTRA de sus rutas se le manda a esa ficha.
  const enLasSuyas = !esDueno && fichas.find((f) => !f.eliminado && rutasDelUsuario.includes(f.rutaId))
  if (enLasSuyas) return { caso: 'misma', ficha: enLasSuyas }
  const ficha = fichas.find((f) => !f.eliminado) ?? fichas[0]
  return { caso: pagaMal && !esDueno ? 'bloqueada' : 'otra', ficha }
}

/**
 * Antes de llevar fichas a una ruta: los nombres de las personas que YA tienen
 * otra ficha en ella. Una persona no puede tener dos fichas en la misma ruta
 * (`@@unique([organizationId, cedula, rutaId])`): sin esta pregunta, unir dos
 * rutas o pasar clientes de una a otra reventaba en la base con un 500.
 *
 * @returns {Promise<string[]>}
 */
export async function chocanEnLaRuta(db, { organizationId, clienteIds = [], rutaId }) {
  if (!rutaId || !clienteIds.length) return []
  const movidos = await db.cliente.findMany({
    where: { organizationId, id: { in: clienteIds } },
    select: { id: true, nombre: true, cedula: true },
  })
  const cedulas = [...new Set(movidos.map((c) => c.cedula).filter((c) => !sinCedula(c)))]
  if (!cedulas.length) return []
  const yaAhi = await db.cliente.findMany({
    where: { organizationId, rutaId, cedula: { in: cedulas }, id: { notIn: clienteIds } },
    select: { cedula: true },
  })
  const ocupadas = new Set(yaAhi.map((c) => c.cedula))
  return movidos.filter((c) => ocupadas.has(c.cedula)).map((c) => c.nombre)
}

/** «Ana y Luis tienen» / «Ana tiene»: para el error de un choque. */
export function textoDelChoque(nombres) {
  const lista = nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}` : nombres[0]
  return `${lista} ya ${nombres.length > 1 ? 'tienen' : 'tiene'} ficha en esa ruta: una persona no puede tener dos fichas en la misma ruta.`
}
