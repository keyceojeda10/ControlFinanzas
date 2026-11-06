// lib/tarjeta/datos.js — LO QUE VE EL CLIENTE EN SU TARJETA.
//
// ⚠ LAS CIFRAS SON LAS DE LA FICHA DEL PRÉSTAMO, de las mismas funciones y con el
// mismo `include` que `GET /api/prestamos/[id]`. El portal viejo resta
// `totalAPagar - totalPagado` por su cuenta, y eso no es lo que debe un préstamo
// con tabla ni uno abierto. Si la tarjeta dice una cifra y el cobrador otra, el
// cliente deja de creerle a las dos.
//
// ⚠ NO SALEN: cédula, dirección, teléfono, tasa, interés ni monto prestado. El
// enlace se puede reenviar: lleva lo que el cliente necesita y nada más.
//
// ⚠ EL MORATORIO CALCULADO TAMPOCO. `calcularInteresMoratorio` es lo que se le
// ofrece al dueño aplicar, no una deuda. Si lo aplica entra como recargo: sube el
// saldo y sale en la lista con su nombre.

import { prisma } from '@/lib/prisma'
import {
  calcularSaldoPendiente, calcularPorcentajePagado, calcularDiasMora,
  calcularCuotaQueToca, calcularProximoCobro,
} from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import { pagosEnOrden } from '@/lib/dinero/orden-de-pagos'
import { getUtcOffset } from '@/lib/i18n'
import { numerosDeClientes, camposDeNumero } from '@/lib/prestamos/numero'
import { tituloDelTipoDePago } from '@/lib/recibo-derivados'
import { tokenValido } from '@/lib/tarjeta/enlace'

/** Lo que leen los cálculos de la ficha. Pedir de menos no da error: decide mal en silencio. */
export const INCLUDE_TARJETA = {
  pagos: {
    orderBy: { fechaPago: 'desc' },
    include: {
      cobrador: { select: { nombre: true, rol: true } },
      metodoPagoRef: { select: { nombre: true } },
    },
  },
  cuotasAmortizacion: { orderBy: { numeroPeriodo: 'asc' } },
  devengos: { select: { periodo: true, interes: true, capitalBase: true }, orderBy: { periodo: 'asc' } },
}

/** «01 ROSWYN SÁNCHEZ» → «Roswyn». La ruta numera a la gente en el propio nombre. */
export function primerNombre(nombre) {
  const palabra = String(nombre ?? '').trim().replace(/^[^\p{L}]+/u, '').split(/\s+/)[0] ?? ''
  if (!palabra) return ''
  return palabra[0].toLocaleUpperCase('es') + palabra.slice(1).toLocaleLowerCase('es')
}

const SIN_TOTAL = ['recargo', 'descuento']
const SIGNO = { recargo: '+', descuento: '-' }

function medioDelPago(p) {
  if (p.metodoPagoRef?.nombre) return p.metodoPagoRef.nombre
  if (p.metodoPago === 'efectivo') return 'Efectivo'
  if (p.metodoPago === 'transferencia') return p.plataforma || 'Transferencia'
  return null
}

/** Un préstamo, en las cuentas de la tarjeta. Pura: se prueba sin base. */
export function armarPrestamo(crudo, { diasExcluidos = [], festivos = [], ocultarSaldo = false, country = 'co', referencia = null } = {}) {
  // En el mismo orden que la ficha ANTES de calcular: ella también los ordena primero.
  const pagos = pagosEnOrden(crudo.pagos ?? [], { reciente: true, offsetHoras: getUtcOffset(country) })
  const p = { ...crudo, pagos }
  const activo = p.estado === 'activo'
  const cuota = activo ? Math.round(calcularCuotaQueToca(p, diasExcluidos, festivos) || 0) : 0
  const proximo = activo ? calcularProximoCobro(p, diasExcluidos, festivos) : null

  return {
    id: p.id,
    referencia,
    pagado: !activo,
    // Sin saldo ni barra si el dueño esconde el saldo: el ajuste no se contradice.
    saldo: ocultarSaldo ? null : calcularSaldoPendiente(p),
    porcentaje: ocultarSaldo ? null : calcularPorcentajePagado(p),
    yaPagado: pagos.filter((x) => !SIN_TOTAL.includes(x.tipo)).reduce((s, x) => s + x.montoPagado, 0),
    diasMora: activo ? calcularDiasMora(p, diasExcluidos, festivos) : 0,
    proxima: cuota > 0 || proximo ? { monto: cuota, fecha: proximo ? new Date(proximo).toISOString() : null } : null,
    pagos: pagos.map((x) => ({
      id: x.id,
      fecha: new Date(x.fechaPago).toISOString(),
      titulo: tituloDelTipoDePago(x.tipo),
      monto: x.montoPagado,
      signo: SIGNO[x.tipo] ?? null,
      medio: medioDelPago(x),
      // Solo el cobrador: el dueño va como el negocio, sin su nombre personal.
      recibio: x.cobrador?.rol === 'cobrador' ? primerNombre(x.cobrador.nombre) : null,
    })),
  }
}

/**
 * La tarjeta de un enlace, o `null` si no debe abrirse: enlace que no existe,
 * negocio inactivo o dueño que dejó de mandarla. Las tres responden igual: quien
 * prueba enlaces no se entera de cuál existe.
 */
export async function tarjetaPorToken(token) {
  if (!tokenValido(token)) return null
  const cliente = await prisma.cliente.findUnique({
    where: { tarjetaToken: token },
    select: {
      id: true, nombre: true, organizationId: true, diasSinCobro: true,
      ruta: { select: { diasSinCobro: true } },
      organization: {
        select: { nombre: true, activo: true, reciboCliente: true, ocultarSaldoWA: true, country: true, timezone: true, diasSinCobro: true },
      },
    },
  })
  const org = cliente?.organization
  if (!org?.activo || org.reciboCliente !== 'tarjeta') return null

  const where = { organizationId: cliente.organizationId, clienteId: cliente.id }
  let prestamos = await prisma.prestamo.findMany({
    where: { ...where, estado: 'activo' }, include: INCLUDE_TARJETA, orderBy: { fechaInicio: 'desc' },
  })
  // Sin nada vivo, el último que terminó: quien acaba de pagar la última cuota ve «Pagado».
  if (prestamos.length === 0) {
    prestamos = await prisma.prestamo.findMany({
      where: { ...where, estado: 'completado' }, include: INCLUDE_TARJETA, orderBy: { ultimoPagoAt: 'desc' }, take: 1,
    })
  }

  const [festivos, numeros] = await Promise.all([
    prisma.festivo.findMany({ where: { organizationId: cliente.organizationId }, select: { fecha: true } }),
    numerosDeClientes(prisma, { organizationId: cliente.organizationId, clienteIds: [cliente.id] }),
  ])
  const varios = prestamos.length > 1

  return {
    clienteId: cliente.id,
    organizationId: cliente.organizationId,
    negocio: org.nombre,
    country: org.country ?? 'co',
    timezone: org.timezone ?? null,
    nombre: primerNombre(cliente.nombre),
    ocultarSaldo: org.ocultarSaldoWA,
    prestamos: prestamos.map((p) => armarPrestamo(p, {
      diasExcluidos: obtenerDiasSinCobro(cliente, cliente.ruta, org, p),
      festivos,
      ocultarSaldo: org.ocultarSaldoWA,
      country: org.country ?? 'co',
      // Sin la plata del crédito: el monto prestado no sale en la tarjeta.
      referencia: varios ? `Crédito #${camposDeNumero(numeros, p.id).numeroCliente ?? ''}`.trim() : null,
    })),
  }
}

/* Los que arman la vista previa del chat no son el cliente abriéndola. */
const ROBOT_VISTA_PREVIA = /whatsapp|facebookexternalhit|facebot|telegrambot|bot\b|crawler|spider/i
const UNA_HORA = 60 * 60 * 1000

export const esRobotDeVistaPrevia = (agente) => ROBOT_VISTA_PREVIA.test(String(agente ?? ''))

/** Para saber si se usa. Sin esperar y sin fallar: el cliente no se queda sin tarjeta por esto. */
export function apuntarVista(clienteId, agente, ahora = Date.now()) {
  if (esRobotDeVistaPrevia(agente)) return
  prisma.cliente.updateMany({
    where: { id: clienteId, OR: [{ tarjetaVistaAt: null }, { tarjetaVistaAt: { lt: new Date(ahora - UNA_HORA) } }] },
    data: { tarjetaVistaAt: new Date(ahora) },
  }).catch(() => {})
}

/** Datos inventados: el dueño la ve antes de activarla, sin exponer a nadie. */
export function tarjetaDeEjemplo(negocio = 'Tu negocio', country = 'co') {
  const dia = (n) => new Date(Date.now() - n * 86400000).toISOString()
  const pago = (id, n, medio, recibio) => ({ id, fecha: dia(n), titulo: tituloDelTipoDePago('completo'), monto: 20000, signo: null, medio, recibio })
  return {
    ejemplo: true, negocio, country, nombre: 'Pedro', ocultarSaldo: false,
    prestamos: [{
      id: 'ejemplo', referencia: null, pagado: false, saldo: 180000, porcentaje: 25, yaPagado: 60000, diasMora: 0,
      proxima: { monto: 20000, fecha: new Date(Date.now() + 86400000).toISOString() },
      pagos: [pago('a', 0, 'Efectivo', 'Diego'), pago('b', 1, 'Nequi', 'Diego'), pago('c', 2, 'Efectivo', 'Diego')],
    }],
  }
}
