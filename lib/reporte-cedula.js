// lib/reporte-cedula.js — LA CONSULTA DETRÁS DEL REPORTE DE UNA CÉDULA.
//
// La regla que convierte esto en «Alto riesgo / Riesgo medio…» vive en
// `lib/reporte-cliente.js` (JS puro, con pruebas). Aquí solo se lee.
//
// ⚠ LA MORA SE CALCULA COMO EN LA FICHA: préstamo completo, con devengos,
// cuotas y pagos, y los días sin cobro resueltos por préstamo. Con menos
// campos un préstamo abierto se lee vencido entero (27 oct 2026) y un campo
// que no se pide vale `undefined` sin avisar.
//
// ⚠ DE OTROS NEGOCIOS SOLO SALEN CONTEOS. Ni el nombre del negocio, ni montos,
// ni quién prestó: es lo que prometen los términos de uso.

import { prisma } from '@/lib/prisma'
import { calcularDiasMora } from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import { calificacionDe } from '@/lib/calificacion'
import { historialDeUnCliente } from '@/lib/historial-cliente'
import { cuentaComoAtraso } from '@/lib/reporte-cliente'

/* Lo que pide la ficha para calcular la mora (app/api/clientes/[id]). */
const PARA_LA_MORA = {
  devengos: { select: { periodo: true, interes: true } },
  cuotasAmortizacion: {
    orderBy: { numeroPeriodo: 'asc' },
    select: { numeroPeriodo: true, capital: true, interes: true, cuotaTotal: true, saldoRestante: true, pagado: true, interesPagado: true, fechaEsperada: true },
  },
  pagos: { select: { montoPagado: true, fechaPago: true, tipo: true } },
}

const sinCedula = (c) => !c || String(c).trim().length < 5 || String(c).trim().startsWith('SIN-')

function diasDeMora(p, cliente, ruta, org, festivos) {
  try {
    return calcularDiasMora(p, obtenerDiasSinCobro(cliente, ruta, org, p), festivos)
  } catch {
    return 0
  }
}

/** Lo de este negocio: la estrella, los clavos abiertos y el atraso de hoy. */
async function lodePropio(cliente, organizationId) {
  const [org, festivos, historial, activos] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { diasSinCobro: true } }),
    prisma.festivo.findMany({ where: { organizationId }, select: { fecha: true } }),
    historialDeUnCliente(cliente.id),
    prisma.prestamo.findMany({ where: { clienteId: cliente.id, estado: 'activo' }, include: PARA_LA_MORA }),
  ])

  let clavosAbiertos = 0
  let peorAtrasoHoy = 0
  for (const p of activos) {
    if (p.esClavo) { clavosAbiertos++; continue }
    peorAtrasoHoy = Math.max(peorAtrasoHoy, diasDeMora(p, cliente, cliente.ruta, org, festivos))
  }

  return {
    clienteId: cliente.id,
    nombre: cliente.nombre,
    ruta: cliente.ruta?.nombre ?? null,
    rutaId: cliente.rutaId ?? null,
    eliminado: cliente.estado === 'eliminado',
    calificacion: calificacionDe({ ...historial, manual: cliente.calificacionManual }),
    calificacionPor: cliente.calificacionPor?.nombre ?? null,
    clavosAbiertos,
    activos: activos.length,
    peorAtrasoHoy,
  }
}

/** Lo de los demás negocios, en conteos. */
async function lodeOtros(cedula, organizationId) {
  const clientes = await prisma.cliente.findMany({
    where: { cedula, organizationId: { not: organizationId } },
    select: {
      organizationId: true,
      diasSinCobro: true,
      ruta: { select: { diasSinCobro: true } },
      prestamos: {
        where: { estado: { in: ['activo', 'completado', 'cancelado'] } },
        include: PARA_LA_MORA,
      },
    },
  })
  const vacio = { negocios: 0, pagados: 0, alDia: 0, atrasados: 0, peorAtrasoHoy: 0, clavos: 0 }
  if (!clientes.length) return vacio

  const ids = [...new Set(clientes.map((c) => c.organizationId))]
  const [orgs, festivos] = await Promise.all([
    prisma.organization.findMany({ where: { id: { in: ids } }, select: { id: true, diasSinCobro: true } }),
    prisma.festivo.findMany({ where: { organizationId: { in: ids } }, select: { organizationId: true, fecha: true } }),
  ])
  const orgDe = new Map(orgs.map((o) => [o.id, o]))
  const festivosDe = new Map()
  for (const f of festivos) {
    if (!festivosDe.has(f.organizationId)) festivosDe.set(f.organizationId, [])
    festivosDe.get(f.organizationId).push(f)
  }

  const r = { ...vacio, negocios: ids.length }
  for (const c of clientes) {
    for (const p of c.prestamos) {
      if (p.esClavo) { r.clavos++; continue }
      if (p.estado === 'completado') { r.pagados++; continue }
      if (p.estado !== 'activo') continue
      const d = diasDeMora(p, c, c.ruta, orgDe.get(c.organizationId), festivosDe.get(c.organizationId) || [])
      if (cuentaComoAtraso(d)) { r.atrasados++; r.peorAtrasoHoy = Math.max(r.peorAtrasoHoy, d) }
      else r.alDia++
    }
  }
  return r
}

/**
 * @param {object} a
 * @param {string} a.organizationId
 * @param {string} [a.cedula]     la que se escribe en «nuevo cliente»
 * @param {string} [a.clienteId]  el elegido en «nuevo préstamo» o la ficha
 * @param {boolean} a.conOtros    si el plan incluye la consulta a otros negocios
 * @returns {Promise<{propio:object|null, otros:object|null, cedula:string|null}>}
 */
export async function datosDelReporte({ organizationId, cedula, clienteId, conOtros }) {
  const select = {
    id: true, nombre: true, cedula: true, estado: true, diasSinCobro: true, rutaId: true,
    calificacionManual: true,
    calificacionPor: { select: { nombre: true } },
    ruta: { select: { nombre: true, diasSinCobro: true } },
  }
  const doc = cedula ? String(cedula).trim() : null
  const cliente = clienteId
    ? await prisma.cliente.findFirst({ where: { id: clienteId, organizationId }, select })
    : !sinCedula(doc)
      ? await prisma.cliente.findUnique({ where: { organizationId_cedula: { organizationId, cedula: doc } }, select })
      : null

  const laCedula = cliente?.cedula ?? doc
  const [propio, otros] = await Promise.all([
    cliente ? lodePropio(cliente, organizationId) : null,
    conOtros && !sinCedula(laCedula) ? lodeOtros(String(laCedula).trim(), organizationId) : null,
  ])
  return { propio, otros, cedula: sinCedula(laCedula) ? null : laCedula }
}
