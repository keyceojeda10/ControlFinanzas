#!/bin/bash
# ══ EL VIGILANTE DE ERRORES ═════════════════════════════════════════════════
#
# ── POR QUÉ EXISTE ──
#
# `/api/errores-cliente` guarda cada pantalla rota en el registro de PM2 y ahí
# muere: no hay pantalla que los enseñe, ni aviso, ni resumen. Medido el 18 ago
# 2026, esto era lo que la app sabía y nadie había leído:
#
#     95  Cannot access 'tU' before initialization   (pantalla de rutas)
#     28  préstamo sin cuotasAmortizacion            (hoja de pago)
#     25  React #300                                 (ficha del préstamo)
#     10  onCerrarVisita is not defined              (cobros de hoy)
#
# NINGUNO lo reportó nadie. Las quejas llegan por WhatsApp porque el sistema se
# entera antes que nosotros y no se lo cuenta a nadie.
#
# ── LO QUE HACE ──
#
# Cuenta los errores de las últimas 24 horas, los agrupa por mensaje y manda UN
# mensaje por Telegram — el mismo canal del vigilante del respaldo.
#
# ⚠ CALLA CUANDO NO HAY NADA. Un aviso que llega todos los días diciendo «cero»
# se convierte en ruido y a la semana nadie lo abre. Ver `feedback_el_cero_es_un_dato`:
# ahí el cero SÍ importaba porque era una pantalla que el dueño abre cada
# mañana; aquí es una notificación que interrumpe.
#
# ── CÓMO SE INSTALA ──
#
#     scp scripts/vigilante-errores.sh root@VPS:/opt/cf-backup/
#     chmod +x /opt/cf-backup/vigilante-errores.sh
#     crontab: 0 9 * * * /bin/bash /opt/cf-backup/vigilante-errores.sh
#
# Para ensayarlo SIN mandar nada:
#
#     VIGILANTE_SECO=1 HORAS=720 bash /opt/cf-backup/vigilante-errores.sh
set -uo pipefail

APP_DIR="${APP_DIR:-/home/control-finanzas}"
LOGS="${LOGS:-/root/.pm2/logs}"
HORAS="${HORAS:-24}"

# ⚠ LO QUE SE PASA POR FUERA MANDA SOBRE EL `.env`.
#
# La primera versión hacía `source .env` a secas, y eso PISA las variables que
# uno pasa en la línea de órdenes. Probándolo con `TELEGRAM_BOT_TOKEN= ...` para
# que imprimiera en pantalla, el `source` devolvió las claves buenas y le mandó
# al dueño un Telegram de prueba con 261 errores de treinta días. Un guion de
# vigilancia que no se puede ensayar en seco se ensaya en la cara de alguien.
#
# Se guardan antes y se reponen después: así `VIGILANTE_SECO=1` o un token vacío
# hacen lo que se espera.
__tok="${TELEGRAM_BOT_TOKEN-}"
__chat="${TELEGRAM_CHAT_ID-}"
__tenia_tok="${TELEGRAM_BOT_TOKEN+si}"
__tenia_chat="${TELEGRAM_CHAT_ID+si}"

# shellcheck disable=SC1091
source "${APP_DIR}/.env" 2>/dev/null || true

[ -n "${__tenia_tok:-}" ] && TELEGRAM_BOT_TOKEN="$__tok"
[ -n "${__tenia_chat:-}" ] && TELEGRAM_CHAT_ID="$__chat"

# Y una puerta explícita para ensayarlo sin mandar nada.
if [ -n "${VIGILANTE_SECO:-}" ]; then
  TELEGRAM_BOT_TOKEN=""
  TELEGRAM_CHAT_ID=""
fi

desde=$(date -d "-${HORAS} hours" '+%Y-%m-%d %H:%M:%S')

# Los apuntes del día, ya filtrados por fecha. El formato lo pone
# `app/api/errores-cliente/route.js`: «FECHA: [ERROR-CLIENTE] {json}».
recientes=$(cat "${LOGS}"/cf-error-*.log 2>/dev/null \
  | grep -F '[ERROR-CLIENTE]' \
  | awk -v d="$desde" '{ ts = $1 " " substr($2, 1, 8); if (ts >= d) print }')

total=$(printf '%s' "$recientes" | grep -c . || true)
[ "${total:-0}" -eq 0 ] && exit 0   # ⚠ silencio cuando no hay nada

# Agrupado por mensaje. Se recortan los identificadores largos para que veinte
# fallos del mismo tipo no salgan como veinte líneas distintas.
# ⚠ SE JUNTAN Y SE RECORTAN, o el aviso no se lee.
#
# Sin esto salían nueve renglones de «Loading chunk 1940 failed…» con su URL
# entera —cada trozo con su número, así que veinte fallos del MISMO problema
# ocupaban veinte líneas— y el React #300 se llevaba cinco renglones él solo
# repitiendo su enlace de ayuda. Un aviso que no se lee de una pasada a las
# nueve de la mañana es un aviso que no se lee.
resumen=$(printf '%s\n' "$recientes" \
  | grep -oE '"mensaje":"[^"]*' | sed 's/"mensaje":"//' \
  | sed -E 's/Loading chunk .*/Pantalla a medio cargar (tras un despliegue)/' \
  | sed -E 's/Minified React error #([0-9]+).*/React #\1 (pantalla en blanco)/' \
  | sed -E 's/[a-z0-9]{20,}/…/g; s/[0-9]{5,}/…/g' \
  | sed -E 's/\\+$//' \
  ` # ⚠ Safari y Chrome dicen lo mismo con otras palabras: «Can't find` \
  ` # variable: X» y «X is not defined» son EL MISMO fallo. Sin unirlos,` \
  ` # 16 casos salían como 10 y 6, y el segundo se ve pequeño y se ignora.` \
  | sed -E "s/Can't find variable: (.*)/\\1 is not defined/" \
  | sed -E 's/[.]+$//' \
  | cut -c1-58 \
  | sort | uniq -c | sort -rn | head -7 \
  | sed 's/^ *//' | sed 's/^\([0-9]*\) /  \1 × /')

pantallas=$(printf '%s\n' "$recientes" \
  | grep -oE '"ruta":"[^"]*' | sed 's/"ruta":"//' \
  | sed -E 's|/[a-z0-9]{20,}|/…|g' \
  | sort | uniq -c | sort -rn | head -4 \
  | sed 's/^ *//' | sed 's/^\([0-9]*\) /  \1 × /')

personas=$(printf '%s\n' "$recientes" | grep -oE '"org":"[^"]*' | sort -u | grep -c . || true)

texto="⚠ Pantallas rotas en las últimas ${HORAS}h: ${total}
(en ${personas} negocios)

Qué pasó:
${resumen}

Dónde:
${pantallas}

Los detalles: pm2 logs cf --err | grep ERROR-CLIENTE"

if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
  curl -sS --max-time 20 -X POST \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=${texto}" > /dev/null
else
  echo "$texto"   # sin claves: sirve para probarlo a mano
fi
