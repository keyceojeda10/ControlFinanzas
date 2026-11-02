/* ── LA LISTA «PARA ATENDER HOY» (2 nov 2026) ─────────────────────────────────
 *
 * Los negocios que se registraron hace 21 días o menos y todavía no pagan,
 * medidos con lo que hicieron en la app y clasificados por `serios.js`. Salen
 * los calientes y los que PIDIERON algo (cómo pagar, su cartera por cargar):
 * el resto lo sigue atendiendo el bot.
 *
 * ⚠ Un solo SQL por métrica, agrupado: con 30-40 registros por semana, una
 *   consulta por negocio son cientos de idas a la base cada mañana.
 * ⚠ Los días se cuentan en el calendario de Bogotá (−5 h), como el resto del
 *   sistema: un cobro a las 9 p. m. es de ese día, no del siguiente.
 */

import { prisma } from '@/lib/prisma'
import { EMAILS_INTERNOS } from './motor'
import { nivelDe, momentoDe, mensajePara, ordenarParaAtender, PROBABILIDAD } from './serios'

const DIA = 86400000
export const DIAS_VENTANA = 21
export const EVENTO_ATENCION = 'atencion_seguimiento'
export const RESULTADOS = { hable: 'Hablé', no_contesto: 'No contestó', pago: 'Pagó', no_interesa: 'No le interesa' }

const porOrg = (filas, campo = 'n') => new Map(filas.map((f) => [f.org, Number(f[campo]) || 0]))

export async function paraAtender({ ahora = new Date() } = {}) {
  const desde = new Date(ahora.getTime() - DIAS_VENTANA * DIA)

  const candidatos = await prisma.organization.findMany({
    where: {
      createdAt: { gte: desde },
      users: { none: { email: { in: EMAILS_INTERNOS } } },
    },
    select: {
      id: true, nombre: true, telefono: true, createdAt: true,
      users: { where: { rol: 'owner' }, select: { nombre: true, telefono: true }, take: 1 },
      suscripciones: { orderBy: { fechaVencimiento: 'desc' }, take: 1, select: { fechaVencimiento: true } },
    },
  })
  if (candidatos.length === 0) return []
  /* Los que ya pagaron no son de esta lista: `PagoSuscripcion` no tiene
     relación con el negocio, así que se mira aparte. */
  const pagaron = new Set((await prisma.pagoSuscripcion.findMany({
    where: { organizationId: { in: candidatos.map((o) => o.id) }, montoCOP: { gt: 2000 } },
    select: { organizationId: true },
  })).map((p) => p.organizationId))
  const orgs = candidatos.filter((o) => !pagaron.has(o.id))
  if (orgs.length === 0) return []
  const ids = orgs.map((o) => o.id)
  const marcas = ids.map(() => '?').join(',')

  const [clientes, prestamos, diasCobro, diasEntra, atenciones] = await Promise.all([
    prisma.cliente.groupBy({ by: ['organizationId'], where: { organizationId: { in: ids }, estado: { not: 'eliminado' } }, _count: { _all: true } }),
    prisma.prestamo.groupBy({ by: ['organizationId'], where: { organizationId: { in: ids }, estado: { in: ['activo', 'completado'] } }, _count: { _all: true } }),
    prisma.$queryRawUnsafe(
      `SELECT p.organizationId org, COUNT(DISTINCT DATE(pg.createdAt - INTERVAL 5 HOUR)) n
         FROM Pago pg JOIN Prestamo p ON p.id = pg.prestamoId
        WHERE p.organizationId IN (${marcas}) AND pg.tipo NOT IN ('recargo','descuento')
        GROUP BY p.organizationId`, ...ids),
    prisma.$queryRawUnsafe(
      `SELECT organizationId org, COUNT(DISTINCT DATE(createdAt - INTERVAL 5 HOUR)) n, MAX(createdAt) ultima
         FROM Evento WHERE evento = 'page_view' AND organizationId IN (${marcas})
        GROUP BY organizationId`, ...ids),
    prisma.evento.findMany({
      where: { evento: EVENTO_ATENCION, organizationId: { in: ids } },
      orderBy: { createdAt: 'desc' },
      select: { organizationId: true, metadata: true, createdAt: true },
    }),
  ])

  /* ⚠ LO QUE PIDIERON Y NADIE LES DIO (medido el 2 nov 2026 en la primera
     lista): uno preguntó al bot cómo pagar por Nequi y no pagó; otro mandó su
     cartera para cargar y la solicitud llevaba 9 días «en revisión». Esos van
     primero, sean calientes o no. */
  const cargasPendientes = new Set((await prisma.solicitudCarga.findMany({
    where: { organizationId: { in: ids }, estado: { in: ['recibida', 'en_revision', 'esperando'] } },
    select: { organizationId: true },
  })).map((c) => c.organizationId))
  const ultimos10 = (t) => String(t ?? '').replace(/\D/g, '').slice(-10)
  const telefonos = new Map(orgs.map((o) => [o.id, ultimos10(o.users[0]?.telefono ?? o.telefono)]))
  const quierenPagar = new Set()
  const tels = [...new Set([...telefonos.values()].filter((t) => t.length === 10))]
  if (tels.length) {
    const filasPago = await prisma.$queryRawUnsafe(
      `SELECT RIGHT(REPLACE(REPLACE(b.telefono,' ',''),'+',''),10) tel
         FROM BotConversacion c JOIN BotLead b ON b.id = c.botLeadId
        WHERE c.rol = 'lead' AND c.createdAt >= ?
          AND LOWER(c.texto) REGEXP 'pagar|pago|mensualidad|nequi|tarjeta|cu[aá]nto (vale|cuesta)|precio|activar el plan'
          AND RIGHT(REPLACE(REPLACE(b.telefono,' ',''),'+',''),10) IN (${tels.map(() => '?').join(',')})
        GROUP BY tel`, new Date(ahora.getTime() - 10 * DIA), ...tels)
    const conIntencion = new Set(filasPago.map((f) => f.tel))
    for (const [id, t] of telefonos) if (conIntencion.has(t)) quierenPagar.add(id)
  }

  const nClientes = new Map(clientes.map((c) => [c.organizationId, c._count._all]))
  const nPrestamos = new Map(prestamos.map((c) => [c.organizationId, c._count._all]))
  const nDiasCobro = porOrg(diasCobro)
  const nDiasEntra = porOrg(diasEntra)
  const ultimaEntrada = new Map(diasEntra.map((f) => [f.org, f.ultima ? new Date(f.ultima) : null]))
  const ultimaAtencion = new Map()
  for (const a of atenciones) {
    if (ultimaAtencion.has(a.organizationId)) continue
    let meta = {}
    try { meta = JSON.parse(a.metadata || '{}') } catch {}
    ultimaAtencion.set(a.organizationId, { resultado: meta.resultado ?? null, quien: meta.quien ?? null, cuando: a.createdAt })
  }

  const filas = orgs.map((o) => {
    const dueno = o.users[0] ?? {}
    const m = {
      clientes: nClientes.get(o.id) ?? 0,
      prestamos: nPrestamos.get(o.id) ?? 0,
      diasCobro: nDiasCobro.get(o.id) ?? 0,
      diasEntra: nDiasEntra.get(o.id) ?? 0,
    }
    const { nivel, razon } = nivelDe(m)
    const vence = o.suscripciones[0]?.fechaVencimiento ?? null
    const diasParaVencer = vence ? Math.ceil((new Date(vence).getTime() - ahora.getTime()) / DIA) : null
    const ult = ultimaEntrada.get(o.id) ?? null
    const diasSinEntrar = ult ? Math.floor((ahora.getTime() - ult.getTime()) / DIA) : Math.floor((ahora.getTime() - o.createdAt.getTime()) / DIA)
    const momento = momentoDe({
      quierePagar: quierenPagar.has(o.id), cargaPendiente: cargasPendientes.has(o.id),
      diasParaVencer, diasSinEntrar, diasCobro: m.diasCobro,
    })
    return {
      organizationId: o.id,
      negocio: o.nombre,
      nombre: dueno.nombre ?? null,
      telefono: dueno.telefono ?? o.telefono ?? null,
      registro: o.createdAt,
      diasDesdeRegistro: Math.floor((ahora.getTime() - o.createdAt.getTime()) / DIA),
      ...m,
      nivel,
      // Lo que pidió va primero en la razón: es lo que hay que resolverle.
      razon: [
        momento === 'quiere_pagar' ? 'le preguntó al bot cómo pagar' : null,
        momento === 'espera' ? 'mandó su cartera para cargar y no está lista' : null,
        razon,
      ].filter(Boolean).join(' · '),
      deCada10: nivel ? PROBABILIDAD[nivel] : null,
      vence, diasParaVencer, ultimaEntrada: ult, diasSinEntrar,
      momento,
      mensaje: mensajePara({ momento, nombre: dueno.nombre, prestamos: m.prestamos, diasCobro: m.diasCobro, vence }),
      atencion: ultimaAtencion.get(o.id) ?? null,
    }
  })
  return ordenarParaAtender(filas)
}


export { pendientes } from './serios'
