// lib/dinero/efectivo-renovacion.js — Los billetes que se entregan al renovar.
//
// La pantalla decía la resta exacta («entregar $119.355») y el servidor
// desembolsaba al centenar hacia arriba ($119.400): el cobrador deslizaba una
// cifra y la caja registraba otra (DETALLES-PRESTAMOS #18). Y el seguro, que se
// descuenta al prestar (decisión del dueño, 17 oct 2026, #51), sale de aquí.
// Una sola cuenta para los dos lados.
//
//   bruto  = (monto nuevo − lo que debía) redondeado al centenar hacia arriba
//   entrega = bruto − seguro
//
// `seguroExcede` cuando el seguro no cabe en lo que se entrega: no hay billetes
// de los que descontarlo.
export function efectivoDeLaRenovacion({ monto, deuda, seguro = 0 }) {
  const exacta = (Number(monto) || 0) - (Number(deuda) || 0)
  const bruto = exacta > 0 ? Math.ceil(exacta / 100) * 100 : exacta
  const s = Math.max(0, Math.round(Number(seguro) || 0))
  const seguroExcede = s > 0 && s > Math.max(0, bruto)
  return {
    exacta,
    bruto,
    seguro: s,
    seguroExcede,
    entrega: bruto > 0 && !seguroExcede ? bruto - s : Math.max(0, bruto),
    redondeado: bruto !== exacta,
  }
}
