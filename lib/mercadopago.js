// lib/mercadopago.js — Cliente de MercadoPago (SDK v2)
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
})

export const preferenceApi = new Preference(client)
export const paymentApi    = new Payment(client)

export const PLANES = {
  basic:        { nombre: 'Basic',        precio: 80000  },
  standard:     { nombre: 'Standard',     precio: 150000 },
  professional: { nombre: 'Professional', precio: 250000 },
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
