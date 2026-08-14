/* ══ EL LIBRO DE PAGOS DEL SAAS ═══════════════════════════════════════════════
 *
 * Reportado por el dueño el 14 ago 2026:
 *
 *   «El MRR puede decir 2.500.000, pero a día de hoy no sé cuántos ya me han
 *    pagado. No sé si me han pagado un millón, si me han pagado 300, si me han
 *    pagado 2 millones.»
 *
 * No era un fallo de la pantalla: el dato no existía. `Suscripcion` guarda UNA
 * fila por organización y renovar la pisa —`montoCOP`, la fecha y el id de la
 * transacción se sobrescriben—, así que del pago anterior no quedaba rastro.
 * Con 46 organizaciones pagando y renovaciones cada mes, el historial se
 * borraba a sí mismo.
 *
 * Este módulo es el único sitio que escribe en `PagoSuscripcion`. La regla es
 * corta: `Suscripcion` dice hasta cuándo tiene servicio, esto dice cuánto entró
 * y cuándo. Una fila por pago, y no se vuelve a tocar.
 *
 * ⚠ Se llama SIEMPRE dentro de la transacción que activa el plan. Si el plan se
 *   activa y el apunte no se escribe, vuelve el problema de origen: servicio
 *   dado y plata sin registrar.
 */

/**
 * Apunta un pago en el libro.
 *
 * @param {object} tx  cliente Prisma de la transacción (o `prisma` suelto)
 * @param {object} p
 * @param {string} p.organizationId
 * @param {string} p.plan              ya sanitizado
 * @param {number} p.montoCOP
 * @param {string} [p.periodo]         mensual | trimestral | anual
 * @param {string} p.gateway           wompi | mercadopago | manual
 * @param {string} [p.gatewayId]       id de la transacción; null en los manuales
 * @param {string} [p.referencia]
 * @param {string} [p.adminId]         quién lo registró, si fue a mano
 * @param {string} [p.origen]          directo | reconstruido
 * @param {Date}   [p.fecha]
 * @returns {Promise<object|null>} la fila creada, o null si no había nada que apuntar
 */
export async function registrarPagoSuscripcion(tx, {
  organizationId,
  plan,
  montoCOP,
  periodo = 'mensual',
  gateway,
  gatewayId = null,
  referencia = null,
  adminId = null,
  origen = 'directo',
  fecha,
}) {
  const monto = Math.round(Number(montoCOP) || 0)

  /* Un plan de $0 no es un pago: son los trials y las cortesías. Apuntarlos
     ensuciaría el «cuánto entró» con filas de cero, que es justo la clase de
     dato irrelevante que hay que quitar del panel, no añadirle. */
  if (monto <= 0) return null
  if (!organizationId || !plan || !gateway) return null

  /* Misma llave de idempotencia que ya usaba el webhook. Sin esto, un reintento
     de la pasarela apuntaría el mismo pago dos veces y el mes saldría inflado
     —el error que este libro existe para no volver a cometer. */
  if (gatewayId) {
    const yaEsta = await tx.pagoSuscripcion.findUnique({
      where: { gatewayId: String(gatewayId) },
      select: { id: true },
    })
    if (yaEsta) return null
  }

  return tx.pagoSuscripcion.create({
    data: {
      organizationId,
      plan,
      montoCOP: monto,
      periodo,
      gateway,
      gatewayId: gatewayId ? String(gatewayId) : null,
      referencia,
      adminId,
      origen,
      ...(fecha && { fecha }),
    },
  })
}

/* ── Rescatar el pasado ────────────────────────────────────────────────────
 *
 * De marzo a agosto de 2026 los pagos no se guardaron en ninguna tabla, pero sí
 * dejaron rastro en `AdminLog`: el monto va escrito dentro de la frase. Estas
 * dos formas son las únicas que ha usado el sistema.
 *
 * Vive aquí y no dentro del script para que las pruebas la cubran: es la pieza
 * de la que sale una cifra de dinero a partir de un texto, o sea la que hay que
 * vigilar. */

const PERIODOS = { mensual: 'mensual', trimestral: 'trimestral', anual: 'anual' }

/** «$39.000» y «$39000» son el mismo número: el panel pone separador de miles y
 *  el webhook no. */
export const montoDeTexto = (s) => parseInt(String(s).replace(/[.,\s]/g, ''), 10) || 0

/**
 * Lee un `AdminLog` de activación y devuelve el apunte, o null si no se entiende.
 * @param {{id:string, adminId?:string, detalle?:string}} log
 */
export function leerApunteDeAdminLog(log) {
  const t = log?.detalle || ''

  // Pago aprobado por wompi #1485602-1786736042-25463. Plan: starter. Monto: $39000
  // El `$` es opcional: uno de marzo se reprocesó a mano y quedó «Monto: 1500 [REPROCESADO…]».
  const aprobado = /Pago aprobado por (\w+) #(\S+?)\.\s*Plan:\s*(\w+)\.\s*Monto:\s*\$?([\d.,]+)/.exec(t)
  if (aprobado) {
    const [, gateway, gatewayId, plan, monto] = aprobado
    return {
      gateway,
      gatewayId,
      plan,
      montoCOP: montoDeTexto(monto),
      // El webhook no escribe el período. Todo lo cobrado por pasarela es mensual.
      periodo: 'mensual',
      adminId: null,
    }
  }

  // Plan starter asignado (pago directo). Período: Mensual. Monto: $39.000. Vigente hasta: 13/9/2026
  // ⚠ «Periodo» sin tilde es la forma vieja: 18 apuntes de abril a julio la usan.
  // Exigir la tilde dejaba fuera $1.116.000 sin que nadie se enterara.
  const directo = /Plan (\w+) asignado \(pago directo\)\.\s*Per[íi]odo:\s*(\w+)\.\s*Monto:\s*\$?([\d.,]+)/.exec(t)
  if (directo) {
    const [, plan, periodo, monto] = directo
    return {
      gateway: 'manual',
      // `adminlog:` no puede chocar nunca con un id real de pasarela, y hace que
      // volver a correr la reconstrucción no duplique el apunte.
      gatewayId: `adminlog:${log.id}`,
      plan,
      montoCOP: montoDeTexto(monto),
      periodo: PERIODOS[periodo.toLowerCase()] ?? 'mensual',
      adminId: log.adminId ?? null,
    }
  }

  return null
}
