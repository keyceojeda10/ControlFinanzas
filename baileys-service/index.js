// baileys-service/index.js — Microservicio WhatsApp via Baileys
// Corre como proceso PM2 separado en el VPS (puerto 3003)
// Usa pairing code (más confiable desde servidores que QR)

const express = require('express')
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const pino = require('pino')
const path = require('path')
const fs = require('fs')
const readline = require('readline')

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 3003
const SECRET = process.env.BAILEYS_SECRET || 'baileys_cf_2026'
const PHONE_NUMBER = process.env.PHONE_NUMBER || ''
const AUTH_DIR = path.join(__dirname, 'auth_info')

// ── Estado global ───────────────────────────────────────
let sock = null
let pairingCode = null
let isConnected = false
let reconnectAttempts = 0
const MAX_RECONNECT = 10

// ── Rate limiter (20 mensajes/hora) ─────────────────────
const sentTimestamps = []
const RATE_LIMIT = 20
const RATE_WINDOW = 3600000 // 1 hora

function canSend() {
  const now = Date.now()
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
  if (num.startsWith('0')) num = num.substring(1)
  if (num.length === 10) num = '57' + num
  return num + '@s.whatsapp.net'
}

// ── Conectar a WhatsApp ─────────────────────────────────
async function connectWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
  const logger = pino({ level: 'silent' })

  const { version } = await fetchLatestBaileysVersion()
  console.log(`📡 Usando WA versión: ${version.join('.')}`)

  sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    browser: ['Chrome (Linux)', '', ''],
    version,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 25000,
    retryRequestDelayMs: 2000,
  })

  // Pairing code: si no está registrado, pedir código
  if (!state.creds.registered) {
    if (!PHONE_NUMBER) {
      console.log('\n⚠️ No hay sesión guardada y no se configuró PHONE_NUMBER.')
      console.log('📱 Configura PHONE_NUMBER en .env con tu número (ej: 573001234567)')
      console.log('   O usa GET /pair?phone=573001234567 para vincular\n')
    } else {
      await requestPairingCode(PHONE_NUMBER)
    }
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update

    if (connection === 'open') {
      isConnected = true
      reconnectAttempts = 0
      pairingCode = null
      console.log('✅ WhatsApp conectado exitosamente')
    }

    if (connection === 'close') {
      isConnected = false
      const statusCode = lastDisconnect?.error?.output?.statusCode
      const reason = lastDisconnect?.error?.data?.reason || statusCode

      console.log(`❌ WhatsApp desconectado (código: ${reason})`)

      if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
        console.log('🔄 Sesión expirada. Limpiando auth para re-vincular...')
        if (fs.existsSync(AUTH_DIR)) {
          fs.rmSync(AUTH_DIR, { recursive: true })
        }
        pairingCode = null
        reconnectAttempts = 0
        setTimeout(connectWhatsApp, 3000)
      } else if (reconnectAttempts < MAX_RECONNECT) {
        reconnectAttempts++
        const delayMs = Math.min(3000 * reconnectAttempts, 30000)
        console.log(`🔄 Reconectando en ${delayMs / 1000}s (intento ${reconnectAttempts}/${MAX_RECONNECT})...`)
        setTimeout(connectWhatsApp, delayMs)
      } else {
        console.log('⚠️ Máximo de reconexiones. Usa GET /pair?phone=TUNUMERO para re-vincular.')
      }
    }
  })

  sock.ev.on('creds.update', saveCreds)
}

async function requestPairingCode(phone) {
  try {
    // Baileys necesita un momento para inicializar antes de pedir pairing code
    await delay(3000)
    if (!sock) return
    const code = await sock.requestPairingCode(phone)
    pairingCode = code
    console.log(`\n📱 CÓDIGO DE VINCULACIÓN: ${code}`)
    console.log(`   Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo`)
    console.log(`   Selecciona "Vincular con número de teléfono" e ingresa: ${code}\n`)
    return code
  } catch (err) {
    console.error('❌ Error solicitando pairing code:', err.message)
    return null
  }
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

app.get('/status', auth, (req, res) => {
  res.json({
    connected: isConnected,
    hasPairingCode: !!pairingCode,
    pairingCode: pairingCode || null,
    messagesThisHour: sentTimestamps.filter(t => t > Date.now() - RATE_WINDOW).length,
    rateLimit: RATE_LIMIT,
    withinSchedule: isWithinSchedule(),
  })
})

// Solicitar pairing code para vincular
app.get('/pair', auth, async (req, res) => {
  const phone = req.query.phone
  if (!phone) {
    return res.status(400).json({ error: 'Parámetro phone requerido (ej: 573001234567)' })
  }

  if (isConnected) {
    return res.json({ connected: true, message: 'Ya está conectado' })
  }

  // Limpiar sesión anterior y reconectar
  if (fs.existsSync(AUTH_DIR)) {
    fs.rmSync(AUTH_DIR, { recursive: true })
  }

  // Reiniciar conexión
  reconnectAttempts = 0
  await connectWhatsApp()

  // Esperar a que se inicialice y pedir pairing code
  await delay(5000)
  const code = await requestPairingCode(phone)

  if (code) {
    res.json({
      pairingCode: code,
      instructions: 'Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo → "Vincular con número" → Ingresa el código',
    })
  } else {
    res.status(500).json({ error: 'No se pudo generar pairing code. Revisa los logs.' })
  }
})

// Enviar mensaje
app.post('/send', auth, async (req, res) => {
  const { telefono, mensaje } = req.body

  if (!telefono || !mensaje) {
    return res.status(400).json({ error: 'telefono y mensaje son requeridos' })
  }

  if (!isConnected || !sock) {
    return res.status(503).json({ error: 'WhatsApp no conectado', needsPairing: !isConnected })
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
