// lib/plan-servidor.js — la barrera de plan de los endpoints, en un solo sitio.
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Doce endpoints comprobaban el plan a mano y **no lo hacían igual**:
//
//   · Diez leían `session.user.plan`, que viene del JWT.
//   · `reportes/dia` lo leía de la base.
//   · Y cuatro —Analíticas, su PDF, el ranking— no lo comprobaban en absoluto,
//     así que un plan Inicial se llevaba lo que la tabla marca como de Básico.
//
// ── ⚠ EL FALLO QUE ARREGLA, Y QUE NO SE VE PROBANDO CON UN PLAN FIJO ───────
//
// **El plan del JWT no se refresca sin volver a entrar.** O sea: un cliente
// paga, sube a Básico, abre reportes y le sigue diciendo que su plan no
// alcanza. Ha pagado y no lo tiene. Nadie lo reporta como fallo del sistema:
// lo reporta como «el pago no me sirvió».
//
// Aquí el token se usa como ATAJO —si ya alcanza, no se pregunta nada— y solo
// cuando dice que NO se comprueba contra la base antes de cerrar la puerta.
// Así el caso caro (una consulta más) es únicamente el de quien iba a recibir
// un 403, y el que acaba de pagar entra en el momento.
//
// El 403 lleva `motivo: 'plan'` para que la pantalla pueda enseñar
// `<PlanGate/>` en vez de «revisa tu conexión», que es lo que salía antes.

import { prisma } from '@/lib/prisma'
import { nivelReportes } from '@/lib/planes'

/**
 * Devuelve `null` si el negocio alcanza el nivel, o la `Response` 403 que hay
 * que devolver tal cual.
 *
 *   const veto = await exigeNivelReportes(session, 1)
 *   if (veto) return veto
 */
export async function exigeNivelReportes(session, minimo = 1) {
  if (nivelReportes(session?.user?.plan) >= minimo) return null

  const orgId = session?.user?.organizationId
  if (orgId) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true },
    })
    if (nivelReportes(org?.plan) >= minimo) return null
  }

  return Response.json(
    { error: 'Plan insuficiente', motivo: 'plan', minimo },
    { status: 403 },
  )
}
