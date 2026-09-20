// lib/avisos-cartera.js — las BUENAS noticias que salen de un pago.
//
// La campana solo sabía decir «fulano se atrasó». Lo contrario —terminó de
// pagar, se puso al día, ya se le puede volver a prestar— no lo decía nadie, y
// es justo lo que mueve el negocio: la renovación es de donde sale el
// crecimiento, y el momento de ofrecerla es ESE día, no cuando el dueño se
// acuerde de mirar la lista.
//
// Puro: recibe el préstamo ANTES y DESPUÉS del pago y dice qué pasó. No calcula
// nada nuevo —usa las mismas funciones que pintan la ficha— y no escribe nada.
// Como mucho UN evento por pago, por orden de importancia: un préstamo que se
// salda también «se pone al día», y dos avisos del mismo cobro son ruido.

import { calcularDiasMora, calcularSaldoPendiente, calcularPorcentajePagado } from '@/lib/calculos'
import { RENOVAR_DESDE } from '@/lib/adaptadores/prestamos'

/**
 * @returns {null | { tipo, diasAntes?, pct? }}
 */
export function eventoDelPago({ antes, despues, diasExcluidos = [], festivos = [] }) {
  if (!antes || !despues) return null

  const saldoAntes = calcularSaldoPendiente(antes)
  const saldoDespues = calcularSaldoPendiente(despues)
  if (saldoAntes > 0 && saldoDespues <= 0) return { tipo: 'prestamo_saldado' }

  const diasAntes = calcularDiasMora(antes, diasExcluidos, festivos)
  const diasDespues = calcularDiasMora(despues, diasExcluidos, festivos)
  if (diasAntes > 0 && diasDespues <= 0) return { tipo: 'cliente_al_dia', diasAntes }

  const pctAntes = calcularPorcentajePagado(antes)
  const pctDespues = calcularPorcentajePagado(despues)
  if (pctAntes < RENOVAR_DESDE && pctDespues >= RENOVAR_DESDE && diasDespues <= 0) {
    return { tipo: 'listo_renovar', pct: Math.round(pctDespues) }
  }
  return null
}

/** El texto de cada evento. Separado para que la prueba lo lea sin base de datos. */
export function textoDelEvento(evento, { cliente, montoPrestado, montoPagado, plata }) {
  const quien = cliente || 'Un cliente'
  if (evento.tipo === 'prestamo_saldado') {
    return {
      titulo: `${quien} terminó de pagar`,
      mensaje: `Saldó su préstamo de ${plata(montoPrestado)}. Buen momento para ofrecerle otro.`,
    }
  }
  if (evento.tipo === 'cliente_al_dia') {
    const d = evento.diasAntes
    return {
      titulo: `${quien} se puso al día`,
      mensaje: `Llevaba ${d} ${d === 1 ? 'día' : 'días'} de atraso y pagó ${plata(montoPagado)}.`,
    }
  }
  return {
    titulo: `${quien} ya se puede renovar`,
    mensaje: `Lleva pagado el ${evento.pct}% de su préstamo y va al día.`,
  }
}
