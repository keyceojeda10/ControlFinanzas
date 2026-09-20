// POST /api/cron/resumen-diario — EL DÍA EN UN SOLO AVISO.
// Cron cada hora, en punto:
//   0 * * * *  curl -s -X POST -H "x-cron-secret: $CRON_SECRET" https://app.control-finanzas.com/api/cron/resumen-diario
//
// ── POR QUÉ ───────────────────────────────────────────────────────────────────
// La campana eran decenas de «fulano se atrasó», una fila por cliente, y el 95 %
// se quedaba sin leer (3.368 avisos en 30 días, 174 leídos; 19 sep 2026). Lo que
// un dueño quiere saber al final del día cabe en una frase: cuánto entró, cuánto
// salió, quién se atrasó y quién no ha entregado la caja.
//
// Corre CADA HORA porque cada dueño elige la suya (`prefsAvisos.resumenHora`,
// 19:00 si no ha elegido) y los negocios están en doce países: a cada vuelta
// solo se atiende a quien le toca en SU hora local. Es idempotente —si ya hay un
// resumen de hoy para ese usuario, no se repite— así que correrlo dos veces en la
// misma hora no duplica nada.
//
// ── LAS CIFRAS SON LAS DEL INICIO ────────────────────────────────────────────
// «Cobrado» = pagos del día sin recargos ni descuentos, y «préstamos nuevos» =
// los creados hoy: las MISMAS definiciones que `api/dashboard/resumen`. Un resumen
// que dijera otra cifra que la pantalla de inicio sería peor que no mandarlo.
//
// No se avisa a un negocio que hoy no se movió: un «$0 cobrados» diario a
// quinientas cuentas dormidas es la forma de que lo apaguen todos.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getLocalDayRange } from '@/lib/i18n'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'
import { notificar } from '@/lib/notificar'
import { relojLocal, textoDelResumen } from '@/lib/resumen-dia'
import { normalizarPrefs } from '@/lib/avisos-preferencias'

const CRON_SECRET = process.env.CRON_SECRET

export async function POST(req) {
  const secret = req.headers.get('x-cron-secret')
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const rl = cronLimiter(getClientIp(req))
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const owners = await prisma.user.findMany({
    where: { rol: 'owner', activo: true, organization: { activo: true } },
    select: { id: true, organizationId: true, prefsAvisos: true, organization: { select: { country: true } } },
  })

  // A quién le toca en ESTA vuelta: su hora local es la que eligió.
  const porOrg = new Map()
  for (const o of owners) {
    const country = o.organization?.country || 'co'
    const { hora } = relojLocal(country)
    if (normalizarPrefs(o.prefsAvisos).resumenHora !== hora) continue
    if (!porOrg.has(o.organizationId)) porOrg.set(o.organizationId, { country, ids: [] })
    porOrg.get(o.organizationId).ids.push(o.id)
  }

  const res = { revisados: owners.length, negocios: porOrg.size, enviados: 0, sinMovimiento: 0, yaTenian: 0, errores: 0 }

  for (const [organizationId, { country, ids }] of porOrg) {
    try {
      const { fecha } = relojLocal(country)
      const { inicio, fin } = getLocalDayRange(fecha, country)

      // Idempotente: quien ya tiene su resumen de hoy no recibe otro.
      const yaTienen = await prisma.notificacion.findMany({
        where: { userId: { in: ids }, tipo: 'resumen_dia', createdAt: { gte: inicio } },
        select: { userId: true },
      })
      const conResumen = new Set(yaTienen.map((n) => n.userId))
      const para = ids.filter((id) => !conResumen.has(id))
      res.yaTenian += ids.length - para.length
      if (para.length === 0) continue

      const [pagos, prestamos, gastos, porCobrador, cierres, atrasos] = await Promise.all([
        prisma.pago.aggregate({
          where: { organizationId, fechaPago: { gte: inicio, lte: fin }, tipo: { notIn: ['recargo', 'descuento'] } },
          _sum: { montoPagado: true }, _count: true,
        }),
        prisma.prestamo.aggregate({
          where: { organizationId, createdAt: { gte: inicio, lte: fin } },
          _sum: { montoPrestado: true }, _count: true,
        }),
        prisma.gastoMenor.aggregate({
          where: { organizationId, fecha: { gte: inicio, lte: fin }, estado: { not: 'rechazado' } },
          _sum: { monto: true },
        }),
        prisma.pago.groupBy({
          by: ['cobradorId'],
          where: { organizationId, fechaPago: { gte: inicio, lte: fin }, tipo: { notIn: ['recargo', 'descuento'] }, cobradorId: { not: null } },
          _sum: { montoPagado: true },
        }),
        prisma.cierreCaja.findMany({
          where: { organizationId, fecha: { gte: inicio, lte: fin } },
          select: { cobradorId: true },
        }),
        // Cada préstamo que cruzó a mora hoy dejó su fila (`cron/mora-alertas`).
        prisma.notificacion.findMany({
          where: { organizationId, tipo: 'mora', createdAt: { gte: inicio, lte: fin } },
          select: { datos: true },
        }),
      ])

      const cobrado = Math.round(pagos._sum?.montoPagado || 0)
      const cobros = pagos._count || 0
      const nPrestamos = prestamos._count || 0
      if (cobros === 0 && nPrestamos === 0) { res.sinMovimiento++; continue }

      // Cobradores que recogieron plata hoy y todavía no han cerrado su caja.
      const cerraron = new Set(cierres.map((c) => c.cobradorId))
      const pendientesIds = porCobrador
        .filter((g) => (g._sum?.montoPagado || 0) > 0 && !cerraron.has(g.cobradorId))
        .map((g) => g.cobradorId)
      const sinCerrar = pendientesIds.length
        ? (await prisma.user.findMany({
            where: { id: { in: pendientesIds }, organizationId, rol: 'cobrador' },
            select: { nombre: true },
          })).map((u) => u.nombre)
        : []

      // Un préstamo = un atraso, aunque la fila se repita por cada destinatario.
      const prestamosAtrasados = new Set()
      for (const n of atrasos) {
        try { const d = JSON.parse(n.datos || '{}'); if (d.prestamoId) prestamosAtrasados.add(d.prestamoId) } catch {}
      }

      const texto = textoDelResumen({
        cobrado, cobros,
        prestado: Math.round(prestamos._sum?.montoPrestado || 0), prestamos: nPrestamos,
        gastos: Math.round(gastos._sum?.monto || 0),
        atrasados: prestamosAtrasados.size, sinCerrar,
      })

      const { avisados } = await notificar({
        organizationId, para, tipo: 'resumen_dia', ...texto,
        // `?resumen=1`: al tocar la notificación se abre la pantalla del resumen.
        href: '/dashboard?resumen=1', datos: { fecha, cobrado, cobros },
      })
      res.enviados += avisados
    } catch (e) {
      res.errores++
      console.error('[cron/resumen-diario]', organizationId, e?.message)
    }
  }

  return NextResponse.json({ ok: true, ...res })
}
