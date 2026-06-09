import { NextResponse }           from 'next/server'
import { getServerSession }        from 'next-auth'
import { authOptions }             from '@/lib/auth'
import { prisma }                  from '@/lib/prisma'
import { recalcularSaldosCapital } from '@/lib/capital'

// Elimina todos los clientes y préstamos marcados como demo de esta org.
// También revierte los movimientos de capital generados por el préstamo demo.
// Se llama desde WizardExito al montar, en background.
export async function DELETE(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const orgId = session.user.organizationId

  try {
    const { clienteId, prestamoId } = await req.json().catch(() => ({}))

    // Recopilar todos los IDs de préstamos demo a limpiar
    const prestamoIds = new Set()
    if (prestamoId) prestamoIds.add(prestamoId)

    if (clienteId) {
      const extras = await prisma.prestamo.findMany({
        where: { clienteId, organizationId: orgId },
        select: { id: true },
      })
      extras.forEach(p => prestamoIds.add(p.id))
    }

    await prisma.$transaction(async (tx) => {
      // 1. Borrar pagos
      for (const pid of prestamoIds) {
        await tx.pago.deleteMany({ where: { prestamoId: pid } })
      }

      // 2. Borrar movimientos de capital vinculados a estos préstamos
      //    (desembolso, recaudo de abono previo, etc.)
      if (prestamoIds.size > 0) {
        await tx.movimientoCapital.deleteMany({
          where: {
            organizationId: orgId,
            referenciaId: { in: [...prestamoIds] },
          },
        })
      }

      // 3. Borrar préstamos
      await tx.prestamo.deleteMany({
        where: { id: { in: [...prestamoIds] }, organizationId: orgId },
      })

      // 4. Borrar logs de actividad vinculados al cliente y préstamos demo
      const entidadesABorrar = [...prestamoIds, ...(clienteId ? [clienteId] : [])]
      if (entidadesABorrar.length > 0) {
        await tx.actividadLog.deleteMany({
          where: {
            organizationId: orgId,
            entidadId: { in: entidadesABorrar },
          },
        })
      }

      // 5. Borrar cliente
      if (clienteId) {
        await tx.cliente.deleteMany({ where: { id: clienteId, organizationId: orgId } })
      }

      // 6. Recalcular saldo de Capital desde cero para que quede exacto
      //    (por si había capital configurado antes del demo)
      await recalcularSaldosCapital(tx, { organizationId: orgId })
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[demo-cleanup]', err)
    return NextResponse.json({ error: 'Error en cleanup' }, { status: 500 })
  }
}
