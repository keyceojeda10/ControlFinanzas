// components/ui/tarjetaCredito.js — tarjetas premium oscuras (v3).
//
// Leccion de diseño (2 jul): bañar todas las tarjetas en color saturado = muro
// chillon sin jerarquia. El canon correcto:
//   - UN solo momento dorado fuerte por pantalla (hero del dashboard).
//   - Las tarjetas de listas son OSCURAS premium (carbon calido) y el ESTADO
//     se expresa via acento: numero del saldo, glow superior, borde, pill y
//     barra de progreso en el mood color. Elegante y escaneable.
//   - Sin skeuomorfismo (nada de chips ni bandas).
//
// IMPORTANTE: los hex del gradiente NO deben coincidir con los que las
// heuristicas del tema claro blanquean en globals.css (#1a1a1a, #141414,
// #111111, #0a0a0a, #121212, #1f1f1f, #202020...). Tampoco usar "rgba(0,0,0"
// en el mismo style attr que un linear-gradient.

// Superficie compartida: carbon calido con profundidad
export const CARD_SURFACE = {
  grad: 'linear-gradient(150deg, #26242e 0%, #1b1a21 52%, #141318 100%)',
  ink: '#f6f5f9',
  sub: 'rgba(246, 245, 249, 0.55)',
  faint: 'rgba(246, 245, 249, 0.38)',
  track: 'rgba(255, 255, 255, 0.10)',
  cell: 'rgba(255, 255, 255, 0.05)',
  shadow: '0 12px 28px rgba(18, 16, 26, 0.30)',
}

// Acento por estado — colorea saldo, glow, borde, pill y progreso
export const CARD_ACCENTS = {
  ok:   { color: '#f5c518' },  // al dia — dorado marca
  hot:  { color: '#fb923c' },  // vencido pocos dias — naranja
  crit: { color: '#f87171' },  // mora seria — rojo
  done: { color: '#34d399' },  // completado — verde
  off:  { color: '#9aa5b5' },  // cancelado/inactivo — grafito
}

// Background completo de la tarjeta: glow del acento arriba-derecha + carbon
export function cardBackground(accent) {
  return `radial-gradient(ellipse 90% 75% at 100% -10%, color-mix(in srgb, ${accent} 18%, transparent) 0%, transparent 55%), ${CARD_SURFACE.grad}`
}

export function cardBorder(accent) {
  return `1px solid color-mix(in srgb, ${accent} 28%, rgba(255,255,255,0.10))`
}

export function moodKeyCliente(c) {
  if (c.estado === 'cancelado' || c.estado === 'inactivo') return 'off'
  if (c.diasMoraMax > 7) return 'crit'
  if (c.estado === 'mora' || c.diasMoraMax > 0) return 'hot'
  return 'ok'
}

export function moodKeyPrestamo(p) {
  if (p.estado === 'completado') return 'done'
  if (p.estado === 'cancelado') return 'off'
  if (p.diasMora > 7) return 'crit'
  if (p.diasMora > 0) return 'hot'
  return 'ok'
}
