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
  enHorario, diasEntre, pasoVencido, motivoParaEscalar, motivoDeRespuesta,
  DIAS_EN_RIESGO, BAJAS_DESDE, claveVencido, claveEnRiesgo, claveCampanaNequi,
} from './reglas'
import { enviarPaso, seguimientoDe } from './enviar'
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

function contar(destino, res) {
  if (res.enviado) destino.enviados++
  else destino[res.motivo] = (destino[res.motivo] ?? 0) + 1
}

export async function correrSeguimiento({ ahora = new Date(), forzarHorario = false } = {}) {
  if (!forzarHorario && !enHorario(ahora)) return { fueraDeHorario: true }
  const r = {
    vencido: { candidatos: 0, enviados: 0 },
    enRiesgo: { candidatos: 0, enviados: 0 },
    campana: { candidatos: 0, enviados: 0 },
    escalados: 0,
  }
  await reengancheVencidos(ahora, r)
  await enRiesgo(ahora, r)
  await campanaNequi(ahora, r)
  return r
}
