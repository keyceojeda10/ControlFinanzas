// components/ui/tarjetaCredito.js — sistema de tarjetas color-block (fintech).
// La tarjeta ES el color del estado: superficie saturada + tinta oscura encima
// (o blanca en mora seria). Sin skeuomorfismo: nada de chips, bandas ni relieves.
// Se usa en ClienteCard, PrestamoCard y el hero del dashboard.
//
// ink   = texto principal sobre la tarjeta
// sub   = texto secundario/labels
// track = fondo de barras de progreso / divisores
// edge  = borde 1px
// glow  = sombra de color debajo de la tarjeta
//
// Nota: no usar "rgba(0,0,0" dentro del mismo style attr que un linear-gradient
// (una heuristica del tema claro en globals.css lo blanquea).

export const CARD_GLOSS = 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.16) 45%, transparent 58%)'

export const CARD_STYLES = {
  // Al dia — dorado de marca, tinta casi negra (referencia: tarjeta amarilla)
  ok: {
    grad: 'linear-gradient(135deg, #f9d64a 0%, #f5c518 55%, #eab308 100%)',
    ink: '#231a04',
    sub: 'rgba(35, 26, 4, 0.60)',
    track: 'rgba(35, 26, 4, 0.16)',
    edge: 'rgba(180, 140, 10, 0.35)',
    glow: 'rgba(200, 160, 20, 0.30)',
  },
  // Vencido pocos dias — naranja
  hot: {
    grad: 'linear-gradient(135deg, #fca75c 0%, #f97316 58%, #ea6a0c 100%)',
    ink: '#2b1204',
    sub: 'rgba(43, 18, 4, 0.62)',
    track: 'rgba(43, 18, 4, 0.16)',
    edge: 'rgba(190, 90, 15, 0.40)',
    glow: 'rgba(210, 105, 25, 0.30)',
  },
  // Mora seria — rojo profundo, tinta blanca
  crit: {
    grad: 'linear-gradient(135deg, #f43f5e 0%, #dc2640 55%, #be123c 100%)',
    ink: '#ffffff',
    sub: 'rgba(255, 255, 255, 0.78)',
    track: 'rgba(255, 255, 255, 0.22)',
    edge: 'rgba(150, 20, 45, 0.45)',
    glow: 'rgba(190, 18, 60, 0.30)',
  },
  // Completado — verde
  done: {
    grad: 'linear-gradient(135deg, #4ade80 0%, #22c55e 55%, #16a34a 100%)',
    ink: '#05230f',
    sub: 'rgba(5, 35, 15, 0.62)',
    track: 'rgba(5, 35, 15, 0.16)',
    edge: 'rgba(20, 120, 60, 0.40)',
    glow: 'rgba(34, 160, 90, 0.30)',
  },
  // Cancelado / inactivo — grafito claro
  off: {
    grad: 'linear-gradient(135deg, #d7dde6 0%, #b6bfcc 58%, #9aa5b5 100%)',
    ink: '#232a35',
    sub: 'rgba(35, 42, 53, 0.62)',
    track: 'rgba(35, 42, 53, 0.15)',
    edge: 'rgba(90, 105, 125, 0.35)',
    glow: 'rgba(120, 135, 155, 0.28)',
  },
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
