// lib/calificacion.js — CÓMO HA PAGADO ESTE CLIENTE, EN UNA MARCA.
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Tenemos clientes que pagan súper bien y clientes que pagan mal. Es como para
//  que el cobrador sepa qué clientela está trabajando bien y cuál mal.»
//
// El sistema ya sabe si alguien está en mora HOY —la pastilla y el anillo del
// avatar lo dicen— pero eso es el préstamo de ahora. Lo que faltaba es el
// historial: cómo terminó lo anterior. Eso no se veía en ninguna pantalla.
//
// ⚠ SE CALCULA, NO SE PONE A MANO. La primera propuesta era que el
// administrador marcara a cada uno. Dos problemas: nadie califica 7.624
// clientes, y una marca puesta a mano ENVEJECE —verde en agosto, te falla en
// octubre y sigue verde—. Se calcula del historial, que siempre está al día.
// El administrador puede corregirla, y cuando lo hace se dice quién y cuándo.
//
// ══ LA REGLA, Y DE DÓNDE SALEN LOS UMBRALES ════════════════════════════════
//
// Medido sobre los 4.703 préstamos terminados de producción el 28 ago 2026:
//
//     terminó a tiempo o antes ...... 65 %
//     hasta 1 semana tarde .......... 17 %
//     hasta 1 mes tarde ............. 14 %
//     hasta 3 meses tarde ............ 3 %
//     más de 3 meses tarde ........... 0,2 %
//
// El corte en «una semana» y «un mes» no es inventado: son los dos escalones
// donde la cartera real se separa. Agregado por cliente da 76 % verde, 20 %
// ámbar y 5 % rojo sobre los 2.949 con historial — tres grupos que existen de
// verdad, en vez de un 95 % verde que no diría nada.
//
// ⚠ SIN HISTORIAL NO HAY ESTRELLA. Un cliente nuevo tiene cero préstamos
// terminados, y pintarle un cero lo dejaría como el peor de la lista cuando
// solo es nuevo. Es la misma trampa que ya corrigió el «cumplimiento»: «un 0 %
// en un cliente que acaba de recibir el préstamo lo pinta como el peor, y es
// justo al revés». Son 4.675 de 7.624 clientes: la mayoría de tarjetas no
// llevan marca, y por eso la marca significa algo cuando aparece.

/** Los tres niveles. El orden importa: de peor a mejor. */
export const NIVELES = ['rojo', 'ambar', 'verde']

/* Los umbrales, en días de retraso al terminar el préstamo. Viven aquí y no
   repartidos por el código: si mañana la cartera cambia, se mueven en un sitio. */
export const TARDE_ACEPTABLE = 7   // hasta aquí sigue siendo «cumple»
export const TARDE_FEO = 30        // a partir de aquí es «falló feo»

export const TEXTO = {
  verde: 'Buen cliente',
  ambar: 'Se atrasa',
  rojo:  'Mal cliente',
}

/* La frase que explica la marca. Va en la ficha, para que nadie tenga que
   adivinar por qué su cliente salió ámbar. */
export const PORQUE = {
  verde: 'Terminó lo que debía sin atrasarse',
  ambar: 'Alguna vez terminó con más de una semana de retraso',
  rojo:  'Dejó un préstamo perdido o terminó con más de un mes de retraso',
}

/**
 * @param {object} h  historial ya agregado del cliente
 * @param {number} h.terminados     préstamos que cerró (completados o cancelados)
 * @param {number} h.clavos         de ésos, cuántos se dieron por perdidos
 * @param {number} h.peorRetraso    el mayor retraso en días al terminar
 * @param {string|null} h.manual    lo que puso el administrador, si puso algo
 * @returns {{nivel:string, numero:number, automatico:string, aMano:boolean}|null}
 *          `null` cuando no hay nada que calificar.
 */
export function calificacionDe(h) {
  const terminados = Number(h?.terminados) || 0
  const manual = NIVELES.includes(h?.manual) ? h.manual : null

  /* Sin historial no hay marca... salvo que el administrador la haya puesto a
     mano. Ése es justo el caso que pidió el cliente: alguien a quien conoce de
     antes y sabe cómo paga, aunque el sistema todavía no tenga con qué juzgar. */
  if (terminados === 0 && !manual) return null

  const clavos = Number(h?.clavos) || 0
  const peor = Number(h?.peorRetraso) || 0

  const automatico = terminados === 0
    ? null
    : (clavos > 0 || peor > TARDE_FEO) ? 'rojo'
    : peor > TARDE_ACEPTABLE ? 'ambar'
    : 'verde'

  return {
    nivel: manual ?? automatico,
    // El número que va DENTRO de la estrella: cuántos préstamos ha terminado.
    // Es la prueba detrás del color — «verde con 5» pesa más que «verde con 1».
    numero: terminados,
    automatico,
    aMano: Boolean(manual),
  }
}

/**
 * Lo que se lee en la ficha debajo de la marca.
 *
 * ⚠ CUANDO SE CORRIGIÓ A MANO, SE DICE — y se dice también lo que decía el
 * sistema. Sin esto habría dos verdades sobre lo mismo sin forma de saber cuál
 * mandó, que es de donde salen las cifras que no cuadran en este repo.
 */
export function explicacion(c, quien = null) {
  if (!c) return null
  if (!c.aMano) return PORQUE[c.nivel]
  const dicho = c.automatico ? ` El sistema lo tenía como «${TEXTO[c.automatico]}».` : ''
  return `Puesto a mano${quien ? ` por ${quien}` : ''}.${dicho}`
}
