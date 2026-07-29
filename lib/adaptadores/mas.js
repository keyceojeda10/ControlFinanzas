// lib/adaptadores/mas.js — entre /api/mas y <PantallaMas>.
//
// La pantalla "Más" existe para que cada fila lleve su cifra: un menú de
// nombres es un índice; con la cifra al lado es un panel. Aquí es donde esas
// cifras se convierten en la frase que va bajo cada nombre.
//
// Y AQUÍ ES DONDE SE DECIDE CUÁNDO UNA FILA NO LLEVA CIFRA. Un "0 sin registrar
// nada" en rojo dice que hay un problema cuando lo cierto es que todo va bien.
// Sin cifra es mejor que con una cifra que miente.

import { formatMoney } from '@/lib/i18n'

/** "8 sin registrar nada" solo cuando de verdad falta alguien. */
export function textoCobradores(sinRegistrar) {
  if (!sinRegistrar || sinRegistrar <= 0) return null
  return `${sinRegistrar} sin registrar nada`
}

/** "1 préstamo · $1.2M". En plural cuando toca, sin "(s)". */
export function textoPerdidos(perdidos, pais) {
  const cantidad = perdidos?.cantidad ?? 0
  if (cantidad <= 0) return null
  const cuantos = `${cantidad} préstamo${cantidad === 1 ? '' : 's'}`
  const monto = perdidos?.monto
  return monto > 0 ? `${cuantos} · ${formatMoney(monto, pais)}` : cuantos
}

/**
 * "solo $10.000 este mes" — el "solo" no es adorno: un mes de millones con
 * $10.000 de gastos significa que la gasolina y los almuerzos no se están
 * registrando, y eso hace que la ganancia se vea más alta de lo que es.
 * Sin gastos registrados, la fila lo dice en vez de mostrar "$0".
 */
export function textoGastos(gastosMes, pais) {
  if (!gastosMes || gastosMes <= 0) return 'nada registrado este mes'
  return `${formatMoney(gastosMes, pais)} este mes`
}

export function adaptarMas(datos) {
  if (!datos) return {}
  const pais = datos.pais
  return {
    plataLista: datos.plataLista > 0 ? formatMoney(datos.plataLista, pais) : null,
    gastosMes: textoGastos(datos.gastosMes, pais),
    cobradoresSinRegistrar: textoCobradores(datos.cobradoresSinRegistrar),
    perdidos: textoPerdidos(datos.perdidos, pais),
    socios: { cantidad: datos.socios ?? 0 },
    usuarios: datos.usuarios ?? 1,
  }
}
