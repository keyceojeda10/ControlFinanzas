// app/api/rutas/backup/route.js — Backup y restauracion de configuracion de rutas

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

// ─── GET /api/rutas/backup — Descargar configuracion actual ──────
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId || session.user.rol !== 'owner') {
    return Response.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { organizationId } = session.user

  const rutas = await prisma.ruta.findMany({
    where: { organizationId },
    select: {
      id:     true,
      nombre: true,
      clientes: {
        where: { estado: { not: 'eliminado' } },
        select: { id: true, nombre: true, cedula: true, ordenRuta: true },
        orderBy: { ordenRuta: 'asc' },
      },
    },
  })

  const clientesSinRuta = await prisma.cliente.findMany({
    where: { organizationId, rutaId: null, estado: { not: 'eliminado' } },
    select: { id: true, nombre: true, cedula: true },
  })

  return Response.json({
    version: 1,
    fecha: new Date().toISOString(),
    organizationId,
    rutas: rutas.map((r) => ({
      id:       r.id,
      nombre:   r.nombre,
      clientes: r.clientes.map((c) => ({ id: c.id, nombre: c.nombre, cedula: c.cedula, orden: c.ordenRuta })),
    })),
    sinRuta: clientesSinRuta.length,
  })
}

// ─── POST /api/rutas/backup — Restaurar configuracion ────────────
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId || session.user.rol !== 'owner') {
    return Response.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { organizationId } = session.user

  try {
    const backup = await request.json()

    if (!backup?.rutas || !Array.isArray(backup.rutas)) {
      return Response.json({ error: 'Formato de backup invalido' }, { status: 400 })
    }

    // Verificar que las rutas del backup existen en esta org
    const rutaIds = backup.rutas.map((r) => r.id)
    const rutasExistentes = await prisma.ruta.findMany({
      where: { id: { in: rutaIds }, organizationId },
      select: { id: true },
    })
    const rutasValidas = new Set(rutasExistentes.map((r) => r.id))

    // Recolectar todos los clienteIds del backup
    const clienteIds = backup.rutas.flatMap((r) => r.clientes.map((c) => c.id))
    const clientesExistentes = await prisma.cliente.findMany({
      where: { id: { in: clienteIds }, organizationId, estado: { not: 'eliminado' } },
      select: { id: true },
    })
    const clientesValidos = new Set(clientesExistentes.map((c) => c.id))

    // Ejecutar restauracion en una transaccion
    await prisma.$transaction(async (tx) => {
      // 1. Desasignar todos los clientes de la org
      await tx.cliente.updateMany({
        where: { organizationId, estado: { not: 'eliminado' } },
        data: { rutaId: null, ordenRuta: null },
      })

      // 2. Re-asignar segun backup
      for (const ruta of backup.rutas) {
        if (!rutasValidas.has(ruta.id)) continue
        for (const c of ruta.clientes) {
          if (!clientesValidos.has(c.id)) continue
          await tx.cliente.update({
            where: { id: c.id },
            data: { rutaId: ruta.id, ordenRuta: c.orden ?? 0 },
          })
        }
      }
    })

    return Response.json({ ok: true, restaurados: clienteIds.filter((id) => clientesValidos.has(id)).length })
  } catch (err) {
    console.error('[Backup] Error restaurando:', err)
    return Response.json({ error: 'Error al restaurar la configuracion' }, { status: 500 })
  }
}
