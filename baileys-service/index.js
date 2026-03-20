// baileys-service/index.js — Microservicio WhatsApp via Baileys
// Corre como proceso PM2 separado en el VPS (puerto 3003)
// Se conecta a WhatsApp Web vía WebSocket, igual que abrir WhatsApp Web

const express = require('express')
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require('@whiskeysockets/baileys')
const pino = require('pino')
const qrcode = require('qrcode-terminal')
const path = require('path')

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 3003
const SECRET = process.env.BAILEYS_SECRET || 'baileys_cf_2026'
const AUTH_DIR = path.join(__dirname, 'auth_info')

// ── Estado global ───────────────────────────────────────
let sock = null
let qrString = null
let isConnected = false
let reconnectAttempts = 0
const MAX_RECONNECT = 5

// ── Rate limiter (20 mensajes/hora) ─────────────────────
const sentTimestamps = []
const RATE_LIMIT = 20
const RATE_WINDOW = 3600000 // 1 hora

function canSend() {
  const now = Date.now()
  // Limpiar timestamps viejos
  while (sentTimestamps.length > 0 && sentTimestamps[0] < now - RATE_WINDOW) {
    sentTimestamps.shift()
  }
  return sentTimestamps.length < RATE_LIMIT
}

function recordSend() {
  sentTimestamps.push(Date.now())
}

// ── Horario Colombia (8am-8pm) ──────────────────────────
function isWithinSchedule() {
  const now = new Date()
  const colombiaOffset = -5 * 60 // UTC-5
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  const colombiaMinutes = utcMinutes + colombiaOffset
  const colombiaHour = Math.floor(((colombiaMinutes % 1440) + 1440) % 1440 / 60)
  return colombiaHour >= 8 && colombiaHour < 20
}

// ── Formatear teléfono para WhatsApp ────────────────────
function formatPhone(phone) {
  let num = phone.replace(/\D/g, '')
  // Si empieza con 0, quitar
  if (num.startsWith('0')) num = num.substring(1)
  // Si no tiene código de país (10 dígitos Colombia), agregar 57
  if (num.length === 10) num = '57' + num
  return num + '@s.whatsapp.net'
}

// ── Conectar a WhatsApp ─────────────────────────────────
async function connectWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)

  const logger = pino({ level: 'silent' })

  sock = makeWASocket({
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: ['Control Finanzas', 'Chrome', '120.0.0'],
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
  })

  // QR para vincular
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      qrString = qr
      console.log('\n📱 Escanea este QR con WhatsApp:\n')
      qrcode.generate(qr, { small: true })
      console.log('\nO usa GET /qr para obtener el string QR\n')
    }

    if (connection === 'open') {
      isConnected = true
      reconnectAttempts = 0
      qrString = null
      console.log('✅ WhatsApp conectado')
    }

    if (connection === 'close') {
      isConnected = false
      const statusCode = lastDisconnect?.error?.output?.statusCode
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut

      console.log(`❌ WhatsApp desconectado (código: ${statusCode})`)

      if (shouldReconnect && reconnectAttempts < MAX_RECONNECT) {
        reconnectAttempts++
        const delayMs = Math.min(5000 * reconnectAttempts, 30000)
        console.log(`🔄 Reconectando en ${delayMs / 1000}s (intento ${reconnectAttempts}/${MAX_RECONNECT})...`)
        setTimeout(connectWhatsApp, delayMs)
      } else if (statusCode === DisconnectReason.loggedOut) {
        console.log('⚠️ Sesión cerrada. Necesitas escanear QR de nuevo.')
        // Limpiar auth para forzar nuevo QR
        const fs = require('fs')
        if (fs.existsSync(AUTH_DIR)) {
          fs.rmSync(AUTH_DIR, { recursive: true })
        }
        setTimeout(connectWhatsApp, 5000)
      } else {
        console.log('⚠️ Máximo de reconexiones alcanzado. Reinicia el servicio manualmente.')
      }
    }
  })

  sock.ev.on('creds.update', saveCreds)
}

// ── Auth middleware ──────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers['x-baileys-secret'] || req.query.secret
  if (token !== SECRET) {
    return res.status(401).json({ error: 'No autorizado' })
  }
  next()
}

// ── Endpoints ───────────────────────────────────────────

// Estado del servicio
app.get('/status', auth, (req, res) => {
  res.json({
    connected: isConnected,
    hasQR: !!qrString,
    messagesThisHour: sentTimestamps.filter(t => t > Date.now() - RATE_WINDOW).length,
    rateLimit: RATE_LIMIT,
    withinSchedule: isWithinSchedule(),
  })
})

// QR para vincular (si no está conectado)
app.get('/qr', auth, (req, res) => {
  if (isConnected) {
    return res.json({ connected: true, qr: null })
  }
  if (!qrString) {
    return res.json({ connected: false, qr: null, message: 'Esperando QR...' })
  }
  res.json({ connected: false, qr: qrString })
})

// Enviar mensaje
app.post('/send', auth, async (req, res) => {
  const { telefono, mensaje } = req.body

  if (!telefono || !mensaje) {
    return res.status(400).json({ error: 'telefono y mensaje son requeridos' })
  }

  if (!isConnected || !sock) {
    return res.status(503).json({ error: 'WhatsApp no conectado', needsQR: !!qrString })
  }

  if (!canSend()) {
    return res.status(429).json({ error: 'Rate limit alcanzado (20/hora)', retryAfterMs: RATE_WINDOW })
  }

  if (!isWithinSchedule()) {
    return res.status(200).json({
      sent: false,
      reason: 'fuera_de_horario',
      message: 'Solo se envían mensajes entre 8am-8pm Colombia',
    })
  }

  const jid = formatPhone(telefono)

  // Responder inmediatamente, enviar con delay en background
  res.json({ queued: true, jid, estimatedDelay: '5-15s' })

  // Delay aleatorio anti-ban (5-15 segundos)
  const randomDelay = 5000 + Math.random() * 10000
  console.log(`⏳ Enviando a ${jid} en ${Math.round(randomDelay / 1000)}s...`)

  setTimeout(async () => {
    try {
      // Simular "escribiendo..." (anti-ban)
      await sock.presenceSubscribe(jid)
      await delay(500)
      await sock.sendPresenceUpdate('composing', jid)
      await delay(2000 + Math.random() * 3000)
      await sock.sendPresenceUpdate('paused', jid)
      await delay(500)

      await sock.sendMessage(jid, { text: mensaje })
      recordSend()
      console.log(`✅ Mensaje enviado a ${jid}`)
    } catch (err) {
      console.error(`❌ Error enviando a ${jid}:`, err.message)
    }
  }, randomDelay)
})

// ── Iniciar ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Baileys Service corriendo en puerto ${PORT}`)
  console.log(`🔑 Secret: ${SECRET.substring(0, 8)}...`)
  console.log(`⏰ Horario: 8am-8pm Colombia`)
  console.log(`📊 Rate limit: ${RATE_LIMIT} mensajes/hora\n`)
  connectWhatsApp()
})
