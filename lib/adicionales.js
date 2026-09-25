// lib/adicionales.js — cobradores y rutas adicionales: lo que ve el dueño,
// quitarlos y aplicar la compra que aprueba Wompi.
//
// El precio vive en lib/precio-plan.js y el cupo en lib/planes.js (`cuposDe`).
// Aquí solo está lo que toca la base.
//
// Las reglas que decidió el dueño el 24 sep 2026:
//   · agregarlos con el plan pagado y vigente cobra YA los días que faltan
//     para renovar; el cupo se abre cuando Wompi aprueba, no antes
//   · sin plan pagado (prueba o vencido) se eligen libres y se pagan con el
//     plan: el checkout y el cobro automático ya los suman
//   · quitarlos es al instante y no se devuelve nada; solo hasta lo que está
//     en uso, para no congelar a un cobrador que está trabajando
//   · fuera de Wompi (MercadoPago y los países a mano) se piden por WhatsApp
//     y los carga el panel

import { prisma } from '@/lib/prisma'
import { PLANES_CONFIG, PLANES_VALIDOS, admiteAdicionales, cuposDe, selectCupos, getPrecioCobradorExtra, getPrecioRutaExtra } from '@/lib/planes'
import { adicionalesMensual, precioAdicionales, selectPrecio, MINIMO_WOMPI } from '@/lib/precio-plan'
import { registrarPagoSuscripcion } from '@/lib/libro-pagos'
import { ultimaSuscripcion, ultimoPago } from '@/lib/cobro-intento'
import { getPaymentGateway } from '@/lib/i18n'

/* Más que esto no lo pide nadie de verdad: es un tope contra un número
   escrito mal, no una regla de negocio. */
export const MAX_ADICIONALES = 50

const selectOrg = { id: true, nombre: true, planOriginal: true, ...selectCupos, ...selectPrecio }

/** ¿Pagó un plan que sigue vigente? La prueba y el plan gratis no cuentan. */
export function planPagadoVigente(ultima, ahora = new Date()) {
  return Boolean(
    ultima && ultima.estado === 'activa' && ultima.montoCOP > 0 &&
    ultima.fechaVencimiento && new Date(ultima.fechaVencimiento) > ahora
  )
}

/** El plan que se cobra: el último pagado, o el suyo fuera de la prueba. */
function planDelCobro(org, pagada) {
  return [pagada?.plan, org?.planOriginal, org?.plan].find(p => p && PLANES_CONFIG[p]) ?? 'starter'
}

/** Un número de adicionales válido, o null. */
export function leerCantidad(v) {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 && n <= MAX_ADICIONALES ? n : null
}

/**
 * Todo lo que la pantalla necesita para enseñar y cambiar los adicionales.
 * `null` si la organización no existe.
 */
export async function estadoAdicionales(organizationId, ahora = new Date()) {
  const [org, ultima, pagada, usuarios, rutas] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: selectOrg }),
    ultimaSuscripcion(organizationId),
    ultimoPago(organizationId),
    prisma.user.count({ where: { organizationId, activo: true } }),
    prisma.ruta.count({ where: { organizationId, activo: true } }),
  ])
  if (!org) return null

  const country = org.country ?? 'co'
  const plan = planDelCobro(org, pagada)
  const config = PLANES_CONFIG[plan]
  const pagado = planPagadoVigente(ultima, ahora)
  return {
    org,
    plan,
    admite: admiteAdicionales(plan),
    gateway: getPaymentGateway(country),
    country,
    precios: { cobrador: getPrecioCobradorExtra(country), ruta: getPrecioRutaExtra(country) },
    incluidos: { usuarios: config.maxUsuarios, rutas: config.maxRutas },
    regalados: { cobradores: org.cobradoresExtra ?? 0, rutas: org.rutasExtra ?? 0 },
    adicionales: { cobradores: org.cobradoresAdicionales ?? 0, rutas: org.rutasAdicionales ?? 0 },
    usados: { usuarios, rutas },
    /* El cupo de verdad: con `org.plan`, que en la prueba es el de la prueba. */
    cupo: cuposDe(org, org.plan),
    mensual: adicionalesMensual(org, plan),
    pagado,
    vence: pagado ? ultima.fechaVencimiento : null,
  }
}

/** Lo que se le manda a la pantalla (sin la fila de la organización). */
export function paraPantalla(e) {
  if (!e) return null
  const { org, ...resto } = e
  return resto
}

/**
 * Pone los adicionales del negocio. Sube solo sin plan pagado (se pagan con
 * él); baja siempre, hasta lo que está en uso.
 *
 * @returns {Promise<{ estado: object } | { error: string, status: number, requierePago?: boolean }>}
 */
export async function cambiarAdicionales({ organizationId, cobradores, rutas, ahora = new Date() }) {
  const e = await estadoAdicionales(organizationId, ahora)
  if (!e) return { error: 'Organización no encontrada', status: 404 }
  if (!e.admite) {
    return { error: `Tu plan ${PLANES_CONFIG[e.plan]?.nombre ?? e.plan} no admite cobradores ni rutas adicionales. Crecimiento en adelante sí.`, status: 400 }
  }
  if (e.gateway !== 'wompi') {
    return { error: 'En tu país los adicionales se piden por WhatsApp.', status: 403 }
  }

  const nuevo = {
    cobradores: cobradores ?? e.adicionales.cobradores,
    rutas: rutas ?? e.adicionales.rutas,
  }
  const sube = nuevo.cobradores > e.adicionales.cobradores || nuevo.rutas > e.adicionales.rutas
  if (sube && e.pagado) {
    return { error: 'Tu plan ya está pagado: para agregar, paga los días que faltan para renovar.', status: 409, requierePago: true }
  }

  /* ⚠ NO SE BAJA DEBAJO DE LO QUE ESTÁ EN USO. El cupo congelaría al último
     cobrador o ruta (lib/limites-plan.js), que puede estar cobrando ahora
     mismo en la calle. Primero se desactiva, luego se quita el cupo. */
  const cupo = cuposDe({ ...e.org, cobradoresAdicionales: nuevo.cobradores, rutasAdicionales: nuevo.rutas }, e.org.plan)
  if (nuevo.cobradores < e.adicionales.cobradores && cupo.usuarios < e.usados.usuarios) {
    return { error: `Tienes ${e.usados.usuarios} usuarios activos y quedarías con cupo para ${cupo.usuarios}. Desactiva un cobrador primero.`, status: 409 }
  }
  if (nuevo.rutas < e.adicionales.rutas && cupo.rutas < e.usados.rutas) {
    return { error: `Tienes ${e.usados.rutas} rutas activas y quedarías con cupo para ${cupo.rutas}. Desactiva una ruta primero.`, status: 409 }
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: { cobradoresAdicionales: nuevo.cobradores, rutasAdicionales: nuevo.rutas },
  })
  return { estado: await estadoAdicionales(organizationId, ahora), antes: e.adicionales, despues: nuevo }
}

/**
 * Lo mínimo que puede costar comprar `cuantos`: un día (el prorrateo más corto
 * que arma el checkout), y nunca menos de lo que deja cobrar Wompi.
 */
export function minimoDeLaCompra(cuantos, plan, country = 'co') {
  const mensual = precioAdicionales(cuantos, admiteAdicionales(plan) ? plan : 'growth', country)
  return Math.max(MINIMO_WOMPI, Math.round(mensual / 30 / 100) * 100)
}

/**
 * Aplica una compra de adicionales que Wompi aprobó. Idempotente por el id de
 * la transacción: el libro de pagos no admite dos filas con el mismo.
 *
 * @returns {Promise<{ ok: true, yaProcesado?: boolean } | { ok: false, motivo: string }>}
 */
export async function aplicarCompraAdicionales({ organizationId, plan, adicionales, montoCOP, gatewayId, referencia, country = 'co' }) {
  const cobradores = Math.max(0, Math.floor(adicionales?.cobradores ?? 0))
  const rutas = Math.max(0, Math.floor(adicionales?.rutas ?? 0))
  if (!organizationId || cobradores + rutas <= 0) throw new Error('Compra de adicionales sin cantidad')
  const planLibro = PLANES_VALIDOS.includes(plan) ? plan : 'growth'

  /* ⚠ LO PAGADO TIENE QUE ALCANZAR PARA LO QUE DICE LA REFERENCIA. La firma de
     integridad de Wompi ya ata el monto a la referencia que armamos nosotros;
     esto es la segunda llave: 50 cobradores no se abren con $1.500. Un día de
     lo comprado es lo mínimo que puede salir de nuestro checkout. */
  const minimo = minimoDeLaCompra({ cobradores, rutas }, planLibro, country)
  if (!(Number(montoCOP) >= minimo)) {
    return { ok: false, motivo: `Pagó $${Number(montoCOP).toLocaleString('es-CO')} y ${cobradores} cobradores + ${rutas} rutas cuestan como mínimo $${minimo.toLocaleString('es-CO')} (un día)` }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      /* El apunte primero: si ya estaba (un reintento del webhook), no se suma
         otra vez. `registrarPagoSuscripcion` devuelve null en ese caso. */
      const apunte = await registrarPagoSuscripcion(tx, {
        organizationId,
        plan: planLibro,
        montoCOP,
        periodo: 'adicionales',
        gateway: 'wompi',
        gatewayId: String(gatewayId),
        referencia,
      })
      if (!apunte) return { ok: true, yaProcesado: true }

      await tx.organization.update({
        where: { id: organizationId },
        data: {
          cobradoresAdicionales: { increment: cobradores },
          rutasAdicionales: { increment: rutas },
        },
      })

      const owner = await tx.user.findFirst({
        where: { organizationId, rol: 'owner' },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      })
      if (owner) {
        const que = [
          cobradores > 0 && `${cobradores} ${cobradores === 1 ? 'cobrador' : 'cobradores'}`,
          rutas > 0 && `${rutas} ${rutas === 1 ? 'ruta' : 'rutas'}`,
        ].filter(Boolean).join(' y ')
        await tx.actividadLog.create({
          data: {
            organizationId,
            userId: owner.id,
            accion: 'adicionales_comprados',
            entidadTipo: 'organizacion',
            entidadId: organizationId,
            detalle: `Compró ${que} adicional${cobradores + rutas === 1 ? '' : 'es'} por $${Number(montoCOP).toLocaleString('es-CO')} (Wompi ${gatewayId})`,
          },
        })
      }
      return { ok: true }
    })
  } catch (err) {
    /* Dos webhooks del mismo pago a la vez: el segundo choca con el id único
       del libro. Ya lo aplicó el primero. */
    if (err?.code === 'P2002') return { ok: true, yaProcesado: true }
    throw err
  }
}
