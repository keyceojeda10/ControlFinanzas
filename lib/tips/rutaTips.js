// lib/tips/rutaTips.js — Generador de tips para detalle de ruta (logica pura, sin API)
//
// Importante: NO es IA. Son recomendaciones derivadas de los datos de la ruta.
// Debe usar los MISMOS criterios que la segmentacion de la lista para no
// contradecirla (ej: no decir "2 por cobrar hoy" si hoy no se cobra ninguno).

// Un cliente "tiene cobro pendiente hoy" si el backend lo marca asi, con el
// mismo fallback que usa la lista (page.jsx).
function tienePendienteHoy(c) {
  return Boolean(c.cobroPendienteHoy ?? (!c.pagoHoy && !c.hoySinCobro && c.estado !== 'completado'))
}

export function generarTipRuta(clientes = []) {
  if (!clientes || clientes.length === 0) return null

  const porCobrarHoy = clientes.filter(tienePendienteHoy).length
  const pagaronHoy = clientes.filter(c => c.pagoHoy).length
  const enMoraAlta = clientes.filter(c => (c.diasMora ?? 0) > 5).length

  // Total de clientes con actividad de cobro HOY (pendientes + ya pagados).
  const conCobroHoy = porCobrarHoy + pagaronHoy

  // CASO 1: hoy no toca cobrar a nadie en esta ruta.
  if (conCobroHoy === 0) {
    if (enMoraAlta >= 2) {
      return `Hoy no hay cobros programados, pero ${enMoraAlta} clientes llevan mas de 5 dias en mora — buen momento para visitarlos.`
    }
    return 'Hoy no hay cobros programados en esta ruta. Aprovecha para ponerte al dia o revisar clientes en mora.'
  }

  // CASO 2: ya cobro a todos los que tocaban hoy.
  if (porCobrarHoy === 0 && pagaronHoy > 0) {
    return `Ruta del dia completada: cobraste a los ${pagaronHoy} clientes que tocaban hoy. Excelente trabajo.`
  }

  // CASO 3: mora alta es lo mas urgente, aunque haya pendientes normales.
  if (enMoraAlta >= 2) {
    return `${enMoraAlta} clientes de esta ruta llevan mas de 5 dias en mora — priorizalos en tu recorrido de hoy.`
  }

  // CASO 4: progreso parcial del dia.
  if (pagaronHoy > 0 && porCobrarHoy > 0) {
    const pct = Math.round((pagaronHoy / conCobroHoy) * 100)
    return `Llevas ${pagaronHoy} de ${conCobroHoy} cobros del dia (${pct}%) — te faltan ${porCobrarHoy} por visitar.`
  }

  // CASO 5: aun no empiezas, hay pendientes hoy.
  return `Tienes ${porCobrarHoy} ${porCobrarHoy === 1 ? 'cliente' : 'clientes'} por cobrar hoy en esta ruta.`
}
