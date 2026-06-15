// lib/suscripcion.js — Validacion de suscripcion activa para API routes.
//
// El bloqueo por suscripcion vencida vivia SOLO en el layout del dashboard
// (redirige a /suscripcion-vencida al cargar una pagina). Pero las API routes
// no pasan por ese layout, asi que un trial vencido podia seguir registrando
// clientes/pagos via API — sobre todo por el sync offline de la PWA, que
// reenvia los registros directo a las APIs sin tocar la UI.
//
// Este helper se llama en las APIs de datos para cortar ese hueco a nivel
// servidor. Lee la DB (no el JWT, que puede estar stale) para decidir.

import { prisma } from '@/lib/prisma'

// Devuelve true si la organizacion tiene la suscripcion vencida.
// Superadmin nunca esta vencido. Si no hay suscripcion registrada, no bloquea
// (cuentas legacy / casos sin sub creada todavia).
export async function suscripcionVencida(session) {
  if (!session?.user) return false
  if (session.user.rol === 'superadmin') return false
  const organizationId = session.user.organizationId
  if (!organizationId) return false

  const sub = await prisma.suscripcion.findFirst({
    where: {
      organizationId,
      // Ignorar suscripciones 'pending' (creadas al iniciar pago en MP pero
      // nunca completadas) — mismo criterio que auth.js y el layout.
      OR: [{ mpStatus: null }, { mpStatus: { not: 'pending' } }],
    },
    orderBy: { fechaVencimiento: 'desc' },
    select: { fechaVencimiento: true },
  })

  if (!sub?.fechaVencimiento) return false
  return new Date(sub.fechaVencimiento) < new Date()
}

// Helper para usar al inicio de un handler de API. Si esta vencida, devuelve
// una Response 403 lista para retornar; si no, devuelve null (sigue el flujo).
//
//   const bloqueo = await bloquearSiSuscripcionVencida(session)
//   if (bloqueo) return bloqueo
export async function bloquearSiSuscripcionVencida(session) {
  if (await suscripcionVencida(session)) {
    return Response.json(
      { error: 'Tu suscripción está vencida. Renueva tu plan para continuar.', suscripcionVencida: true },
      { status: 403 }
    )
  }
  return null
}
