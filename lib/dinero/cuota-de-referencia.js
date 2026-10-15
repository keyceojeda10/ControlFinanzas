/* ── ¿EL PAGO CUBRIÓ LA CUOTA, SE QUEDÓ CORTO O PAGÓ DE MÁS? (12 oct 2026) ────
 *
 * Soporte del dueño: Jannette Díaz, cuota de $450.000 al mes. Le cambió el
 * monto a $200.000 en la hoja de pago y el historial dijo «Completo». Y al
 * revés: $500.000 salía «Completo» también, sin decir que hubo $50.000 de más.
 *
 * La causa: la hoja decide `tipo` UNA vez, al abrirse, con el monto que
 * propone; si se cambia el monto, el tipo no se vuelve a calcular y el servidor
 * guarda lo que le llega.
 *
 * ⚠ NO SE ARREGLA CAMBIANDO `tipo`. Ese campo lo leen cálculos de plata:
 *   · `PAGOS_DEL_CALCULO` (pagos-del-calculo.js) solo cuenta los «completo» del
 *     préstamo abierto: un «parcial» ahí no lo vería el saldo;
 *   · `interes-cobrado.js` reparte interés y capital distinto según el tipo.
 * Guardar más «parcial» habría movido saldos y ganancias en silencio. Por eso
 * el pago guarda aparte la CUOTA QUE TOCABA cuando se cobró (`cuotaEsperada`),
 * calculada en el servidor, y la etiqueta sale de comparar contra ella.
 *
 * La cuota que tocaba es la MISMA que propone la hoja (`montoInicial` de
 * RegistrarPago.jsx): la cuota, o lo que falta de una cuota a medio pagar, y
 * nunca más que el saldo. Si no fuera la misma, completar una cuota a medias
 * saldría «parcial».
 */

/**
 * @param {{ cuota?: number, saldo?: number, alDia?: number }} p
 *   cuota  `prestamo.cuotaDiaria`
 *   saldo  lo que debía ANTES del pago
 *   alDia  `calcularMontoParaPonerseAlDia` ANTES del pago
 * @returns {number|null} null si el préstamo no tiene cuota (no hay con qué comparar)
 */
export function cuotaDeReferencia({ cuota, saldo, alDia } = {}) {
  const c = Math.round(Number(cuota) || 0)
  if (!(c > 0)) return null
  const falta = Math.round(Number(alDia) || 0)
  const ref = falta > 0 && falta < c ? falta : c
  const s = Math.round(Number(saldo) || 0)
  const r = s > 0 ? Math.min(s, ref) : ref
  return r > 0 ? r : null
}

/** Los tipos que son «pago de cuota»: los demás (capital, interés, recargo…) dicen lo suyo. */
const DE_CUOTA = ['completo', 'parcial']

/**
 * Cómo fue el pago frente a la cuota que tocaba.
 * @returns {{ clase: 'completo'|'parcial'|'extra', cuota: number|null, diferencia: number }|null}
 *   null si no es un pago de cuota. Sin `cuotaEsperada` (pagos de antes del 12
 *   oct) se queda con lo que diga `tipo`.
 */
export function comoFueElPago({ tipo, montoPagado, cuotaEsperada } = {}) {
  if (!DE_CUOTA.includes(tipo)) return null
  const ref = Math.round(Number(cuotaEsperada) || 0)
  if (!(ref > 0)) return { clase: tipo === 'parcial' ? 'parcial' : 'completo', cuota: null, diferencia: 0 }
  const diferencia = Math.round(Number(montoPagado) || 0) - ref
  if (diferencia < 0) return { clase: 'parcial', cuota: ref, diferencia }
  if (diferencia > 0) return { clase: 'extra', cuota: ref, diferencia }
  return { clase: 'completo', cuota: ref, diferencia: 0 }
}

/**
 * Lo que falta HOY de la cuota que tocaba cuando se empezó a cobrar, o null si
 * hoy no hubo un pago de cuota con `cuotaEsperada` (entonces no se sabe).
 *
 * El aviso «Cobrado hoy · parcial» lo deducía de que la cuota que toca AHORA
 * fuera menor que la cuota. Pero tras un pago CON EXTRA la siguiente también
 * queda menor —lo adelantado se descuenta—, y el aviso decía «faltan $90.000»
 * sobre el pago que la lista, dos centímetros más abajo, llamaba «Con extra»
 * (Crediya, 15 oct 2026). Ahora sale de la misma comparación que la lista.
 */
export function faltaDeLaCuotaDeHoy(pagosDeHoy = []) {
  const deCuota = (pagosDeHoy ?? [])
    .filter((p) => DE_CUOTA.includes(p.tipo))
    .sort((a, b) => new Date(a.createdAt ?? a.fechaPago) - new Date(b.createdAt ?? b.fechaPago))
  const desde = deCuota.findIndex((p) => Number(p.cuotaEsperada) > 0)
  if (desde < 0) return null
  const pagado = deCuota.slice(desde).reduce((s, p) => s + (Number(p.montoPagado) || 0), 0)
  return Math.max(0, Math.round(Number(deCuota[desde].cuotaEsperada) - pagado))
}

/** El texto corto para pastillas y mensajes. `fmt` formatea plata. */
export function textoDelPago(como, fmt = (n) => `$${Math.round(n).toLocaleString('es-CO')}`) {
  if (!como) return null
  /* «Le tocaba», no «la cuota»: tras un abono parcial lo que toca es lo que
     FALTA de la cuota ($250.000 de una de $450.000), y llamarlo «cuota de
     $250.000» confunde. */
  if (como.clase === 'parcial') {
    return { etiqueta: 'Parcial', detalle: como.cuota ? `Le tocaba ${fmt(como.cuota)} · pagó ${fmt(como.cuota + como.diferencia)} · faltaron ${fmt(-como.diferencia)}` : null }
  }
  if (como.clase === 'extra') {
    return { etiqueta: 'Con extra', detalle: `Le tocaba ${fmt(como.cuota)} · pagó ${fmt(como.diferencia)} de más` }
  }
  return { etiqueta: 'Completo', detalle: null }
}

/** Las filas del recibo (`Recibo.frenteACuota`), o null si fue la cuota justa. */
export function frenteACuotaDe(pago, fmt) {
  const como = comoFueElPago(pago)
  if (!como?.cuota || como.clase === 'completo') return null
  return como.clase === 'parcial'
    ? { cuota: fmt(como.cuota), faltaron: fmt(-como.diferencia) }
    : { cuota: fmt(como.cuota), deMas: fmt(como.diferencia) }
}

const ETIQUETA_TIPO = {
  completo: 'Pago completo', parcial: 'Pago parcial', capital: 'Abono a capital',
  recargo: 'Recargo', descuento: 'Descuento', intereses: 'Pago de interés', liquidacion: 'Cierre del préstamo',
}

/**
 * La etiqueta de un pago en el historial que se manda o se imprime. Antes había
 * TRES copias de `getTipoPagoLabel(tipo)` (WhatsApp, plantillas, la imagen) y
 * las tres decían «Pago completo» a $200.000 de una cuota de $450.000.
 */
export function etiquetaDelPago(pago, fmt = (n) => `$${Math.round(n).toLocaleString('es-CO')}`) {
  const como = comoFueElPago(pago)
  if (como?.cuota && como.clase === 'parcial') return `Pago parcial (le tocaba ${fmt(como.cuota)}, faltaron ${fmt(-como.diferencia)})`
  if (como?.cuota && como.clase === 'extra') return `Pago con ${fmt(como.diferencia)} de más`
  if (como) return como.clase === 'parcial' ? 'Pago parcial' : 'Pago completo'
  return ETIQUETA_TIPO[pago?.tipo] || 'Pago'
}
