// app/api/uploads/[...path]/route.js — la ÚNICA puerta a los archivos subidos.
//
// ⚠ Este API siempre exigió sesión y siempre funcionó. Lo que fallaba es que
// nadie llegaba hasta él: los archivos vivían en `public/uploads`, y Next sirve
// `public/` como estático ANTES de aplicar el rewrite. Ver `lib/almacen.js`.
//
// Con los archivos fuera de `public/`, este es el único camino y el 401 empieza
// a significar algo.

import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { directorioAlmacen, directorioViejo, rutaSegura } from '@/lib/almacen'

const MIME_TYPES = {
  '.webp': 'image/webp',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
}

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new Response('Unauthorized', { status: 401 })

    const segments = (await params).path

    /* ── ⚠ Y NO BASTA CON TENER CUENTA: TIENE QUE SER SUYA ────────────────
     *
     * La ruta es `<tipo>/<organizationId>/<archivo>`, así que el dueño del
     * archivo está en la propia URL. Sin esta comprobación, cualquiera de los
     * 457 negocios podía abrir la firma del pagaré de otro con solo cambiar un
     * id — que es multi-tenant roto, no un descuido de permisos.
     *
     * `tickets/` no lleva organización: son los adjuntos de soporte, que
     * atiende el superadmin. Solo él los ve.
     *
     * El superadmin pasa siempre: su trabajo es mirar cuentas ajenas. */
    const esSuperadmin = session.user.rol === 'superadmin'
    if (!esSuperadmin) {
      const [tipo, orgEnLaRuta] = segments ?? []
      if (tipo === 'tickets') return new Response('Forbidden', { status: 403 })
      if (!orgEnLaRuta || orgEnLaRuta !== session.user.organizationId) {
        return new Response('Forbidden', { status: 403 })
      }
    }

    /* Se busca primero donde se guarda ahora y después donde se guardaba antes:
       un archivo que no alcanzó la mudanza tiene que seguir viéndose, o el
       prestamista se encuentra la firma de su pagaré rota. */
    let filePath = null
    for (const base of [directorioAlmacen(), directorioViejo()]) {
      const intento = rutaSegura(segments, base)
      if (!intento) return new Response('Forbidden', { status: 403 })
      if (existsSync(intento)) { filePath = intento; break }
    }
    if (!filePath) return new Response('Not found', { status: 404 })

    const ext = path.extname(filePath).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'
    const buffer = await readFile(filePath)

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        /* PRIVATE, no `public`. Con `public` un proxy o una CDN podría guardar
           la firma de un pagaré y servírsela a otro: la caché no sabe de
           sesiones. `immutable` se queda porque el nombre lleva hash. */
        'Cache-Control': 'private, max-age=31536000, immutable',
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
