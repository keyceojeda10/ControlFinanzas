// lib/admin-log.js — Helper para registrar AdminLog sin romper FK
// AdminLog.adminId es FK requerida a User. Esta funcion resuelve un superadmin
// valido (o el adminId pasado) y, si no encuentra ninguno, logea en console
// y omite el insert en DB en lugar de tirar P2003 y romper el flujo padre.

import { prisma } from '@/lib/prisma'

let cachedSystemAdminId = null
let cachedAt = 0
const CACHE_TTL_MS = 5 * 60 * 1000

async function resolverSystemAdminId() {
  const ahora = Date.now()
  if (cachedSystemAdminId && ahora - cachedAt < CACHE_TTL_MS) {
    return cachedSystemAdminId
  }
  const admin = await prisma.user.findFirst({
    where: { rol: 'superadmin', activo: true },
    select: { id: true },
  })
  if (admin?.id) {
    cachedSystemAdminId = admin.id
    cachedAt = ahora
    return admin.id
  }
  // Fallback: cualquier superadmin aunque este inactivo, evitar romper el insert
  const cualquiera = await prisma.user.findFirst({
    where: { rol: 'superadmin' },
    select: { id: true },
  })
  if (cualquiera?.id) {
    cachedSystemAdminId = cualquiera.id
    cachedAt = ahora
    return cualquiera.id
  }
  return null
}

/* `AdminLog.detalle` es VARCHAR(191). Un texto más largo tira P2000 y el
   registro se pierde entero: el del precio preferencial, con la nota y el
   «antes», pasaba de largo y la ficha respondía 500 con el precio ya guardado
   (medido en el espejo el 12 sep 2026). Se corta aquí, para todos. */
export const DETALLE_MAX = 191
export const recortarDetalle = (s) => (s && s.length > DETALLE_MAX ? `${s.slice(0, DETALLE_MAX - 1)}…` : s)

export async function registrarAdminLog({ adminId, accion, organizacionId, detalle }) {
  try {
    let aid = adminId
    if (!aid || aid === 'system') {
      aid = await resolverSystemAdminId()
    }
    if (!aid) {
      console.warn('[adminLog] omitido (sin superadmin disponible):', { accion, organizacionId, detalle })
      return null
    }
    return await prisma.adminLog.create({
      data: { adminId: aid, accion, organizacionId: organizacionId || null, detalle: recortarDetalle(detalle) || null },
    })
  } catch (err) {
    console.warn('[adminLog] fallo al registrar:', err?.message || err, { accion, organizacionId })
    return null
  }
}
