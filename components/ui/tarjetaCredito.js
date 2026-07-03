// components/ui/tarjetaCredito.js — tarjetas pastel premium (v4).
//
// Referencia del user (2 jul): tarjeta fintech de superficie SUAVE (pastel
// gris-lavanda) con tinta oscura profunda y textura de olas sutiles. Cada
// estado tiene su propia tarjeta pastel completa — reactividad real pero
// moderada: colores bonitos, nunca chillones, nunca casi-negro.
//
//   ok    → champan dorado (al dia — color de marca suavizado)
//   nuevo → azul lavanda (cliente/prestamo nuevo, como la referencia)
//   hot   → durazno (vencido pocos dias)
//   crit  → rosa (mora seria)
//   done  → menta (completado)
//   off   → gris perla (cancelado/inactivo)
//
// ink   = texto principal (tinta profunda del mismo tono)
// sub   = texto secundario
// accent= color fuerte del estado (pills, barras, enfasis)
// track = fondo de barras/divisores
// Los textos sobre la tarjeta usan SIEMPRE estos valores, nunca tokens del
// tema (la tarjeta es igual en dark y light).
//
// Nota: no usar "rgba(0,0,0" en el mismo style attr que un linear-gradient
// (heuristica del tema claro en globals.css lo blanquea).

export const CARD_PALETTES = {
  ok: {
    grad: 'linear-gradient(135deg, #f7eed4 0%, #f0e0b0 55%, #e9d491 100%)',
    ink: '#3f3306',
    sub: 'rgba(63, 51, 6, 0.78)',
    accent: '#7a6003',
    track: 'rgba(63, 51, 6, 0.13)',
    border: 'rgba(180, 140, 10, 0.30)',
    shadow: '0 10px 24px rgba(190, 160, 60, 0.18)',
    waves: 'rgba(255,255,255,0.55)',
  },
  nuevo: {
    grad: 'linear-gradient(135deg, #e6eafa 0%, #cfd7f2 55%, #bec9ee 100%)',
    ink: '#232f5e',
    sub: 'rgba(35, 47, 94, 0.78)',
    accent: '#364a9a',
    track: 'rgba(35, 47, 94, 0.13)',
    border: 'rgba(80, 100, 190, 0.28)',
    shadow: '0 10px 24px rgba(90, 110, 200, 0.16)',
    waves: 'rgba(255,255,255,0.6)',
  },
  hot: {
    grad: 'linear-gradient(135deg, #fbe9d5 0%, #f6d5af 55%, #f2c795 100%)',
    ink: '#5a3105',
    sub: 'rgba(90, 49, 5, 0.78)',
    accent: '#a3540a',
    track: 'rgba(90, 49, 5, 0.13)',
    border: 'rgba(200, 120, 30, 0.30)',
    shadow: '0 10px 24px rgba(210, 140, 60, 0.16)',
    waves: 'rgba(255,255,255,0.5)',
  },
  crit: {
    grad: 'linear-gradient(135deg, #fbe0e3 0%, #f5c3c9 55%, #f0aeb7 100%)',
    ink: '#5c1220',
    sub: 'rgba(92, 18, 32, 0.78)',
    accent: '#a82038',
    track: 'rgba(92, 18, 32, 0.13)',
    border: 'rgba(200, 60, 80, 0.30)',
    shadow: '0 10px 24px rgba(210, 90, 110, 0.16)',
    waves: 'rgba(255,255,255,0.5)',
  },
  done: {
    grad: 'linear-gradient(135deg, #def3e8 0%, #c0e8d3 55%, #aadfc3 100%)',
    ink: '#0c3a26',
    sub: 'rgba(12, 58, 38, 0.78)',
    accent: '#12724a',
    track: 'rgba(12, 58, 38, 0.13)',
    border: 'rgba(30, 140, 90, 0.30)',
    shadow: '0 10px 24px rgba(60, 160, 110, 0.16)',
    waves: 'rgba(255,255,255,0.55)',
  },
  off: {
    grad: 'linear-gradient(135deg, #eff1f5 0%, #dce0e8 55%, #cdd3dd 100%)',
    ink: '#39404e',
    sub: 'rgba(57, 64, 78, 0.78)',
    accent: '#4a5265',
    track: 'rgba(57, 64, 78, 0.13)',
    border: 'rgba(110, 120, 140, 0.30)',
    shadow: '0 10px 24px rgba(120, 130, 150, 0.14)',
    waves: 'rgba(255,255,255,0.6)',
  },
}

// Verde fijo para valores "pagado" — legible sobre las 6 superficies pastel
export const PALETTE_PAGADO = '#0f6840'

export function moodKeyCliente(c, esNuevo = false) {
  if (c.estado === 'cancelado' || c.estado === 'inactivo') return 'off'
  if (c.diasMoraMax > 7) return 'crit'
  if (c.estado === 'mora' || c.diasMoraMax > 0) return 'hot'
  if (esNuevo) return 'nuevo'
  return 'ok'
}

export function moodKeyPrestamo(p, esNuevo = false) {
  if (p.estado === 'completado') return 'done'
  if (p.estado === 'cancelado') return 'off'
  if (p.diasMora > 7) return 'crit'
  if (p.diasMora > 0) return 'hot'
  if (esNuevo) return 'nuevo'
  return 'ok'
}

// % de cobro del dia (rutas) → paleta
export function moodKeyRuta(progreso, esperadoHoy) {
  if (esperadoHoy === 0) return 'off'
  if (progreso >= 100) return 'done'
  if (progreso >= 60) return 'ok'
  if (progreso >= 30) return 'hot'
  return 'crit'
}
