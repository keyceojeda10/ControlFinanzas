// lib/almacen.js — dónde viven los archivos que sube la gente.
//
// ══ POR QUÉ NO EN `public/` ════════════════════════════════════════════════
//
// Todo lo que vive en `public/` lo sirve Next como archivo ESTÁTICO, antes de
// cualquier rewrite y **sin pasar por la sesión**. Comprobado contra producción:
//
//     GET /uploads/firmas/<org>/<hash>.png       → 200  (sin sesión)
//     GET /api/uploads/firmas/<org>/<hash>.png   → 401
//
// O sea: el API con permisos existía, funcionaba, y la ruta estática lo
// rodeaba. El rewrite `/uploads/:path* → /api/uploads/:path*` de
// `next.config.mjs` nunca llegaba a dispararse porque el archivo estaba ahí.
//
// Son **1.313 archivos**: 1.066 firmas, 184 fotos de clientes, 61 fotos de
// pagos, 2 tickets. Firmas y cédulas de gente real, abiertas a quien tuviera el
// enlace. No se adivinan ni se listan, pero un enlace reenviado por WhatsApp
// entra para siempre y sin cuenta.
//
// `lib/fotos-donadas.js` ya lo había descubierto en agosto y por eso las fotos
// donadas nunca fueron a `public/`. Esto hace lo mismo con las que ya estaban.
//
// ── FUERA DEL REPO, COMO EL RESPALDO ──────────────────────────────────────
//
// La carpeta va fuera del árbol del proyecto para que ni un `git pull` ni un
// despliegue la toquen — el mismo motivo por el que el respaldo vive en
// `/opt/cf-backup`. En producción se fija con `UPLOADS_DIR`.

import path from 'path'

/** Dónde se guardan y desde dónde se sirven los archivos subidos. */
export function directorioAlmacen() {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), '.almacen', 'uploads')
}

/* ⚠ EL SITIO VIEJO, SOLO PARA LEER.
 *
 * Durante la mudanza —y para cualquier archivo que se quedara atrás— el API
 * sigue sabiendo mirar en `public/uploads`. Sin esto, un archivo no movido
 * daría 404 y el prestamista vería la firma de su pagaré rota, que es peor que
 * el problema que estamos cerrando.
 *
 * NO se escribe aquí nunca más: `directorioAlmacen()` es el único destino. */
export function directorioViejo() {
  return path.join(process.cwd(), 'public', 'uploads')
}

/** Une los segmentos de la URL y corta el path traversal. `null` si es sucio. */
export function rutaSegura(segmentos, base) {
  if (!segmentos || segmentos.length === 0) return null
  const unido = segmentos.join('/')
  if (unido.includes('..') || unido.includes('\\')) return null
  const completa = path.join(base, unido)
  // `path.join` normaliza, así que esta es la comprobación que de verdad vale.
  if (!completa.startsWith(base)) return null
  return completa
}

/* Borra un archivo subido, esté en el almacén nuevo o donde se guardaba antes.
   La URL que hay en la base es `/uploads/<tipo>/<org>/<archivo>`, así que se le
   quita el prefijo y se prueban los dos sitios. Sin esto, la foto vieja se
   quedaría ocupando disco para siempre tras la mudanza. */
export async function borrarSubido(url) {
  if (!url) return
  const { unlink } = await import('fs/promises')
  const rel = String(url).replace(/^\/uploads\//, '')
  for (const base of [directorioAlmacen(), directorioViejo()]) {
    const p = rutaSegura(rel.split('/'), base)
    if (!p) continue
    try { await unlink(p) } catch {}
  }
}

/* Lee un archivo subido, esté donde esté. Lo usa el PAGARÉ para estampar la
   firma en el PDF: si esto devuelve null, el pagaré sale sin firma y nadie se
   entera hasta que hay que cobrarlo. */
export async function leerSubido(url) {
  if (!url) return null
  const { readFile } = await import('fs/promises')
  const { existsSync } = await import('fs')
  const rel = String(url).replace(/^\/uploads\//, '')
  for (const base of [directorioAlmacen(), directorioViejo()]) {
    const p = rutaSegura(rel.split('/'), base)
    if (p && existsSync(p)) { try { return await readFile(p) } catch {} }
  }
  return null
}
