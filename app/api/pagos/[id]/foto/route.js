import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import sharp from 'sharp'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024

function validateMagicBytes(buffer, declaredType) {
  if (buffer.length < 12) return false
  if (declaredType === 'image/webp') {
    return buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
           buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  }
  const expected = {
    'image/jpeg': [0xFF, 0xD8, 0xFF],
    'image/png':  [0x89, 0x50, 0x4E, 0x47],
  }[declaredType]
  if (!expected) return false
  return expected.every((byte, i) => buffer[i] === byte)
}

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const { organizationId, id: userId, rol } = session.user

    const pago = await prisma.pago.findFirst({
      where: { id, organizationId },
      select: { id: true, cobradorId: true },
    })
    if (!pago) return Response.json({ error: 'Pago no encontrado' }, { status: 404 })

    if (rol === 'cobrador' && pago.cobradorId !== userId) {
      return Response.json({ error: 'No tienes acceso a este pago' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('foto')
    if (!file || !(file instanceof Blob)) {
      return Response.json({ error: 'No se envio imagen' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return Response.json({ error: 'Formato no soportado. Usa JPG, PNG o WebP.' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return Response.json({ error: 'Imagen muy pesada. Maximo 5MB.' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (!validateMagicBytes(buffer, file.type)) {
      return Response.json({ error: 'Archivo no es una imagen valida' }, { status: 400 })
    }

    const compressed = await sharp(buffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer()

    const randomName = crypto.randomBytes(16).toString('hex')
    const fileName = `${randomName}.webp`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'pagos', organizationId)
    await mkdir(uploadDir, { recursive: true })
    await writeFile(path.join(uploadDir, fileName), compressed)

    const fotoUrl = `/uploads/pagos/${organizationId}/${fileName}`
    await prisma.pago.update({
      where: { id },
      data: { fotoUrl },
    })

    return Response.json({ fotoUrl })
  } catch (err) {
    console.error('Error subiendo foto de pago:', err)
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}
