const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, Browsers, delay } = require("@whiskeysockets/baileys");
const pino = require("pino");
const QRCode = require("qrcode");
const fs = require("fs");

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
  
  let qrCount = 0;
  
  sock.ev.on("connection.update", async (u) => {
    const { connection, lastDisconnect, qr } = u;
    
    if (qr) {
      qrCount++;
      const file = "qr.png";
      await QRCode.toFile(file, qr, { width: 300 });
      console.log("QR #" + qrCount + " guardado en " + file);
      console.log("ESCANEA: " + process.cwd() + "/" + file);
    }
    
    if (connection === "open") {
      console.log("CONECTADO");
      fs.writeFileSync("connected.flag", "ok");
      setTimeout(() => process.exit(0), 3000);
    }
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log("Cerrado code:", code);
      if (code !== 401 && code !== 403) {
        await delay(2000);
        start();
      }
    }
  });
  
  sock.ev.on("creds.update", saveCreds);
}

start();
setTimeout(function() { console.log("Timeout"); process.exit(1); }, 180000);
