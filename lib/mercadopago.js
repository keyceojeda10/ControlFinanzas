// lib/mercadopago.js — Cliente de MercadoPago (SDK v2)
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
})

export const preferenceApi = new Preference(client)
export const paymentApi    = new Payment(client)

export const PLANES = {
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
