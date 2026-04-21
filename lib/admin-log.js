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
      data: { adminId: aid, accion, organizacionId: organizacionId || null, detalle: detalle || null },
    })
  } catch (err) {
    console.warn('[adminLog] fallo al registrar:', err?.message || err, { accion, organizacionId })
    return null
  }
}
