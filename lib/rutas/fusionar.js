/* ══ UNIR UNA RUTA CON OTRA ═════════════════════════════════════════════════
 *
 * PRESTA MIL, 2 oct 2026: tenía que unir su RUTA #9 con la #10 y no había
 * forma. Lo único parecido era «eliminar ruta», que deja a todos los clientes
 * sin ruta, deja la plata de la ruta sin dueño y su historial apuntando a una
 * ruta que ya no existe. A mano eran 103 clientes, uno por uno.
 *
 * Lo que decidió el dueño:
 *   · los clientes de la ruta que se une pasan al FINAL de la otra, en su orden
 *   · su capital propio pasa ENTERO a la otra; el del negocio no cambia
 *   · la ruta que se une se ARCHIVA (`activo: false`): sale de la lista y del
 *     cupo del plan, y su historial queda intacto
 *   · quién la cobra lo elige el dueño al unir (viene el de la ruta destino)
 *
 * ⚠ EL CAPITAL VA COMO UN PAR DE CORRECCIONES, −X EN UNA Y +X EN LA OTRA. No
 * con `ajusteArranqueRuta`: ése lo lee `recalcularSaldosCapital` SIEMPRE como
 * salida de la ruta y la caja del cobrador como entrada, así que un traslado
 * escrito así se torcería en el primer recálculo. Con dos `ajuste` normales el
 * global baja y sube lo mismo (neto 0), cada ruta mueve lo suyo, y el recálculo
 * los lee igual que los escribió. La descripción empieza por «Unión de rutas»,
 * que `afectaElFajo` reconoce: mueven la BOLSA, no los billetes de nadie.
 */
import { registrarMovimientoCapital } from '@/lib/capital'
import { parsearDiasSinCobro } from '@/lib/dias-sin-cobro'
import { getLocalDateStr, getLocalDayRange } from '@/lib/i18n'

export const DESCRIPCION_UNION = 'Unión de rutas'

/* Los mismos que la caja del cobrador deja fuera de «lo cobrado». */
const TIPOS_AJUSTE_PAGO = ['recargo', 'descuento']

/* ══ NO SE UNE CON COBROS DE HOY SIN CERRAR ═══════════════════════════════
 * La caja de cada cobrador se arma con los clientes que tienen HOY sus rutas.
 * Si a mitad del día se unen la #9 y la #10, la caja de Carlos de hoy incluye
 * lo que ya cobró Camilo a esos clientes: le pediría entregar plata que no
 * tiene, y los mismos cobros saldrían en dos cajas. Medido en el espejo el
 * 2 oct 2026. Decidido por el dueño: si hoy ya hubo cobros en la ruta que se
 * une, los dos cobradores cierran su caja antes de unir.
 *
 * ⚠ Lo de los días PASADOS no lo cubre esto: su detalle se recalcula con las
 * rutas de hoy (igual que al cambiar el cobrador de una ruta). Los cierres
 * guardados no cambian. Pendiente aparte: que cada cobro recuerde su ruta. */
async function bloqueoPorCobrosDeHoy(db, { organizationId, country, origen, destino }) {
  const { inicio, fin } = getLocalDayRange(getLocalDateStr(country), country)
  const agg = await db.pago.aggregate({
    where: {
      fechaPago: { gte: inicio, lt: fin },
      tipo: { notIn: TIPOS_AJUSTE_PAGO },
      prestamo: { organizationId, cliente: { rutaId: origen.id } },
    },
    _sum: { montoPagado: true },
  })
  const cobradoHoy = Math.round(agg?._sum?.montoPagado ?? 0)
  if (!(cobradoHoy > 0)) return { cobradoHoy: 0, bloqueo: null }

  const quienes = [origen.cobrador, destino.cobrador]
    .filter(Boolean)
    .filter((c, i, a) => a.findIndex((x) => x.id === c.id) === i)
  const sinCerrar = []
  for (const c of quienes) {
    const cierre = await db.cierreCaja.findFirst({
      where: { organizationId, cobradorId: c.id, fecha: { gte: inicio, lt: fin } },
      select: { id: true },
    })
    if (!cierre) sinCerrar.push(c.nombre)
  }
  if (!sinCerrar.length) return { cobradoHoy, bloqueo: null }
  const pesos = '$' + cobradoHoy.toLocaleString('es-CO')
  const quien = sinCerrar.length > 1 ? `${sinCerrar.slice(0, -1).join(', ')} y ${sinCerrar.at(-1)}` : sinCerrar[0]
  return {
    cobradoHoy,
    bloqueo: `Hoy ya se cobraron ${pesos} en ${origen.nombre}. Para que esos cobros no salgan en dos cajas, ${sinCerrar.length > 1 ? 'cierren' : 'cierre'} la caja de hoy ${quien} antes de unir.`,
  }
}

/** Los días sin cobro que de verdad rigen en una ruta: los suyos o los del negocio. */
export function diasDeLaRuta(ruta, org) {
  return parsearDiasSinCobro(ruta?.diasSinCobro) ?? parsearDiasSinCobro(org?.diasSinCobro) ?? []
}

const DIAS = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados']

/** «no se cobra los domingos» / «se cobra todos los días». */
function comoSeCobra(dias) {
  if (!dias.length) return 'se cobra todos los días'
  const nombres = [...dias].sort().map((d) => DIAS[d])
  const lista = nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}` : nombres[0]
  return `no se cobra los ${lista}`
}

/**
 * Si los clientes que se mueven van a cambiar de días sin cobro, la frase que
 * lo dice; si no cambian, null. Vale para los que no tienen días propios: los
 * que sí, se quedan con los suyos.
 */
export function avisoDiasSinCobro(origen, destino, org) {
  const a = diasDeLaRuta(origen, org), b = diasDeLaRuta(destino, org)
  if ([...a].sort().join(',') === [...b].sort().join(',')) return null
  return `En ${origen.nombre} ${comoSeCobra(a)} y en ${destino.nombre} ${comoSeCobra(b)}: sus clientes pasan a cobrarse como en ${destino.nombre}.`
}

/**
 * Lo que va a pasar, para enseñarlo ANTES de confirmar. Solo lee.
 *
 * @returns {Promise<{ error: string, status: number } | object>}
 */
export async function vistaUnion(db, { organizationId, origenId, destinoId }) {
  if (!origenId || !destinoId) return { error: 'Elige con qué ruta la unes', status: 400 }
  if (origenId === destinoId) return { error: 'No se puede unir una ruta consigo misma', status: 400 }
  const [origen, destino, org] = await Promise.all([
    db.ruta.findFirst({ where: { id: origenId, organizationId }, select: { id: true, nombre: true, activo: true, saldoCapital: true, capitalHabilitado: true, diasSinCobro: true, cobradorId: true, cobrador: { select: { id: true, nombre: true } } } }),
    db.ruta.findFirst({ where: { id: destinoId, organizationId }, select: { id: true, nombre: true, activo: true, saldoCapital: true, capitalHabilitado: true, diasSinCobro: true, cobradorId: true, cobrador: { select: { id: true, nombre: true } } } }),
    db.organization.findUnique({ where: { id: organizationId }, select: { diasSinCobro: true, country: true } }),
  ])
  if (!origen || !destino) return { error: 'Ruta no encontrada', status: 404 }
  if (!origen.activo || !destino.activo) return { error: 'Esa ruta ya está archivada', status: 409 }

  const [clientes, prestamos] = await Promise.all([
    db.cliente.count({ where: { organizationId, rutaId: origenId, estado: { notIn: ['eliminado'] } } }),
    db.prestamo.count({ where: { organizationId, estado: 'activo', cliente: { rutaId: origenId } } }),
  ])
  const capitalOrigen = Math.round(origen.saldoCapital || 0)
  const capitalDestino = Math.round(destino.saldoCapital || 0)
  const { cobradoHoy, bloqueo } = await bloqueoPorCobrosDeHoy(db, { organizationId, country: org?.country ?? 'co', origen, destino })
  return {
    origen: { id: origen.id, nombre: origen.nombre, cobrador: origen.cobrador, capital: capitalOrigen },
    destino: { id: destino.id, nombre: destino.nombre, cobrador: destino.cobrador, capital: capitalDestino },
    clientes,
    prestamos,
    capitalDespues: capitalOrigen + capitalDestino,
    avisoDias: avisoDiasSinCobro(origen, destino, org),
    cobradoHoy,
    bloqueo,
  }
}

/**
 * Une `origenId` dentro de `destinoId`. Todo en una transacción: o pasa entero
 * o no pasa nada.
 *
 * @param {object} p
 * @param {string|null|undefined} p.cobradorId  quién cobra la ruta unida (undefined = el de la ruta destino; null = nadie)
 * @returns {Promise<{ error: string, status: number } | { clientes: number, capital: number, cobradorId: string|null, destino: object, origen: object }>}
 */
export async function unirRutas(db, { organizationId, origenId, destinoId, cobradorId, usuarioId }) {
  const v = await vistaUnion(db, { organizationId, origenId, destinoId })
  if (v.error) return v
  if (v.bloqueo) return { error: v.bloqueo, status: 409 }

  if (cobradorId) {
    const c = await db.user.findFirst({ where: { id: cobradorId, organizationId, rol: 'cobrador', activo: true }, select: { id: true } })
    if (!c) return { error: 'Ese cobrador no existe o está desactivado', status: 400 }
  }

  return db.$transaction(async (tx) => {
    /* ⚠ PRIMERO EL CANDADO DEL CAPITAL. Todo movimiento de capital (un cobro,
       un préstamo) lo toma antes de tocar la bolsa de una ruta: con él puesto,
       el saldo que se lee aquí es el último y nadie lo cambia hasta terminar. */
    await tx.$queryRaw`SELECT id FROM Capital WHERE organizationId = ${organizationId} FOR UPDATE`

    const origen = await tx.ruta.findFirst({ where: { id: origenId, organizationId, activo: true }, select: { id: true, nombre: true, saldoCapital: true, capitalHabilitado: true } })
    const destino = await tx.ruta.findFirst({ where: { id: destinoId, organizationId, activo: true }, select: { id: true, nombre: true, cobradorId: true, capitalHabilitado: true } })
    if (!origen || !destino) return { error: 'Una de las rutas ya no está activa', status: 409 }

    /* 1. Los clientes, al final de la ruta destino y en el orden que traían.
       ⚠ EN UNA SOLA SENTENCIA, NO UNA POR CLIENTE. Con 117 clientes de uno en
       uno la transacción pasó de su tiempo en el espejo, y la última
       actualización —la que iba en vuelo cuando expiró— SE ESCRIBIÓ FUERA de
       ella: quedó un cliente movido y el resto no (2 oct 2026). Una sentencia
       entra entera o no entra, y deja la transacción corta. */
    const ultimo = await tx.cliente.aggregate({ where: { organizationId, rutaId: destinoId }, _max: { ordenRuta: true } })
    const inicio = (ultimo._max.ordenRuta ?? -1) + 1
    const movidos = await tx.$executeRaw`
      UPDATE Cliente c
      JOIN (
        SELECT id, ROW_NUMBER() OVER (ORDER BY (ordenRuta IS NULL), ordenRuta, createdAt, id) AS rn
        FROM Cliente WHERE organizationId = ${organizationId} AND rutaId = ${origenId}
      ) x ON x.id = c.id
      SET c.rutaId = ${destinoId}, c.ordenRuta = ${inicio} + x.rn - 1`

    // 2. Las visitas reagendadas que siguen pendientes van con sus clientes.
    await tx.visitaReagendada.updateMany({
      where: { organizationId, rutaId: origenId, estado: 'pendiente' },
      data: { rutaId: destinoId },
    })

    // 3. El capital propio de la ruta, entero a la otra (ver la cabecera).
    const capital = Math.round(origen.saldoCapital || 0)
    if (capital !== 0) {
      const sale = capital > 0 ? 'egreso' : 'ingreso'
      const entra = capital > 0 ? 'ingreso' : 'egreso'
      const monto = Math.abs(capital)
      await registrarMovimientoCapital(tx, {
        organizationId, tipo: 'ajuste', direccion: sale, monto, rutaId: origenId,
        descripcion: `${DESCRIPCION_UNION}: pasa a ${destino.nombre}`,
        referenciaId: destinoId, referenciaTipo: 'ruta', creadoPorId: usuarioId,
      })
      await registrarMovimientoCapital(tx, {
        organizationId, tipo: 'ajuste', direccion: entra, monto, rutaId: destinoId,
        descripcion: `${DESCRIPCION_UNION}: llega de ${origen.nombre}`,
        referenciaId: origenId, referenciaTipo: 'ruta', creadoPorId: usuarioId,
      })
    }

    // 4. Quién la cobra, y la ruta destino con capital propio si alguna lo tenía.
    const cobradorFinal = cobradorId === undefined ? destino.cobradorId : cobradorId
    await tx.ruta.update({
      where: { id: destinoId },
      data: {
        cobradorId: cobradorFinal ?? null,
        ...(origen.capitalHabilitado && !destino.capitalHabilitado && { capitalHabilitado: true }),
      },
    })

    // 5. La ruta que se une, archivada: sin clientes, sin cobrador, con su historial.
    await tx.ruta.update({ where: { id: origenId }, data: { activo: false, cobradorId: null } })

    return {
      clientes: Number(movidos) || 0,
      capital,
      cobradorId: cobradorFinal ?? null,
      origen: { id: origen.id, nombre: origen.nombre },
      destino: { id: destino.id, nombre: destino.nombre },
    }
  }, { timeout: 60000 })
}
