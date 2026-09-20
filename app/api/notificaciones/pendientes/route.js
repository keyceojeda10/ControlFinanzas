// app/api/notificaciones/pendientes/route.js — LO QUE ESPERA UNA DECISIÓN.
//
// La campana solo sabía contar lo que PASÓ. Lo que de verdad necesita al dueño
// —un préstamo que un cobrador no puede entregar hasta que se lo aprueben, una
// caja que pide reabrirse, un gasto por aprobar— llegaba solo por push (el 14 %
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

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return Response.json({ pendientes: [] })

  const { organizationId } = session.user

  const [prestamos, reaperturas, gastos] = await Promise.all([
    prisma.prestamo.findMany({
      where: { organizationId, estado: 'pendiente_aprobacion' },
      select: {
        id: true, montoPrestado: true, totalAPagar: true, createdAt: true, creadoPorId: true,
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
  ])

  // `Prestamo.creadoPorId` es un id suelto, sin relación: los nombres se traen
  // aparte y de una vez.
  const ids = [...new Set(prestamos.map((p) => p.creadoPorId).filter(Boolean))]
  const autores = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids }, organizationId }, select: { id: true, nombre: true } })
    : []
  const nombreDe = new Map(autores.map((u) => [u.id, u.nombre]))

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
