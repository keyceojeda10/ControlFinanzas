/* ── LA PRUEBA DE 7 + 7 DÍAS ─────────────────────────────────────────────────
 *
 * Decisión de Carlos (12 oct 2026): sigue siendo «14 días gratis», pero son 7
 * normales y 7 de regalo si USA la app: cobros registrados en 3 días distintos
 * (hora de Bogotá) antes de que se le venza. El dato que lo justifica: quien
 * tiene 6+ clientes y cobra 5 días en sus primeros 12 paga el 85 % de las
 * veces; quien cobra un solo día, el 21 %.
 *
 * ⚠ LA PRUEBA SE CORTA POR LA SUSCRIPCIÓN, NO POR `planDemoHasta`. El bloqueo
 *   de la app lee `Suscripcion.fechaVencimiento` (app/(dashboard)/layout.jsx,
 *   lib/suscripcion.js). El registro y el premio mueven LAS DOS fechas; mover
 *   solo una dejaba la prueba en 14 días o la cortaba antes de tiempo.
 *
 * ⚠ QUIÉN ESTÁ EN 7 + 7 lo dice una MARCA, no la fecha: el registro escribe un
 *   `EnvioSeguimiento` { caso: 'prueba', paso: 'inicio' }. Los que ya estaban
 *   en prueba conservan sus 14 días y los crons viejos (por calendario) siguen
 *   con ellos; a los marcados los lleva el motor nuevo. Así no reciben los dos.
 */

import { prisma } from '@/lib/prisma'
import { DIAS_PRUEBA, DIAS_PRUEBA_BASE, DIAS_COBRO_PARA_REGALO } from '@/lib/planes'
import { PREFIJO_ABONO_PREVIO } from '@/lib/dinero/abono-previo'
import { esperadoDeCartera, SELECT_PRESTAMO } from '@/lib/dinero/esperado'
import { notificar } from '@/lib/notificar'
import { diaBogota } from './reglas'
import { enviarPaso } from './enviar'

export const clavePrueba = (orgId) => `prueba:${orgId}`
const MARCA = { caso: 'prueba', paso: 'inicio' }

/** En el registro, dentro de su transacción: este negocio va con 7 + 7. */
export async function marcarPruebaSiete(tx, organizationId) {
  return tx.envioSeguimiento.create({
    data: { organizationId, ...MARCA, claveCaso: clavePrueba(organizationId), canal: 'app' },
  })
}

/** El `where` de Prisma para los negocios que NO van con 7 + 7 (los crons viejos). */
export const whereSinPruebaSiete = { enviosSeguimiento: { none: MARCA } }
export const whereConPruebaSiete = { enviosSeguimiento: { some: MARCA } }

/** Fin de la prueba con el regalo: los mismos días de calendario que el registro. */
export function finConRegalo(createdAt) {
  const d = new Date(createdAt)
  d.setDate(d.getDate() + DIAS_PRUEBA)
  return d
}

/** Fin de la prueba sin el regalo. */
export function finSinRegalo(createdAt) {
  const d = new Date(createdAt)
  d.setDate(d.getDate() + DIAS_PRUEBA_BASE)
  return d
}

/**
 * CON ASESOR, EL RELOJ ARRANCA AL APROBAR SU CARTERA (bloque 4). Quien pidió que
 * le cargaran el cuaderno no pudo usar la app mientras tanto: sus 7 días
 * empiezan el día en que la recibe cargada, y el regalo cuenta desde ahí.
 *
 * Solo si sigue en prueba gratis y nunca ha pagado. Mueve la marca de inicio
 * (o la crea: quien venía de los 14 días pasa a 7 + 7) y las DOS fechas, sin
 * acortar nunca. Devuelve el nuevo fin, o null si no aplica.
 */
export async function reiniciarPrueba(organizationId, { ahora = new Date() } = {}) {
  /* La gratis más reciente AUNQUE ya esté vencida: el cron de suscripciones la
     marca `vencida` al pasar la fecha, y si el asesor tardó, el dueño estaría
     bloqueado justo cuando le entregan la cartera. */
  const sub = await prisma.suscripcion.findFirst({ where: { organizationId, montoCOP: 0 }, orderBy: { fechaVencimiento: 'desc' } })
  if (!sub) return null
  const pagoReal = await prisma.pagoSuscripcion.count({ where: { organizationId, montoCOP: { gt: 0 } } })
  if (pagoReal > 0) return null
  const ya = await prisma.envioSeguimiento.findFirst({ where: { organizationId, caso: 'prueba', paso: 'premio' } })
  const nuevoFin = new Date(Math.max((ya ? finConRegalo(ahora) : finSinRegalo(ahora)).getTime(), sub.fechaVencimiento.getTime()))
  const marca = await prisma.envioSeguimiento.findFirst({ where: { organizationId, ...MARCA } })
  await prisma.$transaction([
    marca
      ? prisma.envioSeguimiento.update({ where: { id: marca.id }, data: { createdAt: ahora } })
      : prisma.envioSeguimiento.create({ data: { organizationId, ...MARCA, claveCaso: clavePrueba(organizationId), canal: 'app', createdAt: ahora } }),
    prisma.suscripcion.update({ where: { id: sub.id }, data: { fechaVencimiento: nuevoFin, estado: 'activa' } }),
    prisma.organization.update({ where: { id: organizationId }, data: { planDemoHasta: nuevoFin } }),
  ])
  return nuevoFin
}

/** Cuándo empezó la prueba de 7 + 7: la marca (registro o carga aprobada). */
export async function inicioDePrueba(organizationId) {
  const marca = await prisma.envioSeguimiento.findFirst({ where: { organizationId, ...MARCA }, select: { createdAt: true } })
  return marca?.createdAt ?? null
}

/**
 * Los días distintos (Bogotá) en que registró cobros, hasta `hasta`.
 * ⚠ Cuenta cuándo se REGISTRÓ (`createdAt`), no la fecha que dice el pago:
 *   escribir cobros con fecha de días pasados no gana el regalo.
 * ⚠ Fuera el abono previo de una carga (todos el mismo día) y los recargos y
 *   descuentos, que no son cobrar. `nota: null` va explícito: `NOT LIKE` sobre
 *   un NULL es NULL en SQL y dejaría fuera los cobros normales.
 */
export async function diasConCobro(organizationId, hasta = new Date()) {
  const pagos = await prisma.pago.findMany({
    where: {
      organizationId,
      createdAt: { lte: hasta },
      tipo: { notIn: ['recargo', 'descuento'] },
      OR: [{ nota: null }, { NOT: { nota: { startsWith: PREFIJO_ABONO_PREVIO } } }],
    },
    select: { createdAt: true, montoPagado: true },
  })
  const dias = new Set(pagos.map((p) => diaBogota(p.createdAt)))
  return { dias: [...dias].sort(), cobros: pagos.length, monto: Math.round(pagos.reduce((a, p) => a + (Number(p.montoPagado) || 0), 0)) }
}

/** La suscripción de prueba vigente (gratis), o null. */
async function suscripcionDePrueba(organizationId) {
  return prisma.suscripcion.findFirst({
    where: { organizationId, montoCOP: 0, estado: 'activa' },
    orderBy: { fechaVencimiento: 'desc' },
  })
}

/**
 * ¿Ganó los 7 días de regalo? Si sí, mueve las dos fechas UNA vez (la fila
 * `premio` es la llave) y le avisa. Se llama al registrar un cobro y desde el
 * motor cada hora, como red.
 */
export async function evaluarPremioPrueba(organizationId, { ahora = new Date() } = {}) {
  try {
    const marca = await prisma.envioSeguimiento.findFirst({ where: { organizationId, ...MARCA } })
    if (!marca) return { premio: false, motivo: 'sin_7_7' }
    const ya = await prisma.envioSeguimiento.findFirst({ where: { organizationId, caso: 'prueba', paso: 'premio' } })
    if (ya) return { premio: false, motivo: 'ya_lo_tiene' }

    const sub = await suscripcionDePrueba(organizationId)
    if (!sub || sub.fechaVencimiento <= ahora) return { premio: false, motivo: 'sin_prueba_vigente' }
    const pagoReal = await prisma.pagoSuscripcion.count({ where: { organizationId, montoCOP: { gt: 0 } } })
    if (pagoReal > 0) return { premio: false, motivo: 'ya_paga' }

    const { dias } = await diasConCobro(organizationId, ahora)
    if (dias.length < DIAS_COBRO_PARA_REGALO) return { premio: false, motivo: 'faltan_dias', dias: dias.length }

    /* Los 14 días se cuentan desde que EMPEZÓ la prueba, que es la marca: el
       registro, o el día en que el asesor le dejó la cartera cargada
       (`reiniciarPrueba`). Nunca acorta: si ya iba más lejos, se queda. */
    const nuevoFin = new Date(Math.max(finConRegalo(marca.createdAt).getTime(), sub.fechaVencimiento.getTime()))

    try {
      await prisma.$transaction([
        prisma.envioSeguimiento.create({
          data: { organizationId, caso: 'prueba', claveCaso: clavePrueba(organizationId), paso: 'premio', canal: 'app' },
        }),
        prisma.suscripcion.update({ where: { id: sub.id }, data: { fechaVencimiento: nuevoFin } }),
        prisma.organization.update({ where: { id: organizationId }, data: { planDemoHasta: nuevoFin } }),
      ])
    } catch (e) {
      if (e?.code === 'P2002') return { premio: false, motivo: 'ya_lo_tiene' } // otro proceso ganó la carrera
      throw e
    }

    const fecha = nuevoFin.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', timeZone: 'America/Bogota' })
    await notificar({
      organizationId, tipo: 'prueba', titulo: 'Ganó sus 7 días de regalo',
      mensaje: `Registró cobros en ${DIAS_COBRO_PARA_REGALO} días distintos: su prueba sigue hasta el ${fecha}.`,
      href: '/dashboard',
    })
    const dueno = await prisma.user.findFirst({ where: { organizationId, rol: 'owner' }, select: { nombre: true, telefono: true } })
    await enviarPaso({
      organizationId, telefono: dueno?.telefono, caso: 'prueba', claveCaso: clavePrueba(organizationId), paso: 'premio_whatsapp',
      plantilla: 'prueba_extendida', datos: { nombre: String(dueno?.nombre || 'amigo').split(' ')[0], fecha },
      ahora, ignorarLimiteDiario: true,
    }).catch(() => null)
    return { premio: true, hasta: nuevoFin }
  } catch (e) {
    // Nunca tumba el cobro que lo disparó.
    console.error('[prueba] premio:', organizationId, e?.message)
    return { premio: false, motivo: 'error' }
  }
}

/**
 * Los cobros que le tocan hoy y cuánto suman: la MISMA cuenta que «Cobrar hoy»
 * y la caja (`esperadoDeCartera`), para que el mensaje y la pantalla digan lo
 * mismo.
 */
export async function cobrosDeHoy(organizationId, ahora = new Date()) {
  const [clientes, org, festivos] = await Promise.all([
    prisma.cliente.findMany({
      where: { organizationId },
      select: {
        diasSinCobro: true,
        ruta: { select: { diasSinCobro: true } },
        prestamos: { where: { estado: 'activo', esClavo: false }, select: SELECT_PRESTAMO },
      },
    }),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { diasSinCobro: true } }),
    prisma.festivo.findMany({ where: { organizationId }, select: { fecha: true } }),
  ])
  const r = esperadoDeCartera({ clientes, org, festivos }, diaBogota(ahora))
  return { cobros: r.conCobro, monto: r.esperado }
}
