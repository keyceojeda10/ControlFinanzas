import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { planTieneFotos } from '@/lib/planes'
import sharp from 'sharp'
import { writeFile, mkdir, unlink } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB raw

const MAGIC_BYTES = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png':  [0x89, 0x50, 0x4E, 0x47],
  'image/webp': null,
}

function validateMagicBytes(buffer, declaredType) {
  if (buffer.length < 12) return false
  if (declaredType === 'image/webp') {
    return buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
           buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  }
  const expected = MAGIC_BYTES[declaredType]
  if (!expected) return false
  return expected.every((byte, i) => buffer[i] === byte)
}

// POST /api/clientes/[id]/foto — Subir/actualizar foto de cliente
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { organizationId, rol } = session.user

    // Verificar plan
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true },
    })
    if (!planTieneFotos(org?.plan)) {
      return Response.json({ error: 'Tu plan no incluye fotos de clientes. Disponible desde el plan Crecimiento.' }, { status: 403 })
    }

    // Verificar permisos
    if (rol !== 'owner') {
      if (rol === 'cobrador') {
        const u = await prisma.user.findUnique({ where: { id: session.user.id }, select: { puedeEditarClientes: true } })
        if (!u?.puedeEditarClientes) return Response.json({ error: 'Sin permiso para editar clientes' }, { status: 403 })
      } else if (rol !== 'superadmin') {
        return Response.json({ error: 'No autorizado' }, { status: 403 })
      }
    }

    const { id } = await params

    // Verificar que el cliente pertenece a la organizacion
    const cliente = await prisma.cliente.findFirst({
      where: { id, organizationId },
      select: { id: true, fotoUrl: true },
    })
    if (!cliente) return Response.json({ error: 'Cliente no encontrado' }, { status: 404 })

    // Leer archivo
    const formData = await request.formData()
    const file = formData.get('foto')
    if (!file || !(file instanceof Blob)) {
      return Response.json({ error: 'No se envio imagen' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return Response.json({ error: 'Formato no soportado. Usa JPG, PNG o WebP.' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return Response.json({ error: 'Imagen muy pesada. Máximo 5MB.' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Validar magic bytes
    if (!validateMagicBytes(buffer, file.type)) {
      return Response.json({ error: 'Archivo no es una imagen valida' }, { status: 400 })
    }

    // Comprimir con sharp: resize 400x400 max, WebP calidad 75
    const compressed = await sharp(buffer)
      .resize(400, 400, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer()

    // Guardar archivo
    const randomName = crypto.randomBytes(16).toString('hex')
    const fileName = `${randomName}.webp`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'clientes', organizationId)
    await mkdir(uploadDir, { recursive: true })
    await writeFile(path.join(uploadDir, fileName), compressed)

    // Eliminar foto anterior si existe
    if (cliente.fotoUrl) {
      try {
        const oldPath = path.join(process.cwd(), 'public', cliente.fotoUrl)
        await unlink(oldPath)
      } catch {
        // Archivo anterior no existe, ignorar
      }
    }

    // Actualizar BD
    const fotoUrl = `/uploads/clientes/${organizationId}/${fileName}`
    await prisma.cliente.update({
      where: { id },
      data: { fotoUrl },
    })

    return Response.json({ fotoUrl })
  } catch (err) {
    console.error('Error subiendo foto:', err)
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE /api/clientes/[id]/foto — Eliminar foto de cliente
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { organizationId, rol } = session.user

    if (rol !== 'owner' && rol !== 'superadmin') {
      if (rol === 'cobrador') {
        const u = await prisma.user.findUnique({ where: { id: session.user.id }, select: { puedeEditarClientes: true } })
        if (!u?.puedeEditarClientes) return Response.json({ error: 'Sin permiso' }, { status: 403 })
      } else {
        return Response.json({ error: 'No autorizado' }, { status: 403 })
      }
    }

    const { id } = await params
    const cliente = await prisma.cliente.findFirst({
      where: { id, organizationId },
      select: { id: true, fotoUrl: true },
    })
    if (!cliente) return Response.json({ error: 'Cliente no encontrado' }, { status: 404 })

    if (cliente.fotoUrl) {
      try {
        const oldPath = path.join(process.cwd(), 'public', cliente.fotoUrl)
        await unlink(oldPath)
      } catch {}
    }

    await prisma.cliente.update({
      where: { id },
      data: { fotoUrl: null },
    })

    return Response.json({ ok: true })
  } catch (err) {
    console.error('Error eliminando foto:', err)
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}
