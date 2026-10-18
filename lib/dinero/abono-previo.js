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

/* ══ LOS MIGRADOS NO SON PLATA DEL DÍA (decisión del dueño, 18 oct 2026) ══════
 *
 * Pasar al sistema un préstamo que ya estaba en la calle asienta su desembolso
 * completo el día que se carga, y su abono previo con la fecha de inicio. La
 * caja contaba los dos como si la plata se hubiera movido: el día de la carga,
 * «Lo que prestaste» con préstamos entregados hace meses (a Andrés le salían
 * $200.000 de Luz Marina, migrada de septiembre), y el día de inicio, «Lo que
 * entró» con un cobro que nunca pasó por la caja. Medido el 18 oct: 2.134
 * desembolsos de migrados ($1.552.116.061) y 1.622 abonos previos en 95
 * negocios; ningún cierre de cobrador guardado caía en uno de esos días.
 *
 * El dueño decidió: el migrado sigue moviendo el CAPITAL (la plata está en la
 * calle), pero no es billete que entra o sale de la caja ese día. Se reconoce
 * aquí y solo aquí, igual que el abono previo:
 *   · un préstamo es migrado si tiene su abono previo, o si su desembolso es de
 *     la carga masiva («… (carga masiva) - …»);
 *   · el asiento de su desembolso original y el de su abono previo son
 *     «asientos de migración»: el libro los cuenta en su propia línea. */

/** Para los `where` de Prisma: los pagos que NO son un abono previo. ⚠ Con
 *  `NOT startsWith` a secas, MariaDB deja fuera también las notas NULL —que
 *  son casi todos los pagos—, por eso va el `OR` con `null`. */
export const SIN_ABONO_PREVIO = {
  OR: [{ nota: null }, { NOT: { nota: { startsWith: PREFIJO_ABONO_PREVIO } } }],
}

const ES_DE_CARGA_MASIVA = /\(carga masiva\)/i
const ES_RECAUDO_PREVIO = /^Abono previo/i
const ES_DESEMBOLSO_EDITADO = /^(Desembolso actualizado|Reverso desembolso - edici[óo]n)/i

/** Los préstamos migrados entre `prestamoIds` (un `Set` de ids). */
export async function prestamosMigrados(db, prestamoIds = []) {
  const ids = [...new Set((prestamoIds || []).filter(Boolean))]
  if (!ids.length) return new Set()
  const [conAbono, deCarga] = await Promise.all([
    db.pago.findMany({
      where: { prestamoId: { in: ids }, nota: { startsWith: PREFIJO_ABONO_PREVIO } },
      select: { prestamoId: true },
    }),
    db.movimientoCapital.findMany({
      where: { referenciaTipo: 'prestamo', referenciaId: { in: ids }, tipo: 'desembolso', descripcion: { contains: '(carga masiva)' } },
      select: { referenciaId: true },
    }),
  ])
  return new Set([...conAbono.map((p) => p.prestamoId), ...deCarga.map((m) => m.referenciaId)])
}

/** ¿Este asiento de capital es la entrada de un préstamo migrado? `migrados`
 *  es el `Set` de `prestamosMigrados`; sin él se reconocen los que lo dicen en
 *  su descripción (la carga masiva y los abonos previos). La edición del mismo
 *  día de un migrado se trata en `resumirLibro`, que ve la pareja entera. */
export function esAsientoDeMigracion(mov, migrados = null) {
  const d = mov?.descripcion || ''
  if (mov?.tipo === 'recaudo') return ES_RECAUDO_PREVIO.test(d)
  if (mov?.tipo !== 'desembolso') return false
  // La reserva de ruta no movió la caja: no es la entrada de nadie.
  if (mov?.ajusteArranqueRuta) return false
  if (ES_DE_CARGA_MASIVA.test(d)) return true
  if (ES_DESEMBOLSO_EDITADO.test(d)) return false
  return Boolean(mov?.referenciaTipo === 'prestamo' && mov?.referenciaId && migrados?.has(mov.referenciaId))
}
