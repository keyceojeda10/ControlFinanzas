// baileys-service/index.js — Microservicio WhatsApp via Baileys
// Corre como proceso PM2 separado en el VPS (puerto 3003)
// Usa pairing code para vincular (más confiable desde servidores)

const express = require('express')
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const pino = require('pino')
const path = require('path')
const fs = require('fs')

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 3003
const SECRET = process.env.BAILEYS_SECRET || 'baileys_cf_2026'
const AUTH_DIR = path.join(__dirname, 'auth_info')

// ── Estado global ───────────────────────────────────────
let sock = null
let pairingCode = null
let isConnected = false
let isPairing = false // bloquea reconexión mientras se vincula

// ── Rate limiter (20 mensajes/hora) ─────────────────────
const sentTimestamps = []
const RATE_LIMIT = 20
const RATE_WINDOW = 3600000

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
  const colombiaOffset = -5 * 60
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
async function connectWhatsApp(phoneForPairing) {
  // Cerrar socket anterior si existe
  if (sock) {
    try { sock.ev.removeAllListeners(); sock.end(); } catch {}
    sock = null
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
  const logger = pino({ level: 'silent' })
  const { version } = await fetchLatestBaileysVersion()

  console.log(`📡 Conectando WA v${version.join('.')}...`)

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
  })

  // Si no hay sesión y se pasó un número, solicitar pairing code
  if (!state.creds.registered && phoneForPairing) {
    isPairing = true
    try {
      await delay(3000)
      if (sock) {
        const code = await sock.requestPairingCode(phoneForPairing)
        pairingCode = code
        console.log(`\n📱 CÓDIGO: ${code}`)
        console.log(`   WhatsApp → Dispositivos vinculados → Vincular con número → ${code}\n`)
      }
    } catch (err) {
      console.error('❌ Error pairing code:', err.message)
      isPairing = false
    }
  } else if (!state.creds.registered) {
    console.log('\n⚠️ Sin sesión. Usa GET /pair?phone=573XXXXXXXXX para vincular.\n')
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update

    if (connection === 'open') {
      isConnected = true
      isPairing = false
      pairingCode = null
      console.log('✅ WhatsApp conectado exitosamente')
    }

    if (connection === 'close') {
      isConnected = false
      const statusCode = lastDisconnect?.error?.output?.statusCode

      console.log(`❌ Desconectado (${statusCode})`)

      // Si estamos en proceso de pairing, NO reconectar automático
      if (isPairing) {
        console.log('⏳ Esperando pairing... no reconectar.')
        return
      }

      // Si hay sesión guardada y se desconectó, reconectar
      if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
        console.log('🔓 Sesión cerrada. Limpiando auth...')
        if (fs.existsSync(AUTH_DIR)) fs.rmSync(AUTH_DIR, { recursive: true })
        console.log('⚠️ Usa GET /pair?phone=TUNUMERO para re-vincular.')
      } else if (fs.existsSync(path.join(AUTH_DIR, 'creds.json'))) {
        // Solo reconectar si HAY sesión guardada
        console.log('🔄 Reconectando en 5s...')
        setTimeout(() => connectWhatsApp(), 5000)
      } else {
        console.log('⚠️ Sin sesión. Usa GET /pair?phone=573XXXXXXXXX para vincular.')
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

app.get('/status', auth, (req, res) => {
  res.json({
    connected: isConnected,
    isPairing,
    pairingCode: pairingCode || null,
    messagesThisHour: sentTimestamps.filter(t => t > Date.now() - RATE_WINDOW).length,
    rateLimit: RATE_LIMIT,
    withinSchedule: isWithinSchedule(),
  })
})

// Vincular WhatsApp con pairing code
app.get('/pair', auth, async (req, res) => {
  const phone = req.query.phone
  if (!phone) {
    return res.status(400).json({ error: 'Parámetro phone requerido (ej: 573001234567)' })
  }

  if (isConnected) {
    return res.json({ connected: true, message: 'Ya está conectado' })
  }

  // Limpiar todo y empezar de cero
  if (fs.existsSync(AUTH_DIR)) fs.rmSync(AUTH_DIR, { recursive: true })
  pairingCode = null
  isPairing = false

  // Conectar con número para pairing
  await connectWhatsApp(phone)

  // Esperar hasta que tengamos el pairing code (máx 15s)
  for (let i = 0; i < 30; i++) {
    if (pairingCode) break
    await delay(500)
  }

  if (pairingCode) {
    res.json({
      pairingCode,
      instructions: 'WhatsApp → Dispositivos vinculados → Vincular dispositivo → Vincular con número → Ingresa el código',
    })
  } else {
    res.status(500).json({ error: 'No se pudo generar código. Revisa logs con: pm2 logs baileys' })
  }
})

// Enviar mensaje
app.post('/send', auth, async (req, res) => {
  const { telefono, mensaje } = req.body

  if (!telefono || !mensaje) {
    return res.status(400).json({ error: 'telefono y mensaje son requeridos' })
  }

  if (!isConnected || !sock) {
    return res.status(503).json({ error: 'WhatsApp no conectado', needsPairing: true })
  }

  if (!canSend()) {
    return res.status(429).json({ error: 'Rate limit (20/hora)', retryAfterMs: RATE_WINDOW })
  }

  if (!isWithinSchedule()) {
    return res.status(200).json({ sent: false, reason: 'fuera_de_horario' })
  }

  const jid = formatPhone(telefono)
  res.json({ queued: true, jid, estimatedDelay: '5-15s' })

  const randomDelay = 5000 + Math.random() * 10000
  console.log(`⏳ Enviando a ${jid} en ${Math.round(randomDelay / 1000)}s...`)

  setTimeout(async () => {
    try {
      await sock.presenceSubscribe(jid)
      await delay(500)
      await sock.sendPresenceUpdate('composing', jid)
      await delay(2000 + Math.random() * 3000)
      await sock.sendPresenceUpdate('paused', jid)
      await delay(500)

      await sock.sendMessage(jid, { text: mensaje })
      recordSend()
      console.log(`✅ Enviado a ${jid}`)
    } catch (err) {
      console.error(`❌ Error enviando a ${jid}:`, err.message)
    }
  }, randomDelay)
})

// ── Iniciar ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Baileys Service puerto ${PORT}`)
  console.log(`📊 Rate limit: ${RATE_LIMIT}/hora | Horario: 8am-8pm COL\n`)

  // Si ya hay sesión guardada, conectar automáticamente
  if (fs.existsSync(path.join(AUTH_DIR, 'creds.json'))) {
    console.log('🔑 Sesión encontrada, conectando...')
    connectWhatsApp()
  } else {
    console.log('⚠️ Sin sesión. Usa GET /pair?phone=573XXXXXXXXX para vincular.')
  }
})
