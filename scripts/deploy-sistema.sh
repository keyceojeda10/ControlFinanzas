#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# DESPLIEGUE A PRODUCCION
#
# Vive en el repo a proposito. La copia de /home/deploy-sistema.sh se instala
# desde aqui, para que el script que toca produccion tenga historial.
#
# ── LO QUE SE ARREGLO ─────────────────────────────────────────────────────
#
# El script tenia `set -e` y aun asi el deploy seguia adelante con la base sin
# sincronizar, por una sola linea:
#
#     npx prisma db push --accept-data-loss || echo 'WARN: ... no bloquea deploy'
#
# El `|| echo` anula el `set -e` justo donde mas duele. Y el motivo por el que
# se puso es REAL —a veces falla por una restriccion de clave ajena y no debe
# tumbar el despliegue— asi que abortar a ciegas tampoco sirve.
#
# La solucion es la que ya esta escrita en las lecciones del proyecto: SACAR EL
# SQL Y LEERLO ANTES. Aqui:
#
#   1. Se calcula la diferencia entre la base viva y el esquema del codigo.
#   2. Si NO hay diferencia — el caso normal — se sigue sin tocar nada.
#   3. Si LA HAY, se imprime el SQL exacto y el despliegue PARA. Para aplicarlo
#      hay que volver a lanzarlo con CF_APLICAR_ESQUEMA=1, habiendolo leido.
#
# Asi un despliegue de solo codigo no se entera, y uno que toca el esquema
# obliga a mirar lo que va a pasarle a la base de 398 negocios.
#
#   bash deploy-sistema.sh                      # normal
#   CF_APLICAR_ESQUEMA=1 bash deploy-sistema.sh # tras leer el SQL
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

echo '===== DEPLOY SISTEMA ====='
cd /home/control-finanzas

echo '>> git pull'
git pull origin main

echo '>> npm install'
npm install

echo '>> prisma generate'
npx prisma generate

# ── EL ESQUEMA ────────────────────────────────────────────────────────────
echo '>> comparando la base viva con el esquema del codigo'
SQL_PENDIENTE="$(npx prisma migrate diff \
  --from-config-datasource \
  --to-schema prisma/schema.prisma \
  --script 2>/dev/null || true)"

# Prisma escribe este comentario cuando no hay nada que hacer.
if [ -z "$SQL_PENDIENTE" ] || echo "$SQL_PENDIENTE" | grep -qi 'empty migration'; then
  echo '   la base ya esta al dia, no hay nada que aplicar'
else
  echo ''
  echo '   ⚠ LA BASE NO COINCIDE CON EL ESQUEMA. Esto es lo que se le haria:'
  echo '   ─────────────────────────────────────────────────────────────────'
  echo "$SQL_PENDIENTE" | sed 's/^/   /'
  echo '   ─────────────────────────────────────────────────────────────────'
  echo ''

  if [ "${CF_APLICAR_ESQUEMA:-0}" != "1" ]; then
    echo '   DESPLIEGUE DETENIDO. Ni la base ni el codigo se han tocado.'
    echo '   Lee el SQL de arriba. Si es lo que esperas:'
    echo ''
    echo '       CF_APLICAR_ESQUEMA=1 bash deploy-sistema.sh'
    echo ''
    exit 1
  fi

  echo '>> aplicando el esquema (CF_APLICAR_ESQUEMA=1)'
  npx prisma db push --accept-data-loss
fi

echo '>> build en carpeta temporal (.next-build)'
NEXT_BUILD_DIR=.next-build npm run build

echo '>> swap atomico .next-build -> .next'
rm -rf .next-old
mv .next .next-old
mv .next-build .next

echo '>> pm2 reload (graceful)'
pm2 reload ecosystem.config.js

echo '>> limpieza'
rm -rf .next-old

pm2 status
echo '===== COMPLETADO ====='
