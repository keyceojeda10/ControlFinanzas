const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, Browsers, delay } = require("@whiskeysockets/baileys");
const pino = require("pino");
const qrcode = require("qrcode-terminal");

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth_info");
  const { version } = await fetchLatestBaileysVersion();
  console.log("Version:", version.join("."));
  
  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
    },
    logger: pino({ level: "silent" }),
    browser: Browsers.ubuntu("Chrome"),
    version,
    syncFullHistory: false,
  });
  
  sock.ev.on("connection.update", async (u) => {
    const { connection, lastDisconnect, qr } = u;
    
    if (qr) {
      console.log("\nESCANEA ESTE QR EN WHATSAPP:\n");
      qrcode.generate(qr, { small: true });
      console.log("\nWhatsApp -> Dispositivos vinculados -> Vincular dispositivo -> Escanear QR\n");
    }
    
    if (connection === "open") {
      console.log("\nCONECTADO! Sesion guardada en ./auth_info\n");
      setTimeout(() => process.exit(0), 3000);
    }
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log("Cerrado code:", code);
      if (code !== 401 && code !== 403) {
        console.log("Reconectando...");
        await delay(2000);
        start();
      }
    }
  });
  
  sock.ev.on("creds.update", saveCreds);
}

start();
setTimeout(function() { console.log("Timeout 3min"); process.exit(1); }, 180000);
