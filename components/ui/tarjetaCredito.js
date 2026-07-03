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

// Superficie compartida: grafito calido con profundidad.
// Ajuste 2 jul: se subio la luminosidad dos tonos (antes casi-negro #141318)
// porque sobre el tema claro el contraste golpeaba demasiado. Grafito medio
// mantiene el look premium sin efecto "hueco negro".
export const CARD_SURFACE = {
  grad: 'linear-gradient(150deg, #3b3843 0%, #2d2b34 52%, #24222a 100%)',
  ink: '#f6f5f9',
  sub: 'rgba(246, 245, 249, 0.58)',
  faint: 'rgba(246, 245, 249, 0.42)',
  track: 'rgba(255, 255, 255, 0.12)',
  cell: 'rgba(255, 255, 255, 0.06)',
  shadow: '0 8px 20px rgba(30, 27, 40, 0.16)',
}

// Acento por estado — colorea saldo, glow, borde, pill y progreso
export const CARD_ACCENTS = {
  ok:   { color: '#f5c518' },  // al dia — dorado marca
  hot:  { color: '#fb923c' },  // vencido pocos dias — naranja
  crit: { color: '#f87171' },  // mora seria — rojo
  done: { color: '#34d399' },  // completado — verde
  off:  { color: '#9aa5b5' },  // cancelado/inactivo — grafito
}

// Background completo de la tarjeta: glow del acento arriba-derecha + grafito
export function cardBackground(accent) {
  return `radial-gradient(ellipse 90% 75% at 100% -10%, color-mix(in srgb, ${accent} 14%, transparent) 0%, transparent 55%), ${CARD_SURFACE.grad}`
}

export function cardBorder(accent) {
  return `1px solid color-mix(in srgb, ${accent} 24%, rgba(255,255,255,0.12))`
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
