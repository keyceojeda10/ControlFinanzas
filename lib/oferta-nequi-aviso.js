// lib/oferta-nequi-aviso.js — cuándo sale la ventana del 35 % por Nequi dentro
// de la app (components/cf/AvisoOfertaNequi.jsx). Aparte del componente para
// poder probarlo: vitest no transforma JSX en este proyecto.

/* ── LA VENTANA (opción B del dueño, 12 oct 2026) ──
   «No quiero que quede estático ni que se vea como spam»: nada fijo en la app,
   solo esta ventana. Sale la primera vez; si dice «Ahora no», vuelve a la
   SEMANA, o antes si entra en los 3 últimos días del plan o de la prueba, que
   es el punto en que de verdad se decide pagar. Se cuenta por NEGOCIO
   (`ofertaVistaAt`, del servidor), no por aparato. */
export const DIAS_ENTRE_VENTANAS = 7
export const DIAS_PUNTO_DE_PAGO = 3

export function debeAbrirseVentanaNequi(estado, { rol, ahora = Date.now() } = {}) {
  if (rol !== 'owner' || !estado) return false
  if (!(estado.ofertaNequi > 0)) return false
  if (estado.cobroAutomatico?.activo) return false
  const recurrenteOk = estado.tipo === 'recurrente' && estado.mpStatus === 'authorized' && !estado.canceladaAt
  if (recurrenteOk || estado.tieneRecurrenteActiva) return false
  if (Number(estado.diasRestantes) < 0) return false // vencido: ahí manda el aviso de renovar
  const vista = estado.ofertaVistaAt ? new Date(estado.ofertaVistaAt).getTime() : null
  if (vista == null) return true
  if (ahora - vista >= DIAS_ENTRE_VENTANAS * 86400000) return true
  // El punto de pago: los 3 últimos días, si la última vez fue antes de entrar en ellos.
  const vence = estado.fechaVencimiento ? new Date(estado.fechaVencimiento).getTime() : null
  if (vence == null) return false
  const entraEnPuntoDePago = vence - DIAS_PUNTO_DE_PAGO * 86400000
  return ahora >= entraEnPuntoDePago && vista < entraEnPuntoDePago
}

/** Lo que cuesta el primer cobro con la oferta: el mismo redondeo del servidor (`precioConDescuento`). */
export function precioConOferta(precio, pct) {
  return Math.round((Number(precio) * (1 - Number(pct) / 100)) / 100) * 100
}
