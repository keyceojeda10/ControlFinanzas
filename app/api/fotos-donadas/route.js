import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import {
  META_FOTOS, MAX_POR_ENVIO, MAX_BYTES, TIPOS, FORMAS,
  campanaViva, faltan, carpetaDonadas,
} from '@/lib/fotos-donadas'

/* Las fotos donadas para medir el lector de cartulinas. Ver `lib/fotos-donadas`
   para el porqué, para lo que NO se puede prometer, y para por qué el archivo
   no vive en `public/`. */

const MAGIC = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
}

/* La misma comprobación que ya hace la foto de cliente: la extensión y el
   `type` los pone el navegador y se pueden mentir; los primeros bytes no. */
function esImagenDeVerdad(buf, tipo) {
  if (buf.length < 12) return false
  if (tipo === 'image/webp') {
    return buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
           buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  }
  if (tipo === 'image/heic' || tipo === 'image/heif') {
    // El HEIC del iPhone: caja `ftyp` en los bytes 4-8.
    return buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70
  }
  const esperado = MAGIC[tipo]
  return esperado ? esperado.every((b, i) => buf[i] === b) : false
}

const EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'image/heic': 'heic', 'image/heif': 'heif',
}

/**
 * GET — el estado de la campaña.
 *
 * ⚠ DEVUELVE DOS CUENTAS DISTINTAS Y NO SE PUEDEN CONFUNDIR:
 *   · `recogidas` — el total de TODO el mundo, que es lo que cierra la campaña
 *   · `mias`      — lo que mandó ESTE negocio, que es lo que le da las gracias
 * Al principio valen lo mismo y por eso es fácil escribir una donde va la otra.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }
    const [recogidas, mias] = await Promise.all([
      prisma.fotoDonada.count(),
      prisma.fotoDonada.count({ where: { organizationId: session.user.organizationId } }),
    ])
    return Response.json({
      viva: campanaViva(recogidas), recogidas, mias,
      meta: META_FOTOS, faltan: faltan(recogidas),
    })
  } catch (e) {
    console.error('[fotos-donadas] GET', e)
    /* Que el panel no se caiga por esto. Es un banner de una campaña de tres
       días; si su cuenta falla, lo que NO puede pasar es que se lleve por
       delante la pantalla con la que se cobra. */
    return Response.json({ viva: false, recogidas: 0, mias: 0, meta: META_FOTOS, faltan: META_FOTOS })
  }
}

/** POST — recibe las fotos. */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }
    const { organizationId, id: userId } = session.user

    const yaHay = await prisma.fotoDonada.count()
    if (!campanaViva(yaHay)) {
      return Response.json({ error: 'La campaña ya cerró. ¡Gracias!' }, { status: 410 })
    }

    const form = await request.formData()
    const archivos = form.getAll('fotos').filter((f) => f instanceof Blob)
    const forma = FORMAS.some((f) => f.id === form.get('forma')) ? form.get('forma') : null

    if (!archivos.length) return Response.json({ error: 'No llegó ninguna foto' }, { status: 400 })
    if (archivos.length > MAX_POR_ENVIO) {
      return Response.json({ error: `Máximo ${MAX_POR_ENVIO} fotos por envío` }, { status: 400 })
    }

    const carpeta = path.join(carpetaDonadas(), organizationId)
    await mkdir(carpeta, { recursive: true })

    const guardadas = []
    const rechazadas = []

    for (const f of archivos) {
      const nombre = f.name || 'foto'
      if (!TIPOS.includes(f.type)) { rechazadas.push({ nombre, razon: 'No es una imagen' }); continue }
      if (f.size > MAX_BYTES) { rechazadas.push({ nombre, razon: 'Pesa más de 8 MB' }); continue }

      const buf = Buffer.from(await f.arrayBuffer())
      if (!esImagenDeVerdad(buf, f.type)) { rechazadas.push({ nombre, razon: 'El archivo está dañado' }); continue }

      /* ⚠ LA FOTO SE GUARDA TAL CUAL, sin comprimir ni recortar. La de cliente
         pasa por `sharp` a 400×400 porque es un avatar; aquí encoger es
         destruir la prueba: lo que se va a medir es si el lector distingue un
         «3» de un «8» escritos a lápiz. */
      const archivo = path.join(carpeta, `${crypto.randomBytes(16).toString('hex')}.${EXT[f.type]}`)
      await writeFile(archivo, buf)
      guardadas.push({ archivo, bytes: buf.length })
    }

    if (guardadas.length) {
      await prisma.fotoDonada.createMany({
        data: guardadas.map((g) => ({ organizationId, userId, archivo: g.archivo, bytes: g.bytes, forma })),
      })
    }

    const [recogidas, mias] = await Promise.all([
      prisma.fotoDonada.count(),
      prisma.fotoDonada.count({ where: { organizationId } }),
    ])

    return Response.json({
      guardadas: guardadas.length, rechazadas,
      viva: campanaViva(recogidas), recogidas, mias, meta: META_FOTOS,
    })
  } catch (e) {
    console.error('[fotos-donadas] POST', e)
    return Response.json({ error: 'No se pudieron guardar las fotos' }, { status: 500 })
  }
}
