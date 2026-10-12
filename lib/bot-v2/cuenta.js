// lib/bot-v2/cuenta.js — LO QUE EL BOT SABE DE LA CUENTA DE UN DUEÑO (12 oct 2026).
//
// El dueño ya registrado que le escribía al bot recibía respuestas sin ningún
// dato de su cuenta: a «¿cuánto cuesta?» le contestaba con el guion de venta
// («puede probarlo 14 días gratis») aunque ya estuviera pagando. Aquí se saca
// UNA vez lo que el bot necesita para contestarle como a un cliente: su plan,
// si está en prueba o pagando y hasta cuándo, cuántos clientes tiene y si le
// aplica la oferta del 35 % por Nequi. El texto para el prompt lo arma
// `textoContexto` (contexto.js, puro).

import { prisma } from '@/lib/prisma'
import { PLANES_CONFIG } from '@/lib/planes'
import { precioMensual, selectPrecio } from '@/lib/precio-plan'
import { ESTADOS_ABIERTOS } from '@/lib/carga-asesor/solicitud'

/** @returns {Promise<object|null>} */
export async function cuentaDeLaOrg(organizationId, { ahora = new Date() } = {}) {
  if (!organizationId) return null
  const [org, sub, pago, clientes, seg, carga] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { plan: true, ...selectPrecio } }),
    prisma.suscripcion.findFirst({ where: { organizationId }, orderBy: { fechaVencimiento: 'desc' }, select: { fechaVencimiento: true, montoCOP: true } }),
    prisma.pagoSuscripcion.count({ where: { organizationId, montoCOP: { gt: 0 } } }),
    prisma.cliente.count({ where: { organizationId, estado: { notIn: ['eliminado'] } } }),
    prisma.seguimientoOrg.findUnique({ where: { organizationId }, select: { ofertaNequi: true } }),
    prisma.solicitudCarga.findFirst({ where: { organizationId, estado: { in: ESTADOS_ABIERTOS } }, select: { estado: true } }),
  ])
  if (!org) return null
  const vence = sub?.fechaVencimiento ?? null
  return {
    plan: PLANES_CONFIG[org.plan]?.nombre ?? org.plan,
    // El MISMO precio que cobra el sistema (preferencial incluido): ver lib/precio-plan.js.
    precio: precioMensual(org, org.plan, vence ? new Date(vence) : ahora).monto,
    enPrueba: pago === 0,
    vigente: vence ? new Date(vence) > ahora : false,
    vence: vence ? new Date(vence).toISOString() : null,
    clientes,
    ofertaNequi: seg?.ofertaNequi === 'disponible',
    cargaAbierta: carga?.estado ?? null,
  }
}
