/**
 * ¿Hay que devolverle la guía a una cuenta que la tiene cerrada?
 *
 * ══ EL ONBOARDING SE CIERRA Y NO VUELVE ══════════════════════════════════════
 *
 * Se marca `onboardingStep: 99` a los 14 días con UN préstamo, o al tener
 * cliente + préstamo + pago. A partir de ahí la puerta del endpoint sale antes
 * de mirar nada: la guía no vuelve nunca, pase lo que pase.
 *
 * Medido contra producción (4 ago 2026, 412 organizaciones):
 *
 *   · 165 cuentas tienen la guía cerrada Y cinco clientes o menos.
 *   · 150 de esas NO HAN COBRADO NADA en 30 días. No van despacio: pararon.
 *   ·  94 se cerraron por «14 días + 1 préstamo»; de ellas 58 tienen UN SOLO
 *      préstamo y 35 no han registrado NI UN PAGO. Un préstamo sin cobros no
 *      es haber arrancado, es haber probado el sistema una vez.
 *
 * Y esto ya se endureció antes por el mismo motivo —el comentario del endpoint
 * lo cuenta: bastaba 1 cliente y se apagaba la guía «justo al que más la
 * necesitaba»—. Subir el listón otra vez sin más solo mueve la frontera; lo que
 * faltaba es que la guía SEPA VOLVER.
 *
 * ⚠ NO SE REABRE A QUIEN ESTÁ TRABAJANDO. Hay 15 cuentas con pocos clientes que
 * cobran cada semana: negocios pequeños que funcionan. Devolverles la guía sería
 * decirles que no han empezado cuando llevan meses. Y a las 98 con más de cinco
 * clientes no las toca el filtro.
 */

/** Días sin cobrar nada tras los cuales se considera que la cuenta paró. */
export const DIAS_PARADA = 30

/** Cartera por debajo de la cual la cuenta no ha arrancado de verdad. */
export const CLIENTES_MINIMOS = 5

/**
 * @param {object} cuenta
 * @param {number} cuenta.clientes      cuántos clientes tiene cargados
 * @param {Date|string|null} cuenta.ultimoPago  fecha del último pago registrado
 * @param {number} cuenta.onboardingStep
 * @param {Date|number} ahora
 */
export function debeReabrirse(cuenta, ahora = Date.now()) {
  if ((cuenta?.onboardingStep ?? 0) < 99) return false      // sigue abierta

  // Con cartera de verdad no se reabre aunque esté parada: ya sabe usar el
  // sistema, y lo que le pasa no lo arregla una lista de primeros pasos.
  const clientes = Number(cuenta?.clientes ?? 0)
  if (clientes > CLIENTES_MINIMOS) return false

  // Sin ningún pago NUNCA: es el caso más claro de los tres. Cargó algo, no
  // llegó a cobrar y la guía se le apagó a los 14 días.
  if (!cuenta?.ultimoPago) return true

  const dias = (new Date(ahora).getTime() - new Date(cuenta.ultimoPago).getTime()) / 86400000
  return dias > DIAS_PARADA
}

/**
 * El motivo, para poder decirlo en la pantalla.
 *
 * Volver a enseñar la lista de misiones sin explicar por qué se lee como un
 * fallo del sistema — «esto ya lo hice». Con el motivo es una mano tendida.
 */
export function motivoReapertura(cuenta, ahora = Date.now()) {
  if (!debeReabrirse(cuenta, ahora)) return null
  if (!cuenta?.ultimoPago) {
    return {
      clave: 'sin_cobros',
      texto: 'Todavía no has registrado ningún cobro. Te dejamos otra vez los pasos para arrancar.',
    }
  }
  return {
    clave: 'parada',
    texto: 'Hace más de un mes que no registras un cobro. Te dejamos otra vez los pasos por si quieres retomar.',
  }
}
