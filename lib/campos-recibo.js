// lib/campos-recibo.js — Que campos puede llevar el comprobante de pago.
//
// Vive aparte del componente a proposito: es un dato, no interfaz, y asi se
// puede probar sin montar React. El editor lo reexporta para no romper imports.

export const CAMPOS_PREDEFINIDOS = [
  { campo: 'totalPagado',      nombre: 'Total pagado',         porDefecto: true },
  /* ⚠ LA RESTA, ESCRITA EN EL PAPEL (13 sep 2026).
   *
   * El comprobante decia cuanto se pago y cuanto queda, nunca cuanto se debia.
   * El cliente no puede comprobar la resta: ve «$50.000» y «$430.000» y tiene
   * que fiarse de que antes eran $480.000. Con esta linea la cuenta se lee
   * sola, y es el papel al que se recurre cuando hay discusion.
   *
   * ⚠ NO SE CALCULA SUMANDO EL PAGO AL SALDO NUEVO. Un abono a capital baja el
   * saldo MAS de lo pagado (se ahorra interes), una liquidacion tambien, y un
   * recargo lo sube. La cifra la mide el servidor DENTRO de la transaccion,
   * con el prestamo bloqueado, justo antes de escribir el pago (`saldoLocked`
   * en el POST de pagos). Sin ese dato la fila NO SE PINTA — ver `resolverCampo`.
   *
   * Va delante de `saldoPendiente` a proposito: se lee de arriba abajo.
   */
  { campo: 'saldoAntes',       nombre: 'Antes debía',          porDefecto: true },
  { campo: 'saldoPendiente',   nombre: 'Saldo pendiente',      porDefecto: true },
  { campo: 'totalAPagar',      nombre: 'Total a pagar',        porDefecto: true },
  { campo: 'cuota',            nombre: 'Cuota',                porDefecto: true },
  { campo: 'progreso',         nombre: 'Progreso',             porDefecto: true },
  { campo: 'montoPrestado',    nombre: 'Monto prestado',       porDefecto: false },
  { campo: 'frecuencia',       nombre: 'Frecuencia de pago',   porDefecto: false },
  { campo: 'fechaVencimiento', nombre: 'Fecha de vencimiento', porDefecto: false },
  { campo: 'numeroCuota',      nombre: 'Cuota actual',         porDefecto: false },
  { campo: 'cuotasRestantes',  nombre: 'Cuotas restantes',     porDefecto: false },
  { campo: 'diasMora',         nombre: 'Días en mora',         porDefecto: false },
  // Pedidos por un prestamista el 28 jul 2026. Su queja: el cliente paga de mas
  // y el recibo no le dice a donde fue esa plata.
  //
  // `excedente` es lo que sobro DESPUES de cubrir la cuota y la mora del dia, y
  // `excedenteAplicado` explica su destino: baja las cuotas siguientes, no el
  // capital. Para bajar capital hay un tipo de pago aparte.
  { campo: 'excedente',        nombre: 'Excedente del pago',   porDefecto: false },
  { campo: 'excedenteAplicado', nombre: 'A dónde va el excedente', porDefecto: false },
  // Los dos de mora van apagados a proposito: solo 4 de 375 negocios activos
  // tienen tasaMoratorio > 0 (1,1%). Encenderlos por defecto seria mostrar
  // "Mora: $0" a los otros 371.
  { campo: 'moraDiaria',       nombre: 'Mora por día',         porDefecto: false },
  { campo: 'totalMora',        nombre: 'Total mora',           porDefecto: false },
  /* ⚠ «A QUÉ SE APLICÓ ESTE PAGO», Y APAGADO A PROPÓSITO (15 sep 2026).
   *
   * Es el bloque con la barra de interés y capital. Se puso fijo el 14 sep y
   * el primer prestamista que lo vio pidió quitarlo el mismo día:
   *
   *   «Quiero cambiarle ese que dice interés del período y el abono al capital
   *    […] porque yo cobro un interés altico, pues la gente a veces ahí me
   *    marea.»
   *
   * Y tiene razón: el recibo es SU papel, y ahí va escrito a cuánto presta.
   * Pero a otros les resuelve la llamada de siempre —«abonué $250.000 y el
   * saldo casi no se movió»—, así que no es quitarlo, es que cada uno lo
   * decida. Como todo lo demás de esta lista.
   *
   * Nace APAGADO: un recibo que dice de menos no genera una queja del deudor;
   * uno que dice de más sí se la genera al prestamista, y ya pasó. Quien lo
   * quiera, lo enciende aquí.
   *
   * ⚠ NO SE PINTA COMO FILA. `resolverCampo` devuelve null para él a propósito:
   * este campo es el INTERRUPTOR del bloque, igual que `progreso` es el de la
   * barra. La cifra sigue viniendo del servidor atada al id del pago.
   */
  { campo: 'repartoDelPago',   nombre: 'A qué se aplicó el pago', porDefecto: false },
  { campo: 'clienteCedula',    nombre: 'Cédula',               porDefecto: false },
  { campo: 'clienteTelefono',  nombre: 'Teléfono',             porDefecto: false },
  { campo: 'ruta',             nombre: 'Ruta',                 porDefecto: false },
  { campo: 'cobrador',         nombre: 'Cobrador',             porDefecto: false },
]

export function getDefaultCampos() {
  return CAMPOS_PREDEFINIDOS
    .filter(c => c.porDefecto)
    .map(c => ({ tipo: 'dato', campo: c.campo, nombre: c.nombre }))
}

export const CAMPOS_DATO_LABELS = Object.fromEntries(
  CAMPOS_PREDEFINIDOS.map(c => [c.campo, c.nombre])
)
