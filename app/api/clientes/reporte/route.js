// app/api/clientes/reporte/route.js — ¿LE PRESTO A ESTA PERSONA?
//
// GET ?cedula=…     al escribirla en «nuevo cliente»
// GET ?clienteId=…  en la ficha y al elegirlo en «nuevo préstamo»
// POST { clienteId } el cobrador que se topa en «nuevo cliente» con una cédula
//                    que ya es del negocio le avisa al dueño (una vez al día)
//
// Reemplaza a /api/clientes/score, que solo miraba otros negocios. La regla:
// lib/reporte-cliente.js · la consulta: lib/reporte-cedula.js.
//
// ⚠ EL COBRADOR VE EL REPORTE DE CUALQUIER CLIENTE DEL NEGOCIO, también de
// otra ruta: es justo lo que pidió el dueño, que un cobrador no le preste a
// quien ya le quedó mal a otro. Lo que no ve son montos: el reporte no lleva.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { reporteLimiter } from '@/lib/rate-limit'
import { planVeOtrosNegocios } from '@/lib/planes'
import { datosDelReporte } from '@/lib/reporte-cedula'
import { reporteDe } from '@/lib/reporte-cliente'
import { prisma } from '@/lib/prisma'
import { notificar } from '@/lib/notificar'
import { logActividad } from '@/lib/activity-log'
import { getLocalDateStr, getLocalDayRange } from '@/lib/i18n'

const enLaRuta = (ruta) => (ruta ? (/^\s*ruta\b/i.test(ruta) ? ruta : `la ruta ${ruta}`) : 'otra ruta')

export async function GET(req) {
  const session = await getServerSession(authOptions)
  const organizationId = session?.user?.organizationId
  if (!organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })

  if (!reporteLimiter(session.user.id).ok) {
    return Response.json({ error: 'Demasiadas consultas. Intenta en un rato.' }, { status: 429 })
  }

  const { searchParams } = new URL(req.url)
  const cedula = searchParams.get('cedula')?.trim() || null
  const clienteId = searchParams.get('clienteId')?.trim() || null
  if (!cedula && !clienteId) return Response.json({ error: 'Falta la cédula' }, { status: 400 })

  const conOtros = planVeOtrosNegocios(session.user.plan)
  try {
    const datos = await datosDelReporte({ organizationId, cedula, clienteId, conOtros })
    const r = reporteDe({ propio: datos.propio, otros: datos.otros })
    return Response.json({
      ...r,
      conOtros,
      negocios: datos.otros?.negocios ?? 0,
      // Para «nuevo cliente»: la cédula ya es de alguien de este negocio.
      existente: datos.propio
        ? {
            id: datos.propio.clienteId, nombre: datos.propio.nombre, ruta: datos.propio.ruta, eliminado: datos.propio.eliminado,
            // Para el cobrador: si es de una de sus rutas puede ir a prestarle;
            // si no, solo avisarle al dueño.
            tuyo: session.user.rol === 'owner' || (session.user.rutaIds ?? []).includes(datos.propio.rutaId),
          }
        : null,
    })
  } catch (err) {
    console.error('[reporte cédula]', err)
    return Response.json({ error: 'No se pudo consultar el reporte' }, { status: 500 })
  }
}

/* ⚠ «¿NOS VA A NOTIFICAR?» (2 nov 2026). El mejor cliente: «si un compañero en
   otra ruta va y mete un cliente que lo tenemos registrado como clavo, nos va a
   notificar?». El cobrador de otra ruta no puede crearlo (la cédula ya existe)
   ni prestarle (no es de sus rutas), así que lo que le queda es avisar: el
   dueño recibe quién, qué cliente, de qué ruta y lo que dice el reporte, y
   decide si lo pasa de ruta. Una vez al día por cobrador y cliente. */
export async function POST(req) {
  const session = await getServerSession(authOptions)
  const organizationId = session?.user?.organizationId
  if (!organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol === 'owner') return Response.json({ error: 'El dueño no necesita avisarse' }, { status: 400 })
  if (!reporteLimiter(session.user.id).ok) {
    return Response.json({ error: 'Demasiadas consultas. Intenta en un rato.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const clienteId = typeof body.clienteId === 'string' ? body.clienteId : null
  if (!clienteId) return Response.json({ error: 'Falta el cliente' }, { status: 400 })

  const datos = await datosDelReporte({ organizationId, clienteId, conOtros: false })
  if (!datos.propio) return Response.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const { inicio } = getLocalDayRange(getLocalDateStr(session.user.country), session.user.country)
  const ya = await prisma.actividadLog.findFirst({
    where: { organizationId, userId: session.user.id, accion: 'aviso_cliente_ya_registrado', entidadId: clienteId, createdAt: { gte: inicio } },
    select: { id: true },
  })
  if (ya) return Response.json({ avisado: true })

  const r = reporteDe({ propio: datos.propio })
  const motivo = r.propio[0]?.texto
  const quien = session.user.nombre ?? 'Un cobrador'
  const resumen = r.nivel === 'rojo' || r.nivel === 'ambar'
    ? ` ${r.titulo}${motivo ? `: ${motivo.charAt(0).toLowerCase()}${motivo.slice(1)}` : ''}.`
    : ''

  logActividad({
    session,
    accion: 'aviso_cliente_ya_registrado',
    entidadTipo: 'cliente',
    entidadId: clienteId,
    detalle: `Quiso registrar a ${datos.propio.nombre}, que es de ${enLaRuta(datos.propio.ruta)}`,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })
  notificar({
    organizationId, para: 'owners', tipo: 'cliente_ya_registrado',
    titulo: r.nivel === 'rojo' ? `${quien} se topó con un cliente que paga mal` : `${quien} quiso registrar a un cliente que ya tienes`,
    mensaje: `${quien} quiso registrar a ${datos.propio.nombre}, que es de ${enLaRuta(datos.propio.ruta)}.${resumen}`,
    href: `/clientes/${clienteId}`, datos: { clienteId, cobradorId: session.user.id },
  })
  return Response.json({ avisado: true }, { status: 201 })
}
