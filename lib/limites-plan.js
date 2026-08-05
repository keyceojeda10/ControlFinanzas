// lib/limites-plan.js — Verificacion de limites de plan y enforcement de downgrade
//
// Cuando un org baja de plan (ej professional → starter), puede tener mas
// rutas/usuarios/clientes de los que su plan nuevo permite. Este modulo
// determina cuales recursos estan "dentro del plan" y cuales estan "congelados".
//
// Regla de oro: NUNCA borrar datos. Las rutas/clientes congelados siguen
// visibles y pueden recibir pagos, pero no permiten crear clientes/prestamos nuevos.

import { prisma }        from '@/lib/prisma'
import { PLANES_CONFIG } from '@/lib/planes'

// Verifica limites completos de una org (para UI y dashboards)
export async function verificarLimitesPlan(organizationId) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true, cobradoresExtra: true, rutasExtra: true, clientesExtra: true },
  })
  if (!org) return null

  const config = PLANES_CONFIG[org.plan] || PLANES_CONFIG.starter

  const [clientes, usuarios, rutas] = await Promise.all([
    prisma.cliente.count({ where: { organizationId, estado: { notIn: ['eliminado'] } } }),
    prisma.user.count({ where: { organizationId, activo: true } }),
    prisma.ruta.count({ where: { organizationId, activo: true } }),
  ])

  const limiteRutas    = config.maxRutas    + (org.rutasExtra || 0)
  const limiteUsuarios = config.maxUsuarios + (org.cobradoresExtra || 0)
  // El cupo extra de clientes sigue el mismo patrón que los otros dos: se suma
  // al del plan. Es para casos puntuales —a alguien se le prometió más de lo
  // que su plan da— sin forzarle a subir de plan.
  const limiteClientes = config.maxClientes + (org.clientesExtra || 0)

  return {
    plan: org.plan,
    clientes: { usado: clientes, limite: limiteClientes, excede: clientes > limiteClientes },
    usuarios: { usado: usuarios, limite: limiteUsuarios, excede: usuarios > limiteUsuarios },
    rutas:    { usado: rutas,    limite: limiteRutas,    excede: rutas > limiteRutas },
    excedeAlgo: clientes > limiteClientes || usuarios > limiteUsuarios || rutas > limiteRutas,
  }
}

// Devuelve los IDs de rutas permitidas por el plan (las primeras N por orden/creacion)
export async function obtenerRutasPermitidas(organizationId) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true, rutasExtra: true },
  })
  if (!org) return []

  const config = PLANES_CONFIG[org.plan] || PLANES_CONFIG.starter
  const limite = config.maxRutas + (org.rutasExtra || 0)

  const rutas = await prisma.ruta.findMany({
    where: { organizationId, activo: true },
    orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  })

  return new Set(rutas.slice(0, limite).map(r => r.id))
}

// Verifica si una ruta especifica esta dentro del limite del plan
export async function rutaPermitida(organizationId, rutaId) {
  const permitidas = await obtenerRutasPermitidas(organizationId)
  return permitidas.has(rutaId)
}

// Devuelve IDs de usuarios permitidos por el plan.
// El owner siempre cuenta; los cobradores se priorizan por orden/creacion.
export async function obtenerUsuariosPermitidos(organizationId) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true, cobradoresExtra: true },
  })
  if (!org) return new Set()

  const config = PLANES_CONFIG[org.plan] || PLANES_CONFIG.starter
  const limite = config.maxUsuarios + (org.cobradoresExtra || 0)

  const usuarios = await prisma.user.findMany({
    where: { organizationId, activo: true },
    orderBy: [
      { rol: 'asc' },      // owner (alphabetically first) antes que cobrador
      { orden: 'asc' },
      { createdAt: 'asc' },
    ],
    select: { id: true },
  })

  return new Set(usuarios.slice(0, limite).map(u => u.id))
}

// Verifica si un usuario especifico esta dentro del limite del plan
export async function usuarioPermitido(organizationId, userId) {
  const permitidos = await obtenerUsuariosPermitidos(organizationId)
  return permitidos.has(userId)
}
