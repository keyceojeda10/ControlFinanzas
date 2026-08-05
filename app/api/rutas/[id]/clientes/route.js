// app/api/rutas/[id]/clientes/route.js - Asignar / quitar clientes de una ruta

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { registrarMovimientoCapital } from '@/lib/capital'
import { calcularSaldoPendiente } from '@/lib/calculos'

async function verificarRuta(id, organizationId) {
  return prisma.ruta.findFirst({ where: { id, organizationId } })
}

// ─── POST /api/rutas/[id]/clientes ──────────────────────────────
// Body: { clienteIds: string[] }
export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  const puedeGestionar = session.user.rol === 'owner' || session.user.permisos?.gestionarRutas
  if (!puedeGestionar) {
    return Response.json({ error: 'No tienes permiso para asignar clientes a rutas' }, { status: 403 })
  }

  const { id } = await params
  const { organizationId } = session.user

  // Cobrador solo puede gestionar sus rutas asignadas
  if (session.user.rol === 'cobrador' && !session.user.rutaIds?.includes(id)) {
    return Response.json({ error: 'No tienes acceso a esta ruta' }, { status: 403 })
  }

  const ruta = await verificarRuta(id, organizationId)
  if (!ruta) return Response.json({ error: 'Ruta no encontrada' }, { status: 404 })

  // descontarCapitalRuta: si true, el saldo pendiente de los préstamos activos de los
  // clientes asignados se reserva del capital de ESTA ruta (reasignación: no cambia el
  // total del negocio, solo la sub-bolsa). Resuelve el descuadre de que un cliente que
  // entra a la ruta con un préstamo no descontaba nada del capital de la ruta.
  const { clienteIds, forzar, descontarCapitalRuta = false } = await request.json()
  if (!Array.isArray(clienteIds) || !clienteIds.length) {
    return Response.json({ error: 'clienteIds debe ser un array no vacío' }, { status: 400 })
  }
  // Mismo motivo que en el DELETE: un número aquí casaría con cualquier cliente
  // de la tabla, y este endpoint ASIGNA. Ver el comentario largo de más abajo.
  if (!clienteIds.every((c) => typeof c === 'string' && c.trim())) {
    return Response.json({ error: 'clienteIds debe traer identificadores de texto' }, { status: 400 })
  }

  // Verificar que todos los clientes pertenecen a la organización
  const clientes = await prisma.cliente.findMany({
    where: { id: { in: clienteIds }, organizationId, estado: { notIn: ['eliminado'] } },
    select: { id: true, nombre: true, rutaId: true },
  })
  if (clientes.length !== clienteIds.length) {
    return Response.json({ error: 'Uno o más clientes no son válidos' }, { status: 400 })
  }

  // Verificar si algún cliente ya está en otra ruta
  const enOtraRuta = clientes.filter((c) => c.rutaId && c.rutaId !== id)
  if (enOtraRuta.length > 0 && !forzar) {
    const nombres = enOtraRuta.map((c) => c.nombre).join(', ')
    return Response.json(
      { error: `Estos clientes ya están en otra ruta: ${nombres}. Usa la opción de mover para reasignarlos.` },
      { status: 409 }
    )
  }

  // Préstamos activos de los clientes a asignar (para descontar su saldo del capital de la ruta).
  const prestamosActivos = descontarCapitalRuta
    ? await prisma.prestamo.findMany({
      where: { clienteId: { in: clienteIds }, organizationId, estado: 'activo', esClavo: false },
      select: { id: true, totalAPagar: true, totalPagado: true, pagos: { select: { montoPagado: true, tipo: true } } },
    })
    : []

  // Asignar clientes en transaccion atomica (max orden + updates juntos)
  await prisma.$transaction(async (tx) => {
    const maxOrden = await tx.cliente.aggregate({
      where: { rutaId: id, organizationId },
      _max: { ordenRuta: true },
    })
    const nextOrden = (maxOrden._max.ordenRuta ?? -1) + 1

    for (let i = 0; i < clienteIds.length; i++) {
      await tx.cliente.update({
        where: { id: clienteIds[i] },
        data: { rutaId: id, ordenRuta: nextOrden + i },
      })
    }

    // Reservar el saldo pendiente de los préstamos activos en el capital de la ruta.
    // ajusteArranqueRuta: no altera el saldo global de la org, solo la sub-bolsa de la ruta.
    if (descontarCapitalRuta) {
      for (const p of prestamosActivos) {
        const saldo = Math.round(calcularSaldoPendiente(p))
        if (saldo <= 0) continue
        await registrarMovimientoCapital(tx, {
          organizationId,
          tipo: 'desembolso',
          direccion: 'egreso',
          monto: saldo,
          descripcion: `Reserva de capital por préstamo de cliente asignado a la ruta`,
          referenciaId: p.id,
          referenciaTipo: 'prestamo',
          rutaId: id,
          ajusteArranqueRuta: true,
          creadoPorId: session.user.id,
        })
      }
    }
  })

  return Response.json({ asignados: clienteIds.length })
}

// ─── DELETE /api/rutas/[id]/clientes ────────────────────────────
// Body: { clienteId: string }
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  const puedeGestionar = session.user.rol === 'owner' || session.user.permisos?.gestionarRutas
  if (!puedeGestionar) {
    return Response.json({ error: 'No tienes permiso para quitar clientes de rutas' }, { status: 403 })
  }

  const { id } = await params
  const { organizationId } = session.user

  // Cobrador solo puede gestionar sus rutas asignadas
  if (session.user.rol === 'cobrador' && !session.user.rutaIds?.includes(id)) {
    return Response.json({ error: 'No tienes acceso a esta ruta' }, { status: 403 })
  }

  const ruta = await verificarRuta(id, organizationId)
  if (!ruta) return Response.json({ error: 'Ruta no encontrada' }, { status: 404 })

  const { clienteId } = await request.json()
  // ⚠ TIENE QUE SER TEXTO, y no vale con `!clienteId`.
  //
  // Los ids son varchar. En MariaDB, comparar una columna de texto con un
  // NÚMERO convierte cada texto a número, y «cmm79te91…» empieza por letra, o
  // sea que vale 0. Resultado: `id = 0` casa con TODAS las filas de Cliente y
  // el findFirst devuelve una cualquiera.
  //
  // Así se quitó de la ruta a quien no era: la pantalla mandaba el índice de la
  // parada porque le faltaba el id, y el índice de la primera parada es 0.
  if (typeof clienteId !== 'string' || !clienteId.trim()) {
    return Response.json({ error: 'clienteId es requerido' }, { status: 400 })
  }

  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId, organizationId, rutaId: id },
  })
  if (!cliente) return Response.json({ error: 'Cliente no encontrado en esta ruta' }, { status: 404 })

  await prisma.cliente.update({ where: { id: clienteId }, data: { rutaId: null, ordenRuta: null } })

  return Response.json({ quitado: clienteId })
}
