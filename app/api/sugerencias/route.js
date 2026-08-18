import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { transcribirAudio } from '@/lib/transcribir'
import {
  campanaViva, diasQueQuedan, tieneContenido,
  MAX_IMAGENES, MAX_BYTES_IMAGEN, MAX_BYTES_AUDIO, MAX_CARACTERES,
  TIPOS_IMAGEN, TIPOS_AUDIO,
} from '@/lib/sugerencias'

export const runtime = 'nodejs'
export const maxDuration = 60

/* Lo que la gente dice que le falta. Ver `lib/sugerencias` para el porqué, para
   lo que ya se intentó y no funcionó, y para por qué esto va a TODOS y no solo
   a los dueños.

   ⚠ LOS ARCHIVOS NO VAN A `public/`. Lo que vive ahí lo sirve Next como estático
   y no pasa por la sesión —comprobado contra producción: `/uploads/...` responde
   200 sin cuenta—. Una captura de la cartera lleva nombres, cédulas y deudas de
   terceros que no están en esta conversación. Van al almacén, como las fotos de
   cuadernos, donde ni un `git pull` ni un despliegue las rozan. */
function carpetaSugerencias() {
  return process.env.SUGERENCIAS_DIR || `${process.cwd()}/.sugerencias`
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const viva = campanaViva()
  // Si ya mandó algo, el banner cambia de texto en vez de desaparecer: quien
  // ayudó tiene que ver que llegó, y puede querer añadir otra cosa después.
  const mias = await prisma.sugerencia.count({ where: { userId: session.user.id } })

  /* ══ LA RESPUESTA VUELVE POR DONDE VINO ══════════════════════════════════
   *
   * «No se les puede contestar desde el banner, no por WhatsApp.» — el dueño,
   * 18 ago 2026.
   *
   * Tenía razón y el fallo era de diseño mío: hice el campo `respuesta` como
   * libreta privada del panel —«se guarda aquí, no se le envía»— y contestar
   * quedó dependiendo de tener el WhatsApp de la persona. De los cinco que
   * escribieron, a uno hubo que buscarle el número; y un cobrador que manda una
   * queja desde la ruta no tiene por qué darle su teléfono a nadie.
   *
   * Escribieron desde el banner: la respuesta se lee en el banner.
   *
   * ⚠ Se devuelve aunque la campaña esté cerrada. El 28 de agosto el banner se
   * apaga solo, y quien escribió el 27 tiene que poder leer lo que se le
   * contestó el 29. */
  const contestadas = await prisma.sugerencia.findMany({
    where: {
      userId: session.user.id,
      respuesta: { not: null },
      respuestaVistaEn: null,
    },
    select: { id: true, texto: true, respuesta: true, respondidaEn: true },
    orderBy: { respondidaEn: 'desc' },
    take: 3,
  })

  return Response.json({ viva, dias: diasQueQuedan(), mias, contestadas })
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 })
  if (!session.user.organizationId) {
    return Response.json({ error: 'Sin organización' }, { status: 400 })
  }
  if (!campanaViva()) {
    return Response.json({ error: 'La campaña ya cerró. ¡Gracias!' }, { status: 410 })
  }

  let form
  try { form = await request.formData() } catch {
    return Response.json({ error: 'Envío inválido' }, { status: 400 })
  }

  const textoEscrito = String(form.get('texto') ?? '').trim().slice(0, MAX_CARACTERES)
  const imagenes = form.getAll('imagenes').filter((f) => f && typeof f === 'object')
  const audio = form.get('audio')

  if (!tieneContenido({ texto: textoEscrito, imagenes: imagenes.length, audio: !!audio })) {
    return Response.json({ error: 'Escribe algo, graba una nota o adjunta una imagen' }, { status: 400 })
  }
  if (imagenes.length > MAX_IMAGENES) {
    return Response.json({ error: `Máximo ${MAX_IMAGENES} imágenes` }, { status: 400 })
  }

  const carpeta = path.join(carpetaSugerencias(), session.user.organizationId)
  await mkdir(carpeta, { recursive: true })
  const guardados = []

  const guardar = async (archivo, prefijo, tiposOk, maxBytes) => {
    if (!tiposOk.includes(archivo.type)) return { error: `Formato no admitido: ${archivo.type || 'desconocido'}` }
    const buf = Buffer.from(await archivo.arrayBuffer())
    if (buf.length > maxBytes) return { error: 'Archivo demasiado grande' }
    const ext = (archivo.name?.split('.').pop() || archivo.type.split('/')[1] || 'bin').slice(0, 5)
    const nombre = `${prefijo}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`
    await writeFile(path.join(carpeta, nombre), buf)
    guardados.push(path.join(session.user.organizationId, nombre))
    return { ok: true }
  }

  for (const img of imagenes) {
    const r = await guardar(img, 'img', TIPOS_IMAGEN, MAX_BYTES_IMAGEN)
    if (r.error) return Response.json({ error: r.error }, { status: 400 })
  }

  /* ⚠ SI LA TRANSCRIPCIÓN FALLA, EL AUDIO NO SE PIERDE. Se guarda igual y la
     sugerencia queda con el texto que haya —aunque sea ninguno— más el archivo.
     Tirar la nota de voz de alguien porque Groq tuvo un mal minuto sería
     exactamente lo contrario de lo que esta campaña intenta. */
  let textoVoz = ''
  let fuente = 'escrito'
  if (audio) {
    const r = await guardar(audio, 'voz', TIPOS_AUDIO, MAX_BYTES_AUDIO)
    if (r.error) return Response.json({ error: r.error }, { status: 400 })
    const t = await transcribirAudio(audio)
    textoVoz = t.texto ?? ''
    fuente = textoEscrito ? 'escrito+voz' : 'voz'
  }

  const texto = [textoEscrito, textoVoz].filter(Boolean).join('\n\n')

  const creada = await prisma.sugerencia.create({
    data: {
      organizationId: session.user.organizationId,
      userId: session.user.id,
      rol: session.user.rol ?? 'desconocido',
      texto: texto || '(sin texto: revisar los adjuntos)',
      fuente,
      archivos: guardados.length ? JSON.stringify(guardados) : null,
    },
    select: { id: true },
  })

  return Response.json({ ok: true, id: creada.id, transcrito: !!textoVoz })
}


/* Marcar que ya la leyó. Una tarjeta que no se puede cerrar es la que la gente
   aprende a saltarse, y la siguiente respuesta ya no la mira. */
export async function PATCH(request) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await request.json().catch(() => ({}))
  if (!id) return Response.json({ error: 'Falta cuál' }, { status: 400 })

  /* Por `userId` además del id: sin eso, cualquiera podría marcar como vista la
     respuesta de otro con solo tener el identificador. */
  const { count } = await prisma.sugerencia.updateMany({
    where: { id, userId: session.user.id, respuestaVistaEn: null },
    data: { respuestaVistaEn: new Date() },
  })
  return Response.json({ ok: count > 0 })
}
