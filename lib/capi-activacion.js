// lib/capi-activacion.js — el evento que Meta debe perseguir
//
// ══ POR QUÉ EXISTE ════════════════════════════════════════════════════════
//
// Hasta ahora el CAPI le mandaba a Meta el evento de REGISTRO. Medido contra
// producción (450 organizaciones, agosto 2026), registrarse predice muy poco:
// de los que se registran, solo el 12 % termina pagando.
//
// Lo que sí predice es cuántos clientes carga en la cartera:
//
//     0 clientes ....... 0,6 % paga
//     1 a 5 ............ 2,2 %
//     6 a 20 ........... 21,4 %   ← primer escalón
//     21 a 50 .......... 51,7 %   ← segundo escalón
//     51 o más ......... 80,6 %
//
// Entre el quinto y el sexto cliente la conversión se multiplica por diez. Ese
// es el evento que vale la pena optimizar: al pasar de 5 a 6, el usuario deja
// de ser «un registro» y pasa a ser alguien que probablemente pague.
//
// Mandamos dos hitos:
//
//   Activacion   → cruzó 6 clientes  (21,4 % paga)  — el que optimiza campañas
//   Activacion21 → cruzó 21 clientes (51,7 % paga)  — señal de cartera grande
//
// ══ POR QUÉ SOLO AL CRUZAR, Y NO EN CADA CLIENTE ══════════════════════════
//
// El evento debe dispararse UNA vez por organización, en la transición exacta.
// Si se mandara en cada cliente creado, una cartera de 300 generaría 300
// eventos y Meta optimizaría hacia volumen de eventos, no hacia calidad.
// Por eso `dispararSiCruzoUmbral` recibe el conteo ANTES y DESPUÉS: solo emite
// cuando el umbral queda estrictamente entre los dos.
//
// La carga masiva (foto del cuaderno / Excel) mete N clientes de un golpe, así
// que puede cruzar los dos umbrales en una sola llamada. Por eso se evalúan
// ambos de forma independiente y no con un `else if`.
//
// ══ QUÉ DATOS SE MANDAN ═══════════════════════════════════════════════════
//
// Meta hace el match con email y teléfono hasheados. Los sacamos del usuario
// owner de la organización, que es el mismo dato con el que se registró y por
// tanto el que ya conoce del formulario de Lead Ads.
//
// Nunca lanza: si el CAPI falla, la creación del cliente no se puede caer por
// eso. Todo va detrás de un catch que solo escribe en consola.

import { prisma } from '@/lib/prisma'
import { sendConversionEvent } from '@/lib/facebook-capi'

/* Los dos escalones de la escalera de conversión. Si estos números cambian,
   cámbielos aquí: son la única fuente. */
export const UMBRAL_ACTIVACION = 6
export const UMBRAL_CARTERA_GRANDE = 21

const EVENTO_POR_UMBRAL = {
  [UMBRAL_ACTIVACION]: 'Activacion',
  [UMBRAL_CARTERA_GRANDE]: 'Activacion21',
}

/**
 * Emite el evento de activación si el conteo de clientes cruzó un umbral.
 *
 * @param {object}  args
 * @param {string}  args.organizationId
 * @param {number}  args.antes    Clientes que había ANTES de esta operación
 * @param {number}  args.despues  Clientes que hay DESPUÉS
 */
export async function dispararSiCruzoUmbral({ organizationId, antes, despues }) {
  if (!organizationId) return

  const cruzados = [UMBRAL_ACTIVACION, UMBRAL_CARTERA_GRANDE]
    .filter((u) => antes < u && despues >= u)

  if (cruzados.length === 0) return

  try {
    /* El owner es quien se registró: su email y teléfono son los que Meta ya
       tiene del formulario. Si la org tuviera varios owners, el primero por
       fecha es el que creó la cuenta. */
    const owner = await prisma.user.findFirst({
      where: { organizationId, rol: 'owner' },
      orderBy: { createdAt: 'asc' },
      select: { email: true, telefono: true },
    })
    if (!owner) return

    const telefonoE164 = owner.telefono
      ? (() => {
          const d = owner.telefono.replace(/\D/g, '')
          return d.startsWith('57') ? d : `57${d}`
        })()
      : undefined

    for (const umbral of cruzados) {
      await sendConversionEvent({
        eventName: EVENTO_POR_UMBRAL[umbral],
        email: owner.email || undefined,
        phone: telefonoE164,
        eventSourceUrl: 'https://app.control-finanzas.com/clientes',
        customData: {
          currency: 'COP',
          value: 0,
          content_name: `clientes_${umbral}`,
          num_items: despues,
        },
      })
      console.log(`[CAPI] ${EVENTO_POR_UMBRAL[umbral]} org=${organizationId} clientes=${despues}`)
    }
  } catch (err) {
    console.error('[CAPI activacion]', err.message)
  }
}

/**
 * Envoltorio para el caso «acabo de crear N clientes y no sé cuántos había».
 * Cuenta el total actual y deduce el conteo anterior restando los recién
 * creados. Se usa donde no es práctico contar antes de la operación.
 *
 * @param {object} args
 * @param {string} args.organizationId
 * @param {number} args.creados  Cuántos clientes se acaban de crear
 */
export async function dispararTrasCrear({ organizationId, creados = 1 }) {
  if (!organizationId || creados < 1) return
  try {
    const despues = await prisma.cliente.count({
      where: { organizationId, estado: { not: 'eliminado' } },
    })
    await dispararSiCruzoUmbral({ organizationId, antes: despues - creados, despues })
  } catch (err) {
    console.error('[CAPI activacion]', err.message)
  }
}
