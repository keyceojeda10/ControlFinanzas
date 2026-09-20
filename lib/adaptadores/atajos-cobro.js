// lib/adaptadores/atajos-cobro.js — qué montos ofrece la hoja de cobro de la ruta.
//
// Puro, fuera del componente, para poder probarlo: aquí se decide qué cifra queda
// PUESTA al abrir la hoja, y eso es plata.

/**
 * Las pastillas de monto de un préstamo: SOLO cifras que el servidor ya dio.
 * Una pastilla que repite la cifra de otra no se pinta —en un préstamo al día,
 * «ponerse al día» es la cuota, y con una sola cuota pendiente «todo» también—.
 */
export function opcionesDeMonto(p) {
  const cuota = Math.round(Number(p?.cuota ?? 0))
  const saldo = Math.round(Number(p?.saldoPendiente ?? 0))
  const alDia = Math.round(Number(p?.alDia ?? 0))
  const lista = []
  if (cuota > 0 && !p?.pagadoHoy) lista.push({ id: 'cuota', nombre: 'Cuota', monto: Math.min(cuota, saldo || cuota), significa: 'la cuota de hoy' })
  if (alDia > 0 && alDia < saldo && !lista.some((o) => o.monto === alDia)) {
    lista.push({ id: 'alDia', nombre: 'Ponerse al día', monto: alDia, significa: 'se pone al día' })
  }
  if (saldo > 0 && !lista.some((o) => o.monto === saldo)) {
    lista.push({ id: 'todo', nombre: 'Todo', monto: saldo, significa: 'salda el préstamo' })
  } else if (saldo > 0) {
    // La cuota YA es todo lo que debe: se dice, que es una buena noticia.
    const igual = lista.find((o) => o.monto === saldo)
    if (igual) igual.significa = 'salda el préstamo'
  }
  return lista
}

