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
    select: { id: true, nombre: true, plan: true, telefono: true, ciudad: true, diasSinCobro: true, frecuenciaDefault: true, tasaDefault: true, modoInteresDefault: true, country: true, timezone: true, createdAt: true, activo: true, capitalEsEfectivo: true, renovacionesEnCobrado: true, modoAbreviado: true, ocultarSaldoWA: true, tasaMoratorio: true, diasGraciaMoratorio: true, requiereAprobacionPrestamos: true, portalDatosCompletos: true, camposRecibo: true, plantillasWA: true },
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

  const historial = await prisma.suscripcion.findMany({
    where: {
      organizationId: orgId,
      OR: [{ mpStatus: null }, { mpStatus: { not: 'pending' } }],
    },
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
  const { nombre, telefono, ciudad, diasSinCobro, frecuenciaDefault, tasaDefault, modoInteresDefault, capitalEsEfectivo, renovacionesEnCobrado, modoAbreviado, ocultarSaldoWA, tasaMoratorio, diasGraciaMoratorio, requiereAprobacionPrestamos, portalDatosCompletos, camposRecibo, plantillasWA } = await req.json()

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

  // ── «Cómo prestas por defecto» ──
  //
  // Solo se aceptan valores que el sistema conoce de verdad. Guardar una
  // frecuencia inventada no falla aquí: falla el día que alguien crea un
  // préstamo y calcularPrestamo no sabe qué hacer con ella.
  //
  // `null` es un valor VÁLIDO y significa «vuelve al comportamiento de
  // siempre». Por eso se distingue de `undefined`, que significa «no lo mandes
  // a cambiar».
  const FRECUENCIAS = ['diario', 'semanal', 'quincenal', 'mensual']
  const MODOS = ['fijo', 'unico', 'solo_interes', 'saldo', 'manual', 'lineal', 'lineal_dinamico', 'proporcional']

  if (frecuenciaDefault !== undefined && frecuenciaDefault !== null && !FRECUENCIAS.includes(frecuenciaDefault)) {
    return NextResponse.json({ error: 'Esa frecuencia no existe' }, { status: 400 })
  }
  if (modoInteresDefault !== undefined && modoInteresDefault !== null && !MODOS.includes(modoInteresDefault)) {
    return NextResponse.json({ error: 'Ese modo de interés no existe' }, { status: 400 })
  }
  if (tasaDefault !== undefined && tasaDefault !== null) {
    const t = Number(tasaDefault)
    // Sin tope superior a propósito: el gota a gota trabaja con tasas que en
    // otro contexto parecerían absurdas, y no nos toca a nosotros decidir cuál
    // es demasiado. Pero negativa no existe.
    if (!Number.isFinite(t) || t < 0) {
      return NextResponse.json({ error: 'La tasa no puede ser negativa' }, { status: 400 })
    }
  }

  const org = await prisma.organization.update({
    where: { id: orgId },
    data: {
      frecuenciaDefault,
      tasaDefault: tasaDefault === undefined || tasaDefault === null ? tasaDefault : Number(tasaDefault),
      modoInteresDefault,
      ...(nombre !== undefined && { nombre: nombre.trim() }),
      ...(telefono !== undefined && { telefono: telefono?.trim() || null }),
      ...(ciudad !== undefined && { ciudad: ciudad?.trim() || null }),
      ...(diasSinCobroVal !== undefined && { diasSinCobro: diasSinCobroVal }),
      ...(capitalEsEfectivo !== undefined && { capitalEsEfectivo: !!capitalEsEfectivo }),
      ...(renovacionesEnCobrado !== undefined && { renovacionesEnCobrado: !!renovacionesEnCobrado }),
      ...(modoAbreviado !== undefined && { modoAbreviado: !!modoAbreviado }),
      ...(ocultarSaldoWA !== undefined && { ocultarSaldoWA: !!ocultarSaldoWA }),
      ...(tasaMoratorio !== undefined && { tasaMoratorio: Math.max(0, Math.min(100, Number(tasaMoratorio) || 0)) }),
      ...(diasGraciaMoratorio !== undefined && { diasGraciaMoratorio: Math.max(0, Math.min(90, Math.round(Number(diasGraciaMoratorio) || 0))) }),
      ...(requiereAprobacionPrestamos !== undefined && { requiereAprobacionPrestamos: !!requiereAprobacionPrestamos }),
      ...(portalDatosCompletos !== undefined && { portalDatosCompletos: !!portalDatosCompletos }),
      ...(camposRecibo !== undefined && { camposRecibo: Array.isArray(camposRecibo) ? camposRecibo.slice(0, 10) : null }),
      ...(plantillasWA !== undefined && { plantillasWA: (plantillasWA && typeof plantillasWA === 'object') ? plantillasWA : null }),
    },
    select: { id: true, nombre: true, plan: true, telefono: true, ciudad: true, diasSinCobro: true, country: true, timezone: true, capitalEsEfectivo: true, renovacionesEnCobrado: true, modoAbreviado: true, ocultarSaldoWA: true, tasaMoratorio: true, diasGraciaMoratorio: true, requiereAprobacionPrestamos: true, portalDatosCompletos: true, camposRecibo: true, plantillasWA: true },
  })

  return NextResponse.json({ ok: true, org })
}
