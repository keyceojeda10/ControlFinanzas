// lib/mercadopago.js — Cliente de MercadoPago (SDK v2)
import { MercadoPagoConfig, Preference, Payment, PreApproval } from 'mercadopago'

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
})

export const preferenceApi   = new Preference(client)
export const paymentApi      = new Payment(client)
export const preApprovalApi  = new PreApproval(client)

export const PLANES = {
  test:         { nombre: 'Test',         precio: 1500,   maxUsuarios: 1,  maxClientes: 50,   cobradorExtra: 0     },
  basic:        { nombre: 'Básico',       precio: 59000,  maxUsuarios: 1,  maxClientes: 50,   cobradorExtra: 0     },
  standard:     { nombre: 'Profesional',  precio: 119000, maxUsuarios: 3,  maxClientes: 300,  cobradorExtra: 29000 },
  professional: { nombre: 'Empresarial',  precio: 199000, maxUsuarios: 7,  maxClientes: null, cobradorExtra: 29000 },
}

const BASE = process.env.NEXTAUTH_URL || 'https://app.control-finanzas.com'

export function buildBackUrls() {
  return {
    success: `${BASE}/pago/exitoso`,
    failure: `${BASE}/pago/fallido`,
    pending: `${BASE}/pago/pendiente`,
  }
}

export function webhookUrl() {
  return `${BASE}/api/pagos/webhook`
}

// Helper para construir body de preapproval (suscripción recurrente)
export function buildPreapprovalBody({ plan, periodo, orgId, payerEmail }) {
  const planInfo = PLANES[plan]
  if (!planInfo) return null

  const frecuencia = periodo === 'anual' ? 12 : periodo === 'trimestral' ? 3 : 1
  const monto = planInfo.precio * frecuencia

  return {
    reason: `Control Finanzas - Plan ${planInfo.nombre}${frecuencia > 1 ? ` (${frecuencia} meses)` : ''}`,
    external_reference: `${orgId}|${plan}|${periodo}`,
    payer_email: payerEmail,
    auto_recurring: {
      frequency: frecuencia,
      frequency_type: 'months',
      transaction_amount: monto,
      currency_id: 'COP',
    },
    back_url: `${BASE}/pago/exitoso`,
    notification_url: webhookUrl(),
    status: 'pending',
  }
}
