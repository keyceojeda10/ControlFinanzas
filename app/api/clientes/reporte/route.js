// app/api/clientes/reporte/route.js — ¿LE PRESTO A ESTA PERSONA?
//
// GET ?cedula=…     al escribirla en «nuevo cliente»
// GET ?clienteId=…  en la ficha y al elegirlo en «nuevo préstamo»
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
        ? { id: datos.propio.clienteId, nombre: datos.propio.nombre, ruta: datos.propio.ruta, eliminado: datos.propio.eliminado }
        : null,
    })
  } catch (err) {
    console.error('[reporte cédula]', err)
    return Response.json({ error: 'No se pudo consultar el reporte' }, { status: 500 })
  }
}
