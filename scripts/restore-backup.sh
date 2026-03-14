#!/bin/bash
# ============================================================
# Restaurar backup de Control Finanzas desde Google Drive
# Uso: bash restore-backup.sh [nombre-archivo]
# ============================================================

set -euo pipefail

BACKUP_DIR="/home/backups"
GDRIVE_REMOTE="gdrive:ControlFinanzas/backups"
APP_DIR="/home/control-finanzas"
RESTORE_DIR="/home/backups/restore-tmp"

source "${APP_DIR}/.env"

echo "╔══════════════════════════════════════════════════════╗"
echo "║  Restaurar Backup - Control Finanzas                 ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Listar backups disponibles
if [ -z "${1:-}" ]; then
    echo "Backups disponibles en Google Drive:"
    echo "─────────────────────────────────────"
    rclone ls "$GDRIVE_REMOTE" | sort -k2 | tail -20
    echo ""
    read -p "Nombre del archivo a restaurar: " BACKUP_FILE
else
    BACKUP_FILE="$1"
fi

echo ""
echo "⚠ ADVERTENCIA: Esto reemplazará la base de datos actual"
read -p "¿Estás seguro? Escribe 'RESTAURAR' para confirmar: " CONFIRM

if [ "$CONFIRM" != "RESTAURAR" ]; then
    echo "Cancelado."
    exit 0
fi

# Descargar
echo "→ Descargando ${BACKUP_FILE}..."
mkdir -p "$RESTORE_DIR"
rclone copy "${GDRIVE_REMOTE}/${BACKUP_FILE}" "$RESTORE_DIR"

# Desencriptar si es .gpg
if [[ "$BACKUP_FILE" == *.gpg ]]; then
    echo "→ Desencriptando..."
    gpg --batch --yes --passphrase "$BACKUP_ENCRYPTION_KEY" \
        --decrypt "${RESTORE_DIR}/${BACKUP_FILE}" > "${RESTORE_DIR}/${BACKUP_FILE%.gpg}"
    BACKUP_FILE="${BACKUP_FILE%.gpg}"
fi

# Descomprimir
echo "→ Descomprimiendo..."
cd "$RESTORE_DIR"
tar -xzf "$BACKUP_FILE"
BACKUP_FOLDER=$(basename "$BACKUP_FILE" .tar.gz)

# Restaurar DB
echo "→ Restaurando base de datos..."
DB_USER=$(echo "$DATABASE_URL" | sed -n 's|mysql://\([^:]*\):.*|\1|p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|mysql://[^:]*:\([^@]*\)@.*|\1|p')
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|mysql://[^@]*@\([^:]*\):.*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|mysql://[^@]*@[^:]*:\([^/]*\)/.*|\1|p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|mysql://[^/]*/\([^?]*\).*|\1|p')

mysql --user="$DB_USER" --password="$DB_PASS" --host="$DB_HOST" --port="$DB_PORT" "$DB_NAME" < "${BACKUP_FOLDER}/database.sql"

echo "✓ Base de datos restaurada"

# Limpiar
rm -rf "$RESTORE_DIR"

echo ""
echo "✓ Restauración completada exitosamente"
echo "  Reinicia la app: pm2 restart cf"
