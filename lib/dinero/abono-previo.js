/**
 * EL ABONO PREVIO DE UN PRÉSTAMO MIGRADO.
 *
 * Cuando el prestamista mete en el sistema un préstamo que ya venía cobrando
 * fuera —de su cuaderno—, dice cuánto le habían pagado ya. Eso se guarda como
 * una fila `Pago` fechada en `fechaInicio`, y NO es un cobro de hoy.
 *
 * ⚠ ESTE FICHERO ES EL ÚNICO SITIO QUE PUEDE DECIDIR SI UN PAGO ES UN ABONO
 * PREVIO, igual que `entraAlFajo()` es el único que decide si un cobro entra al
 * fajo. La razón es la de siempre: había dos formas de reconocerlo y no
 * coincidían.
 *
 *   · `app/api/prestamos/route.js` escribe la nota «Abono previo (préstamo en
 *     curso)».
 *   · `app/api/carga-masiva/importar/route.js` escribe «Abono previo (carga
 *     masiva)».
 *   · `app/api/prestamos/[id]/aprobar/route.js` lo buscaba por
 *     `p.tipo === 'completo'`, que no es lo mismo: coge el primer pago normal
 *     que encuentre si el préstamo ya tiene cobros, y dejaría de encontrarlo el
 *     día que el abono se pueda marcar como capital o como interés.
 *
 * Se reconoce POR LA NOTA y no por una columna nueva a propósito: las 1.272
 * filas que ya existen en producción la tienen, así que no hace falta migrar el
 * esquema — que en este repo es donde se rompen los despliegues.
 */

/** El prefijo común de las dos notas. Todo lo que se escriba en el futuro
 *  tiene que empezar por aquí o dejará de reconocerse. */
export const PREFIJO_ABONO_PREVIO = 'Abono previo'

export const NOTA_ABONO_PREVIO_MANUAL = 'Abono previo (préstamo en curso)'
export const NOTA_ABONO_PREVIO_MASIVA = 'Abono previo (carga masiva)'

/** ¿Esta fila `Pago` es el abono previo de un préstamo migrado? */
export function esAbonoPrevio(pago) {
  return typeof pago?.nota === 'string' && pago.nota.startsWith(PREFIJO_ABONO_PREVIO)
}

/** El abono previo de un préstamo, si lo tiene. Uno solo: las tres vías que lo
 *  escriben crean exactamente una fila. */
export function abonoPrevioDe(prestamo) {
  return (prestamo?.pagos ?? []).find(esAbonoPrevio) ?? null
}

/* ⚠ CUÁNDO EL TIPO DEL ABONO CAMBIA LA DEUDA, Y CUÁNDO NO.
 *
 * Medido con las funciones reales el 26 ago 2026, mismo préstamo de $1.000.000
 * al 20 % mensual desde el 26 de junio con $400.000 abonados:
 *
 *   modo        capital vivo        próximo cobro       mora
 *   unico       666.667 → 600.000   25-sep → 25-OCT     0 → 0
 *   fijo        818.198 → 600.000   25-ago → 25-ago     1 → 1
 *   saldo       950.000 → 600.000   26-ago → 26-JUL     0 → 31 d
 *   lineal      833.333 → 600.000   26-ago → 26-JUL     0 → 31 d
 *   ABIERTO   1.000.000 → 600.000   igual               0 → 0
 *
 * En `unico` marcar «capital» le REGALA UN MES al cliente; en `saldo` y
 * `lineal` lo mete en 31 días de mora. El mismo hecho, la misma palabra del
 * prestamista, cuatro desenlaces distintos. La causa es `periodosCubiertos`
 * (`lib/calculos.js`), que cuenta lo pagado dividido entre la cuota: al bajar
 * el capital baja la cuota, así que el mismo abono «cubre» más períodos.
 *
 * El préstamo ABIERTO es el único donde la respuesta hace exactamente lo que
 * dice y nada más: no tiene tabla que regenerar y no pasa por esa función. Por
 * eso se pregunta ahí y solo ahí, hasta que `periodosCubiertos` se arregle en
 * sus TRES calcos a la vez (`lib/calculos.js`, `lib/whatsapp.js` y
 * `lib/whatsapp-plantillas.js`), que es otra tanda y mueve la mora de todo
 * préstamo del sistema que alguna vez recibió un abono a capital.
 */
export const TIPOS_ABONO_PREVIO = ['completo', 'capital', 'intereses']

export function sePreguntaElTipo({ modoInteres, sinPlazo } = {}) {
  return modoInteres === 'solo_interes' && !!sinPlazo
}
