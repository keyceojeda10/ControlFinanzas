import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { rol } = session.user
    if (rol !== 'superadmin' && rol !== 'owner') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { id } = await params

    // Verificar acceso al ticket
    if (rol === 'owner') {
      const ticket = await prisma.ticketSoporte.findFirst({
        where: { id, organizationId: session.user.organizationId },
        select: { id: true },
      })
      if (!ticket) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('imagen')
    const contenido = formData.get('contenido') || ''

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'No se envió imagen' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Formato no permitido. Usa JPG, PNG, WebP o GIF' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'La imagen no puede superar 5MB' }, { status: 400 })
    }

    // Generar nombre único
    const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1]
    const fileName = `${id}-${Date.now()}.${ext}`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'tickets')

    await mkdir(uploadDir, { recursive: true })

    const bytes = new Uint8Array(await file.arrayBuffer())
    await writeFile(path.join(uploadDir, fileName), bytes)

    const imagenUrl = `/uploads/tickets/${fileName}`

    // Crear mensaje con imagen
    const mensaje = await prisma.mensajeTicket.create({
      data: {
        ticketId: id,
        userId: session.user.id,
        contenido: contenido.trim() || '',
        imagenUrl,
        esAdmin: rol === 'superadmin',
      },
      include: { user: { select: { nombre: true, rol: true } } },
    })

    await prisma.ticketSoporte.update({
      where: { id },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json(mensaje, { status: 201 })
  } catch (error) {
    console.error('[POST /api/soporte/[id]/upload]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
