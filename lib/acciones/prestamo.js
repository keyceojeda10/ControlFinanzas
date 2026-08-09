// lib/acciones/prestamo.js — cómo pide la gente cada cosa del préstamo.
//
// ══ POR QUÉ ═══════════════════════════════════════════════════════════════
//
// Las acciones del préstamo NO se listan aquí: se derivan de `gruposGestion`,
// que es la misma estructura con la que se pinta la hoja «Gestión». Duplicar la
// lista sería garantizar que un día se separen — se añade una fila al menú y la
// búsqueda no la encuentra, o al revés.
//
// Lo único que vive aquí son **los sinónimos**, que es lo que no está en
// ninguna parte del código: cómo llama la gente a cada cosa cuando pregunta.
//
// ⚠ NO SON INVENTADOS. Salen de cómo se pregunta por WhatsApp: «quiero
// prestarle más», «este señor no me va a pagar», «darle más tiempo». El nombre
// del menú («Renovar el préstamo», «Mover a perdidos») ya lo encuentra el
// emparejador solo; los sinónimos son para quien NO sabe cómo se llama.

/** Clave = `id` de la fila en `gruposGestion`. */
export const SINONIMOS_GESTION = {
  recargo: ['recargo', 'multa', 'cobrar mas por atraso', 'interes de mora', 'penalidad'],
  descuento: ['descuento', 'rebaja', 'perdonar', 'quitarle', 'bajarle la deuda'],
  plazo: ['plazo', 'mas tiempo', 'alargar', 'extender', 'mas cuotas', 'menos cuotas',
    'bajar la cuota', 'cambiar la cuota'],
  dia: ['dia de cobro', 'cambiar el dia', 'frecuencia', 'semanal', 'quincenal', 'mensual', 'diario'],
  proximo: ['proximo cobro', 'siguiente cobro', 'cuando le cobro', 'aplazar', 'correr la fecha'],
  sincobro: ['dias sin cobro', 'no cobrar domingo', 'festivos', 'dias que no cobro'],
  editar: ['editar', 'corregir', 'me equivoque', 'cambiar el monto', 'cambiar el interes'],
  renovar: ['renovar', 'renovacion', 'volver a prestar', 'prestarle mas', 'refinanciar',
    'nuevo prestamo al mismo', 'cartulina nueva'],
  anticipado: ['cerrar anticipado', 'liquidar', 'pagar todo', 'saldar', 'cancelar la deuda hoy',
    'si paga todo hoy', 'cuanto para salir'],
  perdidos: ['clavo', 'perdido', 'incobrable', 'no me va a pagar', 'dar por perdido', 'castigar'],
  recuperar: ['sacar de perdidos', 'recuperar', 'volvio a pagar', 'quitar el clavo'],
  cancelar: ['cancelar', 'anular el prestamo', 'eliminar el prestamo', 'borrar el prestamo',
    'deshacer el prestamo', 'nunca se le presto'],
}

/**
 * Acciones que NO están en la hoja «Gestión» pero también se preguntan mucho.
 * Cada una dice qué abrir; quien registra pone el `ejecutar`.
 */
export const EXTRAS_PRESTAMO = [
  { id: 'pagar', label: 'Registrar un pago',
    sinonimos: ['pagar', 'registrar pago', 'abono', 'me pago', 'recibir plata', 'cobrar'] },
  { id: 'abonos', label: 'Abonos y atajos de cobro',
    sinonimos: ['abono a capital', 'pagar mora', 'ponerse al dia', 'pagar intereses',
      'abono extraordinario'] },
  { id: 'historial', label: 'Ver y gestionar los pagos',
    sinonimos: ['historial', 'pagos hechos', 'anular pago', 'borrar un pago',
      'corregir la fecha de un pago', 'estado de cuenta'] },
  { id: 'pagare', label: 'Pagaré y comprobante',
    sinonimos: ['pagare', 'firma', 'firmar', 'comprobante del prestamo', 'documento'] },
  { id: 'whatsapp', label: 'Escribirle por WhatsApp',
    sinonimos: ['whatsapp', 'mandarle mensaje', 'recordarle', 'cobrarle por whatsapp'] },
]
