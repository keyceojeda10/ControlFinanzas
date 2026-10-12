// app/api/admin/seguimiento/route.js — cómo va el seguimiento (superadmin).
//
// Lo que se mandó, quién respondió y qué, los motivos de baja, las bajas que
// volvieron a pagar, la oferta del 35 % y el estado de las plantillas en Meta.
// La línea base es la del 12 oct 2026 (docs/superpowers/specs/2026-10-12-…).

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PLANTILLAS_SEGUIMIENTO } from '@/lib/seguimiento/plantillas'
import { estadoPlantillas } from '@/lib/seguimiento/meta'
import { MOTIVOS } from '@/lib/seguimiento/reglas'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  const ahora = new Date()
  const hace30 = new Date(ahora.getTime() - 30 * 86400000)

  const [envios, segs, conNequi, meta] = await Promise.all([
    prisma.envioSeguimiento.findMany({
      where: { createdAt: { gte: hace30 } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, organizationId: true, caso: true, paso: true, canal: true, plantilla: true, ok: true, error: true,
        respuesta: true, respondidoAt: true, escaladoAt: true, createdAt: true,
        organization: { select: { nombre: true } },
      },
    }),
    prisma.seguimientoOrg.findMany({ select: { organizationId: true, noMolestar: true, motivoBaja: true, ofertaNequi: true } }),
    prisma.organization.count({ where: { wompiFuentePagoId: { not: null }, cobroAutomatico: true } }),
    estadoPlantillas({ forzar: true }),
  ])

  // Por paso: enviados, con error, respondidos.
  const porPaso = {}
  for (const e of envios.filter((x) => x.canal !== 'telegram')) {
    const k = `${e.caso} · ${e.paso}`
    const f = (porPaso[k] ??= { caso: e.caso, paso: e.paso, plantilla: e.plantilla, enviados: 0, errores: 0, respondidos: 0 })
    if (e.ok) f.enviados++; else f.errores++
    if (e.respondidoAt) f.respondidos++
  }

  // Bajas que volvieron a pagar después de la pregunta del motivo.
  const preguntados = envios.filter((e) => e.paso === 'd3_motivo' && e.ok)
  const volvieron = preguntados.length === 0 ? 0 : await prisma.suscripcion.count({
    where: {
      organizationId: { in: [...new Set(preguntados.map((e) => e.organizationId))] },
      estado: 'activa', montoCOP: { gt: 0 }, fechaVencimiento: { gt: ahora },
    },
  })

  const motivos = Object.fromEntries(Object.values(MOTIVOS).map((m) => [m, 0]))
  for (const s of segs) if (s.motivoBaja) motivos[s.motivoBaja] = (motivos[s.motivoBaja] ?? 0) + 1

  return NextResponse.json({
    porPaso: Object.values(porPaso),
    bajasPreguntadas: new Set(preguntados.map((e) => e.organizationId)).size,
    bajasRecuperadas: volvieron,
    motivos,
    oferta: {
      disponible: segs.filter((s) => s.ofertaNequi === 'disponible').length,
      aplicada: segs.filter((s) => s.ofertaNequi === 'aplicada').length,
      sinAplicar: segs.filter((s) => s.ofertaNequi === 'sin_aplicar').length,
      negociosConCobroAutomatico: conNequi,
    },
    noMolestar: segs.filter((s) => s.noMolestar).length,
    escalados: envios.filter((e) => e.escaladoAt).length,
    respuestas: envios.filter((e) => e.respuesta).slice(0, 40).map((e) => ({
      negocio: e.organization?.nombre, paso: e.paso, respuesta: e.respuesta, cuando: e.respondidoAt,
    })),
    plantillas: Object.entries(PLANTILLAS_SEGUIMIENTO).map(([nombre, p]) => ({
      nombre, pedida: p.categoria, estado: meta.get(nombre)?.estado ?? 'sin dato', categoria: meta.get(nombre)?.categoria ?? null,
    })),
  })
}
