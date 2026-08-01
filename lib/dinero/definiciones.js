// ═══════════════════════════════════════════════════════════════════════════
// EL DICCIONARIO: UNA CIFRA, UN NOMBRE, UNA DEFINICION
//
// ── POR QUE ───────────────────────────────────────────────────────────────
//
// Un numero que nadie sabe de donde sale es peor que no ponerlo: ocupa sitio y
// encima genera desconfianza. Y cuando un prestamista dice «tu app esta mal»,
// sin esto no hay forma de contestarle otra cosa que «no, esta bien».
//
// Cada cifra declara lo mismo, y la regla es dura:
//
//     Si no se pueden escribir todas, el numero sobra.
//
//   rotulo    — lo UNICO que la pantalla puede pintar. Dos cifras distintas no
//               pueden compartirlo.
//   pregunta  — la que contesta, EN PALABRAS DEL PRESTAMISTA. No «recaudo
//               bruto del periodo» sino «¿cuánta plata entró hoy?».
//   universo  — que entra y que no. Es donde viven todas las discusiones:
//               ¿cuentan los clavos? ¿el cliente en mora? ¿los festivos?
//   unidad    — dinero, conteo, porcentaje o dias. Un porcentaje y unos pesos
//               no se pintan igual ni se comparan.
//   alcances  — a que nivel tiene sentido: la organizacion, una ruta, un
//               cobrador, un cliente, un prestamo.
//   formula   — como se calcula, en una linea.
//   filas     — de que filas concretas sale, para poder bajar hasta el
//               movimiento y decir «mira, este pago esta aqui».
//
// ── LO QUE ESTE ARCHIVO VINO A MATAR ──────────────────────────────────────
//
// Todo medido contra el codigo y contra la base de produccion, no de memoria:
//
//   «Ganancia neta» y «Utilidad neta», en la MISMA pantalla de analiticas,
//   eran dos numeros distintos: uno llevaba la correccion por tabla de
//   amortizacion y el otro no.
//
//   El reporte de cartera por ruta filtraba `cliente.estado = 'activo'`. Como
//   el estado de un cliente moroso es literalmente 'mora', ese filtro escondia
//   1.081 clientes y **$631.726.806** — el 14% de la cartera — mientras la
//   cifra «En mora» de la misma pantalla si los contaba.
//
//   «Gastos del mes» del panel no filtraba estado y sumaba los RECHAZADOS
//   ($247.000) y los pendientes ($49.000); analiticas, capital y «mas» si
//   filtran. Un gasto rechazado bajaba la ganancia por plata que nunca salio.
//
//   «Meta del día» eran dos cosas: el panel usa lo que el calendario pide hoy
//   y el consejo de abajo usaba la suma de TODAS las cuotas de la cartera. La
//   pantalla decia 48% y el consejo 9%.
//
// ── LA REGLA QUE LO SOSTIENE ──────────────────────────────────────────────
//
// La pantalla no escribe rotulos de dinero: los pide aqui con `rotulo(id)`.
// `lib/__tests__/definiciones.test.js` se pone roja si un rotulo protegido
// reaparece escrito a mano en `app/` o en `components/`.
// ═══════════════════════════════════════════════════════════════════════════

export const UNIDAD = Object.freeze({
  DINERO: 'dinero',
  CONTEO: 'conteo',
  PORCENTAJE: 'porcentaje',
  DIAS: 'dias',
})

export const ALCANCE = Object.freeze({
  ORGANIZACION: 'organizacion',
  RUTA: 'ruta',
  COBRADOR: 'cobrador',
  CLIENTE: 'cliente',
  PRESTAMO: 'prestamo',
})

const TODOS = [ALCANCE.ORGANIZACION, ALCANCE.RUTA, ALCANCE.COBRADOR]

export const DEFINICIONES = Object.freeze({
  // ═════════════════════════════════════════════════════════════════════════
  // LA CAJA DEL DIA — lo que compone la banda y el resumen del cobrador
  // ═════════════════════════════════════════════════════════════════════════

  apertura: {
    rotulo: 'Con lo que amaneciste',
    pregunta: '¿Con cuánta plata empezó el día?',
    universo: 'Es el saldo con el que cerró el día anterior. Sale del libro de movimientos, no de una suma: es el saldo que quedó grabado justo antes del primer movimiento de hoy.',
    formula: 'El saldo anterior del primer movimiento del día.',
    unidad: UNIDAD.DINERO,
    alcances: TODOS,
    filas: null,
  },

  recaudo: {
    rotulo: 'Lo que entró',
    pregunta: '¿Cuánta plata entró hoy?',
    universo: 'Todos los pagos de clientes del día, en efectivo y por transferencia. NO cuentan los recargos (son un cargo que sube la deuda, no plata que llegue) ni los descuentos (bajan la deuda, tampoco entra plata). Los pagos de un préstamo dado por perdido SÍ cuentan: es dinero real que el cobrador tiene que entregar.',
    formula: 'Suma de los pagos del día, sin recargos ni descuentos.',
    unidad: UNIDAD.DINERO,
    alcances: TODOS,
    filas: 'pagos',
  },

  recaudoEfectivo: {
    rotulo: 'En efectivo',
    pregunta: '¿Cuánto de eso viene en billetes?',
    universo: 'Solo lo cobrado en efectivo. Un pago sin método anotado cuenta como efectivo: es el modo por defecto de un cobro en la calle. Esta es la única cifra que tiene que aparecer en el fajo de la noche.',
    formula: 'Los pagos del día cuyo método NO es transferencia.',
    unidad: UNIDAD.DINERO,
    alcances: TODOS,
    filas: 'pagos',
  },

  recaudoDigital: {
    rotulo: 'Por transferencia',
    pregunta: '¿Cuánto entró por Nequi o transferencia?',
    universo: 'Lo cobrado por transferencia. Esta plata NO la trae el cobrador encima: ya está en la cuenta. Contarla dentro del efectivo es lo que hacía que el conteo de la noche nunca cuadrara.',
    formula: 'Los pagos del día marcados como transferencia.',
    unidad: UNIDAD.DINERO,
    alcances: TODOS,
    filas: 'pagos',
  },

  desembolsos: {
    rotulo: 'Lo que prestaste',
    pregunta: '¿Cuánta plata salió a la calle hoy?',
    universo: 'El EFECTIVO que de verdad salió, no el valor de los préstamos. En una renovación el cliente no recibe el monto completo: se le descuenta lo que aún debía, y esa parte nunca sale de la caja. Aquí solo cuenta lo que se entregó en mano.',
    formula: 'Suma del efectivo entregado en los préstamos del día.',
    unidad: UNIDAD.DINERO,
    alcances: TODOS,
    filas: 'prestamos',
  },

  gastos: {
    rotulo: 'Gastos',
    pregunta: '¿En qué se gastó plata hoy?',
    universo: 'Los gastos del día del cobrador. Los pendientes de aprobar SÍ cuentan aquí: el cobrador ya sacó esa plata de su bolsillo, aunque el dueño no la haya revisado. Los RECHAZADOS no cuentan: esa plata no salió.',
    formula: 'Suma de los gastos del día.',
    unidad: UNIDAD.DINERO,
    alcances: TODOS,
    filas: 'gastos',
  },

  inyecciones: {
    rotulo: 'Plata que metiste',
    pregunta: '¿Metiste plata a la caja hoy?',
    universo: 'Capital que el dueño puso desde fuera: no viene de un cobro, viene de su bolsillo.',
    formula: 'Movimientos de inyección y de capital inicial del día.',
    unidad: UNIDAD.DINERO,
    alcances: TODOS,
    filas: 'movimientos',
  },

  retiros: {
    rotulo: 'Plata que sacaste',
    pregunta: '¿Sacaste plata de la caja hoy?',
    universo: 'Capital que el dueño retiró para él. No es un gasto del negocio.',
    formula: 'Movimientos de retiro del día.',
    unidad: UNIDAD.DINERO,
    alcances: TODOS,
    filas: 'movimientos',
  },

  ajustes: {
    rotulo: 'Correcciones',
    pregunta: '¿Qué se corrigió a mano hoy?',
    universo: 'Los ajustes que alguien asentó, cada uno con su motivo y su autor. NO es «lo que falta para que cuadre»: esa línea existía antes y era la que escondía los descuadres.',
    formula: 'Movimientos de ajuste del día, con su dirección real.',
    unidad: UNIDAD.DINERO,
    alcances: TODOS,
    filas: 'movimientos',
  },

  enMano: {
    rotulo: 'Lo que debería tener en la mano',
    pregunta: '¿Cuánto efectivo tendría que entregarme el cobrador?',
    universo: 'SOLO EFECTIVO. Lo que traía + lo que cobró en billetes − lo que prestó en mano − lo que gastó. Lo que entró por transferencia no está aquí porque no lo carga encima.',
    formula: 'Con lo que salió + cobrado en efectivo − prestado en efectivo − gastos.',
    unidad: UNIDAD.DINERO,
    alcances: [ALCANCE.COBRADOR, ALCANCE.RUTA],
    filas: null,
  },

  esperado: {
    rotulo: 'Lo que tocaba cobrar',
    pregunta: '¿Cuánto decía el calendario que se cobraba hoy?',
    universo: 'La cuota de cada préstamo cuyo ciclo caía hoy, según su frecuencia y su día de cobro. NO cuenta lo atrasado de días anteriores: eso es otra cifra. Se descuentan los días sin cobro y los festivos. Los préstamos dados por perdido no suman meta.',
    formula: 'Suma de las cuotas que vencían hoy.',
    unidad: UNIDAD.DINERO,
    alcances: TODOS,
    filas: 'cuotas',
  },

  atrasado: {
    rotulo: 'Lo que viene atrasado',
    pregunta: '¿Cuánto se quedó sin pagar de días anteriores?',
    universo: 'Lo que el calendario pedía ANTES de hoy y sigue sin entrar, topado al saldo del préstamo. Nunca se suma con «lo que tocaba cobrar»: son dos preguntas y mezclarlas es de donde salen la mitad de las contradicciones.',
    formula: 'Lo que vencía antes de hoy menos lo que se ha pagado.',
    unidad: UNIDAD.DINERO,
    alcances: TODOS,
    filas: 'cuotas',
  },

  // ── Lo que hizo el cobrador ──

  prestamosNuevos: {
    rotulo: 'Préstamos nuevos',
    pregunta: '¿A cuánta gente le prestó por primera vez?',
    universo: 'Préstamos creados hoy que NO son renovación de otro. Aquí sí sale el monto completo a la calle.',
    formula: 'Préstamos del día sin préstamo anterior.',
    unidad: UNIDAD.CONTEO,
    alcances: TODOS,
    filas: 'prestamos',
  },

  renovaciones: {
    rotulo: 'Renovaciones',
    pregunta: '¿A cuánta gente le volvió a prestar?',
    universo: 'Préstamos que reemplazan a uno anterior. El valor que se muestra es el EFECTIVO ENTREGADO, no el monto del préstamo: la parte que cubre el saldo viejo nunca sale de la caja.',
    formula: 'Préstamos del día que vienen de otro préstamo.',
    unidad: UNIDAD.CONTEO,
    alcances: TODOS,
    filas: 'prestamos',
  },

  clientesNuevos: {
    rotulo: 'Clientes nuevos',
    pregunta: '¿Cuánta gente entró hoy a la ruta?',
    universo: 'Clientes creados hoy en las rutas del cobrador. Cuenta aunque todavía no tengan préstamo.',
    formula: 'Clientes de sus rutas creados hoy.',
    unidad: UNIDAD.CONTEO,
    alcances: TODOS,
    filas: 'clientes',
  },

  seguros: {
    rotulo: 'Seguros',
    pregunta: '¿Cuánto se cobró de seguro?',
    universo: 'El seguro NO es plata aparte: ya viene dentro del total del préstamo y se cobra repartido en las cuotas. Se muestra para saber cuánto de la cartera es seguro, pero NO se suma al efectivo del día.',
    formula: 'Suma del seguro de los préstamos del día.',
    unidad: UNIDAD.DINERO,
    alcances: TODOS,
    filas: 'prestamos',
  },

  recargos: {
    rotulo: 'Recargos',
    pregunta: '¿Cuánto se le sumó a las deudas hoy?',
    universo: 'Un recargo SUBE lo que el cliente debe. No es plata que haya entrado, así que no cuenta como cobro ni aparece en el fajo.',
    formula: 'Suma de los recargos aplicados hoy.',
    unidad: UNIDAD.DINERO,
    alcances: TODOS,
    filas: 'pagos',
  },

  // ═════════════════════════════════════════════════════════════════════════
  // EL NEGOCIO — lo que el dueño mira sentado
  // ═════════════════════════════════════════════════════════════════════════

  capitalEnCalle: {
    rotulo: 'Capital en la calle',
    pregunta: '¿Cuánta plata mía está afuera ahora mismo?',
    universo: 'Lo prestado menos lo que ya volvió, préstamo por préstamo, SOLO de los activos y sin contar los dados por perdido. NO es «cuánto he prestado alguna vez»: cada peso que el cliente devuelve baja esta cifra. Nunca puede pasarse de lo que falta por cobrar.',
    formula: 'Suma de (lo prestado − el capital ya devuelto) de cada préstamo activo.',
    unidad: UNIDAD.DINERO,
    alcances: TODOS,
    filas: 'prestamos',
    notas: 'Con la fórmula vieja (Σ monto prestado) un solo negocio veía $277.067.809 donde tenía $201.582.321: un 37,2% de más, en la cifra con la que decide si puede prestar.',
  },

  capitalNoRecuperado: {
    rotulo: 'Capital que no volvió',
    pregunta: '¿Cuánta plata mía ya sé que no vuelve?',
    universo: 'Préstamos cuyo total a pagar quedó POR DEBAJO de lo prestado: se cerraron cobrando menos de lo que se puso. La diferencia no es interés negativo, es capital perdido. NO incluye los préstamos que simplemente van atrasados: esos todavía pueden pagar.',
    formula: 'Suma de (lo prestado − el total a pagar) donde el total quedó por debajo.',
    unidad: UNIDAD.DINERO,
    alcances: [ALCANCE.ORGANIZACION],
    filas: 'prestamos',
    notas: 'Antes se disolvía dentro del interés: el reparto lo registraba como «interés negativo» y bajaba la ganancia de meses en los que no había pasado nada malo.',
  },

  porCobrar: {
    rotulo: 'Falta por cobrar',
    pregunta: '¿Cuánto me deben en total?',
    universo: 'El saldo de todos los préstamos activos: capital más el interés pactado que todavía no han pagado. NO cuenta los préstamos dados por perdido ni los ya terminados.',
    formula: 'Suma de (total a pagar − lo pagado) de cada préstamo activo.',
    unidad: UNIDAD.DINERO,
    alcances: TODOS,
    filas: 'prestamos',
  },

  interesEnCartera: {
    rotulo: 'Falta por ganar',
    pregunta: 'Si todos terminan de pagar, ¿cuánto gano?',
    universo: 'El interés pactado que aún no se ha cobrado, de los préstamos activos. Es una expectativa, NO plata ganada: solo se vuelve ganancia cuando el cliente paga.',
    formula: 'Lo que falta por cobrar menos el capital en la calle.',
    unidad: UNIDAD.DINERO,
    alcances: TODOS,
    filas: 'prestamos',
  },

  interesGanadoMes: {
    rotulo: 'Interés cobrado este mes',
    pregunta: 'De lo que entró este mes, ¿cuánto fue ganancia y no plata mía volviendo?',
    universo: 'La parte de interés de cada pago del mes. NO es lo recaudado: la mayor parte de lo que entra es el capital regresando, y recuperar plata propia no es ganar. Los préstamos con tabla de amortización aportan lo que dice su tabla, no un reparto plano.',
    formula: 'Suma de la parte de interés de los pagos del mes.',
    unidad: UNIDAD.DINERO,
    alcances: TODOS,
    filas: 'pagos',
  },

  gananciaMes: {
    rotulo: 'Ganancia del mes',
    pregunta: '¿Cuánto gané este mes, después de gastos?',
    universo: 'El interés cobrado en el mes menos los gastos APROBADOS del mes. NUNCA «lo recaudado menos gastos»: eso contaba como ganancia el capital propio regresando e inflaba la cifra más de cinco veces. Los gastos rechazados no restan: esa plata no salió.',
    formula: 'Interés cobrado del mes − gastos aprobados del mes.',
    unidad: UNIDAD.DINERO,
    alcances: TODOS,
    filas: null,
    notas: 'Aquí vivían DOS cifras con dos rótulos, «Ganancia neta» y «Utilidad neta», en la misma pantalla: una llevaba la corrección por tabla de amortización y la otra no.',
  },

  gastosMes: {
    rotulo: 'Gastos del mes',
    pregunta: '¿Cuánto se ha gastado este mes?',
    universo: 'Los gastos APROBADOS del mes. Los rechazados NO cuentan —esa plata no salió— y los pendientes tampoco hasta que el dueño los revise. En la caja del día la regla es otra a propósito: ahí el pendiente sí pesa, porque el cobrador ya lo sacó de su bolsillo.',
    formula: 'Suma de los gastos aprobados del mes.',
    unidad: UNIDAD.DINERO,
    alcances: TODOS,
    filas: 'gastos',
  },

  rentabilidadMes: {
    rotulo: 'Rentabilidad del mes',
    pregunta: 'Por cada 100 pesos que tengo afuera, ¿cuánto gané este mes?',
    universo: 'La ganancia del mes sobre el capital que está en la calle. NO sobre lo prestado alguna vez: con esa base el porcentaje sale hundido y no se puede comparar entre meses.',
    formula: 'Ganancia del mes ÷ capital en la calle × 100.',
    unidad: UNIDAD.PORCENTAJE,
    alcances: TODOS,
    filas: null,
  },

  capitalDisponible: {
    rotulo: 'Capital para prestar',
    pregunta: '¿Cuánto puedo prestar hoy sin quedarme sin caja?',
    universo: 'El saldo de la caja según el libro de movimientos. NO incluye lo que está en la calle: esa plata todavía no la tienes.',
    formula: 'El saldo actual del libro de capital.',
    unidad: UNIDAD.DINERO,
    alcances: [ALCANCE.ORGANIZACION],
    filas: 'movimientos',
  },

  sumaDeCuotas: {
    rotulo: 'Suma de las cuotas',
    pregunta: 'Si todos mis clientes pagaran su cuota el mismo día, ¿cuánto sería?',
    universo: 'La cuota de TODOS los préstamos activos, sin mirar qué día le toca a cada uno. Es un TECHO, NO la meta del día: si manejas semanales o quincenales, lo que de verdad toca hoy es mucho menos. Para la meta real está «Lo que tocaba cobrar».',
    formula: 'Suma de la cuota de cada préstamo activo.',
    unidad: UNIDAD.DINERO,
    alcances: TODOS,
    filas: 'prestamos',
    notas: 'Usarla como meta del día es lo que hacía que la pantalla dijera 48% y el consejo de abajo 9%, sobre el mismo día y el mismo negocio.',
  },

  // ── La gente ──

  clientesEnMora: {
    rotulo: 'Clientes en mora',
    pregunta: '¿A cuánta gente tengo que ir a cobrar?',
    universo: 'Clientes con al menos un préstamo activo que lleva UNO O MÁS días de atraso. Se cuenta por CLIENTE, no por préstamo: al que debe tres préstamos se le visita una vez. NO se excluye a nadie por su estado: el estado de un cliente moroso es literalmente «mora», y filtrarlo escondía a los que hay que ir a ver.',
    formula: 'Clientes con algún préstamo activo con días de atraso ≥ 1.',
    unidad: UNIDAD.CONTEO,
    alcances: TODOS,
    filas: 'clientes',
    notas: 'Filtrar por estado «activo» escondía 1.081 clientes y $631.726.806 del reporte de cartera, mientras la cifra de arriba en la misma pantalla sí los contaba.',
  },

  moraDura: {
    rotulo: 'Mora de más de una semana',
    pregunta: '¿Quiénes llevan tanto tiempo sin pagar que ya preocupan?',
    universo: 'Clientes con más de 7 días de atraso. NO incluye a los de uno a siete días: esos ya están en «Clientes en mora» y son otra cosa. Es una cifra distinta a propósito: uno de un día de atraso es un cobro pendiente, uno de un mes es un problema, y mezclarlos hace que ninguno de los dos números sirva.',
    formula: 'Clientes con algún préstamo activo con días de atraso > 7.',
    unidad: UNIDAD.CONTEO,
    alcances: TODOS,
    filas: 'clientes',
  },

  puntualidadCliente: {
    rotulo: 'Puntualidad',
    pregunta: 'De las cuotas que ya le tocaban, ¿cuántas ha pagado?',
    universo: 'Del CLIENTE: cuotas vencidas que están pagadas, sobre cuotas vencidas. Solo mira lo que ya venció; lo que todavía no toca no cuenta ni a favor ni en contra.',
    formula: 'Cuotas vencidas pagadas ÷ cuotas vencidas × 100.',
    unidad: UNIDAD.PORCENTAJE,
    alcances: [ALCANCE.CLIENTE, ALCANCE.PRESTAMO],
    filas: 'cuotas',
  },

  avanceRuta: {
    rotulo: 'Avance del día',
    pregunta: 'De lo que tocaba cobrar hoy en esta ruta, ¿cuánto lleva?',
    universo: 'De la RUTA y de HOY: lo cobrado hoy sobre lo que el calendario pedía hoy. No es la puntualidad de nadie: una ruta puede ir al 100% con clientes atrasados, si hoy no les tocaba.',
    formula: 'Cobrado hoy ÷ lo que tocaba cobrar hoy × 100.',
    unidad: UNIDAD.PORCENTAJE,
    alcances: [ALCANCE.RUTA, ALCANCE.COBRADOR],
    filas: null,
    notas: 'Compartía el rótulo «Cumple %» con la puntualidad del cliente, que es otra pregunta con otro universo y otro alcance.',
  },
})

/** La explicación de una cifra, o null si no está en el catálogo. */
export function explicar(id) {
  const e = DEFINICIONES[id]
  return e ? { id, ...e } : null
}

/**
 * El rótulo de una cifra. Es lo ÚNICO que la pantalla debería pintar.
 *
 * Devuelve `null` si no la conoce, para que se vea el hueco en vez de que la
 * pantalla se invente un nombre.
 */
export function rotulo(id) {
  return DEFINICIONES[id]?.rotulo ?? null
}

/**
 * Toda cifra que la pantalla pinte tiene que estar aquí.
 *
 * Se usa en la prueba de guardia: si alguien añade una cifra nueva sin escribir
 * su pregunta y su universo, la prueba se pone roja. Es lo que impide volver a
 * tener números que nadie sabe de dónde salen — que es como se llegó a 47
 * cifras en el panel y un botón de «mostrar más KPIs».
 */
export function faltanExplicacion(ids = []) {
  return ids.filter((id) => !DEFINICIONES[id])
}

/**
 * RÓTULOS QUE NO SE ESCRIBEN A MANO.
 *
 * Estos son los que ya se duplicaron o se contradijeron alguna vez. Si
 * reaparecen como texto literal en `app/` o `components/`, la prueba falla: hay
 * que pedirlos con `rotulo(id)`.
 *
 * La lista crece; no arranca con los 33 porque migrar toda la interfaz de golpe
 * es la clase de cambio que rompe pantallas sin que nadie lo note. Empieza por
 * los que costaron dinero.
 */
export const ROTULOS_PROTEGIDOS = Object.freeze([
  'capitalEnCalle',
  'gananciaMes',
  'gastosMes',
  'rentabilidadMes',
  'sumaDeCuotas',
  'clientesEnMora',
  'avanceRuta',
])

/** Rótulos que NINGUNA pantalla puede volver a usar, con el motivo. */
export const ROTULOS_PROHIBIDOS = Object.freeze({
  'Ganancia neta': 'Convivía con «Utilidad neta» en la misma pantalla y eran dos números distintos. Usa rotulo(\'gananciaMes\').',
  'Utilidad neta': 'Convivía con «Ganancia neta» en la misma pantalla y eran dos números distintos. Usa rotulo(\'gananciaMes\').',
  'Cumple %': 'Eran dos KPI bajo un rótulo: la puntualidad del cliente y el avance de cobro de la ruta. Usa rotulo(\'puntualidadCliente\') o rotulo(\'avanceRuta\').',
})
