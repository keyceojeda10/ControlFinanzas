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

