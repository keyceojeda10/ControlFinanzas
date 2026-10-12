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
  return cerradoHasta <= ahora
}

