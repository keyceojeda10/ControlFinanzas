// lib/dinero/cuentas.js
//
// ══ ¿ESTA PLATA LA TIENE EL COBRADOR EN LA MANO? ═══════════════════════════
//
// Un cobro en efectivo, siempre. Un cobro por transferencia, DEPENDE DE A QUÉ
// CUENTA ENTRÓ:
//
//   · A una cuenta del NEGOCIO → no la toca. No va en el fajo que entrega.
//   · A una cuenta DEL COBRADOR → la recibe él y después se la pasa al
//     negocio, así que sí la debe entregar.
//
// Hasta el 20 ago 2026 el sistema daba por hecho lo primero PARA TODOS, y ese
// supuesto solo existía como una cita en un comentario:
//
//   «cuando el cliente transfiere, ellos colocan por transferencia; cuando
//    llegan a entregar en la noche saben que ese dinero llegó a la cuenta de la
//    oficina y el resto lo traen en efectivo»  — PRESTA MIL, 4 ago 2026
//
// Es cierto para ellos. El dueño levantó la mano: «puede que otros negocios
// trabajen distinto». Y tenía razón: es el 18% de todo lo que se cobra en el
// sistema, y el negocio que trabaje al revés no se va a quejar — le va a faltar
// plata en silencio, porque la caja le diría que cuadra.
//
// ⚠ LA MARCA VA EN LA CUENTA, NO EN EL NEGOCIO. Un mismo negocio puede tener el
//   Nequi de la oficina Y el Daviplata del cobrador de la ruta 3.

/**
 * Los ids de las cuentas cuya plata la recibe el COBRADOR.
 *
 * Se devuelve un Set —y no la lista— porque quien lo usa pregunta una vez por
 * pago: con 300 pagos al día y un `.includes()`, eso es un barrido por fila.
 *
 * Si un negocio no ha marcado ninguna (el caso de todos hoy: 1.238 cuentas, 0
 * marcadas) el Set sale vacío y todo se comporta exactamente como antes.
 */
export async function cuentasDelCobrador(prisma, organizationId) {
  if (!organizationId) return new Set()
  const filas = await prisma.metodoPago.findMany({
    where: { organizationId, esDelCobrador: true },
    select: { id: true },
  })
  return new Set(filas.map((f) => f.id))
}

/**
 * ¿Este cobro entró al fajo del cobrador?
 *
 * ⚠ LO QUE NO DICE NADA ES EFECTIVO. Es el modo por defecto de un cobro en la
 *   calle y descartarlo perdía plata del desglose: `undefined !== 'transferencia'`
 *   tiene que seguir dando `true`.
 *
 * ⚠ UNA TRANSFERENCIA SIN CUENTA SE QUEDA FUERA DEL FAJO. Es el comportamiento
 *   de siempre, y es el prudente: son 21 pagos de 3.009 en 30 días, todos
 *   anteriores al selector de cuenta. Meterlos dentro le pediría al cobrador
 *   billetes que no se sabe si tuvo.
 */
export function entraAlFajo(metodoPago, metodoPagoId, cuentasCobrador) {
  if (metodoPago !== 'transferencia') return true
  if (!metodoPagoId) return false
  return Boolean(cuentasCobrador?.has?.(metodoPagoId))
}

/**
 * Reparte una lista de cobros entre lo que va en el fajo y lo que no.
 *
 * Devuelve las dos cifras Y el total, porque las tres se pintan: el total es lo
 * que el dueño suma con la calculadora antes de abrir la pantalla, y si no está
 * lee las otras dos como «números que no tienen lógica».
 */
export function repartirCobros(cobros = [], cuentasCobrador = new Set()) {
  let total = 0, enMano = 0, enCuenta = 0
  for (const p of cobros) {
    const monto = Math.round(p.montoPagado || p.monto || 0)
    total += monto
    if (entraAlFajo(p.metodoPago, p.metodoPagoId, cuentasCobrador)) enMano += monto
    else enCuenta += monto
  }
  return { total, enMano, enCuenta }
}
