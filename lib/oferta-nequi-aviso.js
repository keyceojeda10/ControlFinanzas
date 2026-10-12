// lib/oferta-nequi-aviso.js — cuándo sale el aviso del 35 % por Nequi dentro de
// la app (components/layout/OfertaNequiBanner.jsx). Aparte del componente para
// poder probarlo: vitest no transforma JSX en este proyecto.

/** ¿Se enseña? Solo al dueño, con la oferta esperando y sin cobro automático. */
export function debeVerseOfertaNequi(estado, { rol, cerradoHasta = 0, ahora = Date.now() } = {}) {
  if (rol !== 'owner' || !estado) return false
  if (!(estado.ofertaNequi > 0)) return false
  if (estado.cobroAutomatico?.activo) return false
  const recurrenteOk = estado.tipo === 'recurrente' && estado.mpStatus === 'authorized' && !estado.canceladaAt
  if (recurrenteOk || estado.tieneRecurrenteActiva) return false
  /* A 3 días o menos ya lo dice la franja de «tu plan vence» (SuscripcionBanner),
     con la oferta dentro: dos avisos de lo mismo es lo que la pila evita, y salía
     «Hay 1 aviso más» con el repetido. */
  if (estado.fechaVencimiento && Number(estado.diasRestantes) >= 0 && Number(estado.diasRestantes) <= 3) return false
  return cerradoHasta <= ahora
}


/* ── LA VENTANA (opción B del dueño, 12 oct 2026) ──
   Una vez al día, en el centro, cuando se acerca el vencimiento: de la prueba
   (la oferta solo se abre en sus 3 últimos días) o del plan de quien paga a mano.
   Antes de eso, la oferta queda en la franja y en la página del plan: una
   ventana diaria durante todo el mes cansa. */
export const DIAS_VENTANA_NEQUI = 5

export function debeAbrirseVentanaNequi(estado, { rol, vistoHoy = false } = {}) {
  if (rol !== 'owner' || !estado || vistoHoy) return false
  if (!(estado.ofertaNequi > 0)) return false
  if (estado.cobroAutomatico?.activo) return false
  const recurrenteOk = estado.tipo === 'recurrente' && estado.mpStatus === 'authorized' && !estado.canceladaAt
  if (recurrenteOk || estado.tieneRecurrenteActiva) return false
  const dias = Number(estado.diasRestantes)
  return Boolean(estado.fechaVencimiento) && Number.isFinite(dias) && dias >= 0 && dias <= DIAS_VENTANA_NEQUI
}

/** Lo que cuesta el primer cobro con la oferta: el mismo redondeo del servidor (`precioConDescuento`). */
export function precioConOferta(precio, pct) {
  return Math.round((Number(precio) * (1 - Number(pct) / 100)) / 100) * 100
}
