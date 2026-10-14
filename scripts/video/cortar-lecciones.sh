#!/usr/bin/env bash
# Parte la clase de 2 minutos (public/videos/bienvenida-720.mp4) en sus cinco
# lecciones, una por paso del asistente. 14 oct 2026.
#
# ⚠ LOS CORTES VAN DENTRO DE LOS SILENCIOS ENTRE LECCIONES (pausas de ~1 s), nunca
# mientras el profe habla: cada lección arranca diciendo «Lección uno, dos…».
# Sacados con:
#   ffmpeg -i bienvenida-720.mp4 -af silencedetect=noise=-35dB:d=0.25 -f null -
#   pausas largas: 10.51-11.17 · 23.77-24.69 · 50.20-51.26 · 73.58-74.62 · 102.84-103.88 · 117.17-fin
# Inicio = fin del silencio − 0,15 s; final = inicio del silencio + 0,3 s (la 5
# para antes de la tarjeta «¡Ya sabes arrancar!», que es del video completo).
# Fundido corto de imagen y sonido en cada borde: sin golpe ni salto.
#
# Si se reedita el video, se vuelven a medir las pausas, se cambian aquí Y en
# `LECCIONES` de lib/video-bienvenida.js (las duraciones salen de este guion).
set -euo pipefail
export LC_ALL=C
cd "$(dirname "$0")/../../public/videos"
ORIGEN=bienvenida-720.mp4
cortar() { # n inicio final
  local n=$1 ini=$2 fin=$3
  local dur; dur=$(awk "BEGIN{print $fin - $ini}")
  local vo; vo=$(awk "BEGIN{print $dur - 0.35}")
  local ao; ao=$(awk "BEGIN{print $dur - 0.25}")
  ffmpeg -v error -y -ss "$ini" -i "$ORIGEN" -t "$dur" \
    -vf "fade=t=in:st=0:d=0.3,fade=t=out:st=${vo}:d=0.35" \
    -af "afade=t=in:st=0:d=0.1,afade=t=out:st=${ao}:d=0.25" \
    -c:v libx264 -preset slow -crf 24 -profile:v high -pix_fmt yuv420p \
    -c:a aac -b:a 96k -movflags +faststart "leccion-$n.mp4"
  ffmpeg -v error -y -ss 1.2 -i "leccion-$n.mp4" -frames:v 1 -q:v 4 "leccion-$n.jpg"
  printf 'leccion-%s  %6.2f s  %s\n' "$n" "$dur" "$(du -h "leccion-$n.mp4" | cut -f1)"
}
cortar 1  11.02  24.07
cortar 2  24.54  50.50
cortar 3  51.11  73.88
cortar 4  74.47 103.14
cortar 5 103.73 117.50
