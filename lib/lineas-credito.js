import { inicioDiaLocal } from '@/lib/calculos'

/**
 * Cuándo cae el próximo corte de una línea de crédito.
 *
 * En un cupo rotativo el corte es LA fecha que manda: es cuando se liquida el
 * interés del ciclo. La lámina T30-04 la sube al segundo lugar de la pantalla
 * por eso mismo — hoy vive en un gris de 12px al lado de la cédula.
 *
 * ⚠ EL MES CORTO. `diaCorte` es un entero y su valor por defecto es 30, así que
 * «30 de febrero» no es un caso raro: es el caso por defecto una vez al año.
 * `new Date(2026, 1, 30)` NO falla, se desborda al 2 de marzo en silencio, y el
 * corte se le correría dos días al cliente sin que nadie vea un error. Se topa
 * al último día real del mes, que es lo que hace cualquier banco con un cupo
 * facturado el 31.
 *
 * Las fechas van por `inicioDiaLocal` —medianoche local expresada como T05:00Z—
 * que es el convenio del resto del sistema. Sin eso, la comparación «¿ya pasó
 * el corte de este mes?» da distinto en producción (UTC) que en un portátil en
 * Bogotá, y el fallo es invisible en local.
 *
 * @param {number} diaCorte  día del mes pactado (1-31)
 * @param {Date|number} desde  referencia; por defecto, ahora
 * @param {number} offsetHoras  huso del país (-5 Colombia, -6 México…)
 * @returns {{ fecha: Date, dias: number }}
 */
export function calcularProximoCorte(diaCorte, desde = Date.now(), offsetHoras = -5) {
  const hoy = inicioDiaLocal(desde, offsetHoras)
  const dia = Math.min(Math.max(Math.round(Number(diaCorte) || 30), 1), 31)

  const enMes = (anio, mes) => {
    // Día 0 del mes SIGUIENTE = último día de este. Así se sabe si el mes llega
    // hasta el día pactado sin tener que saberse los meses de 30 y 31.
    const ultimo = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate()
    return inicioDiaLocal(
      new Date(Date.UTC(anio, mes, Math.min(dia, ultimo), 12, 0, 0)),
      offsetHoras,
    )
  }

  const anio = hoy.getUTCFullYear()
  const mes = hoy.getUTCMonth()

  // El corte de HOY todavía cuenta como próximo: el día del corte el interés aún
  // no está liquidado, y decirle al prestamista «faltan 30 días» la mañana en
  // que le toca cobrar sería justo lo contrario de lo que necesita ver.
  let fecha = enMes(anio, mes)
  if (fecha.getTime() < hoy.getTime()) fecha = enMes(anio, mes + 1)

  const dias = Math.round((fecha.getTime() - hoy.getTime()) / 86400000)
  return { fecha, dias }
}

/** «hoy» / «mañana» / «en 5 días» — lo que se lee de un vistazo. */
export function textoProximoCorte(dias) {
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'mañana'
  return `en ${dias} días`
}
