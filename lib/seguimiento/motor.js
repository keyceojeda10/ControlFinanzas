/* ── EL MOTOR DE SEGUIMIENTO ─────────────────────────────────────────────────
 *
 * UN solo motor que reacciona a lo que hace cada negocio, en vez de siete crons
 * por calendario que no se conocen. Lo corre `app/api/cron/seguimiento` cada
 * hora; decide y envía. Las reglas puras están en `reglas.js`.
 *
 * Bloque 1 (12 oct 2026):
 *   · REENGANCHE de quien pagó y se fue (desde el 1 de septiembre): D+3 «¿nos
 *     dice el motivo?», +4 la oferta si dijo «el precio», +18 «sus datos siguen
 *     guardados». El D+1 sigue en churn-whatsapp.
 *   · EN RIESGO: cliente que paga y lleva 7 días sin usar la app.
 *   · CAMPAÑA DEL 35 %: a los que pagan a mano, una vez.
 *   · ESCALAMIENTO a Carlos (cuentas de 100+ clientes).
 *
 * Un mensaje al día por negocio y en horario: lo que no sale hoy sale mañana.
 * El orden de este archivo es la prioridad: quien se fue va antes que la
 * campaña.
 */

import { prisma } from '@/lib/prisma'
import { whereCobroSinRechazo } from '@/lib/cobro-automatico'
import {
  enHorario, horaBogota, diaBogota, diasEntre, pasoVencido, pasoPrueba, motivoParaEscalar, motivoDeRespuesta,
  DIAS_EN_RIESGO, BAJAS_DESDE, claveVencido, claveEnRiesgo, claveCampanaNequi,
  DIAS_OFERTA_PRUEBA, tocaOfertaDePrueba,
} from './reglas'
import { enviarPaso, enviarPush, seguimientoDe } from './enviar'
import { whereConPruebaSiete, clavePrueba, diasConCobro, evaluarPremioPrueba, cobrosDeHoy } from './prueba'
import { DIAS_COBRO_PARA_REGALO, DIAS_PRUEBA, DIAS_PRUEBA_BASE } from '@/lib/planes'
import { escalar } from './escalar'

/** Las cuentas propias y de prueba: nunca reciben seguimiento. */
export const EMAILS_INTERNOS = [
  'keycejob@gmail.com', 'ccaojd@gmail.com', 'owner@test.com',
  'controlfinanzasgmail@gmail.com', 'serviteclgx1@gmail.com',
]

const primerNombre = (n) => String(n || 'amigo').trim().split(/\s+/)[0]
export const fechaLarga = (d) => new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', timeZone: 'America/Bogota' })

const selectOrg = {
  id: true, nombre: true, plan: true, telefono: true,
  users: { where: { rol: 'owner' }, select: { id: true, nombre: true, telefono: true }, take: 1 },
  _count: { select: { clientes: true } },
}

/**
 * La última vez que el negocio USÓ la app: la actividad de sus sesiones o su
 * último cobro registrado, lo que sea más nuevo.
 * ⚠ No `lastLoginAt`: solo cambia al iniciar sesión, y una sesión dura
 *   semanas; quien entra todos los días parecería desaparecido.
 */
export async function ultimoUsoPorOrg(orgIds) {
  if (orgIds.length === 0) return new Map()
  const [sesiones, pagos] = await Promise.all([
    prisma.sesionActiva.groupBy({ by: ['organizationId'], where: { organizationId: { in: orgIds } }, _max: { lastActivityAt: true } }),
    prisma.pago.groupBy({ by: ['organizationId'], where: { organizationId: { in: orgIds } }, _max: { createdAt: true } }),
  ])
  const m = new Map()
  const poner = (id, d) => { if (d && (!m.get(id) || d > m.get(id))) m.set(id, d) }
  for (const s of sesiones) poner(s.organizationId, s._max.lastActivityAt)
  for (const p of pagos) poner(p.organizationId, p._max.createdAt)
  return m
}

async function ultimoPagoPorOrg(orgIds) {
  if (orgIds.length === 0) return new Map()
  const pagos = await prisma.pagoSuscripcion.findMany({
    where: { organizationId: { in: orgIds }, montoCOP: { gt: 0 } },
    orderBy: { fecha: 'desc' }, select: { organizationId: true, plan: true, montoCOP: true },
  })
  const m = new Map()
  for (const p of pagos) if (!m.has(p.organizationId)) m.set(p.organizationId, p)
  return m
}

const telefonoDe = (org) => org.users[0]?.telefono ?? org.telefono ?? null

function datosDelAviso(org, { ultimoUso, ultimoPago, envio, respuesta, accion }) {
  return {
    org: org.nombre, telefono: telefonoDe(org), clientes: org._count.clientes,
    plan: ultimoPago?.plan ?? org.plan, monto: ultimoPago?.montoCOP ?? 0,
    ultimoUso, envio, respuesta, accion,
  }
}

/* ── 1 · Quien pagó y se fue ── */
async function reengancheVencidos(ahora, r) {
  const pagaron = await prisma.pagoSuscripcion.findMany({
    where: { montoCOP: { gt: 0 } }, distinct: ['organizationId'], select: { organizationId: true },
  })
  const orgs = await prisma.organization.findMany({
    where: {
      id: { in: pagaron.map((p) => p.organizationId) },
      activo: true,
      users: { none: { email: { in: EMAILS_INTERNOS } } },
      NOT: whereCobroSinRechazo,
      suscripciones: { none: { estado: 'activa', fechaVencimiento: { gt: ahora } } },
    },
    select: { ...selectOrg, suscripciones: { orderBy: { fechaVencimiento: 'desc' }, take: 1, select: { fechaVencimiento: true } } },
  })
  const ids = orgs.map((o) => o.id)
  const [usos, pagos] = await Promise.all([ultimoUsoPorOrg(ids), ultimoPagoPorOrg(ids)])

  for (const org of orgs) {
    const vence = org.suscripciones[0]?.fechaVencimiento
    if (!vence || vence < BAJAS_DESDE || vence >= ahora) continue
    r.vencido.candidatos++
    const clave = claveVencido(org.id, vence)
    const filas = await prisma.envioSeguimiento.findMany({ where: { claveCaso: clave } })
    const enviados = Object.fromEntries(filas.map((f) => [f.paso, f]))
    const seg = await seguimientoDe(org.id)
    const motivo = motivoDeRespuesta(String(enviados.d3_motivo?.respuesta ?? '').split(' | ')[0])

    // Escalamiento por silencio: 48 h sin respuesta al motivo.
    const accion = motivoParaEscalar({
      clientes: org._count.clientes, caso: 'vencido', envioMotivo: enviados.d3_motivo,
      motivo, yaEscalado: Boolean(enviados.d3_motivo?.escaladoAt), ahora,
    })
    if (accion && enviados.d3_motivo) {
      if (await escalar({ envioId: enviados.d3_motivo.id, ...datosDelAviso(org, { ultimoUso: usos.get(org.id), ultimoPago: pagos.get(org.id), envio: enviados.d3_motivo, respuesta: enviados.d3_motivo.respuesta, accion }) })) r.escalados++
    }

    const paso = pasoVencido({ diasVencido: diasEntre(vence, ahora), enviados, motivo, ofertaNequi: seg.ofertaNequi, ahora })
    if (!paso) continue
    const nombre = primerNombre(org.users[0]?.nombre)
    const porPaso = {
      d3_motivo: { plantilla: 'motivo_no_renovo', datos: { nombre, fecha: fechaLarga(vence) } },
      d7_oferta: { plantilla: 'oferta_nequi', datos: { nombre } },
      d21_datos: { plantilla: 'datos_guardados', datos: { nombre, fecha: fechaLarga(usos.get(org.id) ?? vence), clientes: org._count.clientes } },
    }[paso]
    const res = await enviarPaso({ organizationId: org.id, telefono: telefonoDe(org), caso: 'vencido', claveCaso: clave, paso, ...porPaso, ahora })
    contar(r.vencido, res)
  }
}

/* ── 2 · Cliente que paga y dejó de usar la app ── */
async function enRiesgo(ahora, r) {
  const orgs = await prisma.organization.findMany({
    where: {
      activo: true,
      users: { none: { email: { in: EMAILS_INTERNOS } } },
      suscripciones: { some: { estado: 'activa', montoCOP: { gt: 0 }, fechaVencimiento: { gt: ahora } } },
    },
    select: selectOrg,
  })
  const ids = orgs.map((o) => o.id)
  const [usos, pagos] = await Promise.all([ultimoUsoPorOrg(ids), ultimoPagoPorOrg(ids)])

  for (const org of orgs) {
    const ultimo = usos.get(org.id)
    if (!ultimo || diasEntre(ultimo, ahora) < DIAS_EN_RIESGO) continue
    r.enRiesgo.candidatos++
    const clave = claveEnRiesgo(org.id, ultimo)

    /* Carlos se entera aunque el WhatsApp no salga (plantilla en revisión, sin
       teléfono): el aviso va en su propia fila, `telegram`, una vez por racha. */
    if (org._count.clientes >= 100) {
      const fila = await prisma.envioSeguimiento.upsert({
        where: { claveCaso_paso: { claveCaso: clave, paso: 'telegram' } },
        create: { organizationId: org.id, caso: 'en_riesgo', claveCaso: clave, paso: 'telegram', canal: 'telegram' },
        update: {},
      })
      const accion = motivoParaEscalar({ clientes: org._count.clientes, caso: 'en_riesgo', yaEscalado: Boolean(fila.escaladoAt), ahora })
      if (accion && await escalar({ envioId: fila.id, ...datosDelAviso(org, { ultimoUso: ultimo, ultimoPago: pagos.get(org.id), envio: null, respuesta: null, accion: `${accion} Lleva ${diasEntre(ultimo, ahora)} días sin usar la app.` }) })) r.escalados++
    }

    /* «Tiene N cobros sin registrar desde el X»: préstamos diarios y semanales
       que desde ese día no tienen ni un cobro. Los quincenales y mensuales
       quedan fuera: en una semana pueden no haber tenido cuota. Con cero no
       hay nada que decirle y no se manda. */
    const cobros = await prisma.prestamo.count({
      where: {
        organizationId: org.id, estado: 'activo', esClavo: false,
        frecuencia: { in: ['diario', 'semanal'] },
        pagos: { none: { createdAt: { gte: ultimo } } },
      },
    })
    if (cobros === 0) continue
    const res = await enviarPaso({
      organizationId: org.id, telefono: telefonoDe(org), caso: 'en_riesgo', claveCaso: clave, paso: 'aviso',
      plantilla: 'cuenta_inactiva', datos: { nombre: primerNombre(org.users[0]?.nombre), cobros, fecha: fechaLarga(ultimo) }, ahora,
    })
    contar(r.enRiesgo, res)
  }
}

/* ── 3 · La campaña del 35 % a los que pagan a mano ── */
async function campanaNequi(ahora, r) {
  const orgs = await prisma.organization.findMany({
    where: {
      activo: true,
      wompiFuentePagoId: null,
      users: { none: { email: { in: EMAILS_INTERNOS } } },
      suscripciones: { some: { estado: 'activa', montoCOP: { gt: 0 }, fechaVencimiento: { gt: ahora } } },
    },
    select: selectOrg,
  })
  for (const org of orgs) {
    r.campana.candidatos++
    const seg = await seguimientoDe(org.id)
    /* La oferta existe desde que arranca la campaña, aunque Meta no haya
       aprobado la plantilla: la pantalla del plan ya la enseña. */
    if (!seg.ofertaNequi) {
      await prisma.seguimientoOrg.update({ where: { organizationId: org.id }, data: { ofertaNequi: 'disponible', ofertaNequiAt: ahora } })
    } else if (seg.ofertaNequi !== 'disponible') continue
    const res = await enviarPaso({
      organizationId: org.id, telefono: telefonoDe(org), caso: 'campana_nequi', claveCaso: claveCampanaNequi(org.id), paso: 'oferta',
      plantilla: 'oferta_nequi', datos: { nombre: primerNombre(org.users[0]?.nombre) }, ahora,
    })
    contar(r.campana, res)
  }
}

/* ── 3b · El 35 % a los de prueba que usan el sistema (opción A, 12 oct 2026) ──
   Solo MARCA la oferta: se ve dentro de la app (la franja de «tu prueba vence»
   y la página del plan). No manda WhatsApp. A cualquier hora: no escribe. */
async function ofertaParaPrueba(ahora, r) {
  const hasta = new Date(ahora.getTime() + DIAS_OFERTA_PRUEBA * 86400000)
  const todos = await prisma.organization.findMany({
    where: {
      activo: true,
      wompiFuentePagoId: null,
      users: { none: { email: { in: EMAILS_INTERNOS } } },
      suscripciones: {
        some: { estado: 'activa', montoCOP: 0, fechaVencimiento: { gt: ahora, lte: hasta } },
        none: { montoCOP: { gt: 0 }, fechaVencimiento: { gt: ahora } },
      },
      // Nunca ofrecida (sin fila de seguimiento, o con la oferta vacía).
      OR: [{ seguimiento: { is: null } }, { seguimiento: { is: { ofertaNequi: null } } }],
    },
    select: {
      id: true, _count: { select: { clientes: true } },
      suscripciones: { where: { estado: 'activa', montoCOP: 0 }, orderBy: { fechaVencimiento: 'desc' }, take: 1, select: { fechaVencimiento: true } },
    },
  })
  if (!todos.length) return
  // Quien ya pagó alguna vez no está «en prueba» aunque tenga una gratis viva.
  const pagaron = new Set((await prisma.pagoSuscripcion.findMany({
    where: { organizationId: { in: todos.map((o) => o.id) }, montoCOP: { gt: 0 } },
    select: { organizationId: true }, distinct: ['organizationId'],
  })).map((p) => p.organizationId))
  for (const org of todos) {
    r.ofertaPrueba.candidatos++
    if (!tocaOfertaDePrueba({ finPrueba: org.suscripciones[0]?.fechaVencimiento, ahora, clientes: org._count.clientes, pagoReal: pagaron.has(org.id) })) continue
    await prisma.seguimientoOrg.upsert({
      where: { organizationId: org.id },
      create: { organizationId: org.id, ofertaNequi: 'disponible', ofertaNequiAt: ahora },
      update: { ofertaNequi: 'disponible', ofertaNequiAt: ahora },
    })
    r.ofertaPrueba.marcados++
  }
}

/* ── 4 · La prueba de 7 + 7 ── */
async function orgsEnPrueba(ahora) {
  return prisma.organization.findMany({
    where: {
      activo: true,
      ...whereConPruebaSiete,
      users: { none: { email: { in: EMAILS_INTERNOS } } },
      suscripciones: { some: { estado: 'activa', montoCOP: 0, fechaVencimiento: { gt: ahora } } },
    },
    select: {
      ...selectOrg, createdAt: true,
      suscripciones: { where: { estado: 'activa', montoCOP: 0 }, orderBy: { fechaVencimiento: 'desc' }, take: 1, select: { fechaVencimiento: true } },
      // La marca dice cuándo empezó la prueba: el registro o la carga con asesor.
      enviosSeguimiento: { where: { caso: 'prueba', paso: 'inicio' }, take: 1, select: { createdAt: true } },
    },
  })
}

/** El regalo de 7 días: cada hora, a cualquier hora (no manda nada por sí solo
 *  salvo el aviso de que lo ganó). Es la red: lo normal es que salte al cobrar. */
async function premiosDePrueba(ahora, r) {
  for (const org of await orgsEnPrueba(ahora)) {
    const p = await evaluarPremioPrueba(org.id, { ahora })
    if (p.premio) r.prueba.premios++
  }
}

const AVISOS_PRUEBA = {
  casi_regalo: () => ({
    titulo: 'Un día más y gana 7 días de regalo',
    mensaje: `Ya registró cobros ${DIAS_COBRO_PARA_REGALO - 1} días. Registre cobros hoy y su prueba sigue ${DIAS_PRUEBA - DIAS_PRUEBA_BASE} días más.`,
    href: '/cobros-hoy',
  }),
  recordatorio: ({ cobros, monto }) => ({
    titulo: 'Hoy le toca cobrar',
    mensaje: `Tiene ${cobros} cobros programados por $${monto.toLocaleString('es-CO')}. Regístrelos aquí.`,
    href: '/cobros-hoy',
  }),
}

async function seguimientoPrueba(ahora, r) {
  const orgs = await orgsEnPrueba(ahora)
  const usos = await ultimoUsoPorOrg(orgs.map((o) => o.id))
  const dia = diaBogota(ahora)
  const ayer = diaBogota(new Date(ahora.getTime() - 86400000))

  for (const org of orgs) {
    r.prueba.candidatos++
    const clave = clavePrueba(org.id)
    const filas = await prisma.envioSeguimiento.findMany({ where: { claveCaso: clave }, select: { paso: true } })
    const enviados = new Set(filas.map((f) => f.paso))
    const { dias, cobros, monto } = await diasConCobro(org.id, ahora)
    const fin = org.suscripciones[0].fechaVencimiento
    const hoy = org._count.clientes >= 6 ? await cobrosDeHoy(org.id, ahora) : { cobros: 0, monto: 0 }
    const uso = usos.get(org.id)

    const inicio = org.enviosSeguimiento[0]?.createdAt ?? org.createdAt
    const paso = pasoPrueba({
      horasDesdeRegistro: (ahora - inicio) / 3600000,
      clientes: org._count.clientes,
      diasCobro: dias.length, diasParaRegalo: DIAS_COBRO_PARA_REGALO,
      cobroHoy: dias.includes(dia), cobroAyer: dias.includes(ayer),
      horasSinUso: uso ? (ahora - uso) / 3600000 : (ahora - inicio) / 3600000,
      diasParaVencer: (fin - ahora) / 86400000,
      premio: enviados.has('premio'),
      cobrosHoy: hoy.cobros, hora: horaBogota(ahora), dia, finPrueba: diaBogota(fin), enviados,
    })
    if (!paso) continue

    const nombre = primerNombre(org.users[0]?.nombre)
    let res
    if (paso.canal === 'push') {
      res = await enviarPush({ organizationId: org.id, caso: 'prueba', claveCaso: clave, paso: paso.paso, ...AVISOS_PRUEBA[paso.aviso](hoy), ahora })
    } else {
      const datos = {
        cuenta_configurar: { nombre },
        cobros_de_hoy: { nombre, cobros: hoy.cobros, monto: `$${hoy.monto.toLocaleString('es-CO')}` },
        prueba_por_vencer: { nombre, fecha: fechaLarga(fin), cobros, monto: `$${monto.toLocaleString('es-CO')}` },
      }[paso.plantilla]
      res = await enviarPaso({ organizationId: org.id, telefono: telefonoDe(org), caso: 'prueba', claveCaso: clave, paso: paso.paso, plantilla: paso.plantilla, datos, ahora })
    }
    contar(r.prueba, res)
  }
}

function contar(destino, res) {
  if (res.enviado) destino.enviados++
  else destino[res.motivo] = (destino[res.motivo] ?? 0) + 1
}

export async function correrSeguimiento({ ahora = new Date(), forzarHorario = false } = {}) {
  const r = {
    vencido: { candidatos: 0, enviados: 0 },
    enRiesgo: { candidatos: 0, enviados: 0 },
    campana: { candidatos: 0, enviados: 0 },
    prueba: { candidatos: 0, enviados: 0, premios: 0 },
    ofertaPrueba: { candidatos: 0, marcados: 0 },
    escalados: 0,
  }
  // El regalo de la prueba no espera al horario: alarga una fecha, no escribe.
  await premiosDePrueba(ahora, r)
  // Tampoco la oferta a los de prueba: solo marca, se ve dentro de la app.
  await ofertaParaPrueba(ahora, r)
  if (!forzarHorario && !enHorario(ahora)) return { ...r, fueraDeHorario: true }
  await reengancheVencidos(ahora, r)
  await seguimientoPrueba(ahora, r)
  await enRiesgo(ahora, r)
  await campanaNequi(ahora, r)
  return r
}
