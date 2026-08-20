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

/* Lo que hace falta de cada préstamo para poder ENSEÑAR la fila, no solo
   sumarla: el nombre del cliente y la hora. Sin el nombre, una lista de cifras
   no explica nada. */
const SELECT_FILA = {
  id: true,
  montoPrestado: true,
  renovadoDeId: true,
  createdAt: true,
  cliente: { select: { nombre: true } },
}

const filaDe = (p, monto, metodoPago = null) => ({
  prestamoId: p.id,
  /* Por dónde salió. Un desembolso por transferencia NO sale del fajo del
     cobrador, así que la caja de su teléfono no puede contarlo como billetes.
     Es el mismo criterio que la tarjeta del administrador ya usaba. */
  metodoPago: metodoPago ?? null,
  cliente: p.cliente?.nombre ?? '',
  // Lo que SALIÓ de la caja. En una renovación no es el monto de la cartulina.
  monto: Math.round(monto || 0),
  // El valor de la cartulina, para poder decir «de $1.000.000, entregó $280.000».
  montoPrestado: Math.round(p.montoPrestado || 0),
  esRenovacion: !!p.renovadoDeId,
  cuando: p.createdAt ?? null,
})

const sumar = (filas) => filas.reduce((s, f) => s + f.monto, 0)
// De mayor a menor: si la cifra no cuadra, el que sobra suele ser de los grandes.
const ordenar = (filas) => [...filas].sort((a, b) => b.monto - a.monto)

/* La deuda que le quedaba a cada préstamo del que se renovó. Solo hace falta
   para las renovaciones sin movimiento de capital, que son el 1%. */
async function deudasDeLosViejos(prestamos) {
  const ids = [...new Set(prestamos.filter((p) => p.renovadoDeId).map((p) => p.renovadoDeId))]
  if (!ids.length) return new Map()
  const viejos = await prisma.prestamo.findMany({
    where: { id: { in: ids } },
    select: { id: true, totalAPagar: true, totalPagado: true, abonadoCapital: true },
  })
  return new Map(viejos.map((v) => [
    v.id, Math.max(0, Number(v.totalAPagar || 0) - Number(v.totalPagado || 0)),
  ]))
}

/**
 * Efectivo que salió de la caja en el día.
 *
 * ⚠ ES LA SUMA DE `detalleDesembolsadoDia`, no un cálculo aparte. Se separaron
 *   un tiempo y ese es el camino conocido a que la pantalla enseñe una cifra y
 *   la lista que la explica no cuadre con ella.
 *
 * @param {string} organizationId
 * @param {Date} inicio  arranque del día local (ver getLocalDayRange)
 * @param {Date} fin     fin del día local, exclusivo
 * @param {string|null} cobradorId  null = toda la organización
 * @returns {Promise<number>} efectivo que salió de la caja, sin redondear
 */
export async function calcularDesembolsadoDia(organizationId, inicio, fin, cobradorId = null) {
  const { total } = await detalleDesembolsadoDia(organizationId, inicio, fin, cobradorId)
  return total
}

/* ══ DE QUÉ SE COMPONE «LO QUE PRESTASTE» ════════════════════════════════════
 *
 * Reportado por el dueño de PRESTA MIL el 14 ago 2026:
 *
 *   «Hice tres renovaciones pero de esas tres una no iba […] la de 600 que me
 *    quedó mal yo la corregí allá en el cliente, sí se corrigió bien, pero acá
 *    en caja quedó sumando 5.600, debería sumar solamente 5.»
 *
 * Reconstruido contra su base: la caja tenía razón. Los $5.600.000 eran OMAR
 * $3.000.000 + TATIANA SERPA $600.000 + FOR. RANGER $2.000.000, y el de Tatiana
 * es real —lo creó por $6.000.000 por error, lo corrigió a $600.000, y las dos
 * correcciones se reflejaron bien en la caja—.
 *
 * Pero él no tenía forma de comprobarlo. Veía un número solo y tuvo que
 * escribir para saber de dónde salía. Esta función devuelve las filas que lo
 * componen, para que la cifra se pueda abrir y contar con el dedo.
 *
 * @returns {Promise<{total:number, filas:Array}>}
 */
export async function detalleDesembolsadoDia(organizationId, inicio, fin, cobradorId = null) {
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
      select: { ...SELECT_FILA },
    })
    if (!prestamosDia.length) return { total: 0, filas: [] }

    const movimientos = await prisma.movimientoCapital.findMany({
      where: {
        organizationId,
        tipo: 'desembolso',
        /* ⚠ LA RESERVA DE RUTA NO ES PLATA ENTREGADA.
           Al asignar clientes a una ruta con capital se asienta un `desembolso`
           con `ajusteArranqueRuta`: mueve la bolsa de la ruta, no la caja
           (`saldoAnterior` y `saldoNuevo` idénticos). Y como aquí «gana el más
           reciente», ese asiento le pisaba al préstamo su desembolso de verdad:
           a Inversiones L&D le decía que entregó $600.000 donde entregó $500.000,
           dos veces, y salían $200.000 «de préstamos que no cuadran».
           Es el mismo fallo que `afectaCaja`, por la otra vía. */
        ajusteArranqueRuta: false,
        referenciaTipo: 'prestamo',
        referenciaId: { in: prestamosDia.map((p) => p.id) },
      },
      select: { referenciaId: true, monto: true, createdAt: true, metodoPago: true },
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

    const filas = prestamosDia.map((p) => {
      const mov = realPorPrestamo.get(p.id)
      return filaDe(p, mov ? mov.monto : montoEntregadoSinMovimiento(p, deudas), mov?.metodoPago)
    })
    return { total: sumar(filas), filas: ordenar(filas) }
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
      select: { ...SELECT_FILA },
    }),
    // Movimientos de desembolso: por el cobrador O en sus rutas (incluye los del owner)
    prisma.movimientoCapital.findMany({
      where: {
        organizationId,
        tipo: 'desembolso',
        /* ⚠ LA RESERVA DE RUTA NO ES PLATA ENTREGADA.
           Al asignar clientes a una ruta con capital se asienta un `desembolso`
           con `ajusteArranqueRuta`: mueve la bolsa de la ruta, no la caja
           (`saldoAnterior` y `saldoNuevo` idénticos). Y como aquí «gana el más
           reciente», ese asiento le pisaba al préstamo su desembolso de verdad:
           a Inversiones L&D le decía que entregó $600.000 donde entregó $500.000,
           dos veces, y salían $200.000 «de préstamos que no cuadran».
           Es el mismo fallo que `afectaCaja`, por la otra vía. */
        ajusteArranqueRuta: false,
        createdAt: { gte: inicio, lt: fin },
        referenciaTipo: 'prestamo',
        OR: [
          { creadoPorId: cobradorId },
          ...(rutaIds.length > 0 ? [{ rutaId: { in: rutaIds } }] : []),
        ],
      },
      select: { referenciaId: true, monto: true, createdAt: true, metodoPago: true },
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
      select: { ...SELECT_FILA },
    })
    : []

  const idsContabilizados = new Set()
  const filas = []

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
    filas.push(filaDe(p, mov ? mov.monto : montoEntregadoSinMovimiento(p, deudas), mov?.metodoPago))
  }

  // Préstamos creados por el cobrador fuera de su ruta
  for (const p of prestamosActividad) {
    if (idsContabilizados.has(p.id)) continue
    idsContabilizados.add(p.id)
    const mov = montoRealPorPrestamo.get(p.id)
    filas.push(filaDe(p, mov ? mov.monto : montoEntregadoSinMovimiento(p, deudas), mov?.metodoPago))
  }

  /* Movimientos del cobrador sin préstamo en ruta/actividad.
   *
   * ⚠ SOLO SI EL PRÉSTAMO SIGUE VIVO.
   *
   * Este bucle sumaba el movimiento a secas. Las dos listas de arriba excluyen
   * los cancelados (`estado: { not: 'cancelado' }`), así que un préstamo
   * anulado no aparece en ninguna… y caía JUSTO AQUÍ, donde nadie miraba su
   * estado. El movimiento de capital se queda al cancelar, y se seguía contando.
   *
   * Reportado con captura: la caja de JULIAN #7 decía «Lo que prestaste
   * −$748.000» mientras la del administrador decía $150.000. Reconstruido al
   * peso: había creado y anulado tres préstamos a MIRANDA GOMEZ y dos
   * renovaciones; sumando los cancelados dan 748.000 exactos, y solo los vivos
   * dan 150.000 — la cifra del administrador, que era la correcta.
   *
   * Un préstamo anulado NO sacó plata de la caja: si salió y se devolvió, el
   * reverso tiene su propio movimiento. */
  const idsSueltos = movimientosDesembolso
    .map((m) => m.referenciaId)
    .filter((id) => id && !idsContabilizados.has(id))

  if (idsSueltos.length) {
    const vivos = await prisma.prestamo.findMany({
      where: { organizationId, id: { in: [...new Set(idsSueltos)] }, estado: { not: 'cancelado' } },
      select: { ...SELECT_FILA },
    })
    const sigueVivo = new Map(vivos.map((p) => [p.id, p]))

    for (const mov of movimientosDesembolso) {
      if (!mov.referenciaId || idsContabilizados.has(mov.referenciaId)) continue
      const p = sigueVivo.get(mov.referenciaId)
      if (!p) continue
      idsContabilizados.add(mov.referenciaId)
      const real = montoRealPorPrestamo.get(mov.referenciaId)
      filas.push(filaDe(p, real ? real.monto : mov.monto, (real ?? mov)?.metodoPago))
    }
  }

  return { total: sumar(filas), filas: ordenar(filas) }
}
