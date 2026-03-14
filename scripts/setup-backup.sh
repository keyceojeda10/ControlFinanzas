#!/bin/bash
# ============================================================
# Setup de backups automáticos para Control Finanzas
# Ejecutar UNA VEZ en el VPS: bash /home/control-finanzas/scripts/setup-backup.sh
# ============================================================

set -euo pipefail

echo "╔══════════════════════════════════════════════════════╗"
echo "║  Setup de Backups - Control Finanzas                 ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# 1. Instalar rclone si no existe
if ! command -v rclone &> /dev/null; then
    echo "→ Instalando rclone..."
    curl https://rclone.org/install.sh | sudo bash
    echo "✓ rclone instalado"
else
    echo "✓ rclone ya instalado ($(rclone version | head -1))"
fi

# 2. Crear directorio de backups
mkdir -p /home/backups
echo "✓ Directorio /home/backups creado"

# 3. Configurar rclone con Google Drive
echo ""
echo "════════════════════════════════════════════════════════"
echo "PASO MANUAL: Configurar Google Drive en rclone"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Como estamos en un VPS sin navegador, sigue estos pasos:"
echo ""
echo "OPCIÓN A - Configurar desde tu PC local:"
echo "  1. Instala rclone en tu PC: https://rclone.org/downloads/"
echo "  2. Ejecuta: rclone authorize \"drive\""
echo "  3. Se abrirá el navegador, autoriza con tu Google"
echo "  4. Copia el token que aparece en la terminal"
echo ""
echo "OPCIÓN B - Usar Service Account (recomendado para servidores):"
echo "  1. Ve a https://console.cloud.google.com"
echo "  2. Crea un proyecto o usa uno existente"
echo "  3. Habilita Google Drive API"
echo "  4. Crea una Service Account y descarga el JSON"
echo "  5. Comparte la carpeta de Drive con el email de la SA"
echo ""
echo "Luego ejecuta en el VPS:"
echo "  rclone config"
echo ""
echo "  Name: gdrive"
echo "  Storage: drive"
echo "  (sigue las instrucciones con el token o SA)"
echo ""

read -p "¿Ya configuraste rclone? (s/n): " CONFIGURED

if [ "$CONFIGURED" != "s" ]; then
    echo ""
    echo "Ejecuta 'rclone config' primero y luego vuelve a correr este script."
    exit 0
fi

# 4. Verificar conexión
echo "→ Verificando conexión a Google Drive..."
if rclone lsd gdrive: > /dev/null 2>&1; then
    echo "✓ Conexión a Google Drive OK"
else
    echo "✗ No se pudo conectar a Google Drive"
    echo "  Ejecuta: rclone config"
    exit 1
fi

# 5. Crear carpeta en Drive
echo "→ Creando carpeta ControlFinanzas/backups en Drive..."
rclone mkdir gdrive:ControlFinanzas/backups
echo "✓ Carpeta creada"

# 6. Hacer ejecutable el script de backup
chmod +x /home/control-finanzas/scripts/backup-gdrive.sh
echo "✓ Script de backup configurado como ejecutable"

# 7. Configurar cron
echo ""
echo "→ Configurando cron job..."

# Backup diario a las 3:00 AM
CRON_LINE="0 3 * * * /home/control-finanzas/scripts/backup-gdrive.sh >> /home/backups/cron.log 2>&1"

# Verificar si ya existe
if crontab -l 2>/dev/null | grep -q "backup-gdrive.sh"; then
    echo "✓ Cron job ya existe"
else
    (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
    echo "✓ Cron job agregado: backup diario a las 3:00 AM"
fi

# 8. Agregar variables al .env
echo ""
APP_ENV="/home/control-finanzas/.env"
if ! grep -q "BACKUP_ENCRYPTION_KEY" "$APP_ENV" 2>/dev/null; then
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    echo "" >> "$APP_ENV"
    echo "# ─── BACKUPS ───────────────────────────────────────" >> "$APP_ENV"
    echo "BACKUP_ENCRYPTION_KEY=${ENCRYPTION_KEY}" >> "$APP_ENV"
    echo "BACKUP_SECRET=$(openssl rand -hex 16)" >> "$APP_ENV"
    echo "✓ Claves de encriptación generadas y agregadas a .env"
    echo ""
    echo "⚠ IMPORTANTE: Guarda esta clave en un lugar seguro"
    echo "  BACKUP_ENCRYPTION_KEY=${ENCRYPTION_KEY}"
    echo "  Sin ella NO podrás restaurar los backups encriptados"
fi

# 9. Test de backup
echo ""
read -p "¿Ejecutar un backup de prueba ahora? (s/n): " TEST

if [ "$TEST" = "s" ]; then
    echo "→ Ejecutando backup de prueba..."
    /home/control-finanzas/scripts/backup-gdrive.sh
    echo "✓ Backup de prueba completado"
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  Setup completado                                    ║"
echo "║                                                      ║"
echo "║  Backup diario: 3:00 AM → Google Drive               ║"
echo "║  Retención: 30 días                                  ║"
echo "║  Encriptación: AES-256                               ║"
echo "║                                                      ║"
echo "║  Logs: /home/backups/backup.log                      ║"
echo "║  Cron: /home/backups/cron.log                        ║"
echo "╚══════════════════════════════════════════════════════╝"
