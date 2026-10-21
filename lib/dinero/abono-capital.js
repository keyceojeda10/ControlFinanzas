// lib/dinero/abono-capital.js — qué cuotas toca un abono a capital, y cuáles no.
//
// ── EL FALLO QUE VIENE A CERRAR ────────────────────────────────────────────
// `app/api/prestamos/[id]/pagos/route.js` repartía el saldo nuevo sobre todas
// las filas «futuras», y «futura» estaba definida así:
//
//     const filasFuturas = filas.filter(f => (f.pagado || 0) < f.cuotaTotal)
//
// Eso no es «futura»: es «sin pagar». Una cuota ATRASADA y sin pagar entraba en
// el lote que se reprograma con fechas nuevas, y el atraso desaparecía. Nadie
// lo decidió — es el efecto lateral de esa condición. Un cliente que debía tres
// cuotas entregaba un abono a capital y salía al día.
//
// El dueño lo decidió: **el atraso se sigue debiendo**.
//
// ── POR QUÉ ESTO ES UN ARCHIVO Y NO UN FILTRO CORREGIDO EN SU SITIO ───────
// Porque partir el filtro a secas ROMPE la invariante, y en silencio.
//
// El saldo se repartía sobre `filasFuturas.length` periodos. Al sacar las
// vencidas de ese lote, el capital que llevaban dentro se queda huérfano y deja
// de cumplirse `Σ cuota.capital + Σ abonos === montoPrestado`: aparece capital
// de la nada o se evapora, según por dónde se mire. Es la misma familia que la
// línea «Ajustes» de la caja — números que se cancelan para que el total dé.
//
// Y vivía suelto dentro de una ruta de API, que es exactamente donde ninguna
// prueba lo alcanza. Ya me costó tres sumas que no sumaban en la caja del
// cobrador. Aquí las dos decisiones son puras y probadas; la ruta solo escribe.

import { inicioDia } from '@/lib/dinero/esperado'

/**
 * Reparte las filas de la tabla en las tres clases que el abono trata distinto.
 *
 * - `pagadas`  · ya cubiertas. No se tocan nunca, ni antes ni ahora.
 * - `vencidas` · su fecha ya pasó y siguen sin cubrirse. **NO se tocan**: son el
 *                atraso, y el atraso se sigue debiendo.
 * - `futuras`  · aún no vencen. Son las únicas que se reprograman.
 *
 * `hoy` entra por parámetro y no se lee del reloj aquí: una función que mira la
 * hora no se puede probar dos veces con el mismo resultado, y esta decide lo
 * que un cliente debe.
 *
 * El corte del día va con el mismo convenio que el resto del dinero
 * (`lib/dinero/esperado.js`): una cuota que vence HOY todavía no está vencida
 * —el cobrador aún puede pasar— así que va con las futuras.
 */
export function partirFilasParaAbono(filas = [], hoy = Date.now()) {
  const corte = inicioDia(hoy)
  const orden = [...(filas || [])].sort((a, b) => a.numeroPeriodo - b.numeroPeriodo)

  const pagadas = []
  const vencidas = []
  const futuras = []

  for (const f of orden) {
    if ((f.pagado || 0) >= f.cuotaTotal) { pagadas.push(f); continue }
    // Sin fecha no se puede afirmar que venció. Ante la duda va a futuras, que
    // es el comportamiento de siempre: esta función no puede inventar mora.
    const vence = f.fechaEsperada ? inicioDia(f.fechaEsperada) : null
    if (vence != null && vence < corte) vencidas.push(f)
    else futuras.push(f)
  }

  return { pagadas, vencidas, futuras }
}

/**
 * Cuánto capital le queda a las filas que SÍ se reprograman.
 *
 * Ésta es la línea donde estaba la trampa. La cuenta, dicha en palabras:
 *
 *     capital vivo (lo que aún no se ha pagado, según la tabla)
 *   − el abono que acaba de entrar
 *   − el capital que se quedan las vencidas, que no se tocan
 *   = lo que se reparte entre las futuras
 *
 * Restar el capital de las vencidas es lo que conserva la invariante: sin esa
 * resta, ese capital quedaría a la vez en las filas vencidas Y repartido otra
 * vez entre las futuras — contado dos veces.
 *
 * ⚠ Y esto es la OPCIÓN A, que se eligió a conciencia. La B era repartir el
 * capital de las vencidas entre las futuras, y deja la cuota vencida como una
 * deuda sin capital detrás: incoherente con la tabla que la propia app imprime
 * y con el recibo que el cliente tiene en la mano.
 */
export function capitalParaFuturas({ capitalAntesDelAbono = 0, abono = 0, vencidas = [] } = {}) {
  const retenido = (vencidas || []).reduce((a, f) => a + (Number(f.capital) || 0), 0)
  const vivo = Number(capitalAntesDelAbono) || 0
  return Math.max(0, vivo - (Number(abono) || 0) - retenido)
}

// ── Cuánto interés deja de cobrarse por un abono a
// capital en un préstamo SIN tabla.
//
// Era la misma cuenta escrita a mano en cinco sitios —el cobro, anular, la cola
// sin señal y dos veces en la hoja de pago— (DETALLES-PRESTAMOS #32). Cinco
// copias de una fórmula de plata son cinco sitios donde puede cambiar una sola.
// Esta es la de siempre, al peso: monto × tasa × (días que faltan / 30).
//
// Con tabla NO se usa: ahí el servidor rehace las cuotas desde el saldo y el
// ahorro sale de la tabla nueva, no de esta cuenta.
//
// `ahora` y `fechaInicio` van en ms o Date; `offsetHoras` es el desfase del país
// (Colombia −5) y se resta como lo hacían las cinco copias.

const DIA_MS = 24 * 60 * 60 * 1000

export function interesQueAhorraUnAbono({ monto, tasaInteres, diasPlazo, fechaInicio, ahora = Date.now(), offsetHoras = 5 }) {
  const m = Number(monto) || 0
  const tasa = Number(tasaInteres) || 0
  const plazo = Number(diasPlazo) || 0
  const inicio = new Date(fechaInicio).getTime()
  if (!(m > 0) || !(tasa > 0) || !(plazo > 0) || Number.isNaN(inicio)) return 0
  const local = new Date(ahora).getTime() - Math.abs(offsetHoras) * 60 * 60 * 1000
  const diasTrans = Math.max(0, Math.floor((local - inicio) / DIA_MS))
  const diasRest = Math.max(0, plazo - diasTrans)
  return Math.round(m * (tasa / 100) * (diasRest / 30))
}

// ══ EL GLOBO: CON QUÉ CAPITAL SE REHACEN LAS CUOTAS TRAS UN ABONO ═════════
//
// Solo para `solo_interes` (Globo). Los demás modos con tabla siguen por
// `capitalVivoSegunTabla` como siempre: nadie ha reportado nada de ellos y no
// se tocan (Carlos, 20 oct 2026).
//
// Reportado por Crediya (Yainer) el 20 oct 2026 con José Bernal: $750.000 al
// 10% mensual, abonos a capital, pagos de solo interés y completos. Tras un
// abono de $100.000 la app decía que debía $162.845; el capital que le quedaba
// era más que eso. Un Globo no puede deber menos que su capital.
//
// `capitalVivoSegunTabla` resta del capital lo que los pagos cubrieron de MÁS
// sobre las cuotas cerradas. Pero ese mismo dinero sigue contado como pagado en
// la cuenta acumulada (`coberturaDeLaTabla`, `calcularSaldoPendiente`): se
// restaba dos veces. A José se le iban $127.775 dos veces y la deuda caía de
// $254.200 a $162.845. En un Globo el capital vive en la última fila y no se
// paga hasta el final, así que el capital que queda es el de las filas que no
// están pagadas; el dinero de más sigue apuntado como pagado, una sola vez.
//
// ⚠ SOLO CAMBIA ALGO SI HABÍA DINERO DE MÁS. Sin pagos por encima de las cuotas
// cerradas, las dos cuentas dan lo mismo. Medido con la historia completa de
// los 14 Globo activos con abonos (.auditoria/_globo-replay.mjs, que reproduce
// al peso la base de 11 de ellos): solo cambia José.
//
// ⚠ Y NO SE TOCA EL INTERÉS DEL PERÍODO EN CURSO: el abono lo sigue bajando,
// como hasta hoy. Conservarlo era la forma de cobrar de un prestamista, y le
// subía la deuda a 9 préstamos de otros que la aceptan así (PEDRO GUTIERREZ,
// desde el arreglo de julio).

/** Globo: el capital que siguen debiendo las filas que no están pagadas. */
export function capitalQueSigueEnLaTabla({ vencidas = [], futuras = [] } = {}) {
  return [...(vencidas || []), ...(futuras || [])].reduce((a, f) => a + (Number(f.capital) || 0), 0)
}
