import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir, unlink } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

// POST /api/prestamos/[id]/firma — Guardar firma del cliente (base64 PNG)
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { organizationId } = session.user
    const { id } = await params

    const prestamo = await prisma.prestamo.findFirst({
      where: { id, organizationId },
      select: { id: true, firmaUrl: true },
    })
    if (!prestamo) return Response.json({ error: 'Préstamo no encontrado' }, { status: 404 })

    const { firma } = await request.json()
    if (!firma || typeof firma !== 'string' || !firma.startsWith('data:image/png;base64,')) {
      return Response.json({ error: 'Firma inválida' }, { status: 400 })
    }

    const base64Data = firma.replace(/^data:image\/png;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    if (buffer.length > 500 * 1024) {
      return Response.json({ error: 'Firma muy pesada' }, { status: 400 })
    }

    const randomName = crypto.randomBytes(16).toString('hex')
    const fileName = `${randomName}.png`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'firmas', organizationId)
    await mkdir(uploadDir, { recursive: true })
    await writeFile(path.join(uploadDir, fileName), buffer)

    if (prestamo.firmaUrl) {
      try {
        await unlink(path.join(process.cwd(), 'public', prestamo.firmaUrl))
      } catch {}
    }

    const firmaUrl = `/uploads/firmas/${organizationId}/${fileName}`
    await prisma.prestamo.update({
      where: { id },
      data: { firmaUrl },
    })

    return Response.json({ firmaUrl })
  } catch (e) {
    console.error('Error firma:', e)
    return Response.json({ error: 'Error al guardar firma' }, { status: 500 })
  }
}

// DELETE /api/prestamos/[id]/firma — Eliminar firma
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { organizationId } = session.user
    const { id } = await params

    const prestamo = await prisma.prestamo.findFirst({
      where: { id, organizationId },
      select: { id: true, firmaUrl: true },
    })
    if (!prestamo) return Response.json({ error: 'Préstamo no encontrado' }, { status: 404 })

    if (prestamo.firmaUrl) {
      try {
        await unlink(path.join(process.cwd(), 'public', prestamo.firmaUrl))
      } catch {}
    }

    await prisma.prestamo.update({
      where: { id },
      data: { firmaUrl: null },
    })

    return Response.json({ ok: true })
  } catch (e) {
    console.error('Error eliminar firma:', e)
    return Response.json({ error: 'Error al eliminar firma' }, { status: 500 })
  }
}
