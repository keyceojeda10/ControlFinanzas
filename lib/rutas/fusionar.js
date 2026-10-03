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
 *   · no se une con movimiento de hoy sin cerrar la caja (ver más abajo)
 *
 * ⚠ EL CAPITAL VA COMO UN PAR DE CORRECCIONES, −X EN UNA Y +X EN LA OTRA. No
 * con `ajusteArranqueRuta`: ése lo lee `recalcularSaldosCapital` SIEMPRE como
 * salida de la ruta y la caja del cobrador como entrada, así que un traslado
 * escrito así se torcería en el primer recálculo. Con dos `ajuste` normales el
 * global baja y sube lo mismo (neto 0), cada ruta mueve lo suyo, y el recálculo
 * los lee igual que los escribió. La descripción empieza por «Unión de rutas»,
 * que `afectaElFajo` reconoce: mueven la BOLSA, no los billetes de nadie. Y
 * llevan `referenciaTipo: 'ruta'`, que es lo que no deja borrarlos ni
 * editarlos por separado (app/api/capital/movimientos/[id]).
 */
import { registrarMovimientoCapital } from '@/lib/capital'
import { parsearDiasSinCobro } from '@/lib/dias-sin-cobro'
import { getLocalDateStr, getLocalDayRange } from '@/lib/i18n'

export const DESCRIPCION_UNION = 'Unión de rutas'

/** Los días sin cobro que de verdad rigen en una ruta: los suyos o los del negocio. */
export function diasDeLaRuta(ruta, org) {
  return parsearDiasSinCobro(ruta?.diasSinCobro) ?? parsearDiasSinCobro(org?.diasSinCobro) ?? []
}

const mismosDias = (a, b) => [...a].sort().join(',') === [...b].sort().join(',')

const DIAS = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados']

/** «no se cobra los domingos» / «se cobra todos los días». */
function comoSeCobra(dias) {
  if (!dias.length) return 'se cobra todos los días'
  const nombres = [...dias].sort().map((d) => DIAS[d])
  const lista = nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}` : nombres[0]
  return `no se cobra los ${lista}`
}

/* ══ LOS DÍAS SIN COBRO NO CAMBIAN PARA NADIE ═════════════════════════════
 * Un préstamo no guarda sus días: los toma de su cliente, de su ruta o del
 * negocio cada vez que se calcula (`obtenerDiasSinCobro`). Si al unir los
 * clientes pasaran a regirse por la otra ruta, se recalcularía HACIA ATRÁS el
 * calendario de todos sus préstamos —los domingos pasados se volverían cuotas
 * atrasadas y subiría la mora— (revisión del 2 oct 2026). Así que a cada
 * cliente sin días propios se le deja anotado el de la ruta que traía. */
export function avisoDiasSinCobro(origen, destino, org) {
  const a = diasDeLaRuta(origen, org), b = diasDeLaRuta(destino, org)
  if (mismosDias(a, b)) return null
  return `En ${origen.nombre} ${comoSeCobra(a)} y en ${destino.nombre} ${comoSeCobra(b)}. Sus clientes siguen como estaban: a cada uno se le deja anotado que ${comoSeCobra(a)}, así no cambian sus cuotas ni su atraso.`
}

/* ══ NO SE UNE CON MOVIMIENTO DE HOY SIN CERRAR LA CAJA ═══════════════════
 * La caja de cada cobrador se arma con los clientes que tienen HOY sus rutas.
 * Si a mitad del día se unen la #9 y la #10, la caja de Carlos de hoy incluye
 * lo que ya cobró o prestó Camilo a esos clientes: le pediría entregar plata
 * que no tiene, y lo mismo saldría en dos cajas. Medido en el espejo el 2 oct
 * 2026; decidido por el dueño.
 *
 *   · si hoy hubo movimiento en la ruta que se une (cobros, préstamos o
 *     capital), los dos cobradores tienen que haber cerrado la caja de hoy
 *   · si se le cambia el cobrador a la ruta destino y en ella ya hubo
 *     movimiento hoy, no se une: es el mismo bloqueo que tiene cambiarle el
 *     cobrador desde el lápiz
 *   · un cierre REABIERTO no cuenta: el cobrador puede seguir cobrando
 *
 * ⚠ Lo de los días PASADOS no lo cubre esto: su detalle se recalcula con las
 * rutas de hoy (igual que al cambiar el cobrador de una ruta). Los cierres
 * guardados no cambian. Pendiente aparte: que cada cobro recuerde su ruta. */
async function movimientoDeHoy(db, { organizationId, rutaId, inicio, fin }) {
  const [cobros, prestamos, capital] = await Promise.all([
    db.pago.aggregate({
      where: { fechaPago: { gte: inicio, lt: fin }, prestamo: { organizationId, cliente: { rutaId } } },
      _sum: { montoPagado: true },
      _count: true,
    }),
    db.prestamo.count({ where: { organizationId, createdAt: { gte: inicio, lt: fin }, cliente: { rutaId } } }),
    db.movimientoCapital.count({ where: { organizationId, rutaId, createdAt: { gte: inicio, lt: fin } } }),
  ])
  const nCobros = typeof cobros?._count === 'number' ? cobros._count : (cobros?._count?._all ?? 0)
  return {
    cobrado: Math.round(cobros?._sum?.montoPagado ?? 0),
    hubo: nCobros > 0 || prestamos > 0 || capital > 0,
  }
}

async function cerroHoy(db, { organizationId, cobradorId, inicio, fin }) {
  const c = await db.cierreCaja.findFirst({
    where: { organizationId, cobradorId, fecha: { gte: inicio, lt: fin }, reabiertoEn: null },
    select: { id: true },
  })
  return Boolean(c)
}

const enLista = (nombres) => (nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}` : nombres[0])

async function bloqueosDeHoy(db, { organizationId, country, origen, destino }) {
  const { inicio, fin } = getLocalDayRange(getLocalDateStr(country), country)
  const [hoyOrigen, hoyDestino] = await Promise.all([
    movimientoDeHoy(db, { organizationId, rutaId: origen.id, inicio, fin }),
    movimientoDeHoy(db, { organizationId, rutaId: destino.id, inicio, fin }),
  ])

  let bloqueo = null
  if (hoyOrigen.hubo) {
    const quienes = [origen.cobrador, destino.cobrador]
      .filter(Boolean)
      .filter((c, i, a) => a.findIndex((x) => x.id === c.id) === i)
    const sinCerrar = []
    for (const c of quienes) {
      if (!(await cerroHoy(db, { organizationId, cobradorId: c.id, inicio, fin }))) sinCerrar.push(c.nombre)
    }
    if (sinCerrar.length) {
      const que = hoyOrigen.cobrado > 0
        ? `Hoy ya se cobraron $${hoyOrigen.cobrado.toLocaleString('es-CO')} en ${origen.nombre}`
        : `Hoy ya hubo movimiento en ${origen.nombre}`
      bloqueo = `${que}. Para que no salga en dos cajas, ${sinCerrar.length > 1 ? 'cierren' : 'cierre'} la caja de hoy ${enLista(sinCerrar)} antes de unir.`
    }
  }
  const bloqueoSiCambia = hoyDestino.hubo
    ? `Hoy ya hubo movimiento en ${destino.nombre}: para cambiarle el cobrador, une mañana o deja a ${destino.cobrador?.nombre ?? 'quien la cobra'}.`
    : null
  return { bloqueo, bloqueoSiCambia, cobradoHoy: hoyOrigen.cobrado }
}

const SELECT_RUTA = {
  id: true, nombre: true, activo: true, saldoCapital: true, capitalHabilitado: true, diasSinCobro: true, cobradorId: true,
  cobrador: { select: { id: true, nombre: true, activo: true } },
}

/* El cobrador de una ruta, solo si sigue activo: a uno desactivado no se le
   puede dar una ruta, y ofrecerlo terminaría en un 400. */
const cobradorVivo = (r) => (r.cobrador && r.cobrador.activo !== false ? { id: r.cobrador.id, nombre: r.cobrador.nombre } : null)

/**
 * Lo que va a pasar, para enseñarlo ANTES de confirmar. Solo lee.
 *
 * @param {string|null|undefined} p.cobradorId  el elegido (undefined = el de la ruta destino)
 * @returns {Promise<{ error: string, status: number } | object>}
 */
export async function vistaUnion(db, { organizationId, origenId, destinoId, cobradorId }) {
  if (!origenId || !destinoId) return { error: 'Elige con qué ruta la unes', status: 400 }
  if (origenId === destinoId) return { error: 'No se puede unir una ruta consigo misma', status: 400 }
  const [origenRaw, destinoRaw, org] = await Promise.all([
    db.ruta.findFirst({ where: { id: origenId, organizationId }, select: SELECT_RUTA }),
    db.ruta.findFirst({ where: { id: destinoId, organizationId }, select: SELECT_RUTA }),
    db.organization.findUnique({ where: { id: organizationId }, select: { diasSinCobro: true, country: true, capitalEsEfectivo: true } }),
  ])
  if (!origenRaw || !destinoRaw) return { error: 'Ruta no encontrada', status: 404 }
  if (!origenRaw.activo || !destinoRaw.activo) return { error: 'Esa ruta ya está archivada', status: 409 }
  const origen = { ...origenRaw, cobrador: cobradorVivo(origenRaw) }
  const destino = { ...destinoRaw, cobrador: cobradorVivo(destinoRaw) }

  const [clientes, clientesDestino, prestamos] = await Promise.all([
    db.cliente.count({ where: { organizationId, rutaId: origenId } }),
    db.cliente.count({ where: { organizationId, rutaId: destinoId } }),
    db.prestamo.count({ where: { organizationId, estado: 'activo', cliente: { rutaId: origenId } } }),
  ])
  /* Solo pasa capital si la ruta que se une lo llevaba: sin `capitalHabilitado`
     su saldo no significa nada (a menudo muy negativo) y meterlo en una bolsa
     de verdad la pintaría en rojo sin motivo. */
  const capitalTraslado = origen.capitalHabilitado ? Math.round(origen.saldoCapital || 0) : 0
  const capitalDestino = Math.round(destinoRaw.saldoCapital || 0)
  const hoy = await bloqueosDeHoy(db, { organizationId, country: org?.country ?? 'co', origen, destino })
  const cambia = cobradorId !== undefined && (cobradorId ?? null) !== (destinoRaw.cobradorId ?? null)
  return {
    origen: { id: origen.id, nombre: origen.nombre, cobrador: origen.cobrador, capital: capitalTraslado, llevabaCapital: !!origen.capitalHabilitado },
    destino: { id: destino.id, nombre: destino.nombre, cobrador: destino.cobrador, capital: capitalDestino, clientes: clientesDestino },
    clientes,
    prestamos,
    capitalDespues: capitalDestino + capitalTraslado,
    /* El cobrador carga el capital en efectivo: la pantalla dice quién le
       entrega cuánto a quién (ver la caja con `capitalEsEfectivo`). */
    capitalEsEfectivo: !!org?.capitalEsEfectivo,
    avisoDias: avisoDiasSinCobro(origen, destino, org),
    diasOrigen: diasDeLaRuta(origen, org),
    diasDestino: diasDeLaRuta(destino, org),
    cobradoHoy: hoy.cobradoHoy,
    bloqueo: hoy.bloqueo ?? (cambia ? hoy.bloqueoSiCambia : null),
    bloqueoSiCambia: hoy.bloqueoSiCambia,
  }
}

/**
 * Une `origenId` dentro de `destinoId`. Todo en una transacción: o pasa entero
 * o no pasa nada.
 *
 * @param {object} p
 * @param {string|null|undefined} p.cobradorId  quién cobra la ruta unida (undefined = el de la ruta destino; null = nadie)
 * @returns {Promise<{ error: string, status: number } | { clientes: number, capital: number, cobradorId: string|null, clientesNuevosParaElCobrador: number, cobradorAnteriorDestino: string|null, cobradorOrigen: string|null, destino: object, origen: object }>}
 */
export async function unirRutas(db, { organizationId, origenId, destinoId, cobradorId, usuarioId }) {
  const v = await vistaUnion(db, { organizationId, origenId, destinoId, cobradorId })
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

    const origen = await tx.ruta.findFirst({ where: { id: origenId, organizationId, activo: true }, select: { id: true, nombre: true, saldoCapital: true, capitalHabilitado: true, cobradorId: true } })
    const destino = await tx.ruta.findFirst({ where: { id: destinoId, organizationId, activo: true }, select: { id: true, nombre: true, cobradorId: true, capitalHabilitado: true } })
    if (!origen || !destino) return { error: 'Una de las rutas ya no está activa', status: 409 }

    // 0. Los días sin cobro de cada cliente, como estaban (ver `avisoDiasSinCobro`).
    if (!mismosDias(v.diasOrigen, v.diasDestino)) {
      await tx.cliente.updateMany({
        where: { organizationId, rutaId: origenId, diasSinCobro: null },
        data: { diasSinCobro: JSON.stringify(v.diasOrigen) },
      })
    }

    /* 1. Los clientes, al final de la ruta destino y en el orden en que se
       veían (`ordenRuta`, y los que no tienen puesto primero, por nombre: como
       los pinta la ruta).
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
        SELECT id, ROW_NUMBER() OVER (ORDER BY (ordenRuta IS NOT NULL), ordenRuta, nombre, id) AS rn
        FROM Cliente WHERE organizationId = ${organizationId} AND rutaId = ${origenId}
      ) x ON x.id = c.id
      SET c.rutaId = ${destinoId}, c.ordenRuta = ${inicio} + x.rn - 1`

    // 2. Las visitas reagendadas que siguen pendientes van con sus clientes.
    await tx.visitaReagendada.updateMany({
      where: { organizationId, rutaId: origenId, estado: 'pendiente' },
      data: { rutaId: destinoId },
    })

    // 3. El capital propio de la ruta, entero a la otra (ver la cabecera).
    const capital = origen.capitalHabilitado ? Math.round(origen.saldoCapital || 0) : 0
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

    // 4. Quién la cobra, y la ruta destino con capital propio si la que llega lo tenía.
    const cobradorFinal = cobradorId === undefined ? destino.cobradorId : cobradorId
    await tx.ruta.update({
      where: { id: destinoId },
      data: {
        cobradorId: cobradorFinal ?? null,
        ...(origen.capitalHabilitado && !destino.capitalHabilitado && { capitalHabilitado: true }),
      },
    })

    /* 5. La ruta que se une, archivada: sin clientes, sin cobrador, con su
       historial. Sin `capitalHabilitado`, para que la pestaña Capital no la
       ofrezca como destino de una inyección que ninguna caja enseñaría. */
    await tx.ruta.update({ where: { id: origenId }, data: { activo: false, cobradorId: null, capitalHabilitado: false } })

    const nMovidos = Number(movidos) || 0
    return {
      clientes: nMovidos,
      capital,
      cobradorId: cobradorFinal ?? null,
      /* Para el aviso: si se queda con la ruta el de la que se unió, los
         clientes nuevos para él son los que ya tenía la otra. */
      clientesNuevosParaElCobrador: cobradorFinal && cobradorFinal === origen.cobradorId ? v.destino.clientes : nMovidos,
      cobradorAnteriorDestino: destino.cobradorId ?? null,
      cobradorOrigen: origen.cobradorId ?? null,
      origen: { id: origen.id, nombre: origen.nombre },
      destino: { id: destino.id, nombre: destino.nombre },
    }
  }, { timeout: 60000 })
}
