// lib/dinero/efectivo-renovacion.js — Los billetes que se entregan al renovar.
//
// La pantalla decía la resta exacta («entregar $119.355») y el servidor
// desembolsaba al centenar hacia arriba ($119.400): el cobrador deslizaba una
// cifra y la caja registraba otra (DETALLES-PRESTAMOS #18). Una sola cuenta para
// los dos lados. El seguro NO entra: no toca la plata (decisión del dueño, 17 oct
// 2026, noche; del #51 se revirtió el descuento porque PRESTA MIL dejó de cuadrar).
//
//   bruto   = (monto nuevo − lo que debía) redondeado al centenar hacia arriba
//   entrega = bruto (nunca negativo)
export function efectivoDeLaRenovacion({ monto, deuda }) {
  const exacta = (Number(monto) || 0) - (Number(deuda) || 0)
  const bruto = exacta > 0 ? Math.ceil(exacta / 100) * 100 : exacta
  return {
    exacta,
    bruto,
    entrega: Math.max(0, bruto),
    redondeado: bruto !== exacta,
  }
}
