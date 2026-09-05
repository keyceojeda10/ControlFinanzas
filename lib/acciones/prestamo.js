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
  /* ⚠ COMO LO ESCRIBIÓ UN PRESTAMISTA (5 sep 2026): «sumarle 15 % más de
     interés a lo que ya debe». Ninguno de los sinónimos de entonces —multa,
     penalidad, interés de mora— casaba con «sumar», «más interés» ni «lo que
     debe», y el buscador contestó «no encontré eso aquí». */
  recargo: ['recargo', 'multa', 'cobrar mas por atraso', 'interes de mora', 'penalidad',
    'sumar interes', 'sumarle', 'mas interes', 'mas de interes', 'porcentaje', 'por ciento',
    'subirle', 'cobrarle mas', 'lo que debe', 'lo que ya debe', 'al saldo'],
  descuento: ['descuento', 'rebaja', 'perdonar', 'quitarle', 'bajarle la deuda'],
  plazo: ['plazo', 'mas tiempo', 'alargar', 'extender', 'mas cuotas', 'menos cuotas',
    'bajar la cuota', 'cambiar la cuota'],
  dia: ['dia de cobro', 'cambiar el dia', 'frecuencia', 'semanal', 'quincenal', 'mensual', 'diario'],
  proximo: ['proximo cobro', 'siguiente cobro', 'cuando le cobro', 'aplazar', 'correr la fecha'],
  sincobro: ['dias sin cobro', 'no cobrar domingo', 'festivos', 'dias que no cobro'],
  editar: ['editar', 'corregir', 'me equivoque', 'cambiar el monto', 'cambiar el interes'],
  renovar: ['renovar', 'renovacion', 'volver a prestar', 'prestarle mas', 'refinanciar',
    'nuevo prestamo al mismo', 'cartulina nueva', 'otro mes de interes', 'cobrarle otro mes'],
  /* ⚠ CÓMO SE PIDE ESTO NO SE PARECE AL NOMBRE DE LA FILA.
     El prestamista que lo pidió lo escribió así: «una persona tiene un préstamo
     con el modo Globo, o sea paga solo intereses, pero ha decidido comenzar a
     pagar por cuotas e interés a la vez, o sea modo banco, intereses sobre
     saldos». Ninguna de esas palabras está en «Cambiar el modo de cobro», así
     que sin sinónimos la función existe y no se encuentra — que es como si no
     existiera. Van los NOMBRES de los modos, que es como los llama la gente. */
  'cambiar-modo': ['cambiar el modo', 'modo de interes', 'modo de cobro', 'cambiar el interes',
    'modo banco', 'interes sobre saldos', 'sobre saldo', 'sobre lo que falta',
    'globo', 'solo interes', 'pasar a cuotas', 'cuota fija', 'que pague cuotas',
    'decreciente', 'frances', 'ya no quiere globo'],
  anticipado: ['cerrar anticipado', 'liquidar', 'pagar todo', 'saldar', 'cancelar la deuda hoy',
    'si paga todo hoy', 'cuanto para salir'],
  perdidos: ['clavo', 'perdido', 'incobrable', 'no me va a pagar', 'dar por perdido', 'castigar'],
  recuperar: ['sacar de perdidos', 'recuperar', 'volvio a pagar', 'quitar el clavo'],
  cancelar: ['cancelar', 'anular el prestamo', 'nunca se le presto', 'dejarlo sin efecto'],
  /* ⚠ «BORRAR» Y «ELIMINAR» SE FUERON DE `cancelar` A PROPOSITO.
     Estaban las dos aqui, y son OTRA cosa: cancelar deja el prestamo a la
     vista con sus cobros; eliminar lo quita y devuelve la caja. Crediya
     escribio «Borrar» buscando lo segundo y, ademas, su prestamo ya estaba
     cancelado —asi que esa fila ni salia— y se quedo sin nada. */
  eliminar: ['eliminar', 'borrar', 'borrar el prestamo', 'eliminar el prestamo',
    'quitar el prestamo', 'deshacer el prestamo', 'me equivoque', 'que no aparezca',
    'sacarlo de la lista'],
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
    /* ⚠ COMPARTIR EL RECIBO SE BUSCA DESDE AQUÍ, porque es donde vive: dentro
       de la tarjeta de cada pago. No tiene fila propia en ningún menú, así que
       sin estas palabras no se encuentra por ningún lado. */
    sinonimos: ['historial', 'pagos hechos', 'anular pago', 'borrar un pago',
      'corregir la fecha de un pago', 'estado de cuenta',
      'compartir el recibo', 'mandar el recibo', 'recibo en imagen', 'enviar comprobante',
      'reenviar el recibo', 'imprimir el recibo', 'quitar un pago mal hecho'] },
  { id: 'pagare', label: 'Pagaré y comprobante',
    sinonimos: ['pagare', 'firma', 'firmar', 'comprobante del prestamo', 'documento'] },
  { id: 'whatsapp', label: 'Escribirle por WhatsApp',
    sinonimos: ['whatsapp', 'mandarle mensaje', 'recordarle', 'cobrarle por whatsapp'] },
]
