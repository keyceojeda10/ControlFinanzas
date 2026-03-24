#!/bin/bash
# ============================================================
# Test de diagnóstico Telegram - Control Finanzas
# Ejecutar en el VPS: bash /home/control-finanzas/scripts/test-telegram.sh
# ============================================================

set -euo pipefail

# Cargar variables del .env
ENV_FILE="/home/control-finanzas/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ No se encontró $ENV_FILE"
    exit 1
fi

# Leer variables relevantes
BOT_TOKEN=$(grep -E "^TELEGRAM_BOT_TOKEN=" "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")
CHAT_ID=$(grep -E "^TELEGRAM_CHAT_ID=" "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")
FB_TOKEN=$(grep -E "^FB_PAGE_ACCESS_TOKEN=" "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")
CRON_SECRET=$(grep -E "^CRON_SECRET=" "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")

echo "╔══════════════════════════════════════════════════════╗"
echo "║  Diagnóstico Telegram - Control Finanzas             ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# 1. Verificar variables de entorno
echo "── 1. Variables de entorno ──────────────────────────────"
if [ -z "$BOT_TOKEN" ]; then
    echo "❌ TELEGRAM_BOT_TOKEN: NO CONFIGURADO"
else
    echo "✅ TELEGRAM_BOT_TOKEN: configurado (${BOT_TOKEN:0:10}...)"
fi

if [ -z "$CHAT_ID" ]; then
    echo "❌ TELEGRAM_CHAT_ID: NO CONFIGURADO"
else
    echo "✅ TELEGRAM_CHAT_ID: $CHAT_ID"
fi

if [ -z "$FB_TOKEN" ]; then
    echo "❌ FB_PAGE_ACCESS_TOKEN: NO CONFIGURADO"
else
    echo "✅ FB_PAGE_ACCESS_TOKEN: configurado (${FB_TOKEN:0:15}...)"
fi
echo ""

# 2. Probar bot de Telegram
echo "── 2. Probando bot de Telegram ─────────────────────────"
if [ -n "$BOT_TOKEN" ]; then
    RESULT=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getMe")
    IS_OK=$(echo "$RESULT" | grep -o '"ok":true' || true)
    if [ -n "$IS_OK" ]; then
        BOT_NAME=$(echo "$RESULT" | grep -oP '"first_name":"[^"]*"' | cut -d'"' -f4)
        echo "✅ Bot activo: $BOT_NAME"
    else
        echo "❌ Bot NO responde. Respuesta: $RESULT"
    fi
else
    echo "⏭ Saltando (sin token)"
fi
echo ""

# 3. Probar envío de mensaje
echo "── 3. Enviando mensaje de prueba ────────────────────────"
if [ -n "$BOT_TOKEN" ] && [ -n "$CHAT_ID" ]; then
    SEND_RESULT=$(curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
        -H "Content-Type: application/json" \
        -d "{\"chat_id\":\"${CHAT_ID}\",\"text\":\"🔧 Test de diagnóstico - $(date '+%Y-%m-%d %H:%M:%S')\nSi ves este mensaje, el bot funciona correctamente.\",\"parse_mode\":\"HTML\"}")
    SEND_OK=$(echo "$SEND_RESULT" | grep -o '"ok":true' || true)
    if [ -n "$SEND_OK" ]; then
        echo "✅ Mensaje enviado exitosamente. ¡Revisa Telegram!"
    else
        ERROR_DESC=$(echo "$SEND_RESULT" | grep -oP '"description":"[^"]*"' | cut -d'"' -f4)
        echo "❌ Error enviando: $ERROR_DESC"
        echo "   Respuesta completa: $SEND_RESULT"
    fi
else
    echo "⏭ Saltando (faltan token o chat_id)"
fi
echo ""

# 4. Probar token de Facebook
echo "── 4. Verificando token de Facebook ─────────────────────"
if [ -n "$FB_TOKEN" ]; then
    FB_RESULT=$(curl -s "https://graph.facebook.com/v21.0/me?access_token=${FB_TOKEN}")
    FB_OK=$(echo "$FB_RESULT" | grep -o '"name"' || true)
    if [ -n "$FB_OK" ]; then
        PAGE_NAME=$(echo "$FB_RESULT" | grep -oP '"name":"[^"]*"' | cut -d'"' -f4)
        echo "✅ Token de Facebook válido. Página: $PAGE_NAME"
    else
        FB_ERROR=$(echo "$FB_RESULT" | grep -oP '"message":"[^"]*"' | cut -d'"' -f4)
        echo "❌ Token de Facebook INVÁLIDO: $FB_ERROR"
        echo "   ⚠️  PROBABLE CAUSA: El token expiró. Necesitas renovarlo en Facebook Business."
    fi
else
    echo "⏭ Saltando (sin token)"
fi
echo ""

# 5. Probar cron de leads-sync
echo "── 5. Probando endpoint leads-sync ──────────────────────"
if [ -n "$CRON_SECRET" ]; then
    SYNC_RESULT=$(curl -s -X POST "https://app.control-finanzas.com/api/cron/leads-sync" \
        -H "Content-Type: application/json" \
        -H "x-cron-secret: ${CRON_SECRET}")
    echo "   Respuesta: $SYNC_RESULT"
else
    echo "⏭ Saltando (sin CRON_SECRET)"
fi
echo ""

# 6. Verificar logs recientes
echo "── 6. Logs recientes de la aplicación ────────────────────"
if command -v pm2 &> /dev/null; then
    echo "   Últimas 20 líneas con '[Telegram]' o '[Leads]':"
    pm2 logs control-finanzas --lines 100 --nostream 2>&1 | grep -iE '\[Telegram\]|\[Leads\]' | tail -20 || echo "   (sin logs relevantes)"
elif command -v journalctl &> /dev/null; then
    echo "   Últimos logs del servicio:"
    journalctl -u control-finanzas --since "1 hour ago" --no-pager 2>&1 | grep -iE '\[Telegram\]|\[Leads\]' | tail -20 || echo "   (sin logs relevantes)"
else
    echo "   No se detectó pm2 ni systemd para ver logs"
fi
echo ""

echo "╔══════════════════════════════════════════════════════╗"
echo "║  Diagnóstico completado                              ║"
echo "╚══════════════════════════════════════════════════════╝"
