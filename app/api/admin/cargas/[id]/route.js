// app/api/admin/cargas/[id]/route.js — revisar una carga con asesor (superadmin).
//
// GET   → la solicitud con sus filas del área de espera, sus archivos y el dueño.
// PATCH → { filas } guarda lo corregido y lo vuelve a validar.
// POST  → { accion: 'aprobar', ruta?, noCobrarDomingos? } importa con el MISMO
//         camino que la carga masiva (lib/importar-cartera.js);
//         { accion: 'rechazar', motivo }; { accion: 'releer' } vuelve a validar.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { archivosDe, filasDe, resumenDeSolicitud, guardarFilas, aprobarSolicitud, rechazarSolicitud } from '@/lib/carga-asesor/solicitud'

export const runtime = 'nodejs'

async function superadmin() {
  const session = await getServerSession(authOptions)
  return session?.user?.rol === 'superadmin' ? session : null
}

export async function GET(_req, { params }) {
  if (!(await superadmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { id } = await params
  const sol = await prisma.solicitudCarga.findUnique({
    where: { id },
    include: { organization: { select: { id: true, nombre: true, plan: true, diasSinCobro: true, _count: { select: { clientes: true } } } } },
  })
  if (!sol) return NextResponse.json({ error: 'No existe' }, { status: 404 })
  const [dueno, rutas] = await Promise.all([
    prisma.user.findFirst({ where: { organizationId: sol.organizationId, rol: 'owner' }, orderBy: { createdAt: 'asc' }, select: { nombre: true, telefono: true, email: true } }),
    prisma.ruta.findMany({ where: { organizationId: sol.organizationId, activo: true }, select: { id: true, nombre: true } }),
  ])
  return NextResponse.json({
    solicitud: {
      id: sol.id, estado: sol.estado, origen: sol.origen, nota: sol.nota, creada: sol.createdAt, aprobada: sol.aprobadaAt,
      errorLectura: sol.errorLectura, archivos: archivosDe(sol), filas: filasDe(sol), resumen: resumenDeSolicitud(sol),
    },
    negocio: { ...sol.organization, clientes: sol.organization._count.clientes, _count: undefined },
    dueno, rutas,
  })
}

export async function PATCH(req, { params }) {
  if (!(await superadmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { id } = await params
  const { filas } = await req.json().catch(() => ({}))
  if (!Array.isArray(filas)) return NextResponse.json({ error: 'Faltan las filas' }, { status: 400 })
  if (filas.length > 2000) return NextResponse.json({ error: 'Demasiadas filas' }, { status: 400 })
  const r = await guardarFilas(id, filas)
  if (r.error) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json(r)
}

export async function POST(req, { params }) {
  const session = await superadmin()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  let r
  if (body.accion === 'aprobar') {
    r = await aprobarSolicitud({ id, adminId: session.user.id, ruta: body.ruta, noCobrarDomingos: body.noCobrarDomingos === true })
  } else if (body.accion === 'rechazar') {
    r = await rechazarSolicitud({ id, adminId: session.user.id, motivo: String(body.motivo ?? '').slice(0, 500) })
  } else if (body.accion === 'releer') {
    const sol = await prisma.solicitudCarga.findUnique({ where: { id } })
    r = sol ? await guardarFilas(id, filasDe(sol)) : { error: 'No existe', status: 404 }
  } else {
    return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 })
  }
  if (r.error) return NextResponse.json({ error: r.error }, { status: r.status ?? 400 })
  return NextResponse.json(r)
}
