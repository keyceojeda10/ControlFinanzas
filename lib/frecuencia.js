// lib/frecuencia.js — cómo se nombra el periodo de una cuota, en un solo sitio.
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «En el valor de la cuota no dice si esa cuota es diaria, semanal, quincenal o
// mensual. Solo dice Rosa Suárez, $8.000.»
//
// Y $8.000 al día y $8.000 al mes son dos negocios distintos. Sin el periodo,
// el número no significa nada: ni para cobrarlo ni para comparar una tarjeta
// con la de al lado.
//
// El rótulo estaba escrito a mano en cuatro sitios —la ficha del préstamo, la
// ruta, el PDF, el detalle— y cada uno con sus palabras: «Diario», «/día»,
// «diario». Aquí está una vez.
//
// ⚠ `'varias'` NO es una frecuencia: es lo que devuelven los APIs cuando un
// cliente tiene varios préstamos con periodos distintos. Rotular esa tarjeta
// con la frecuencia de uno solo es mentir, y el cobrador acaba pidiendo la
// cuota del día equivocado. En ese caso no se pone rótulo.

const PERIODOS = {
  diario: { nombre: 'diaria', sufijo: '/día', titulo: 'Diario' },
  semanal: { nombre: 'semanal', sufijo: '/sem', titulo: 'Semanal' },
  quincenal: { nombre: 'quincenal', sufijo: '/qna', titulo: 'Quincenal' },
  mensual: { nombre: 'mensual', sufijo: '/mes', titulo: 'Mensual' },
}

/** El rótulo que va encima del número: «CUOTA DIARIA». `null` si no se sabe. */
export function rotuloCuota(frecuencia) {
  const p = PERIODOS[frecuencia]
  return p ? `Cuota ${p.nombre}` : null
}

/** La coletilla corta para pegar a una cifra en una tabla: `$20.000/sem`. */
export function sufijoFrecuencia(frecuencia) {
  return (PERIODOS[frecuencia] ?? PERIODOS.diario).sufijo
}

/** El nombre suelto, con mayúscula: «Quincenal». */
export function tituloFrecuencia(frecuencia) {
  return (PERIODOS[frecuencia] ?? PERIODOS.diario).titulo
}
