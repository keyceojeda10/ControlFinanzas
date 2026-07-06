// lib/tips/prestamoTips.js — Generador de tips para detalle de prestamo (logica pura, sin API)

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export function generarTipPrestamo(prestamo, pagos = []) {
  if (!prestamo) return null

  // Mora creciente
  if ((prestamo.diasMora ?? 0) > 5) {
    const ultimoPago = pagos.length > 0 ? pagos[0] : null
    if (ultimoPago) {
      const fecha = new Date(ultimoPago.fechaPago).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
      return `Lleva ${prestamo.diasMora} días sin pagar — último pago fue el ${fecha}. Contactar pronto.`
    }
    return `Lleva ${prestamo.diasMora} días en mora — priorizar cobro de este préstamo.`
  }

  // Cerca de terminar
  const totalCuotas = prestamo.diasPlazo ?? 0
  const cuotasPagadas = totalCuotas - (prestamo.cuotasPendientes ?? 0)
  if (totalCuotas > 0 && prestamo.cuotasPendientes > 0 && prestamo.cuotasPendientes <= 5) {
    return `Faltan solo ${prestamo.cuotasPendientes} cuotas para completar — cliente casi termina.`
  }

  // Patron de dia de pago
  if (pagos.length >= 5) {
    const conteo = [0, 0, 0, 0, 0, 0, 0]
    pagos.slice(0, 20).forEach(p => {
      const dia = new Date(p.fechaPago).getDay()
      conteo[dia]++
    })
    const maxIdx = conteo.indexOf(Math.max(...conteo))
    const maxCount = conteo[maxIdx]
    if (maxCount >= 3 && maxCount / Math.min(pagos.length, 20) > 0.35) {
      return `Este cliente suele pagar los ${DIAS_SEMANA[maxIdx]}. Programa tu visita ese dia.`
    }
  }

  // Metodo de pago preferido
  if (pagos.length >= 3) {
    const metodos = {}
    pagos.slice(0, 15).forEach(p => {
      const m = p.metodoPago || 'efectivo'
      metodos[m] = (metodos[m] || 0) + 1
    })
    const top = Object.entries(metodos).sort((a, b) => b[1] - a[1])[0]
    if (top && top[1] >= 3) {
      return `Paga mayormente en ${top[0]}${top[0] === 'transferencia' && pagos[0]?.plataforma ? ` (${pagos[0].plataforma})` : ''}.`
    }
  }

  // Buen porcentaje
  const pct = prestamo.porcentajePagado ?? 0
  if (pct >= 50 && pct < 75) {
    return `${pct}% pagado — buen avance, mas de la mitad completada.`
  }

  return null
}
