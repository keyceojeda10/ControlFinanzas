// lib/precio-desde-estado.js — lo que `precioCheckout` necesita saber del
// negocio, sacado de la respuesta de /api/pagos/estado.
//
// Lo usan la pantalla del plan y las hojas que ofrecen pagar (el año, el
// segundo mes). Si cada una armara su propio objeto, una se olvidaría del
// precio preferencial o de los adicionales y prometería una cifra que el
// checkout no cobra: el error del 12 sep 2026 (ver plan/page.jsx).

import { precioCheckout } from '@/lib/precio-plan'

export function orgPrecioDeEstado(estado, country = 'co') {
  return {
    country,
    precioPreferencial:      estado?.preferencial?.monto ?? null,
    precioPreferencialPlan:  estado?.preferencial?.plan ?? null,
    precioPreferencialHasta: estado?.preferencial?.hasta ?? null,
    cobradoresAdicionales:   estado?.adicionales?.cobradores ?? 0,
    rutasAdicionales:        estado?.adicionales?.rutas ?? 0,
  }
}

/**
 * El precio de pagar un mes y de pagar el año, con lo que se ahorra.
 * `null` si no se sabe de qué plan es el próximo cobro.
 */
export function mesYAno(estado, country = 'co') {
  const plan = estado?.proximoCobro?.plan
  if (!plan) return null
  const org = orgPrecioDeEstado(estado, country)
  const inicio = estado?.inicioPeriodo ? new Date(estado.inicioPeriodo) : new Date()
  const mes = precioCheckout(org, plan, 'mensual', inicio)
  const ano = precioCheckout(org, plan, 'anual', inicio)
  return {
    plan,
    mes: mes.total,
    ano: ano.total,
    anoAlMes: Math.round(ano.total / 12),
    ahorroAno: Math.max(0, mes.total * 12 - ano.total),
  }
}
