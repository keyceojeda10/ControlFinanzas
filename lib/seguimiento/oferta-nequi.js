/* ── EL 35 % POR DEJAR EL NEQUI GUARDADO ─────────────────────────────────────
 *
 * Decisión de Carlos (12 oct 2026): 35 %, no 50 %. Medido ese día: de 8
 * negocios con Nequi guardado siguen pagando los 8; de 68 que pagan a mano,
 * 46. Se paga solo si 1 de cada 3 renueva un mes más.
 *
 * ⚠ UNA VEZ Y AL PRIMER COBRO AUTOMÁTICO. Se monta como precio preferencial
 *   temporal «por 1 cobro» (el mismo camino del superadmin, `leerPreferencial`)
 *   que empieza en el próximo periodo: si guarda el Nequi estando vencido, el
 *   cobro de ese momento ya sale con descuento; si está al día, el siguiente.
 *   Así nadie guarda el Nequi, cobra el descuento y lo borra antes de pagar.
 *
 * ⚠ NO PISA UN PRECIO PREFERENCIAL VIGENTE. Uno definitivo se perdería al
 *   vencer el temporal. Si ya tiene uno, se marca `sin_aplicar` y se le avisa a
 *   Carlos para que lo decida él.
 *
 * Se llama desde las TRES vías que guardan el medio de pago: `fuente`, `token`
 * y `nequi` (app/api/pagos/wompi/*). Arreglar una y dejar las otras es el error
 * que este repo ya pagó dos veces.
 */

import { prisma } from '@/lib/prisma'
import { selectPrecio, inicioDelPeriodo, precioMensual, estadoPreferencial, leerPreferencial } from '@/lib/precio-plan'
import { sendMessage } from '@/lib/telegram'
import { precioConDescuento, DESCUENTO_NEQUI } from './reglas'

export async function aplicarOfertaNequi(organizationId, { ahora = new Date() } = {}) {
  try {
    const seg = await prisma.seguimientoOrg.findUnique({ where: { organizationId } })
    if (seg?.ofertaNequi !== 'disponible') return { aplicada: false, motivo: 'sin_oferta' }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        nombre: true, plan: true, ...selectPrecio,
        suscripciones: { orderBy: { fechaVencimiento: 'desc' }, take: 1, select: { estado: true, fechaVencimiento: true } },
      },
    })
    if (!org) return { aplicada: false, motivo: 'sin_org' }

    const estado = estadoPreferencial(org, ahora)
    if (estado === 'definitivo' || estado === 'temporal') {
      await prisma.seguimientoOrg.update({ where: { organizationId }, data: { ofertaNequi: 'sin_aplicar', ofertaNequiAt: ahora } })
      await sendMessage(`<b>${org.nombre}</b> guardó su Nequi con la oferta del ${DESCUENTO_NEQUI * 100} %, pero ya tiene un precio preferencial (${estado}). No se aplicó: decídelo en el superadmin.`, null, 'escalamiento').catch(() => null)
      return { aplicada: false, motivo: 'ya_tiene_preferencial' }
    }

    const inicio = inicioDelPeriodo(org.suscripciones[0] ?? null, ahora)
    const { lista } = precioMensual(org, org.plan, inicio)
    const leido = leerPreferencial(
      { plan: org.plan, precio: precioConDescuento(lista), cobros: 1, nota: `Oferta ${DESCUENTO_NEQUI * 100} % por Nequi guardado (seguimiento)` },
      { inicio, country: org.country ?? 'co' },
    )
    if (leido.error) return { aplicada: false, motivo: leido.error }

    await prisma.$transaction([
      prisma.organization.update({ where: { id: organizationId }, data: leido.data }),
      prisma.seguimientoOrg.update({ where: { organizationId }, data: { ofertaNequi: 'aplicada', ofertaNequiAt: ahora } }),
    ])
    return { aplicada: true, precio: leido.data.precioPreferencial, lista }
  } catch (e) {
    /* Nunca tumba el guardado del medio de pago: el descuento se puede poner a
       mano; un Nequi que no se guarda por esto, no. */
    console.error('[oferta-nequi]', organizationId, e?.message)
    return { aplicada: false, motivo: 'error' }
  }
}
