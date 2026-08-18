// lib/recibo-derivados.js — los datos del recibo que la base NO guarda.
//
// ── POR QUÉ EXISTE ESTE FICHERO ─────────────────────────────────────────────
//
// `numeroCuota`, `cuotasRestantes` y `porcentajePagado` NO son columnas: los
// calcula el API cuando el préstamo pasa por él. Cuando el recibo se arma desde
// la pantalla de pago, llega el objeto CRUDO de Prisma y esos campos vienen
// `undefined`: el comprobante salía con guiones y con «0%».
//
// ⚠ Y ESO SE ARREGLÓ DOS VECES, MAL LA PRIMERA.
//
// El 4 de agosto lo corregí en `whatsapp-plantillas.js` con funciones privadas
// de ese fichero. Al día siguiente el mismo cliente volvió a reportarlo: la
// IMAGEN del comprobante (`BotonImprimirRecibo`) es otro camino, y ahí seguía
// `prestamo.numeroCuota ?? '-'` a secas. Su recibo del 5 de agosto:
//
//     Cuota            $150.000
//     Cuota actual     -          ← debía decir «1 de 4»
//     Cuotas restantes -          ← debía decir «3»
//
// Arreglar una vía y dejar la otra es peor que no arreglar nada: el cliente
// cree que ya está y vuelve a encontrárselo. Aquí viven una sola vez.

import { cuotaProximoCobro } from '@/lib/calculos'

/* En qué cuota va: la que se acaba de pagar.
   Se deriva de lo pagado, que es un dato que siempre está. Con tabla manda la
   tabla; sin ella, cuántas cuotas cubre lo abonado. */
/* ⚠ UN PRÉSTAMO ABIERTO NO TIENE «CUOTA 1 DE 10». Estas dos cuentas dividen el
 * total entre la cuota, y en un abierto ese total es solo el capital más lo
 * devengado: la división inventaba once cuotas que no existen y diez
 * restantes. El recibo es el papel que se queda el cliente; prometerle un final
 * ahí es peor que callarlo.
 *
 * `null` es lo correcto, no cero: el recibo ya sabe no pintar un campo vacío. */
function esAbierto(prestamo) {
  return prestamo?.sinPlazo === true && prestamo?.modoInteres === 'solo_interes'
}

export function numeroCuotaDe(prestamo) {
  if (esAbierto(prestamo)) return null
  const filas = prestamo?.cuotasAmortizacion
  if (Array.isArray(filas) && filas.length > 0) {
    const pagadas = filas.filter((f) => (f.pagado || 0) >= f.cuotaTotal).length
    return pagadas > 0 ? `${pagadas} de ${filas.length}` : null
  }
  const cuota = cuotaProximoCobro(prestamo) || prestamo?.cuotaDiaria || 0
  if (!cuota) return null
  const pagado = Number(prestamo?.totalPagado ?? 0)
  if (pagado <= 0) return null
  const total = Number(prestamo?.totalAPagar ?? 0)
  const totalCuotas = total > 0 ? Math.ceil(total / cuota) : null
  const van = Math.ceil(pagado / cuota)
  return totalCuotas ? `${Math.min(van, totalCuotas)} de ${totalCuotas}` : String(van)
}

/* Cuánto lleva pagado, en porcentaje. Decía «0%» a quien acababa de pagar
   $140.000 de $560.000 — un 25%. */
export function porcentajeDe(prestamo) {
  if (prestamo?.porcentajePagado != null) return Math.round(Number(prestamo.porcentajePagado))
  const total = Number(prestamo?.totalAPagar ?? 0)
  if (total <= 0) return 0
  const pagado = Number(prestamo?.totalPagado ?? 0)
  return Math.min(100, Math.max(0, Math.round((pagado / total) * 100)))
}

/* Cuotas que faltan por terminar de pagar. */
export function cuotasRestantesDe(prestamo) {
  if (esAbierto(prestamo)) return null
  const filas = prestamo?.cuotasAmortizacion
  if (Array.isArray(filas) && filas.length > 0) {
    return filas.filter((f) => (f.pagado || 0) < f.cuotaTotal).length
  }
  const cuota = cuotaProximoCobro(prestamo) || prestamo?.cuotaDiaria || 0
  if (!cuota) return null
  const saldo = prestamo?.saldoPendiente
    ?? Math.max(0, (prestamo?.totalAPagar ?? 0) - (prestamo?.totalPagado ?? 0))
  return Math.ceil(saldo / cuota)
}
