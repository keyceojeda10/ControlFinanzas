// lib/procesando.js — lo que NO es dibujo de la pantalla de «estoy en eso».
//
// Aparte de `components/cf/Procesando.jsx` para poder probarlo: las pruebas de
// este repo no compilan JSX, y aquí está lo que de verdad puede salir mal —que
// la pantalla se quede puesta tras un error, o que invente espera—.

/** Lo mínimo que se queda una vez que asoma. Menos que esto es un parpadeo. */
export const MINIMO_MS = 700
/** Cada cuánto pasa al estado siguiente. El último se queda hasta que termine. */
export const PASO_MS = 1100

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
  cliente:   { ilustracion: 'cartulina', pasos: ['Guardando el cliente', 'Abriéndole su cartulina'] },
  cierre:    { ilustracion: 'moneda',    pasos: ['Contando lo cobrado', 'Cerrando la caja'] },
  guardando: { ilustracion: 'moneda',    pasos: ['Guardando'] },
}

/**
 * Fabrica `conPantalla` sobre una función `pintar(estado | null)`.
 *
 * Devuelve lo que devuelva la operación y RELANZA lo que lance: no se traga
 * errores. La pantalla se quita SIEMPRE, también si la operación falla —el
 * mensaje de error tiene que poder verse—.
 *
 * No inventa espera: en cuanto la operación termina se va. Solo aguanta hasta
 * MINIMO_MS desde que asomó, porque un parpadeo es peor que no enseñar nada.
 */
export function crearConPantalla(pintar, { salida = 180 } = {}) {
  let turno = 0
  return async function conPantalla(guion, operacion) {
    const id = ++turno
    const desde = Date.now()
    pintar({ id, guion, saliendo: false })
    const quitar = async () => {
      const falta = MINIMO_MS - (Date.now() - desde)
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
