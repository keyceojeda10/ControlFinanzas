// app/api/caja/procedencia/route.js
//
// DE DONDE SALE UNA CIFRA DE LA CAJA.
//
// Devuelve la explicacion (pregunta, universo, como se calcula) Y LAS FILAS que
// la componen: los pagos, prestamos, gastos o movimientos concretos. Es lo que
// permite bajar desde «entraron $406.000» hasta «este pago de $4.000 de Olga
// Lucia a las 11:23».
//
//   GET /api/caja/procedencia?cifra=recaudo&fecha=2026-08-01
//   GET /api/caja/procedencia?cifra=gastos&fecha=2026-08-01&cobradorId=xxx
//
// El alcance es el mismo que usa la caja: sin `cobradorId` es toda la
// organizacion; con el, sus rutas Y lo que registro el. Que la explicacion y la
// cifra usen alcances distintos seria volver al problema.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { explicar } from '@/lib/dinero/procedencia'
import { afectaCaja, esIngreso } from '@/lib/dinero/conciliacion'
import { getLocalDateStr, getLocalDayRange } from '@/lib/i18n'

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/
const TOPE = 300

const plata = (n) => Math.round(Number(n) || 0)

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  const { organizationId, rol, id: userId, country = 'co' } = session.user

  const { searchParams } = new URL(request.url)
  const cifra = searchParams.get('cifra')
  const fechaParam = searchParams.get('fecha')
  const fecha = FECHA_REGEX.test(fechaParam || '') ? fechaParam : getLocalDateStr(country)

  const explicacion = explicar(cifra)
  if (!explicacion) {
    return Response.json({ error: 'No sé de dónde sale esa cifra' }, { status: 404 })
  }

  // Un cobrador solo puede preguntar por lo suyo, diga lo que diga el parámetro.
  const cobradorId = rol === 'cobrador' ? userId : (searchParams.get('cobradorId') || null)
  const { inicio, fin } = getLocalDayRange(fecha, country)

  const rutaIds = cobradorId
    ? (await prisma.ruta.findMany({
      where: { organizationId, cobradorId, activo: true }, select: { id: true },
    })).map((r) => r.id)
    : []

  // Lo que el cobrador entiende por «lo mío» son sus rutas, no solo lo que
  // registró él: el dueño también cobra en sus rutas.
  const suyo = cobradorId
    ? { OR: [{ cobradorId }, ...(rutaIds.length ? [{ prestamo: { cliente: { rutaId: { in: rutaIds } } } }] : [])] }
    : {}

  let filas = []
  let total = 0

  switch (explicacion.filas) {
    case 'pagos': {
      const soloRecargos = cifra === 'recargos'
      const pagos = await prisma.pago.findMany({
        where: {
          organizationId,
          fechaPago: { gte: inicio, lt: fin },
          ...(soloRecargos ? { tipo: 'recargo' } : { tipo: { notIn: ['recargo', 'descuento'] } }),
          ...(cifra === 'recaudoDigital' ? { metodoPago: 'transferencia' } : {}),
          ...(cifra === 'recaudoEfectivo' ? { NOT: { metodoPago: 'transferencia' } } : {}),
          prestamo: { estado: { not: 'cancelado' } },
          ...suyo,
        },
        select: {
          id: true, montoPagado: true, fechaPago: true, tipo: true, metodoPago: true,
          prestamo: { select: { id: true, cliente: { select: { nombre: true } } } },
          cobrador: { select: { nombre: true } },
        },
        orderBy: { fechaPago: 'desc' },
        take: TOPE,
      })
      filas = pagos.map((p) => ({
        id: p.id,
        titulo: p.prestamo?.cliente?.nombre || 'Cliente',
        detalle: [
          p.metodoPago === 'transferencia' ? 'transferencia' : 'efectivo',
          p.cobrador?.nombre,
        ].filter(Boolean).join(' · '),
        monto: plata(p.montoPagado),
        cuando: p.fechaPago,
        ir: p.prestamo?.id ? `/prestamos/${p.prestamo.id}` : null,
      }))
      break
    }

    case 'prestamos': {
      const soloRenovaciones = cifra === 'renovaciones'
      const soloNuevos = cifra === 'prestamosNuevos'
      const soloSeguro = cifra === 'seguros'
      const prestamos = await prisma.prestamo.findMany({
        where: {
          organizationId,
          createdAt: { gte: inicio, lt: fin },
          estado: { not: 'cancelado' },
          ...(soloRenovaciones ? { NOT: { renovadoDeId: null } } : {}),
          ...(soloNuevos ? { renovadoDeId: null } : {}),
          ...(soloSeguro ? { seguro: true } : {}),
          ...(rutaIds.length ? { cliente: { rutaId: { in: rutaIds } } } : {}),
        },
        select: {
          id: true, montoPrestado: true, montoSeguro: true, renovadoDeId: true,
          createdAt: true, cliente: { select: { nombre: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: TOPE,
      })

      // El EFECTIVO que de verdad salio. En una renovacion el libro asienta solo
      // la diferencia entregada: el saldo viejo que se absorbe nunca salio.
      const movs = await prisma.movimientoCapital.findMany({
        where: {
          organizationId, tipo: 'desembolso', referenciaTipo: 'prestamo',
          referenciaId: { in: prestamos.map((p) => p.id) },
        },
        select: { referenciaId: true, monto: true },
      })
      const entregado = new Map(movs.map((m) => [m.referenciaId, plata(m.monto)]))

      filas = prestamos.map((p) => {
        const efectivo = entregado.has(p.id)
          ? entregado.get(p.id)
          : (p.renovadoDeId ? 0 : plata(p.montoPrestado))
        return {
          id: p.id,
          titulo: p.cliente?.nombre || 'Cliente',
          detalle: soloSeguro
            ? 'seguro del préstamo'
            : p.renovadoDeId
              ? `renovación · valor ${plata(p.montoPrestado).toLocaleString('es-CO')}`
              : 'préstamo nuevo',
          monto: soloSeguro ? plata(p.montoSeguro) : efectivo,
          cuando: p.createdAt,
          ir: `/prestamos/${p.id}`,
        }
      })
      break
    }

    case 'gastos': {
      const gastos = await prisma.gastoMenor.findMany({
        where: {
          organizationId,
          fecha: { gte: inicio, lt: fin },
          estado: { in: ['pendiente', 'aprobado'] },
          ...(cobradorId ? { cobradorId } : {}),
        },
        select: {
          id: true, description: true, monto: true, fecha: true, estado: true,
          cobrador: { select: { nombre: true } },
        },
        orderBy: { fecha: 'desc' },
        take: TOPE,
      })
      filas = gastos.map((g) => ({
        id: g.id,
        // La descripcion YA existe en la base y no se enseñaba: solo el total.
        titulo: g.description || 'Gasto sin describir',
        detalle: [g.cobrador?.nombre, g.estado === 'pendiente' ? 'sin aprobar' : null]
          .filter(Boolean).join(' · '),
        monto: plata(g.monto),
        cuando: g.fecha,
        ir: null,
      }))
      break
    }

    case 'movimientos': {
      const tipos = cifra === 'inyecciones' ? ['inyeccion', 'capital_inicial']
        : cifra === 'retiros' ? ['retiro'] : ['ajuste']
      const movs = await prisma.movimientoCapital.findMany({
        where: {
          organizationId,
          createdAt: { gte: inicio, lt: fin },
          tipo: { in: tipos },
          ...(rutaIds.length ? { rutaId: { in: rutaIds } } : {}),
        },
        select: {
          id: true, monto: true, descripcion: true, createdAt: true,
          saldoAnterior: true, saldoNuevo: true,
        },
        orderBy: { createdAt: 'desc' },
        take: TOPE,
      })
      filas = movs.filter(afectaCaja).map((m) => ({
        id: m.id,
        titulo: m.descripcion || 'Movimiento sin motivo',
        detalle: esIngreso(m) ? 'entró' : 'salió',
        monto: plata(m.monto),
        cuando: m.createdAt,
        ir: null,
      }))
      break
    }

    default:
      // Las cifras derivadas (apertura, en mano) no tienen filas propias: se
      // explican con su fórmula, que ya viaja en `explicacion`.
      filas = []
  }

  total = filas.reduce((a, f) => a + f.monto, 0)

  return Response.json({
    cifra,
    fecha,
    explicacion: {
      rotulo: explicacion.rotulo,
      pregunta: explicacion.pregunta,
      universo: explicacion.universo,
      formula: explicacion.formula,
    },
    filas,
    cantidad: filas.length,
    total,
    // Si se llego al tope, se DICE. Un listado truncado en silencio es
    // exactamente el fallo que tenia la caja con su `take: 400`.
    truncado: filas.length >= TOPE,
  })
}
