// lib/campos-recibo.js — Que campos puede llevar el comprobante de pago.
//
// Vive aparte del componente a proposito: es un dato, no interfaz, y asi se
// puede probar sin montar React. El editor lo reexporta para no romper imports.

export const CAMPOS_PREDEFINIDOS = [
  { campo: 'totalPagado',      nombre: 'Total pagado',         porDefecto: true },
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
