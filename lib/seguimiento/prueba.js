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
 * ⚠ QUIEN NO COBRA A DIARIO NO PUEDE COBRAR 3 DÍAS EN UNA SEMANA (6 nov 2026). Un
 *   préstamo semanal hecho el primer día se cobra el día 7: Inversiones Medina, 5
 *   préstamos semanales del 1 nov, primer cobro el 8 y la prueba vencía el 8. De los
 *   36 negocios con préstamos que terminaron sus 7 días, 25 no cobran a diario y 16
 *   de esos llegaron al final con 0 cobros. Si su calendario no le da 3 días de cobro
 *   antes de vencer, el regalo se le da igual: no se le pide lo que no puede hacer.
 *   ⚠ NUNCA MÁS DE 14 DÍAS (el dueño, 6 nov: «el tope es de 14 días… ya 14 días es
 *   mucho tiempo»). Al mensual no le alcanzan ni los 14: se queda en 14 y la nota
 *   le dice que su primer cobro cae después; no se le manda el WhatsApp de
 *   «para que alcance a registrar sus primeros cobros». Ver `calendarioNoAlcanza`.
 *
 * ⚠ QUIÉN ESTÁ EN 7 + 7 lo dice una MARCA, no la fecha: el registro escribe un
 *   `EnvioSeguimiento` { caso: 'prueba', paso: 'inicio' }. Los que ya estaban
 *   en prueba conservan sus 14 días y los crons viejos (por calendario) siguen
 *   con ellos; a los marcados los lleva el motor nuevo. Así no reciben los dos.
 */

import { prisma } from '@/lib/prisma'
import { DIAS_PRUEBA, DIAS_PRUEBA_BASE, DIAS_COBRO_PARA_REGALO } from '@/lib/planes'
import { PREFIJO_ABONO_PREVIO } from '@/lib/dinero/abono-previo'
import { esperadoDeCartera, selectPrestamoDelDia, tocaCobrarEn } from '@/lib/dinero/esperado'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import { notificar } from '@/lib/notificar'
import { diaBogota, enHorario, HORA_DESDE, HORA_HASTA } from './reglas'
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

/** A cuántos días del vencimiento se mira si su calendario le alcanzaba: antes de
 *  que salga el aviso de «vence» (`pasoPrueba`, a 2 días). */
const DIAS_PARA_MIRAR_CALENDARIO = 3
/** De las 7 p. m. a las 8 a. m. (`HORA_HASTA` → `HORA_DESDE`). */
const HORAS_FUERA_DE_HORARIO = 24 - (HORA_HASTA - HORA_DESDE)

/** Hasta dónde se busca su primer cobro, solo para decírselo en la nota. */
const DIAS_PARA_BUSCAR_PRIMER_COBRO = 35
const DIA_MS = 86400000

/** Los días distintos ('YYYY-MM-DD', en orden), entre dos fechas, en que el
 *  calendario de sus préstamos pide un cobro. Con la misma cuenta que «Cobrar hoy»
 *  (`tocaCobrarEn`). */
export function diasDeCobroProgramados({ clientes = [], org = null, festivos = [] }, desde, hasta) {
  const dias = new Set()
  const fin = new Date(hasta).getTime()
  for (let t = new Date(desde).getTime(); t <= fin; t += 86400000) {
    const dia = diaBogota(new Date(t))
    for (const c of clientes) {
      for (const p of c.prestamos ?? []) {
        if (dias.has(dia)) break
        if (tocaCobrarEn(p, dia, obtenerDiasSinCobro(c, c.ruta, org, p), festivos)) dias.add(dia)
      }
    }
  }
  return [...dias].sort()
}

export function diasConCobroProgramado(cartera, desde, hasta) {
  return diasDeCobroProgramados(cartera, desde, hasta).length
}

/**
 * ¿Tiene préstamos y su calendario no le deja cobrar 3 días antes de vencer?
 * Sin préstamos no aplica: ahí lo que falta es empezar, no tiempo.
 * Devuelve `{ primerCobro }` (el primer día con cobro de hoy en adelante,
 * 'YYYY-MM-DD' o null), o null si no aplica.
 */
async function calendarioNoAlcanza(organizationId, inicio, vence, ahora) {
  const [clientes, org, festivos] = await Promise.all([
    prisma.cliente.findMany({
      where: { organizationId },
      select: {
        diasSinCobro: true,
        ruta: { select: { diasSinCobro: true } },
        prestamos: { where: { estado: 'activo', esClavo: false }, select: selectPrestamoDelDia() },
      },
    }),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { diasSinCobro: true } }),
    prisma.festivo.findMany({ where: { organizationId }, select: { fecha: true } }),
  ])
  if (!clientes.some((c) => c.prestamos.length > 0)) return null
  const hasta = new Date(new Date(inicio).getTime() + DIAS_PARA_BUSCAR_PRIMER_COBRO * DIA_MS)
  const dias = diasDeCobroProgramados({ clientes, org, festivos }, inicio, hasta)
  const antesDeVencer = dias.filter((d) => d <= diaBogota(vence)).length
  if (antesDeVencer >= DIAS_COBRO_PARA_REGALO) return null
  const hoy = diaBogota(ahora)
  return { primerCobro: dias.find((d) => d >= hoy) ?? null }
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
    let calendario = null
    if (dias.length < DIAS_COBRO_PARA_REGALO) {
      /* Este lo dispara el reloj, no un cobro, y el motor corre a toda hora: se
         decide en horario de mensajes (entre los 3 y los 2 días siempre hay). Salvo
         que venza antes de que vuelva el horario (las pruebas que ya iban a menos de
         3 días el 6 nov): ahí se extiende igual y el WhatsApp no sale. */
      const horas = (sub.fechaVencimiento - ahora) / 3600000
      const cerca = horas <= DIAS_PARA_MIRAR_CALENDARIO * 24
      const antesDelHorario = horas <= HORAS_FUERA_DE_HORARIO
      if (cerca && (enHorario(ahora) || antesDelHorario)) calendario = await calendarioNoAlcanza(organizationId, marca.createdAt, sub.fechaVencimiento, ahora)
      if (!calendario) return { premio: false, motivo: 'faltan_dias', dias: dias.length }
    }

    /* Los 14 días se cuentan desde que EMPEZÓ la prueba, que es la marca: el
       registro, o el día en que el asesor le dejó la cartera cargada
       (`reiniciarPrueba`). Nunca acorta: si ya iba más lejos, se queda. */
    const porCalendario = !!calendario
    // ⚠ 14 días y no más, también para el del calendario.
    const nuevoFin = new Date(Math.max(finConRegalo(marca.createdAt).getTime(), sub.fechaVencimiento.getTime()))
    // El mensual: ni con los 14 le llega su primer cobro.
    const cobroDespues = porCalendario && (!calendario.primerCobro || calendario.primerCobro > diaBogota(nuevoFin))

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
      organizationId, tipo: 'prueba',
      titulo: porCalendario ? 'Su prueba se extendió' : 'Ganó sus 7 días de regalo',
      mensaje: cobroDespues
        ? `Su prueba sigue hasta el ${fecha}, el máximo de la prueba gratis. ${calendario.primerCobro
          ? `Su primer cobro programado es el ${new Date(`${calendario.primerCobro}T12:00:00-05:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', timeZone: 'America/Bogota' })}, después de esa fecha.`
          : 'Su primer cobro programado cae después de esa fecha.'}`
        : porCalendario
          ? `Para que alcance a registrar sus primeros cobros, su prueba sigue hasta el ${fecha}.`
          : `Registró cobros en ${DIAS_COBRO_PARA_REGALO} días distintos: su prueba sigue hasta el ${fecha}.`,
      href: '/dashboard',
    })
    const dueno = await prisma.user.findFirst({ where: { organizationId, rol: 'owner' }, select: { nombre: true, telefono: true } })
    /* El que se ganó cobrando acaba de cobrar: está despierto. El del reloj, solo en
       horario. Y al mensual no se le dice «para que alcance a registrar sus primeros
       cobros»: no le alcanza; le queda la nota de la app. */
    if (!porCalendario || (enHorario(ahora) && !cobroDespues)) await enviarPaso({
      organizationId, telefono: dueno?.telefono, caso: 'prueba', claveCaso: clavePrueba(organizationId), paso: 'premio_whatsapp',
      plantilla: porCalendario ? 'prueba_extendida_primeros_cobros' : 'prueba_extendida',
      datos: { nombre: String(dueno?.nombre || 'amigo').split(' ')[0], fecha },
      ahora, ignorarLimiteDiario: true,
    }).catch(() => null)
    return { premio: true, hasta: nuevoFin, porCalendario, cobroDespues }
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
        prestamos: { where: { estado: 'activo', esClavo: false }, select: selectPrestamoDelDia() },
      },
    }),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { diasSinCobro: true } }),
    prisma.festivo.findMany({ where: { organizationId }, select: { fecha: true } }),
  ])
  const r = esperadoDeCartera({ clientes, org, festivos }, diaBogota(ahora))
  return { cobros: r.conCobro, monto: r.esperado }
}
