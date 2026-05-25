// lib/tips/rutaTips.js — Generador de tips para detalle de ruta (logica pura, sin API)

export function generarTipRuta(clientes = []) {
  if (!clientes || clientes.length === 0) return null

  const total = clientes.length
  const cobrados = clientes.filter(c => c.pagoHoy).length
  const enMora = clientes.filter(c => (c.diasMora ?? 0) > 5).length
  const pendientes = total - cobrados

  // Progreso del dia
  if (cobrados > 0 && pendientes > 0) {
    const pct = Math.round((cobrados / total) * 100)
    return `${cobrados} de ${total} clientes cobrados hoy (${pct}%) — te faltan ${pendientes} visitas.`
  }

  // Todos cobrados
  if (cobrados === total && total > 0) {
    return `Ruta completada: ${total} de ${total} clientes cobrados hoy. Excelente trabajo.`
  }

  // Clientes en mora en la ruta
  if (enMora >= 2) {
    return `${enMora} clientes en esta ruta tienen mas de 5 dias en mora — priorizar su cobro.`
  }

  // Ruta sin cobros aun
  if (cobrados === 0 && total > 0) {
    return `${total} clientes programados hoy en esta ruta — comienza por los que suelen pagar temprano.`
  }

  return null
}
