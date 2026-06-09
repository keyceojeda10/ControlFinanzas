import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

// Elimina todos los clientes y préstamos marcados como demo de esta org.
// Se llama desde WizardExito al montar, en background.
export async function DELETE(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const orgId = session.user.organizationId

  try {
    const { clienteId, prestamoId } = await req.json().catch(() => ({}))

    if (prestamoId) {
      // Borrar pagos del préstamo demo primero (FK constraint)
      await prisma.pago.deleteMany({ where: { prestamoId, prestamo: { organizationId: orgId } } }).catch(() => {})
      await prisma.prestamo.deleteMany({ where: { id: prestamoId, organizationId: orgId } }).catch(() => {})
    }

    if (clienteId) {
      // Borrar cualquier préstamo que haya quedado del cliente demo
      const prestamos = await prisma.prestamo.findMany({ where: { clienteId, organizationId: orgId }, select: { id: true } })
      for (const p of prestamos) {
        await prisma.pago.deleteMany({ where: { prestamoId: p.id } }).catch(() => {})
      }
      await prisma.prestamo.deleteMany({ where: { clienteId, organizationId: orgId } }).catch(() => {})
      await prisma.cliente.deleteMany({ where: { id: clienteId, organizationId: orgId } }).catch(() => {})
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[demo-cleanup]', err)
    return NextResponse.json({ error: 'Error en cleanup' }, { status: 500 })
  }
}
