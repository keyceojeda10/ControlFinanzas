/* ── TU SEGUNDO MES A MITAD DE PRECIO (1 nov 2026) ───────────────────────────
 *
 * Decisión del dueño, con los pagos reales del libro (`PagoSuscripcion`):
 *   · de los que pagaron el 1.er mes, el 52 % llegó al 5.º; de los que pagaron
 *     el 2.º, el 81 %. El segundo mes es donde más se pierde.
 *   · con cobro automático renueva el 91 / 100 / 100 %; a mano, 77 / 81 / 71 %.
 *     Lo que amarra al cliente es el cobro automático.
 *
 * Por eso: 50 % en el 2.º mes SOLO si deja el Nequi o la tarjeta guardados, y
 * solo si lo hace a tiempo (hasta el día que vence). A mano, sin descuento: un
 * descuento a mano compra un mes, no amarra a nadie.
 *
 * No es una oferta aparte: es la MISMA del 35 % por guardar el Nequi
 * (`oferta-nequi.js`), que en esta ventana sube a 50 %. Así no hay dos
 * descuentos que se sumen y cada pantalla que ya enseña esa oferta (la del
 * plan, la ventana, el aviso de vencimiento, la hoja de suscripción) lo hereda.
 *
 * ⚠ Los pagos se cuentan en el LIBRO, no en `Suscripcion`: una renovación
 *   alarga la misma fila (`lib/activar-suscripcion.js`) y contando filas
 *   parecía que todos se iban tras el primer pago, que era falso.
 */

import { finDelDiaBogota, diaBogota } from '@/lib/precio-plan'

export const DESCUENTO_SEGUNDO_MES = 0.5

/* Dos pagos a menos de esto son el MISMO periodo: un cambio de plan o unos
   adicionales comprados a mitad de mes, no una renovación. */
const DIAS_MISMO_PERIODO = 10

const MESES = { mensual: 1, trimestral: 3, semestral: 6, anual: 12 }

/**
 * Cuántos MESES ha pagado, a partir de los pagos del libro (`{ fecha, periodo }`).
 *
 * ⚠ MESES, NO PAGOS. Medido el 1 nov 2026: un negocio con UN solo pago
 *   trimestral salía como «primer mes» y se le iba a dar el 50 % en el que en
 *   realidad era su cuarto. Dos pagos a menos de 10 días son el mismo periodo
 *   (cambio de plan, adicionales): cuenta el más largo de los dos.
 */
export function mesesPagados(pagos = []) {
  const orden = pagos
    .map((p) => ({ t: new Date(p?.fecha ?? p).getTime(), meses: MESES[p?.periodo] ?? 1 }))
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t)
  let total = 0
  let ultimo = null
  let delGrupo = 0
  for (const p of orden) {
    if (ultimo == null || p.t - ultimo >= DIAS_MISMO_PERIODO * 86400000) {
      total += p.meses
      delGrupo = p.meses
    } else if (p.meses > delGrupo) {
      total += p.meses - delGrupo
      delGrupo = p.meses
    }
    ultimo = p.t
  }
  return total
}

/**
 * ¿Le toca hoy el 50 %? Pura, para poder probarla con relojes de mentira.
 *
 * @param {object} p
 * @param {number} p.meses        meses pagados (`mesesPagados`)
 * @param {boolean} p.tieneFuente ya tiene el Nequi o la tarjeta guardados
 * @param {string} p.gateway      la pasarela del país (solo Wompi guarda medio)
 * @param {Date|string|null} p.vencimiento el vencimiento del mes que está pagado
 * @param {Date} [p.ahora]
 */
export function tocaSegundoMes({ meses, tieneFuente, gateway, vencimiento, ahora = new Date() }) {
  if (meses !== 1) return false
  if (tieneFuente) return false
  if (gateway !== 'wompi') return false
  if (!vencimiento) return false
  // A tiempo = hasta que termina el día en que vence, en Bogotá.
  return ahora.getTime() <= finDelDiaBogota(diaBogota(new Date(vencimiento))).getTime()
}

/** Lo mismo, leyendo la base. Devuelve false ante cualquier duda. */
export async function enSegundoMes(prisma, organizationId, { ahora = new Date(), gateway, ignorarFuente = false } = {}) {
  const [org, pagos, sub] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { wompiFuentePagoId: true } }),
    prisma.pagoSuscripcion.findMany({
      where: { organizationId, montoCOP: { gt: 2000 } },
      select: { fecha: true, periodo: true },
    }),
    prisma.suscripcion.findFirst({
      where: { organizationId, estado: 'activa', montoCOP: { gt: 2000 } },
      orderBy: { fechaVencimiento: 'desc' },
      select: { fechaVencimiento: true },
    }),
  ])
  if (!org) return false
  return tocaSegundoMes({
    meses: mesesPagados(pagos),
    /* `ignorarFuente`: quien llama acaba de guardarla (oferta-nequi.js). ⚠ Quien
       ya la tenía y la CAMBIA en su primer mes también entra: es raro, y
       distinguirlo pediría leer el negocio antes de guardar en las tres rutas. */
    tieneFuente: !ignorarFuente && org.wompiFuentePagoId != null,
    gateway,
    vencimiento: sub?.fechaVencimiento ?? null,
    ahora,
  })
}
