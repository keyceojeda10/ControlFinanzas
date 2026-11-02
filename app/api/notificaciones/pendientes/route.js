// app/api/notificaciones/pendientes/route.js — LO QUE ESPERA UNA DECISIÓN.
//
// La campana solo sabía contar lo que PASÓ. Lo que de verdad necesita al dueño
// —un préstamo que un cobrador no puede entregar hasta que se lo aprueben, una
// caja que pide reabrirse, un gasto por aprobar, el permiso para hacerle otra
// cartulina a quien ya debe— llegaba solo por push (el 14 %
// de los dueños lo tiene encendido) o había que ir a buscarlo a tres pantallas
// distintas. Aquí se juntan las tres colas en una lista, con lo justo para
// decidir sin abrir nada: quién, cuánto, para quién y desde cuándo.
//
// No escribe nada: aprobar y rechazar siguen siendo los endpoints de siempre
// (`/api/prestamos/[id]/aprobar`, `/api/caja/reabrir/aprobar`, `/api/gastos/[id]`),
// con sus mismas validaciones. Una sola forma de aprobar, llamada desde dos sitios.
//
// Solo el dueño: un cobrador no aprueba nada.

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { perdidosDelCliente } from '@/lib/dinero/cliente-en-perdidos'
import { CAMPOS_DEL_REPARTO } from '@/lib/dinero/capital-base'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return Response.json({ pendientes: [] })

  const { organizationId } = session.user

  const [prestamos, reaperturas, gastos, permisos] = await Promise.all([
    prisma.prestamo.findMany({
      where: { organizationId, estado: 'pendiente_aprobacion' },
      select: {
        id: true, montoPrestado: true, ...CAMPOS_DEL_REPARTO, totalAPagar: true, createdAt: true, creadoPorId: true,
        cliente: { select: { nombre: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 30,
    }),
    prisma.cierreCaja.findMany({
      where: { organizationId, solicitudReaperturaEn: { not: null }, reabiertoEn: null },
      select: {
        id: true, fecha: true, solicitudReaperturaEn: true,
        cobrador: { select: { nombre: true } },
      },
      orderBy: { solicitudReaperturaEn: 'asc' },
      take: 30,
    }),
    prisma.gastoMenor.findMany({
      where: { organizationId, estado: 'pendiente' },
      select: {
        id: true, description: true, monto: true, fecha: true,
        cobrador: { select: { nombre: true } },
      },
      orderBy: { fecha: 'asc' },
      take: 30,
    }),
    // Otra cartulina a quien ya debe (lib/dinero/permiso-prestamo.js). Solo las
    // de hoy y ayer: una de hace una semana ya no tiene a nadie esperando.
    prisma.permisoPrestamo.findMany({
      where: { organizationId, estado: 'pendiente', createdAt: { gte: new Date(Date.now() - 2 * 86400000) } },
      orderBy: { createdAt: 'asc' },
      take: 30,
    }),
  ])

  // `Prestamo.creadoPorId` es un id suelto, sin relación: los nombres se traen
  // aparte y de una vez.
  const ids = [...new Set([...prestamos.map((p) => p.creadoPorId), ...permisos.map((p) => p.cobradorId)].filter(Boolean))]
  const autores = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids }, organizationId }, select: { id: true, nombre: true } })
    : []
  const nombreDe = new Map(autores.map((u) => [u.id, u.nombre]))
  const idsClientes = [...new Set(permisos.map((p) => p.clienteId))]
  const clientesDePermisos = idsClientes.length
    ? await prisma.cliente.findMany({ where: { id: { in: idsClientes }, organizationId }, select: { id: true, nombre: true } })
    : []
  const clienteDe = new Map(clientesDePermisos.map((c) => [c.id, c.nombre]))
  /* El que pide prestarle a un clavo lo dice en la fila: el dueño decide con un
     toque y tiene que saber qué está aprobando (2 nov 2026). */
  const clavos = await Promise.all(idsClientes.map((clienteId) => perdidosDelCliente(prisma, { organizationId, clienteId })))
  const clavoDe = new Map(idsClientes.map((id, i) => [id, clavos[i]]))

  const pendientes = [
    ...prestamos.map((p) => ({
      clave: `prestamo:${p.id}`, clase: 'prestamo', id: p.id,
      quien: nombreDe.get(p.creadoPorId) ?? 'Un cobrador',
      para: p.cliente?.nombre ?? null,
      monto: Number(p.montoPrestado) || 0,
      desde: p.createdAt,
      href: `/prestamos/${p.id}`,
    })),
    ...reaperturas.map((c) => ({
      clave: `reapertura:${c.id}`, clase: 'reapertura', id: c.id,
      quien: c.cobrador?.nombre ?? 'Un cobrador',
      fechaCaja: c.fecha,
      desde: c.solicitudReaperturaEn,
      href: '/caja',
    })),
    ...permisos.map((p) => ({
      clave: `permiso:${p.id}`, clase: 'permiso', id: p.id,
      quien: nombreDe.get(p.cobradorId) ?? 'Un cobrador',
      para: clienteDe.get(p.clienteId) ?? null,
      monto: Number(p.monto) || 0,
      clavo: clavoDe.get(p.clienteId) ? { saldo: clavoDe.get(p.clienteId).saldo } : null,
      desde: p.createdAt,
      href: `/clientes/${p.clienteId}`,
    })),
    ...gastos.map((g) => ({
      clave: `gasto:${g.id}`, clase: 'gasto', id: g.id,
      quien: g.cobrador?.nombre ?? 'Un cobrador',
      concepto: g.description,
      monto: Number(g.monto) || 0,
      desde: g.fecha,
      // Un gasto guarda el DÍA (a mediodía), no la hora en que se anotó: con
      // «hace 8 h» recién creado, la fila mentía. Se dice «hoy» o «ayer».
      soloDia: true,
      href: '/gastos',
    })),
  ].sort((a, b) => new Date(a.desde) - new Date(b.desde))

  return Response.json({ pendientes })
}
