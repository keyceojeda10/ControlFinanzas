// lib/procesando.js — lo que NO es dibujo de la pantalla de «estoy en eso».
//
// Aparte de `components/cf/Procesando.jsx` para poder probarlo: las pruebas de
// este repo no compilan JSX, y aquí está lo que de verdad puede salir mal —que
// la pantalla se quede puesta tras un error, o que invente espera—.

/* ── CUÁNTO SE QUEDA, COMO MÍNIMO ────────────────────────────────────────────
   La primera versión aguantaba 0,7 s «para no ser un parpadeo». El dueño, el
   mismo día, en su teléfono: «la animación es muy rápida, ni se ve». Tenía razón:
   quitada la espera del GPS, producción contesta en décimas y en 0,7 s no daba
   tiempo ni a que el dibujo terminara de subir (0,7 s dura solo la entrada).

   Ahora se queda lo que tarda en CONTARSE: los tres estados apilándose, uno cada
   0,65 s, y medio segundo con el último puesto. Sigue sin inventar espera cuando
   el servidor tarda más que eso: en cuanto contesta, se va. */
export const PASO_MS = 650
export const MINIMO_MS = 1900
/** Una operación de un solo paso («Guardando») no tiene nada que apilar. */
export const MINIMO_CORTO_MS = 1100

export function minimoDe(guion) {
  return (GUIONES[guion]?.pasos.length ?? 1) > 1 ? MINIMO_MS : MINIMO_CORTO_MS
}

/** Qué dice cada operación mientras ocurre, en el orden en que ocurre de verdad
 *  en el servidor: primero se escribe, luego se anota en la caja, luego se arma
 *  lo que se va a enseñar. */
export const GUIONES = {
  cobro:     { ilustracion: 'fajo',      pasos: ['Registrando el cobro', 'Anotándolo en la caja', 'Armando el comprobante'] },
  // La plata no pasó por el bolsillo del cobrador: no se pintan billetes que no
  // están. Misma regla que el comprobante (`entraAlFajo`); quien llama decide.
  cobroEnCuenta: { ilustracion: 'telefono', pasos: ['Registrando el cobro', 'Anotándolo en la cuenta', 'Armando el comprobante'] },
  prestamo:  { ilustracion: 'fajo',      pasos: ['Creando el préstamo', 'Sacando la plata de la caja', 'Armando el plan de pagos'] },
  renovar:   { ilustracion: 'fajo',      pasos: ['Cerrando el préstamo anterior', 'Creando el nuevo', 'Armando el plan de pagos'] },
  // Sin billetes: financiar no mueve plata, solo la deuda y el calendario.
  financiar: { ilustracion: 'cartulina', pasos: ['Cerrando la cartulina vieja', 'Sumando el interés', 'Empezando el plazo desde hoy'] },
  cliente:   { ilustracion: 'cartulina', pasos: ['Guardando el cliente', 'Abriéndole su cartulina'] },
  cierre:    { ilustracion: 'moneda',    pasos: ['Contando lo cobrado', 'Cerrando la caja'] },
  // No dice «descontándolo de la caja»: el gasto de un cobrador no baja la caja
  // hasta que el dueño lo aprueba. Solo lo que de verdad pasa.
  gasto:     { ilustracion: 'moneda',    pasos: ['Anotando el gasto', 'Sumándolo a los gastos del día'] },
  // Corregir el préstamo o su plazo rehace el calendario de cobros con los datos nuevos.
  corregir:  { ilustracion: 'cartulina', pasos: ['Guardando los cambios', 'Rehaciendo el plan de pagos'] },
  guardando: { ilustracion: 'moneda',    pasos: ['Guardando'] },
}

/**
 * Fabrica `conPantalla` sobre una función `pintar(estado | null)`.
 *
 * Devuelve lo que devuelva la operación y RELANZA lo que lance: no se traga
 * errores. La pantalla se quita SIEMPRE, también si la operación falla —el
 * mensaje de error tiene que poder verse—.
 *
 * Aguanta hasta `minimoDe(guion)` desde que asomó —lo que tarda en contarse— y
 * ni un milisegundo más: si el servidor tarda más que eso, se va en cuanto contesta.
 */
export function crearConPantalla(pintar, { salida = 180 } = {}) {
  let turno = 0
  return async function conPantalla(guion, operacion) {
    const id = ++turno
    const desde = Date.now()
    pintar({ id, guion, saliendo: false })
    const quitar = async () => {
      const falta = minimoDe(guion) - (Date.now() - desde)
      if (falta > 0) await new Promise((r) => setTimeout(r, falta))
      if (id !== turno) return            // otra operación ya tomó la pantalla
      pintar({ id, guion, saliendo: true })
      await new Promise((r) => setTimeout(r, salida))
      if (id === turno) pintar(null)
    }
    try {
      const resultado = await operacion()
      await quitar()
      return resultado
    } catch (e) {
      await quitar()
      throw e
    }
  }
}
