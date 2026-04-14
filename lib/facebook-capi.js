// lib/facebook-capi.js — Facebook Conversions API (server-side events)
import crypto from 'crypto'

const FB_PIXEL_ID = process.env.FB_PIXEL_ID
const FB_CAPI_ACCESS_TOKEN = process.env.FB_CAPI_ACCESS_TOKEN

function sha256(value) {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

export async function sendConversionEvent({ eventName, email, phone, eventSourceUrl, customData }) {
  if (!FB_PIXEL_ID || !FB_CAPI_ACCESS_TOKEN) return

  const userData = { country: [sha256('co')] }
  if (email) userData.em = [sha256(email)]
  if (phone) userData.ph = [sha256(phone.replace(/\D/g, ''))]

  const eventData = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    event_source_url: eventSourceUrl || 'https://app.control-finanzas.com/registro',
    user_data: userData,
  }
  if (customData) eventData.custom_data = customData

  const payload = {
    data: [eventData],
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${FB_PIXEL_ID}/events?access_token=${FB_CAPI_ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )
    const result = await res.json()
    if (result.error) console.error('[CAPI]', result.error)
  } catch (err) {
    console.error('[CAPI]', err.message)
  }
}
