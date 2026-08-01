// ═══════════════════════════════════════════════════════════════════════════
// ¿DE DONDE SALE ESTE NUMERO?
//
// ── POR QUE ───────────────────────────────────────────────────────────────
//
// Un numero que nadie sabe de donde sale es peor que no ponerlo: ocupa sitio y
// encima genera desconfianza. Y cuando un prestamista dice «tu app esta mal»,
// hoy no hay forma de contestarle otra cosa que «no, esta bien».
//
// Este archivo es el diccionario que permite contestar de verdad. Cada cifra de
// dinero declara TRES cosas, y la regla es dura:
//
//     Si no se pueden escribir las tres, el numero sobra.
//
//   pregunta  — la que contesta, EN PALABRAS DEL PRESTAMISTA. No «recaudo
//               bruto del periodo» sino «¿cuánta plata entró hoy?».
//   universo  — que entra y que no. Es donde viven todas las discusiones:
//               ¿cuentan los clavos? ¿el cliente inactivo? ¿los festivos?
//   filas     — los pagos, prestamos o gastos CONCRETOS. Es lo que convierte
//               «tu app esta mal» en «mira, este pago esta aqui».
//
// ── POR QUE VIVE EN lib/ Y NO EN LA PANTALLA ──────────────────────────────
//
// Porque el mismo numero se pinta en varios sitios y la explicacion tiene que
// ser LA MISMA. Es exactamente el error que estamos deshaciendo: cinco copias
// de «cuanto tocaba cobrar» que divergieron porque cada pantalla se escribio
// la suya.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * El catalogo. La clave es el `id` que usan `lineasDeLaBanda` y el resumen del
 * cobrador, para que la pantalla no tenga que traducir nada.
 */
export const PROCEDENCIA = Object.freeze({
  apertura: {
    rotulo: 'Con lo que amaneciste',
    pregunta: '¿Con cuánta plata empezó el día?',
    universo: 'Es el saldo con el que cerró el día anterior. Sale del libro de movimientos, no de una suma: es el saldo que quedó grabado justo antes del primer movimiento de hoy.',
    formula: 'El saldo anterior del primer movimiento del día.',
    filas: null,
  },

  recaudo: {
    rotulo: 'Lo que entró',
    pregunta: '¿Cuánta plata entró hoy?',
    universo: 'Todos los pagos de clientes del día, en efectivo y por transferencia. NO cuentan los recargos (son un cargo que sube la deuda, no plata que llegue) ni los descuentos (bajan la deuda, tampoco entra plata). Los pagos de un préstamo dado por perdido SÍ cuentan: es dinero real que el cobrador tiene que entregar.',
    formula: 'Suma de los pagos del día, sin recargos ni descuentos.',
    filas: 'pagos',
  },

  recaudoEfectivo: {
    rotulo: 'En efectivo',
    pregunta: '¿Cuánto de eso viene en billetes?',
    universo: 'Solo lo cobrado en efectivo. Un pago sin método anotado cuenta como efectivo: es el modo por defecto de un cobro en la calle. Esta es la única cifra que tiene que aparecer en el fajo de la noche.',
    formula: 'Los pagos del día cuyo método NO es transferencia.',
    filas: 'pagos',
  },

  recaudoDigital: {
    rotulo: 'Por transferencia',
    pregunta: '¿Cuánto entró por Nequi o transferencia?',
    universo: 'Lo cobrado por transferencia. Esta plata NO la trae el cobrador encima: ya está en la cuenta. Contarla dentro del efectivo es lo que hacía que el conteo de la noche nunca cuadrara.',
    formula: 'Los pagos del día marcados como transferencia.',
    filas: 'pagos',
  },

  desembolsos: {
    rotulo: 'Lo que prestaste',
    pregunta: '¿Cuánta plata salió a la calle hoy?',
    universo: 'El EFECTIVO que de verdad salió, no el valor de los préstamos. En una renovación el cliente no recibe el monto completo: se le descuenta lo que aún debía, y esa parte nunca sale de la caja. Aquí solo cuenta lo que se entregó en mano.',
    formula: 'Suma del efectivo entregado en los préstamos del día.',
    filas: 'prestamos',
  },

  gastos: {
    rotulo: 'Gastos',
    pregunta: '¿En qué se gastó plata hoy?',
    universo: 'Los gastos del día del cobrador. Los pendientes de aprobar SÍ cuentan aquí: el cobrador ya sacó esa plata de su bolsillo, aunque el dueño no la haya revisado.',
    formula: 'Suma de los gastos del día.',
    filas: 'gastos',
  },

  inyecciones: {
    rotulo: 'Plata que metiste',
    pregunta: '¿Metiste plata a la caja hoy?',
    universo: 'Capital que el dueño puso desde fuera: no viene de un cobro, viene de su bolsillo.',
    formula: 'Movimientos de inyección y de capital inicial del día.',
    filas: 'movimientos',
  },

  retiros: {
    rotulo: 'Plata que sacaste',
    pregunta: '¿Sacaste plata de la caja hoy?',
    universo: 'Capital que el dueño retiró para él. No es un gasto del negocio.',
    formula: 'Movimientos de retiro del día.',
    filas: 'movimientos',
  },

  ajustes: {
    rotulo: 'Correcciones',
    pregunta: '¿Qué se corrigió a mano hoy?',
    universo: 'Los ajustes que alguien asentó, cada uno con su motivo y su autor. NO es «lo que falta para que cuadre»: esa línea existía antes y era la que escondía los descuadres.',
    formula: 'Movimientos de ajuste del día, con su dirección real.',
    filas: 'movimientos',
  },

  enMano: {
    rotulo: 'Lo que debería tener en la mano',
    pregunta: '¿Cuánto efectivo tendría que entregarme el cobrador?',
    universo: 'SOLO EFECTIVO. Lo que traía + lo que cobró en billetes − lo que prestó en mano − lo que gastó. Lo que entró por transferencia no está aquí porque no lo carga encima.',
    formula: 'Con lo que salió + cobrado en efectivo − prestado en efectivo − gastos.',
    filas: null,
  },

  esperado: {
    rotulo: 'Lo que tocaba cobrar',
    pregunta: '¿Cuánto decía el calendario que se cobraba hoy?',
    universo: 'La cuota de cada préstamo cuyo ciclo caía hoy, según su frecuencia y su día de cobro. NO cuenta lo atrasado de días anteriores: eso es otra cifra. Se descuentan los días sin cobro y los festivos. Los préstamos dados por perdido no suman meta.',
    formula: 'Suma de las cuotas que vencían hoy.',
    filas: 'cuotas',
  },

  atrasado: {
    rotulo: 'Lo que viene atrasado',
    pregunta: '¿Cuánto se quedó sin pagar de días anteriores?',
    universo: 'Lo que el calendario pedía ANTES de hoy y sigue sin entrar, topado al saldo del préstamo. Nunca se suma con «lo que tocaba cobrar»: son dos preguntas y mezclarlas es de donde salen la mitad de las contradicciones.',
    formula: 'Lo que vencía antes de hoy menos lo que se ha pagado.',
    filas: 'cuotas',
  },

  // ── Lo que hizo el cobrador ──

  prestamosNuevos: {
    rotulo: 'Préstamos nuevos',
    pregunta: '¿A cuánta gente le prestó por primera vez?',
    universo: 'Préstamos creados hoy que NO son renovación de otro. Aquí sí sale el monto completo a la calle.',
    formula: 'Préstamos del día sin préstamo anterior.',
    filas: 'prestamos',
  },

  renovaciones: {
    rotulo: 'Renovaciones',
    pregunta: '¿A cuánta gente le volvió a prestar?',
    universo: 'Préstamos que reemplazan a uno anterior. El valor que se muestra es el EFECTIVO ENTREGADO, no el monto del préstamo: la parte que cubre el saldo viejo nunca sale de la caja.',
    formula: 'Préstamos del día que vienen de otro préstamo.',
    filas: 'prestamos',
  },

  clientesNuevos: {
    rotulo: 'Clientes nuevos',
    pregunta: '¿Cuánta gente entró hoy a la ruta?',
    universo: 'Clientes creados hoy en las rutas del cobrador. Cuenta aunque todavía no tengan préstamo.',
    formula: 'Clientes de sus rutas creados hoy.',
    filas: 'clientes',
  },

  seguros: {
    rotulo: 'Seguros',
    pregunta: '¿Cuánto se cobró de seguro?',
    universo: 'El seguro NO es plata aparte: ya viene dentro del total del préstamo y se cobra repartido en las cuotas. Se muestra para saber cuánto de la cartera es seguro, pero NO se suma al efectivo del día.',
    formula: 'Suma del seguro de los préstamos del día.',
    filas: 'prestamos',
  },

  recargos: {
    rotulo: 'Recargos',
    pregunta: '¿Cuánto se le sumó a las deudas hoy?',
    universo: 'Un recargo SUBE lo que el cliente debe. No es plata que haya entrado, así que no cuenta como cobro ni aparece en el fajo.',
    formula: 'Suma de los recargos aplicados hoy.',
    filas: 'pagos',
  },
})

/** La explicación de una cifra, o null si no está en el catálogo. */
export function explicar(id) {
  const e = PROCEDENCIA[id]
  return e ? { id, ...e } : null
}

/**
 * Toda cifra que la pantalla pinte tiene que estar aquí.
 *
 * Se usa en la prueba de guardia: si alguien añade una cifra nueva a la caja sin
 * escribir su pregunta y su universo, la prueba se pone roja. Es lo que impide
 * que volvamos a tener numeros que nadie sabe de donde salen.
 */
export function faltanExplicacion(ids = []) {
  return ids.filter((id) => !PROCEDENCIA[id])
}
