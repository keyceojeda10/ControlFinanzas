// app/api/configuracion/organizacion/route.js
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { validarDiasSinCobro } from '@/lib/dias-sin-cobro'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const orgId = session.user.organizationId
  if (!orgId) return NextResponse.json({ error: 'Sin organización' }, { status: 400 })

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, nombre: true, plan: true, telefono: true, ciudad: true, diasSinCobro: true, country: true, timezone: true, createdAt: true, activo: true, capitalEsEfectivo: true, modoAbreviado: true, ocultarSaldoWA: true, tasaMoratorio: true, diasGraciaMoratorio: true, requiereAprobacionPrestamos: true, portalDatosCompletos: true },
  })

  const sub = await prisma.suscripcion.findFirst({
    where: {
      organizationId: orgId,
      OR: [{ mpStatus: null }, { mpStatus: { not: 'pending' } }],
    },
    orderBy: { fechaVencimiento: 'desc' },
    select: { id: true, plan: true, estado: true, fechaInicio: true, fechaVencimiento: true, montoCOP: true },
  })

  const diasRestantes = sub?.fechaVencimiento
    ? Math.ceil((new Date(sub.fechaVencimiento) - new Date()) / (1000 * 60 * 60 * 24))
    : null

  // Historial de suscripciones
  const historial = await prisma.suscripcion.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, plan: true, estado: true, fechaInicio: true, fechaVencimiento: true, montoCOP: true, createdAt: true },
  })

  return NextResponse.json({ org, suscripcion: sub, diasRestantes, historial })
}

export async function PATCH(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return NextResponse.json({ error: 'Solo el administrador' }, { status: 403 })

  const orgId = session.user.organizationId
  if (!orgId) return NextResponse.json({ error: 'Sin organización' }, { status: 400 })

  // NOTA: `country` y `timezone` NO se aceptan desde este endpoint.
  // Cambios de pais solo pueden hacerse desde superadmin para evitar corrupcion
  // de calculos de mora/timezone y precios de planes en organizaciones con datos.
  const { nombre, telefono, ciudad, diasSinCobro, capitalEsEfectivo, modoAbreviado, ocultarSaldoWA, tasaMoratorio, diasGraciaMoratorio, requiereAprobacionPrestamos, portalDatosCompletos } = await req.json()

  if (nombre !== undefined && !nombre?.trim()) {
    return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
  }

  // Validar días sin cobro si se envía
  let diasSinCobroVal
  try {
    diasSinCobroVal = diasSinCobro !== undefined ? validarDiasSinCobro(diasSinCobro) : undefined
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }

  const org = await prisma.organization.update({
    where: { id: orgId },
    data: {
      ...(nombre !== undefined && { nombre: nombre.trim() }),
      ...(telefono !== undefined && { telefono: telefono?.trim() || null }),
      ...(ciudad !== undefined && { ciudad: ciudad?.trim() || null }),
      ...(diasSinCobroVal !== undefined && { diasSinCobro: diasSinCobroVal }),
      ...(capitalEsEfectivo !== undefined && { capitalEsEfectivo: !!capitalEsEfectivo }),
      ...(modoAbreviado !== undefined && { modoAbreviado: !!modoAbreviado }),
      ...(ocultarSaldoWA !== undefined && { ocultarSaldoWA: !!ocultarSaldoWA }),
      ...(tasaMoratorio !== undefined && { tasaMoratorio: Math.max(0, Math.min(100, Number(tasaMoratorio) || 0)) }),
      ...(diasGraciaMoratorio !== undefined && { diasGraciaMoratorio: Math.max(0, Math.min(90, Math.round(Number(diasGraciaMoratorio) || 0))) }),
      ...(requiereAprobacionPrestamos !== undefined && { requiereAprobacionPrestamos: !!requiereAprobacionPrestamos }),
      ...(portalDatosCompletos !== undefined && { portalDatosCompletos: !!portalDatosCompletos }),
    },
    select: { id: true, nombre: true, plan: true, telefono: true, ciudad: true, diasSinCobro: true, country: true, timezone: true, capitalEsEfectivo: true, modoAbreviado: true, ocultarSaldoWA: true, tasaMoratorio: true, diasGraciaMoratorio: true, requiereAprobacionPrestamos: true, portalDatosCompletos: true },
  })

  return NextResponse.json({ ok: true, org })
}
