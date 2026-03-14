#!/bin/bash
# ============================================================
# Backup automático de Control Finanzas a Google Drive
# Ejecutar con cron: 0 3 * * * /home/control-finanzas/scripts/backup-gdrive.sh
# ============================================================

set -euo pipefail

# ─── CONFIGURACIÓN ──────────────────────────────────────────
APP_DIR="/home/control-finanzas"
BACKUP_DIR="/home/backups"
GDRIVE_REMOTE="gdrive:ControlFinanzas/backups"
RETENTION_DAYS=30
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_NAME="cf-backup-${DATE}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"
LOG_FILE="/home/backups/backup.log"

# Cargar variables de entorno para DB
source "${APP_DIR}/.env"

# Extraer credenciales de DATABASE_URL
# Formato: mysql://user:password@host:port/database
DB_USER=$(echo "$DATABASE_URL" | sed -n 's|mysql://\([^:]*\):.*|\1|p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|mysql://[^:]*:\([^@]*\)@.*|\1|p')
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|mysql://[^@]*@\([^:]*\):.*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|mysql://[^@]*@[^:]*:\([^/]*\)/.*|\1|p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|mysql://[^/]*/\([^?]*\).*|\1|p')

# ─── FUNCIONES ──────────────────────────────────────────────
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

send_alert() {
    # Enviar alerta por email si el backup falla
    local subject="$1"
    local body="$2"
    curl -s -X POST "https://app.control-finanzas.com/api/admin/backup-alert" \
        -H "Content-Type: application/json" \
        -H "X-Backup-Secret: ${BACKUP_SECRET:-}" \
        -d "{\"subject\": \"${subject}\", \"body\": \"${body}\"}" \
        2>/dev/null || true
}

cleanup() {
    rm -rf "$BACKUP_PATH" "${BACKUP_PATH}.tar.gz.gpg" 2>/dev/null || true
}
trap cleanup EXIT

# ─── INICIO ─────────────────────────────────────────────────
log "═══ Iniciando backup: ${BACKUP_NAME} ═══"

mkdir -p "$BACKUP_DIR" "$BACKUP_PATH"

# 1. Dump de la base de datos
log "Exportando base de datos MySQL..."
mysqldump \
    --user="$DB_USER" \
    --password="$DB_PASS" \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --single-transaction \
    --routines \
    --triggers \
    --quick \
    --lock-tables=false \
    "$DB_NAME" > "${BACKUP_PATH}/database.sql"

DB_SIZE=$(du -sh "${BACKUP_PATH}/database.sql" | cut -f1)
log "Database dump: ${DB_SIZE}"

# 2. Backup del .env (encriptado)
cp "${APP_DIR}/.env" "${BACKUP_PATH}/env-backup"
log "Variables de entorno copiadas"

# 3. Backup del schema de Prisma (para referencia de estructura)
cp "${APP_DIR}/prisma/schema.prisma" "${BACKUP_PATH}/schema.prisma"
log "Schema Prisma copiado"

# 4. Comprimir
log "Comprimiendo backup..."
cd "$BACKUP_DIR"
tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
ARCHIVE_SIZE=$(du -sh "${BACKUP_NAME}.tar.gz" | cut -f1)
log "Archivo comprimido: ${ARCHIVE_SIZE}"

# 5. Encriptar con GPG (si hay clave configurada)
if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    log "Encriptando backup..."
    gpg --batch --yes --passphrase "$BACKUP_ENCRYPTION_KEY" \
        --symmetric --cipher-algo AES256 \
        "${BACKUP_NAME}.tar.gz"
    UPLOAD_FILE="${BACKUP_NAME}.tar.gz.gpg"
    rm "${BACKUP_NAME}.tar.gz"
else
    UPLOAD_FILE="${BACKUP_NAME}.tar.gz"
    log "AVISO: Backup sin encriptar (BACKUP_ENCRYPTION_KEY no configurada)"
fi

# 6. Subir a Google Drive con rclone
log "Subiendo a Google Drive..."
if rclone copy "${BACKUP_DIR}/${UPLOAD_FILE}" "$GDRIVE_REMOTE" --progress 2>&1 | tee -a "$LOG_FILE"; then
    log "Backup subido exitosamente a Google Drive"
else
    log "ERROR: Fallo al subir a Google Drive"
    send_alert "BACKUP FALLIDO" "No se pudo subir el backup ${BACKUP_NAME} a Google Drive"
    exit 1
fi

# 7. Verificar que el archivo existe en Drive
if rclone ls "$GDRIVE_REMOTE/${UPLOAD_FILE}" > /dev/null 2>&1; then
    log "Verificación OK: archivo existe en Google Drive"
else
    log "ERROR: Archivo no encontrado en Google Drive después de subir"
    send_alert "BACKUP FALLIDO" "Verificación fallida para ${BACKUP_NAME}"
    exit 1
fi

# 8. Limpiar backups locales antiguos
log "Limpiando backups locales antiguos (>${RETENTION_DAYS} días)..."
find "$BACKUP_DIR" -name "cf-backup-*" -type f -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true

# 9. Limpiar backups remotos antiguos
log "Limpiando backups remotos antiguos (>${RETENTION_DAYS} días)..."
rclone delete "$GDRIVE_REMOTE" --min-age "${RETENTION_DAYS}d" 2>/dev/null || true

# 10. Limpiar directorio temporal
rm -rf "$BACKUP_PATH"
rm -f "${BACKUP_DIR}/${UPLOAD_FILE}"

log "═══ Backup completado exitosamente ═══"
log "Archivo: ${UPLOAD_FILE} (${ARCHIVE_SIZE})"
log ""
