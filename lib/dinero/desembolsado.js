// lib/dinero/desembolsado.js — cuánto EFECTIVO salió de la caja de un cobrador
// en un día.
//
// ⚠ VIVE AQUÍ PORQUE ESTABA DUPLICADA Y ESO COSTÓ $425 MILLONES.
//
// Había dos copias con el mismo nombre y los argumentos EN ORDEN DISTINTO
// —`(org, inicio, fin, cobrador)` en `caja/route.js` y
// `(org, cobrador, inicio, fin)` en `cierre-auto/route.js`—, cada una privada de
// su archivo. Cuando apareció un tercer sitio que crea cierres —`caja/cuadre`,
// el que usa el admin al recibir el efectivo— no pudo importar ninguna, y
// simplemente NO escribió el campo: Prisma lo dejó en su `@default(0)`.
//
// Resultado medido en producción: 2.485 de 2.852 cierres (87%) con el
// desembolso en cero, y $425.397.087 prestados en 60 días que ningún cierre
// registró. La caja restaba lo cobrado contra lo esperado sin descontar nunca
// lo que el cobrador había prestado ese día.
//
// Una sola definición, importada por los tres. Si mañana aparece un cuarto
// sitio que cierre cajas, tiene de dónde tomarla.
import { prisma } from '@/lib/prisma'

/* Cuánto salió de la caja por un préstamo que NO tiene movimiento de capital.
   En uno nuevo el efectivo entregado ES el monto. En una RENOVACIÓN el monto
   incluye el saldo viejo absorbido, que nunca salió de la caja: contarlo entero
   inflaba la salida (renovar 160k por 160k mostraba −160.000 sin que saliera un
   peso). Lo usan LAS DOS ramas, y por eso vive aquí arriba y no dentro de una.

   ⚠ EN LA RENOVACIÓN NO SE SUPONE CERO: SE RESTA LA DEUDA DEL VIEJO.
   Suponer cero se pasa al otro lado. Medido en producción: de 548 renovaciones
   en 30 días solo 7 no tienen movimiento (el 1%), pero LAS SIETE renuevan un
   préstamo que ya estaba saldado —deuda 0—, así que se entregó el monto entero.
   Contarlas como cero le quitaba a la caja $28.900.000 que sí salieron.

   ⚠ `renovadoDeId` es un campo suelto, NO una relación de Prisma: no se puede
   pedir con un `include`. El préstamo viejo se busca aparte y se pasa aquí en
   `deudaPorPrestamoViejo`. Si no está, se cae del lado prudente (0), que es el
   error que ya había y no uno nuevo. */
const montoEntregadoSinMovimiento = (p, deudaPorPrestamoViejo) => {
  if (!p.renovadoDeId) return p.montoPrestado
  const deuda = deudaPorPrestamoViejo?.get(p.renovadoDeId)
  if (deuda == null) return 0
  return Math.max(0, p.montoPrestado - deuda)
}

/* La deuda que le quedaba a cada préstamo del que se renovó. Solo hace falta
   para las renovaciones sin movimiento de capital, que son el 1%. */
async function deudasDeLosViejos(prestamos) {
  const ids = [...new Set(prestamos.filter((p) => p.renovadoDeId).map((p) => p.renovadoDeId))]
  if (!ids.length) return new Map()
  const viejos = await prisma.prestamo.findMany({
    where: { id: { in: ids } },
    select: { id: true, totalAPagar: true, totalPagado: true },
  })
  return new Map(viejos.map((v) => [
    v.id, Math.max(0, Number(v.totalAPagar || 0) - Number(v.totalPagado || 0)),
  ]))
}

/**
 * @param {string} organizationId
 * @param {Date} inicio  arranque del día local (ver getLocalDayRange)
 * @param {Date} fin     fin del día local, exclusivo
 * @param {string|null} cobradorId  null = toda la organización
 * @returns {Promise<number>} efectivo que salió de la caja, sin redondear
 */
export async function calcularDesembolsadoDia(organizationId, inicio, fin, cobradorId = null) {
  const baseWherePrestamos = {
    organizationId,
    createdAt: { gte: inicio, lt: fin },
    estado: { not: 'cancelado' },
  }

  // ── VISTA GLOBAL (el dueño, sin filtrar por cobrador) ─────────────────────
  //
  // ⚠ ESTA RAMA SUMABA `montoPrestado` A SECAS, y por eso la caja del dueño
  // salía inflada en cada renovación.
  //
  // Renovar es prestar de nuevo a quien todavía debe: se le hace una cartulina
  // por el monto entero pero solo se le entrega la diferencia, porque lo que
  // debía se absorbe. De la caja sale la diferencia, no la cartulina.
  //
  // Reportado por el dueño de PRESTA MIL con un caso al peso: «lo que prestó
  // debería ser $142.000, pero está mostrando $150.000, porque no resta los
  // $8.000, los está sumando lo que debía el cliente». Medido ese mismo día en
  // su organización: cartulinas $1.650.000 contra $870.000 de efectivo real —
  // $780.000 de más en un solo día, en 7 renovaciones.
  //
  // La rama de abajo (por cobrador) YA lo hacía bien: manda el movimiento de
  // capital, que guarda lo que de verdad salió. Aquí se aplica el mismo
  // criterio para que las dos vistas digan lo mismo.
  //
  // Para el VALOR de las cartulinas —que el dueño también quiere ver, «para yo
  // saber cuánto presta el cobrador en el día»— está `valorPrestadoDia`, que se
  // calcula aparte y no se toca.
  if (!cobradorId) {
    const prestamosDia = await prisma.prestamo.findMany({
      where: baseWherePrestamos,
      select: { id: true, montoPrestado: true, renovadoDeId: true },
    })
    if (!prestamosDia.length) return 0

    const movimientos = await prisma.movimientoCapital.findMany({
      where: {
        organizationId,
        tipo: 'desembolso',
        referenciaTipo: 'prestamo',
        referenciaId: { in: prestamosDia.map((p) => p.id) },
      },
      select: { referenciaId: true, monto: true, createdAt: true },
    })
    // El más reciente manda, por si el préstamo se editó después.
    const realPorPrestamo = new Map()
    for (const m of movimientos) {
      if (!m.referenciaId) continue
      const prev = realPorPrestamo.get(m.referenciaId)
      if (!prev || m.createdAt > prev.createdAt) realPorPrestamo.set(m.referenciaId, m)
    }

    // Solo se consultan los viejos si hay alguna renovación sin movimiento.
    const faltan = prestamosDia.filter((p) => p.renovadoDeId && !realPorPrestamo.has(p.id))
    const deudas = faltan.length ? await deudasDeLosViejos(faltan) : null

    return prestamosDia.reduce((suma, p) => {
      const mov = realPorPrestamo.get(p.id)
      return suma + (mov ? mov.monto : montoEntregadoSinMovimiento(p, deudas))
    }, 0)
  }

  // Vista por cobrador: combinar (a) clientes de su ruta y (b) préstamos creados por su perfil.
  // Para renovaciones, el MovimientoCapital tiene el monto real entregado en mano
  // (no el montoPrestado completo), así que se prioriza el monto del movimiento.
  // Buscar rutas del cobrador para incluir movimientos hechos por el owner en sus rutas
  const rutasCobrador = await prisma.ruta.findMany({
    where: { cobradorId, organizationId, activo: true },
    select: { id: true },
  })
  const rutaIds = rutasCobrador.map(r => r.id)

  const [prestamosRuta, movimientosDesembolso, actividadesCreador] = await Promise.all([
    prisma.prestamo.findMany({
      where: {
        ...baseWherePrestamos,
        cliente: { ruta: { cobradorId } },
      },
      select: { id: true, montoPrestado: true, renovadoDeId: true },
    }),
    // Movimientos de desembolso: por el cobrador O en sus rutas (incluye los del owner)
    prisma.movimientoCapital.findMany({
      where: {
        organizationId,
        tipo: 'desembolso',
        createdAt: { gte: inicio, lt: fin },
        referenciaTipo: 'prestamo',
        OR: [
          { creadoPorId: cobradorId },
          ...(rutaIds.length > 0 ? [{ rutaId: { in: rutaIds } }] : []),
        ],
      },
      select: { referenciaId: true, monto: true, createdAt: true },
    }),
    prisma.actividadLog.findMany({
      where: {
        organizationId,
        userId: cobradorId,
        accion: 'crear_prestamo',
        createdAt: { gte: inicio, lt: fin },
      },
      select: { entidadId: true },
    }),
  ])

  // Mapa de préstamo → monto real del movimiento (el más reciente gana si hubo edición)
  const montoRealPorPrestamo = new Map()
  for (const m of movimientosDesembolso) {
    if (!m.referenciaId) continue
    const prev = montoRealPorPrestamo.get(m.referenciaId)
    if (!prev || m.createdAt > prev.createdAt) {
      montoRealPorPrestamo.set(m.referenciaId, { monto: m.monto, createdAt: m.createdAt })
    }
  }

  const prestamoIdsActividad = actividadesCreador
    .map((a) => a.entidadId)
    .filter((id) => !!id)

  const prestamosActividad = prestamoIdsActividad.length
    ? await prisma.prestamo.findMany({
      where: {
        organizationId,
        id: { in: prestamoIdsActividad },
        createdAt: { gte: inicio, lt: fin },
        estado: { not: 'cancelado' },
      },
      select: { id: true, montoPrestado: true, renovadoDeId: true },
    })
    : []

  const idsContabilizados = new Set()
  let total = 0

  // El fallback es el mismo de la rama global: `montoEntregadoSinMovimiento`,
  // arriba del todo. Estaba escrito dos veces y una de las dos se quedó atrás.
  const sinMovimiento = [...prestamosRuta, ...prestamosActividad]
    .filter((p) => p.renovadoDeId && !montoRealPorPrestamo.has(p.id))
  const deudas = sinMovimiento.length ? await deudasDeLosViejos(sinMovimiento) : null

  // Préstamos de la ruta: usar monto del movimiento si existe (correcto en renovaciones)
  for (const p of prestamosRuta) {
    if (idsContabilizados.has(p.id)) continue
    idsContabilizados.add(p.id)
    const mov = montoRealPorPrestamo.get(p.id)
    total += mov ? mov.monto : montoEntregadoSinMovimiento(p, deudas)
  }

  // Préstamos creados por el cobrador fuera de su ruta
  for (const p of prestamosActividad) {
    if (idsContabilizados.has(p.id)) continue
    idsContabilizados.add(p.id)
    const mov = montoRealPorPrestamo.get(p.id)
    total += mov ? mov.monto : montoEntregadoSinMovimiento(p, deudas)
  }

  // Movimientos del cobrador sin préstamo en ruta/actividad
  for (const mov of movimientosDesembolso) {
    if (!mov.referenciaId || idsContabilizados.has(mov.referenciaId)) continue
    idsContabilizados.add(mov.referenciaId)
    const real = montoRealPorPrestamo.get(mov.referenciaId)
    total += real ? real.monto : mov.monto
  }

  return total
}

/**
 * Lo mismo pero de TODA la historia de la organización: cuánto efectivo ha
 * salido en préstamos desde el principio.
 *
 * Lo usa el «saldo sugerido» de capital, que reconstruye el saldo con
 * `base + cobrado − prestado − gastos` para contrastarlo con el del ledger y
 * avisar de descuadres.
 *
 * ⚠ ANTES RESTABA `SUM(montoPrestado)`, o sea las cartulinas. En cada
 * renovación eso resta plata que nunca salió, así que el detector de descuadres
 * era el que descuadraba: medido en producción, $180.770.300 de más en todo el
 * sistema sobre 825 renovaciones ($67.485.057 solo en PRESTA MIL).
 *
 * @param {string} organizationId
 * @returns {Promise<number>} efectivo prestado en toda la historia
 */
export async function calcularDesembolsadoHistorico(organizationId) {
  const prestamos = await prisma.prestamo.findMany({
    where: { organizationId, estado: { not: 'cancelado' } },
    select: { id: true, montoPrestado: true, renovadoDeId: true },
  })
  if (!prestamos.length) return 0

  // Solo las renovaciones necesitan comprobación: un préstamo normal entregó su
  // monto y no hace falta ir a buscar su movimiento.
  const renovaciones = prestamos.filter((p) => p.renovadoDeId)
  if (!renovaciones.length) {
    return prestamos.reduce((s, p) => s + p.montoPrestado, 0)
  }

  const movimientos = await prisma.movimientoCapital.findMany({
    where: {
      organizationId,
      tipo: 'desembolso',
      referenciaTipo: 'prestamo',
      referenciaId: { in: renovaciones.map((p) => p.id) },
    },
    select: { referenciaId: true, monto: true, createdAt: true },
  })
  const realPorPrestamo = new Map()
  for (const m of movimientos) {
    if (!m.referenciaId) continue
    const prev = realPorPrestamo.get(m.referenciaId)
    if (!prev || m.createdAt > prev.createdAt) realPorPrestamo.set(m.referenciaId, m)
  }

  const faltan = renovaciones.filter((p) => !realPorPrestamo.has(p.id))
  const deudas = faltan.length ? await deudasDeLosViejos(faltan) : null

  return prestamos.reduce((suma, p) => {
    if (!p.renovadoDeId) return suma + p.montoPrestado
    const mov = realPorPrestamo.get(p.id)
    return suma + (mov ? mov.monto : montoEntregadoSinMovimiento(p, deudas))
  }, 0)
}
