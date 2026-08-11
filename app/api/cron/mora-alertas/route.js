// app/api/cron/mora-alertas/route.js — el aviso de que un cliente se atrasó.
//
// ══ POR QUÉ SE REESCRIBIÓ ENTERO ═══════════════════════════════════════════
//
// Este guion existía desde hacía meses y **no estaba en el crontab**: no había
// enviado un solo aviso nunca. El dueño, cuando se lo dije:
//
//   «tenemos un apartado de notificaciones y no estamos mandando notificaciones
//    de ninguna clase.»
//
// Y encenderlo tal cual habría sido peor que dejarlo apagado. Medía
//
//     ultimoPagoAt < hace 3 días
//
// que no es mora: es «hace tres días que no me paga». En una cartera MENSUAL
// eso es todo el mundo, todos los días. Medido contra producción: marcaba
// **4.095 de 5.449 préstamos activos**, y 88 de los 100 del negocio que lo
// reportó. Un aviso que suena para el 75% de la cartera se apaga el primer día.
//
// ══ LA REGLA, EN PALABRAS DEL DUEÑO ════════════════════════════════════════
//
//   «si el cliente tiene que realizar su pago el día 10, el día 11 ya tiene un
//    día de mora y ya debería de avisar. Vence el 10, si ya es el día 11, pues
//    tiene un día de atraso, literalmente.»
//
// Eso es exactamente lo que devuelve `calcularDiasMora`: el mismo día del cobro
// vale 0 y el siguiente vale 1. No hace falta ningún umbral aparte — hacía
// falta USAR la función en vez de una consulta que se le parecía.
//
// ══ SE AVISA UNA VEZ, CUANDO SE ATRASA ═════════════════════════════════════
//
// **63% de la cartera tiene un día o más de mora** (3.442 de 5.450). Mandar un
// aviso diario por cada uno serían 3.442 el primer día, 789 de ellos a un solo
// negocio: la campana quedaría inservible y él dejaría de abrirla, que es
// justo lo que hay que evitar.
//
// Se avisa cuando **CRUZA**: los que hoy tienen un día. Medido: **190 préstamos
// en 38 negocios, mediana de 2 avisos por negocio**, y solo dos negocios pasan
// de diez. Ese es un volumen que se lee.
//
// ⚠ LA LLAVE NO ES EL PRÉSTAMO, ES LA CUOTA. Si fuera solo `prestamoId`, el
// cliente que se pone al día y vuelve a atrasarse un mes después no volvería a
// avisar. La llave lleva la fecha de la cuota que disparó la mora, así que un
// atraso nuevo es un aviso nuevo y el mismo atraso no suena dos veces.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'
import { enviarPush, enviarPushOrg } from '@/lib/push'
import { calcularDiasMora, calcularProximoCobro, calcularMontoEnMora } from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'

const CRON_SECRET = process.env.CRON_SECRET

/* El tope no es por rendimiento: es para que la campana siga siendo legible.
   Por encima, los que sobran van en UNA fila que lleva a la lista completa. */
const MAX_FILAS_POR_ORG = 12

/* ⚠ LA VENTANA, Y POR QUÉ NO BASTABA CON «NO REPETIR».
 *
 * Sin ella, «avisar lo que no se ha avisado» significa que la PRIMERA corrida
 * avisa de toda la mora viva. Probado en el espejo antes de subirlo: dijo
 * «4.258 préstamos se atrasaron», y no se atrasaron hoy — llevan meses. El
 * aviso habría nacido mintiendo, que es peor que no tenerlo.
 *
 * Tres días, y no uno, porque el guion puede no correr: si el servidor está
 * caído el martes, el que se atrasó el martes se avisa el miércoles en vez de
 * perderse para siempre. No cambia el umbral —el del dueño sigue siendo un día,
 * «vence el 10, el 11 ya avisa»—, cambia cuánto aguanta un despiste nuestro.
 */
const VENTANA_DIAS = 3

const dinero = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`

export async function POST(req) {
  const secret = req.headers.get('x-cron-secret')
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const rl = cronLimiter(getClientIp(req))
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  try {
    const prestamos = await prisma.prestamo.findMany({
      where: { estado: 'activo' },
      select: {
        id: true, organizationId: true, clienteId: true,
        // `estado` se pide ADEMÁS de filtrarlo: `calcularDiasMora` lo lee, y un
        // campo que no entra en el `select` vale `undefined`, no 'activo'.
        estado: true,
        cuotaDiaria: true, totalAPagar: true, totalPagado: true, montoPrestado: true,
        frecuencia: true, fechaInicio: true, diasPlazo: true, modoInteres: true,
        diaCobroSemana: true, diaCobroMes: true, diaCobroMes2: true,
        proximoCobroManual: true, esClavo: true, diasSinCobro: true,
        cuotasAmortizacion: {
          orderBy: { numeroPeriodo: 'asc' },
          select: {
            numeroPeriodo: true, cuotaTotal: true, interes: true, capital: true,
            pagado: true, interesPagado: true, fechaEsperada: true,
          },
        },
        cliente: {
          select: {
            id: true, nombre: true, diasSinCobro: true,
            ruta: { select: { cobradorId: true, diasSinCobro: true } },
          },
        },
      },
    })

    const orgIds = [...new Set(prestamos.map((p) => p.organizationId))]
    const [orgs, festivos, owners] = await Promise.all([
      prisma.organization.findMany({
        where: { id: { in: orgIds } },
        select: { id: true, diasSinCobro: true },
      }),
      prisma.festivo.findMany({
        where: { organizationId: { in: orgIds } },
        select: { organizationId: true, fecha: true },
      }),
      prisma.user.findMany({
        where: { organizationId: { in: orgIds }, rol: 'owner' },
        select: { id: true, organizationId: true },
      }),
    ])
    const orgPorId = new Map(orgs.map((o) => [o.id, o]))
    const festPorOrg = {}
    for (const f of festivos) (festPorOrg[f.organizationId] ||= []).push(f.fecha)
    const ownersPorOrg = {}
    for (const o of owners) (ownersPorOrg[o.organizationId] ||= []).push(o.id)

    /* Lo ya avisado. Se miran cuatro meses hacia atrás: más allá, un atraso que
       sigue vivo ya no es noticia y volver a nombrarlo no sobra. */
    const desde = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000)
    const previas = await prisma.notificacion.findMany({
      where: { tipo: 'mora', createdAt: { gte: desde } },
      select: { datos: true },
    })
    const yaAvisado = new Set()
    for (const n of previas) {
      try {
        const d = JSON.parse(n.datos || '{}')
        if (d.llave) yaAvisado.add(d.llave)
      } catch {}
    }

    // ── Quiénes se atrasaron ──
    const nuevos = {}
    for (const p of prestamos) {
      const org = orgPorId.get(p.organizationId)
      const fest = (festPorOrg[p.organizationId] || []).map((f) => f)
      /* ⚠ EL CUARTO ARGUMENTO ES EL PRÉSTAMO. `obtenerDiasSinCobro` resuelve
         Préstamo > Cliente > Ruta > Organización, y omitirlo hace que los días
         propios del préstamo no ganen: el mismo préstamo daría una mora acá y
         otra en su ficha. Le pasaba a `/api/prestamos/[id]` y le sigue pasando
         a `/api/mora`. */
      const diasExcluidos = obtenerDiasSinCobro(p.cliente, p.cliente?.ruta, org, p)
      const dias = calcularDiasMora(p, diasExcluidos, fest)
      if (dias < 1 || dias > VENTANA_DIAS) continue

      // La cuota que disparó el atraso: es lo que hace única a ESTA mora.
      const ancla = calcularProximoCobro(p, diasExcluidos, fest)
      const llave = `${p.id}:${ancla ? new Date(ancla).toISOString().slice(0, 10) : dias}`
      if (yaAvisado.has(llave)) continue

      ;(nuevos[p.organizationId] ||= []).push({
        llave, dias, prestamo: p,
        monto: calcularMontoEnMora(p, diasExcluidos, fest),
      })
    }

    const res = { orgs: 0, filas: 0, push: 0, prestamos: 0 }

    for (const [orgId, lista] of Object.entries(nuevos)) {
      res.orgs++
      res.prestamos += lista.length
      // El más atrasado y el de más plata primero: si hay tope, que lo que se
      // pierda sea lo pequeño.
      lista.sort((a, b) => b.dias - a.dias || b.monto - a.monto)

      const destinatarios = new Set(ownersPorOrg[orgId] || [])
      const filas = []

      for (const x of lista.slice(0, MAX_FILAS_POR_ORG)) {
        const nombre = x.prestamo.cliente?.nombre || 'Un cliente'
        for (const userId of destinatarios) {
          filas.push({
            organizationId: orgId, userId, tipo: 'mora',
            titulo: `${nombre} se atrasó`,
            mensaje: x.dias === 1
              ? `Tenía que pagar ayer y no pagó. Debe ${dinero(x.monto)}.`
              : `Lleva ${x.dias} días de atraso. Debe ${dinero(x.monto)}.`,
            datos: JSON.stringify({
              llave: x.llave, clienteId: x.prestamo.clienteId,
              prestamoId: x.prestamo.id, dias: x.dias, monto: Math.round(x.monto),
            }),
          })
        }
        // El cobrador de la ruta también, si lo hay.
        const cobradorId = x.prestamo.cliente?.ruta?.cobradorId
        if (cobradorId && !destinatarios.has(cobradorId)) {
          filas.push({
            organizationId: orgId, userId: cobradorId, tipo: 'mora',
            titulo: `${x.prestamo.cliente?.nombre || 'Un cliente'} se atrasó`,
            mensaje: x.dias === 1
              ? `Tenía que pagar ayer y no pagó. Debe ${dinero(x.monto)}.`
              : `Lleva ${x.dias} días de atraso. Debe ${dinero(x.monto)}.`,
            datos: JSON.stringify({
              llave: x.llave, clienteId: x.prestamo.clienteId,
              prestamoId: x.prestamo.id, dias: x.dias, monto: Math.round(x.monto),
            }),
          })
        }
      }

      /* Los que no cupieron NO se callan: se dicen en una fila que lleva a la
         lista entera. Un tope silencioso se lee como «no había más». */
      const sobran = lista.length - MAX_FILAS_POR_ORG
      if (sobran > 0) {
        for (const userId of destinatarios) {
          filas.push({
            organizationId: orgId, userId, tipo: 'mora',
            titulo: `Y otros ${sobran} clientes se atrasaron`,
            mensaje: `Se acaban de atrasar ${lista.length} en total. Toca para verlos.`,
            datos: JSON.stringify({
              // Sin `llave`: esta fila es un resumen del día, no el aviso de un
              // préstamo, y no debe bloquear el aviso individual de mañana.
              href: '/clientes?filtro=mora', resumen: true, cuantos: lista.length,
            }),
          })
        }
      }

      if (filas.length > 0) {
        await prisma.notificacion.createMany({ data: filas })
        res.filas += filas.length
      }

      // El empujón al teléfono va CONSOLIDADO: la campana guarda el detalle.
      const nombres = lista.slice(0, 3).map((x) => x.prestamo.cliente?.nombre).filter(Boolean)
      const extra = lista.length > 3 ? ` y ${lista.length - 3} más` : ''
      await enviarPushOrg(orgId, {
        title: lista.length === 1 ? 'Un cliente se atrasó' : `${lista.length} clientes se atrasaron`,
        body: `${nombres.join(', ')}${extra}`,
        url: '/clientes?filtro=mora',
      }).catch(() => {})
      res.push++

      const cobradores = new Set(
        lista.map((x) => x.prestamo.cliente?.ruta?.cobradorId).filter(Boolean),
      )
      for (const cobradorId of cobradores) {
        const suyos = lista.filter((x) => x.prestamo.cliente?.ruta?.cobradorId === cobradorId)
        await enviarPush(cobradorId, {
          title: suyos.length === 1 ? 'Un cliente se atrasó' : `${suyos.length} clientes se atrasaron`,
          body: suyos.slice(0, 3).map((x) => x.prestamo.cliente?.nombre).join(', '),
          url: '/clientes?filtro=mora',
        }).catch(() => {})
        res.push++
      }
    }

    return NextResponse.json({
      ok: true, ...res,
      mensaje: `${res.prestamos} préstamo(s) se atrasaron en ${res.orgs} negocio(s); ${res.filas} aviso(s) guardado(s), ${res.push} push`,
    })
  } catch (err) {
    console.error('[cron/mora-alertas]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
