// app/api/configuracion/organizacion/route.js
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { validarDiasSinCobro } from '@/lib/dias-sin-cobro'
import { logActividad } from '@/lib/activity-log'

// Nombres tal como los ve el dueño en la pantalla de Configuración. Sin esto el
// registro diria "renovacionesEnCobrado" y no le serviria a nadie que no lea el
// codigo.
const ETIQUETA_CAMPO = {
  nombre: 'Nombre del negocio',
  telefono: 'Teléfono',
  ciudad: 'Ciudad',
  diasSinCobro: 'Días sin cobro',
  capitalEsEfectivo: 'Capital en ruta = efectivo en mano',
  renovacionesEnCobrado: 'Contar renovaciones en el cobrado',
  modoAbreviado: 'Modo abreviado de montos',
  ocultarSaldoWA: 'Ocultar saldo en WhatsApp',
  tasaMoratorio: 'Tasa moratoria mensual (%)',
  diasGraciaMoratorio: 'Días de gracia de mora',
  requiereAprobacionPrestamos: 'Aprobar préstamos del cobrador',
  portalDatosCompletos: 'Portal: mostrar datos completos',
  camposRecibo: 'Campos del recibo',
  plantillasWA: 'Plantillas de WhatsApp',
}

// Un booleano se lee "encendido/apagado", no "true/false". Los objetos y arrays
// no se vuelcan enteros: el detalle es para leerlo, no para diffear JSON.
function describirValor(v) {
  if (v === null || v === undefined || v === '') return 'vacío'
  if (typeof v === 'boolean') return v ? 'encendido' : 'apagado'
  if (Array.isArray(v)) return `${v.length} campo${v.length === 1 ? '' : 's'}`
  if (typeof v === 'object') return 'actualizado'
  return String(v)
}

// Compara solo los campos que el PATCH realmente escribio.
function describirCambios(antes, despues) {
  const partes = []
  for (const campo of Object.keys(despues)) {
    const a = antes?.[campo]
    const d = despues[campo]
    const iguales = (typeof a === 'object' || typeof d === 'object')
      ? JSON.stringify(a ?? null) === JSON.stringify(d ?? null)
      : a === d
    if (iguales) continue
    partes.push(`${ETIQUETA_CAMPO[campo] || campo}: ${describirValor(a)} → ${describirValor(d)}`)
  }
  return partes
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const orgId = session.user.organizationId
  if (!orgId) return NextResponse.json({ error: 'Sin organización' }, { status: 400 })

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, nombre: true, plan: true, telefono: true, ciudad: true, diasSinCobro: true, country: true, timezone: true, createdAt: true, activo: true, capitalEsEfectivo: true, renovacionesEnCobrado: true, modoAbreviado: true, ocultarSaldoWA: true, tasaMoratorio: true, diasGraciaMoratorio: true, requiereAprobacionPrestamos: true, portalDatosCompletos: true, camposRecibo: true, plantillasWA: true },
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
  const { nombre, telefono, ciudad, diasSinCobro, capitalEsEfectivo, renovacionesEnCobrado, modoAbreviado, ocultarSaldoWA, tasaMoratorio, diasGraciaMoratorio, requiereAprobacionPrestamos, portalDatosCompletos, camposRecibo, plantillasWA } = await req.json()

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

  // Estos flags cambian el SIGNIFICADO de cifras de portada — `renovacionesEnCobrado`
  // decide si "Cobrado" y "Prestado" incluyen el saldo absorbido de las renovaciones.
  // Se cambiaban sin dejar rastro: cuando el dueño de la cartera mas grande reporto
  // que sus numeros no cuadraban, no hubo forma de saber quien habia tocado el flag
  // ni cuando, y el diagnostico se alargo un dia entero. Ahora queda en la bitacora.
  const antes = await prisma.organization.findUnique({
    where: { id: orgId },
    select: Object.fromEntries(Object.keys(ETIQUETA_CAMPO).map((k) => [k, true])),
  })

  const datosActualizados = {
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
  }

  const org = await prisma.organization.update({
    where: { id: orgId },
    data: datosActualizados,
    select: { id: true, nombre: true, plan: true, telefono: true, ciudad: true, diasSinCobro: true, country: true, timezone: true, capitalEsEfectivo: true, renovacionesEnCobrado: true, modoAbreviado: true, ocultarSaldoWA: true, tasaMoratorio: true, diasGraciaMoratorio: true, requiereAprobacionPrestamos: true, portalDatosCompletos: true, camposRecibo: true, plantillasWA: true },
  })

  // Solo se registra si algo cambio de verdad: guardar sin tocar nada no ensucia
  // la bitacora. `logActividad` no se espera (fire-and-forget) para no demorar
  // la respuesta si la escritura del log falla.
  const cambios = describirCambios(antes, datosActualizados)
  if (cambios.length > 0) {
    logActividad({
      session,
      accion: 'editar_configuracion',
      entidadTipo: 'organizacion',
      entidadId: orgId,
      detalle: cambios.join(' · '),
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })
  }

  return NextResponse.json({ ok: true, org })
}
