/* ══ LA PLATA DE UNA RUTA CUANDO CAMBIA LO QUE TIENE EN LA CALLE ═══════════════
 *
 * Dos piezas, las dos con PARES de correcciones (−X en una bolsa, +X en otra):
 * el capital del negocio no cambia, cada bolsa mueve lo suyo y
 * `recalcularSaldosCapital` las lee igual que se escribieron. Nunca con
 * `ajusteArranqueRuta`: la caja del administrador lo lee con el signo al revés
 * (ver la cabecera de lib/rutas/fusionar.js). Sus descripciones empiezan por
 * prefijos que `afectaElFajo` reconoce: mueven la BOLSA, no los billetes de
 * nadie. Y llevan `referenciaTipo: 'ruta'`, que no deja borrar ni editar una
 * mitad sola (app/api/capital/movimientos/[id]).
 */
import { registrarMovimientoCapital } from '@/lib/capital'
import { EMPIEZA_SU_CAPITAL, PREFIJO_CAPITAL_PROPIO, PREFIJO_TRASLADO } from '@/lib/rutas/capital-propio'

/**
 * La ruta SIN capital propio arranca en cero justo antes de tenerlo
 * (DETALLES-RUTAS #39 y #10). Su cuenta interna —lo que movieron sus préstamos
 * con la plata del negocio— vuelve al negocio: una corrección la deja en cero
 * y la otra entra sin ruta. Sin esto, meterle $500.000 a Ruta Centro la dejaba
 * en −$149.933.
 *
 * @param {object} p.ruta  { id, nombre, saldoCapital } TAL COMO ESTÁ DENTRO de la transacción
 * @returns {Promise<number>} la cuenta vieja que se puso en cero
 */
export async function empezarCapitalPropio(tx, { organizationId, ruta, usuarioId, prefijo = PREFIJO_CAPITAL_PROPIO, referenciaId = null }) {
  const viejo = Math.round(Number(ruta?.saldoCapital) || 0)
  if (!viejo) return 0
  const monto = Math.abs(viejo)
  await registrarMovimientoCapital(tx, {
    organizationId, tipo: 'ajuste', direccion: viejo > 0 ? 'egreso' : 'ingreso', monto, rutaId: ruta.id,
    descripcion: `${prefijo}: ${ruta.nombre} ${EMPIEZA_SU_CAPITAL}`,
    referenciaId: referenciaId ?? ruta.id, referenciaTipo: 'ruta', creadoPorId: usuarioId,
  })
  await registrarMovimientoCapital(tx, {
    organizationId, tipo: 'ajuste', direccion: viejo > 0 ? 'ingreso' : 'egreso', monto,
    descripcion: `${prefijo}: lo que ${ruta.nombre} movía con la plata del negocio queda en el negocio`,
    referenciaId: ruta.id, referenciaTipo: 'ruta', creadoPorId: usuarioId,
  })
  return viejo
}

const prestamos = (n) => (n === 1 ? '1 préstamo' : `${n} préstamos`)

/**
 * Un cliente con préstamos activos cambia de ruta: el préstamo cambia de bolsa
 * (DETALLES-RUTAS #8, decisión de Carlos del 18 oct 2026). Las tres vías que
 * mueven a un cliente pasan por aquí: agregarlo a una ruta, editarlo y
 * quitarlo de la ruta.
 *
 *   · Sale de una ruta CON capital propio: esa ruta RECUPERA lo que le deben,
 *     siempre. Lo pone la ruta que lo recibe si tiene capital propio; si no,
 *     el negocio. Antes se quedaba con el préstamo en la calle para siempre y
 *     los cobros entraban a la otra.
 *   · Sale de la plata del negocio (sin ruta o ruta sin capital) hacia una ruta
 *     CON capital: lo de siempre, la reserva si el dueño la eligió
 *     («Agregar y reservar»). La reserva escribe un asiento por préstamo.
 *   · A una ruta SIN capital desde otra sin capital: nada, no hay bolsa.
 *
 * Lo que se pasa es el saldo pendiente con intereses, la misma cifra que la
 * reserva: así la ruta que recibe queda en cero cuando el cliente termina.
 *
 * @param {{id,nombre,capitalHabilitado}|null} p.destino  null = sin ruta
 * @param {Array<{prestamoId, saldo, origen: {id,nombre,capitalHabilitado}|null}>} p.movidos
 * @param {boolean} p.reservar  la respuesta a «¿reservar?»; solo vale para lo que viene del negocio
 */
export async function pasarPrestamosDeRuta(tx, { organizationId, destino, movidos = [], reservar = false, usuarioId }) {
  const destinoConCapital = !!destino?.capitalHabilitado
  const porOrigen = new Map()
  const reservas = []
  for (const m of movidos) {
    const saldo = Math.round(Number(m?.saldo) || 0)
    if (saldo <= 0) continue
    const o = m.origen
    if (o && o.id === destino?.id) continue
    if (o?.capitalHabilitado) {
      const g = porOrigen.get(o.id) ?? { origen: o, monto: 0, cuantos: 0 }
      g.monto += saldo
      g.cuantos += 1
      porOrigen.set(o.id, g)
    } else if (destinoConCapital && reservar) {
      reservas.push({ prestamoId: m.prestamoId, saldo })
    }
  }

  for (const g of porOrigen.values()) {
    await registrarMovimientoCapital(tx, {
      organizationId, tipo: 'ajuste', direccion: 'ingreso', monto: g.monto, rutaId: g.origen.id,
      descripcion: `${PREFIJO_TRASLADO}: ${prestamos(g.cuantos)} de ${g.origen.nombre} ${g.cuantos === 1 ? 'pasa' : 'pasan'} a ${destinoConCapital ? destino.nombre : 'la plata del negocio'}`,
      referenciaId: destino?.id ?? g.origen.id, referenciaTipo: 'ruta', creadoPorId: usuarioId,
    })
    await registrarMovimientoCapital(tx, {
      organizationId, tipo: 'ajuste', direccion: 'egreso', monto: g.monto, rutaId: destinoConCapital ? destino.id : null,
      descripcion: destinoConCapital
        ? `${PREFIJO_TRASLADO}: ${destino.nombre} se queda con ${prestamos(g.cuantos)} de ${g.origen.nombre}`
        : `${PREFIJO_TRASLADO}: el negocio se queda con ${prestamos(g.cuantos)} de ${g.origen.nombre}`,
      referenciaId: g.origen.id, referenciaTipo: 'ruta', creadoPorId: usuarioId,
    })
  }

  // Reservar el saldo en la ruta que lo recibe: no altera el saldo global de la
  // org, solo la sub-bolsa de la ruta (ajusteArranqueRuta).
  for (const r of reservas) {
    await registrarMovimientoCapital(tx, {
      organizationId,
      tipo: 'desembolso',
      direccion: 'egreso',
      monto: r.saldo,
      descripcion: 'Reserva de capital por préstamo de cliente asignado a la ruta',
      referenciaId: r.prestamoId,
      referenciaTipo: 'prestamo',
      rutaId: destino.id,
      ajusteArranqueRuta: true,
      creadoPorId: usuarioId,
    })
  }

  return {
    trasladado: [...porOrigen.values()].map((g) => ({ origen: g.origen.nombre, monto: g.monto, prestamos: g.cuantos })),
    reservado: reservas.reduce((a, r) => a + r.saldo, 0),
  }
}

/** Lo que `calcularSaldoPendiente` necesita de cada préstamo, para los `select`. */
export const SELECT_PRESTAMO_TRASLADO = {
  id: true, clienteId: true, totalAPagar: true, totalPagado: true, abonadoCapital: true,
  pagos: { select: { montoPagado: true, tipo: true } },
}
