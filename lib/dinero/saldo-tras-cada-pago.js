// lib/dinero/saldo-tras-cada-pago.js — «Quedó en $X» de cada pago del historial.
//
// No hay un saldo guardado por pago: la ficha lo reconstruye hacia atrás desde
// el saldo de hoy. Lo hacía sumando cada pago y saltándose el resto, y salía mal
// después de un recargo, un descuento, un abono a capital o un pago de solo
// interés (DETALLES-PRESTAMOS #24), porque esos mueven el TOTAL, no solo lo
// pagado (saldo = total − pagado).
//
// Cada movimiento se deshace como lo hizo el servidor (app/api/prestamos/[id]/pagos):
//   · recargo   → subió el total: antes debía MENOS.
//   · descuento → bajó el total: antes debía MÁS.
//   · interés que sube la deuda (modos sin tabla) → el total subió lo mismo que
//     se pagó: el saldo no cambió.
//   · abono a capital sin tabla → bajó lo pagado Y el total, por el interés que
//     ahorró (`interesQueAhorraUnAbono`, la misma cuenta del servidor).
//   · cualquier otro pago → antes debía el pago más.
//
// Lo que NO se puede deshacer desde aquí —un abono con tabla (se regenera), un
// cierre anticipado (perdona interés) o un préstamo abierto (el interés se
// devenga con los días)— corta la cuenta: de ahí hacia atrás no se pone cifra.
// Mejor ninguna que una mentira.
import { interesQueAhorraUnAbono } from '@/lib/dinero/abono-capital'
import { elInteresSubeLaDeuda } from '@/lib/dinero/modos'
import { tieneTablaAmortizacion, esAbiertoConDevengo } from '@/lib/calculos'

const NO_SON_PAGOS = ['recargo', 'descuento']

function subeLaDeudaSinRomper(prestamo) {
  // Sin las filas de la tabla en caché `elInteresSubeLaDeuda` revienta a
  // propósito; aquí (pantalla sin señal) se decide por el modo.
  try { return elInteresSubeLaDeuda(prestamo) } catch { return !conTablaPorModo(prestamo) }
}
function conTablaPorModo(p) {
  return ['lineal', 'lineal_dinamico', 'solo_interes', 'saldo'].includes(p?.modoInteres)
}

/**
 * HACIA ADELANTE: qué le hace un pago al préstamo, para la pantalla SIN SEÑAL
 * (DETALLES-PRESTAMOS #39). El recibo restaba el monto para cualquier tipo:
 * un «Solo interés» en Clásico —que sube el total lo mismo que se paga— salía
 * bajando el saldo, y con señal no lo bajaba. Las mismas reglas que deshace
 * `saldoTrasCadaPago`, al revés.
 *
 * @returns {{ totalAPagar: number, totalPagado: number, saldo: number }}
 */
export function efectoDelPago(prestamo, { tipo = 'completo', monto, ahora = Date.now(), offsetHoras = 5 }) {
  const m = Math.round(Number(monto) || 0)
  let total = Number(prestamo?.totalAPagar) || 0
  let pagado = Number(prestamo?.totalPagado) || 0
  if (tipo === 'recargo') total += m
  else if (tipo === 'descuento') total = Math.max(pagado, total - m)
  else {
    pagado += m
    if (tipo === 'intereses' && subeLaDeudaSinRomper(prestamo)) total += m
    if (tipo === 'capital' && !conTablaPorModo(prestamo)) {
      const ahorro = interesQueAhorraUnAbono({
        monto: m, tasaInteres: prestamo?.tasaInteres, diasPlazo: prestamo?.diasPlazo,
        fechaInicio: prestamo?.fechaInicio, ahora, offsetHoras,
      })
      total = Math.max(pagado, total - ahorro)
    }
  }
  return { totalAPagar: total, totalPagado: pagado, saldo: Math.max(0, Math.round(total - pagado)) }
}

/**
 * El interés que perdonó un abono a capital, para la pastilla «−$X int.» de
 * cada pago (DETALLES-PRESTAMOS #71). Es lo que descontó el servidor
 * (`interesQueAhorraUnAbono` con la fecha del abono), la misma cuenta que
 * deshace `saldoTrasCadaPago`. Antes la pastilla ponía monto × tasa: «−$20.000»
 * donde se perdonaron $14.667.
 * Con tabla el abono rehace las cuotas y lo perdonado no se puede reconstruir
 * desde aquí: `null`, sin cifra. Mejor ninguna que una mentira.
 */
export function interesPerdonadoPorElAbono(prestamo, pago, { offsetHoras = 5 } = {}) {
  if (pago?.tipo !== 'capital') return null
  const conTabla = Array.isArray(prestamo?.cuotasAmortizacion)
    ? tieneTablaAmortizacion(prestamo)
    : conTablaPorModo(prestamo)
  if (conTabla) return null
  const ahorro = interesQueAhorraUnAbono({
    monto: pago.montoPagado, tasaInteres: prestamo?.tasaInteres, diasPlazo: prestamo?.diasPlazo,
    fechaInicio: prestamo?.fechaInicio, ahora: pago.fechaPago, offsetHoras,
  })
  return ahorro > 0 ? ahorro : null
}

/**
 * @returns {Array<{ pago, saldoDespues: number|null }>} los `limite` pagos de
 *   verdad más recientes, del más nuevo al más viejo.
 */
export function saldoTrasCadaPago(prestamo, saldoActual, { limite = 3, offsetHoras = 5 } = {}) {
  const movimientos = [...(prestamo?.pagos || [])]
    .sort((a, b) => new Date(b.fechaPago) - new Date(a.fechaPago))
  const conTabla = tieneTablaAmortizacion(prestamo ?? {})
  const subeLaDeuda = subeLaDeudaSinRomper(prestamo)
  // Un abierto devenga interés con los días: el total cambia sin ningún pago.
  let saldo = esAbiertoConDevengo(prestamo ?? {}) ? null : Math.round(Number(saldoActual) || 0)

  const filas = []
  for (const m of movimientos) {
    if (filas.length >= limite) break
    const monto = Math.round(Number(m.montoPagado) || 0)
    if (!NO_SON_PAGOS.includes(m.tipo)) filas.push({ pago: m, saldoDespues: saldo })
    if (saldo == null) continue

    // Deshacer el movimiento: el saldo que había JUSTO ANTES.
    if (m.tipo === 'recargo') saldo -= monto
    else if (m.tipo === 'descuento') saldo += monto
    else if (m.tipo === 'intereses' && subeLaDeuda) saldo += 0
    else if (m.tipo === 'capital') {
      if (conTabla) { saldo = null; continue }
      saldo += monto + interesQueAhorraUnAbono({
        monto, tasaInteres: prestamo.tasaInteres, diasPlazo: prestamo.diasPlazo,
        fechaInicio: prestamo.fechaInicio, ahora: m.fechaPago, offsetHoras,
      })
    } else if (m.tipo === 'liquidacion') { saldo = null; continue }
    else saldo += monto
    saldo = Math.max(0, saldo)
  }
  return filas
}
