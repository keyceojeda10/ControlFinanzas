// lib/dinero/sugerido.js — Qué ajustes del libro NO entran al «capital sugerido».
//
// El sugerido reconstruye la caja desde los registros de HOY:
//   manuales (capital inicial, inyecciones, retiros, ajustes) + cobrado − prestado − gastos
// con `prestado` = Σ montoPrestado de los préstamos que EXISTEN (no cancelados)
// y `cobrado` = Σ de los pagos que existen.
//
// ⚠ EL ESPEJO DE UN REGISTRO QUE YA NO SE CUENTA NO ES UN AJUSTE MANUAL. Al
// borrar un préstamo el libro apunta «Reverso desembolso» (+lo prestado); al
// editarlo, la devolución del monto viejo; al cancelarlo, «Cancelación
// préstamo»; al borrar o anular sus pagos, «Reverso recaudo / pago anulado». En
// el libro están bien, porque el libro también tenía el desembolso o el pago
// original. Pero el sugerido ya cuenta el préstamo y el pago con su estado de
// HOY —el borrado no está, el editado va con su monto nuevo—, así que sumar
// además su espejo inventa plata.
//
// Soporte de Oscar Oyola (14 oct 2026): borró y volvió a crear dos préstamos
// ($5.000.000 y $4.000.000), el sugerido le dio $9.000.000 que no existían, lo
// aplicó y su caja quedó en $8.600.000 de mentira. Medido sobre 506 negocios:
// sin estos cinco espejos el sugerido se acerca al saldo del libro en 151 y se
// aleja en 17 (los que ya tenían descuadres que se compensaban); el desvío
// total baja de $5.798 millones a $890 millones.
//
// Puro, sin prisma: vitest lo prueba solo.

export const ESPEJOS_DE_REGISTRO = [
  'Reverso desembolso - préstamo eliminado',
  'Reverso desembolso - edición préstamo',
  'Reverso recaudo - préstamo eliminado',
  'Reverso pago anulado - préstamo',
  'Cancelación préstamo - devuelve',
]

export function esEspejoDeRegistro(descripcion) {
  const d = String(descripcion ?? '')
  return ESPEJOS_DE_REGISTRO.some((p) => d.startsWith(p))
}
