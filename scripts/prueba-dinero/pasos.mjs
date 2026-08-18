// La secuencia. Una función, no una lista: los cuatro modos comparten los
// mismos pasos y solo cambian los parámetros del préstamo.
//
// ── LOS MONTOS ──────────────────────────────────────────────────────────────
//
// Todos distintos, ninguno múltiplo de otro, y con terminaciones reconocibles
// (…700, …300, …900) para que al ver un total descuadrado se pueda leer qué
// sumando falta. Nada de múltiplos redondos de 100.000: enmascararían el
// `ceil100`, que es justo lo que hay que poder distinguir de un fallo real.

export const MODOS = {
  fijo: { etiqueta: 'clásico', modoInteres: 'fijo', tasa: 20, dias: 30, frecuencia: 'diario' },
  unico: { etiqueta: 'globo', modoInteres: 'unico', tasa: 15, dias: 30, frecuencia: 'mensual' },
  solo_interes: { etiqueta: 'solo interés', modoInteres: 'solo_interes', tasa: 10, dias: 90, frecuencia: 'mensual' },
  saldo: { etiqueta: 'sobre saldo', modoInteres: 'saldo', tasa: 8, dias: 120, frecuencia: 'mensual' },
  lineal: { etiqueta: 'decreciente', modoInteres: 'lineal', tasa: 12, dias: 90, frecuencia: 'mensual' },
  /* ⚠ EL PRÉSTAMO ABIERTO. No lleva `dias` porque no tiene plazo: es su razón
     de ser. La caja tiene que tratarlo igual que a los demás —el desembolso
     sale, el cobro entra— y lo que cambia es solo cómo se reparte por dentro. */
  abierto: { etiqueta: 'abierto', modoInteres: 'solo_interes', sinPlazo: true, tasa: 10, dias: 30, frecuencia: 'mensual' },
}

export const MONTOS = {
  prestamoA: 347000,   // el que se renovará
  prestamoB: 213000,   // desembolsado por transferencia
  cobroEfectivo: 41700,
  cobroTransferencia: 25300,
  cobroMetodoRaro: 12900,  // la sonda del método sin validar
  recargo: 8300,
  gasto: 6700,
  renovacion: 500000,
  renovacionDigital: 380000,  // la que se entrega por transferencia
  prestamoAnulado: 291000,    // se crea y se anula: NO debe contar
}

/* Los pasos, en orden. Cada uno declara QUÉ pide y QUÉ espera que cambie.
   El orquestador ejecuta, acumula y compara. */
export function construirPasos(modo) {
  const m = MODOS[modo]
  return [
    {
      id: 'P0', titulo: 'leer la caja en vacío', actor: 'owner',
      // El ancla de todo: si aquí no sale cero, la organización no está limpia
      // y cualquier descuadre posterior sería basura arrastrada.
      soloLeer: true, esperaTodoEnCero: true,
    },
    {
      id: 'P1', titulo: `préstamo A en efectivo (${m.etiqueta})`, actor: 'owner',
      tipo: 'prestamo', cliente: 0, monto: MONTOS.prestamoA, metodoPago: 'efectivo', ...m,
    },
    {
      id: 'P2', titulo: 'préstamo B por transferencia', actor: 'owner',
      // ⚠ `desembolsadoDia` NO distingue el método: resta igual. Si la caja
      // tratara distinto este préstamo que el de P1, sería un hallazgo.
      tipo: 'prestamo', cliente: 1, monto: MONTOS.prestamoB, metodoPago: 'transferencia', ...m,
    },
    {
      id: 'P3', titulo: 'cobro en efectivo (préstamo A)', actor: 'cobrador',
      tipo: 'cobro', enPrestamo: 'A', monto: MONTOS.cobroEfectivo,
      tipoPago: 'parcial', metodoPago: 'efectivo',
    },
    {
      id: 'P4', titulo: 'cobro por transferencia (préstamo B)', actor: 'cobrador',
      tipo: 'cobro', enPrestamo: 'B', monto: MONTOS.cobroTransferencia,
      tipoPago: 'parcial', metodoPago: 'transferencia',
    },
    {
      id: 'P5', titulo: 'cobro con método inválido «nequi» (préstamo A)', actor: 'cobrador',
      // LA SONDA. `pagos/route.js:354` degrada el método a null en la fila Pago
      // (la caja lo cuenta como efectivo), pero la línea 732 pasa el valor CRUDO
      // al MovimientoCapital. Hoy coinciden por accidente: los dos acaban
      // contando como efectivo. Este paso comprueba que siga siendo así.
      tipo: 'cobro', enPrestamo: 'A', monto: MONTOS.cobroMetodoRaro,
      tipoPago: 'parcial', metodoPago: 'nequi', esSonda: true,
    },
    {
      id: 'P6', titulo: 'recargo (préstamo A)', actor: 'owner',
      // Sube la deuda del cliente y NO toca la caja. Si la recogida sube, es
      // descuadre. `nota` es obligatoria para este tipo.
      tipo: 'cobro', enPrestamo: 'A', monto: MONTOS.recargo,
      tipoPago: 'recargo', nota: 'recargo de la prueba de flujo',
    },
    {
      id: 'P7', titulo: 'gasto SIN aprobar', actor: 'cobrador',
      // Separa la vista B de la A y la C: B solo cuenta gastos aprobados.
      // Es divergencia conocida, no fallo: se reporta y se sigue.
      tipo: 'gasto', monto: MONTOS.gasto,
    },
    {
      id: 'P8', titulo: 'aprobar ese gasto', actor: 'owner',
      // Ahora las tres vistas deben coincidir.
      tipo: 'aprobarGasto',
    },
    {
      id: 'P9', titulo: `renovación del préstamo A por ${MONTOS.renovacion.toLocaleString('es-CO')}`, actor: 'owner',
      // EL CASO REPORTADO. De la caja debe salir la DIFERENCIA redondeada al
      // centenar, no el monto entero.
      tipo: 'renovacion', enPrestamo: 'A', monto: MONTOS.renovacion, ...m,
    },
    {
      id: 'P10', titulo: 'renovación del préstamo B POR TRANSFERENCIA', actor: 'owner',
      // Hasta hoy la renovación no aceptaba método y todo se contaba como
      // efectivo: renovar pagando por Nequi le pedía al cobrador un fajo que
      // nunca tuvo. Este paso comprueba que la diferencia NO salga de su fajo.
      tipo: 'renovacion', enPrestamo: 'B', monto: MONTOS.renovacionDigital,
      porTransferencia: true, ...m,
    },
    {
      id: 'P11', titulo: 'préstamo que luego se ANULA', actor: 'owner',
      // El caso de JULIAN #7: creó y anuló tres préstamos, y su caja seguía
      // contándolos. La del administrador decía 150.000 y la suya 748.000.
      // Un préstamo anulado no sacó plata: no puede figurar en «lo que prestó».
      tipo: 'prestamo', cliente: 2, monto: MONTOS.prestamoAnulado,
      metodoPago: 'efectivo', seAnula: true, ...m,
    },
    {
      id: 'P12', titulo: 'leer las tres vistas', actor: 'owner',
      soloLeer: true,
    },
  ]
}
