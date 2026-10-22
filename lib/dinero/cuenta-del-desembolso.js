// lib/dinero/cuenta-del-desembolso.js — de qué cuenta salió un préstamo.
//
// ⚠ LO QUE VUELVE, VUELVE A SU CUENTA (22 oct 2026). Borrar, cancelar o editar
// un préstamo escribía el reverso del desembolso SIN cuenta: un préstamo que
// salió por Daviplata, al borrarse, dejaba Daviplata en −$100.000 y +$100.000
// en «Ajustes sin cuenta». El capital total cuadraba; cada cuenta, no. Lo cazó
// la prueba de punta a punta de «pasar plata entre cuentas» en el espejo.
//
// La última salida que sí dice su cuenta: tras una edición manda la del
// «Desembolso actualizado»; en las ediciones viejas, que no la llevaban, la del
// original.

export async function cuentaDelDesembolso(db, { organizationId, prestamoId }) {
  const m = await db.movimientoCapital.findFirst({
    where: {
      organizationId, referenciaId: prestamoId, referenciaTipo: 'prestamo',
      tipo: 'desembolso', ajusteArranqueRuta: false, metodoPago: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    select: { metodoPago: true, metodoPagoId: true },
  })
  return { metodoPago: m?.metodoPago ?? null, metodoPagoId: m?.metodoPagoId ?? null }
}
