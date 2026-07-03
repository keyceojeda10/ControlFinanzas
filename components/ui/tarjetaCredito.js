// components/ui/tarjetaCredito.js — tarjetas pastel premium (v4).
//
// Dos sets de paletas: LIGHT (pastel suave + tinta oscura) y DARK
// (superficie oscura-saturada + tinta clara). useCardPalettes() devuelve
// el set correcto segun el tema activo.

// ── Paletas LIGHT (fondo claro) ──

const PALETTES_LIGHT = {
  ok: {
    grad: 'linear-gradient(135deg, #f7eed4 0%, #f0e0b0 55%, #e9d491 100%)',
    ink: '#3f3306',
    sub: 'rgba(63, 51, 6, 0.78)',
    accent: '#7a6003',
    track: 'rgba(63, 51, 6, 0.13)',
    border: 'rgba(180, 140, 10, 0.30)',
    shadow: '0 10px 24px rgba(190, 160, 60, 0.18)',
    waves: 'rgba(255,255,255,0.55)',
    sheen: 'linear-gradient(105deg, transparent 25%, rgba(180,150,50,0.12) 40%, rgba(255,230,120,0.22) 50%, rgba(180,150,50,0.12) 60%, transparent 75%)',
  },
  nuevo: {
    grad: 'linear-gradient(135deg, #ddf4e4 0%, #c2eacd 55%, #ade2ba 100%)',
    ink: '#0e3b1e',
    sub: 'rgba(14, 59, 30, 0.78)',
    accent: '#1a8a4a',
    track: 'rgba(14, 59, 30, 0.13)',
    border: 'rgba(40, 160, 90, 0.28)',
    shadow: '0 10px 24px rgba(50, 170, 100, 0.16)',
    waves: 'rgba(255,255,255,0.6)',
    sheen: 'linear-gradient(105deg, transparent 25%, rgba(30,140,70,0.10) 40%, rgba(100,220,140,0.20) 50%, rgba(30,140,70,0.10) 60%, transparent 75%)',
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
    sheen: 'linear-gradient(105deg, transparent 25%, rgba(200,120,30,0.10) 40%, rgba(255,180,80,0.20) 50%, rgba(200,120,30,0.10) 60%, transparent 75%)',
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
    sheen: 'linear-gradient(105deg, transparent 25%, rgba(200,60,80,0.08) 40%, rgba(255,140,160,0.18) 50%, rgba(200,60,80,0.08) 60%, transparent 75%)',
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
    sheen: 'linear-gradient(105deg, transparent 25%, rgba(30,130,80,0.10) 40%, rgba(80,200,130,0.20) 50%, rgba(30,130,80,0.10) 60%, transparent 75%)',
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
    sheen: 'none',
  },
}

// ── Paletas DARK (fondo oscuro) ──

const PALETTES_DARK = {
  ok: {
    grad: 'linear-gradient(135deg, #2a2410 0%, #352d14 55%, #3f3518 100%)',
    ink: '#f0e4be',
    sub: 'rgba(240, 228, 190, 0.65)',
    accent: '#d4a820',
    track: 'rgba(240, 228, 190, 0.12)',
    border: 'rgba(200, 160, 40, 0.30)',
    shadow: '0 10px 24px rgba(0, 0, 0, 0.35)',
    waves: 'rgba(255,255,255,0.06)',
    sheen: 'linear-gradient(105deg, transparent 25%, rgba(255,220,100,0.10) 40%, rgba(255,240,160,0.18) 50%, rgba(255,220,100,0.10) 60%, transparent 75%)',
  },
  nuevo: {
    grad: 'linear-gradient(135deg, #0f2818 0%, #14321e 55%, #1a3c24 100%)',
    ink: '#c0ecd0',
    sub: 'rgba(192, 236, 208, 0.65)',
    accent: '#34d878',
    track: 'rgba(192, 236, 208, 0.12)',
    border: 'rgba(50, 180, 100, 0.30)',
    shadow: '0 10px 24px rgba(0, 0, 0, 0.35)',
    waves: 'rgba(255,255,255,0.06)',
    sheen: 'linear-gradient(105deg, transparent 25%, rgba(80,255,140,0.08) 40%, rgba(140,255,200,0.16) 50%, rgba(80,255,140,0.08) 60%, transparent 75%)',
  },
  hot: {
    grad: 'linear-gradient(135deg, #2c1a08 0%, #38210c 55%, #442910 100%)',
    ink: '#f5d8b4',
    sub: 'rgba(245, 216, 180, 0.65)',
    accent: '#e88a30',
    track: 'rgba(245, 216, 180, 0.12)',
    border: 'rgba(220, 140, 50, 0.30)',
    shadow: '0 10px 24px rgba(0, 0, 0, 0.35)',
    waves: 'rgba(255,255,255,0.06)',
    sheen: 'linear-gradient(105deg, transparent 25%, rgba(255,160,60,0.10) 40%, rgba(255,200,120,0.18) 50%, rgba(255,160,60,0.10) 60%, transparent 75%)',
  },
  crit: {
    grad: 'linear-gradient(135deg, #2c0e14 0%, #381218 55%, #44161e 100%)',
    ink: '#f5c0c8',
    sub: 'rgba(245, 192, 200, 0.65)',
    accent: '#f04060',
    track: 'rgba(245, 192, 200, 0.12)',
    border: 'rgba(220, 70, 90, 0.30)',
    shadow: '0 10px 24px rgba(0, 0, 0, 0.35)',
    waves: 'rgba(255,255,255,0.06)',
    sheen: 'linear-gradient(105deg, transparent 25%, rgba(255,120,140,0.08) 40%, rgba(255,170,185,0.16) 50%, rgba(255,120,140,0.08) 60%, transparent 75%)',
  },
  done: {
    grad: 'linear-gradient(135deg, #0c2418 0%, #102e1e 55%, #143824 100%)',
    ink: '#b8e8ce',
    sub: 'rgba(184, 232, 206, 0.65)',
    accent: '#2cc874',
    track: 'rgba(184, 232, 206, 0.12)',
    border: 'rgba(50, 180, 100, 0.30)',
    shadow: '0 10px 24px rgba(0, 0, 0, 0.35)',
    waves: 'rgba(255,255,255,0.06)',
    sheen: 'linear-gradient(105deg, transparent 25%, rgba(80,220,130,0.08) 40%, rgba(120,255,180,0.16) 50%, rgba(80,220,130,0.08) 60%, transparent 75%)',
  },
  off: {
    grad: 'linear-gradient(135deg, #1a1c22 0%, #222530 55%, #282c38 100%)',
    ink: '#c0c4d0',
    sub: 'rgba(192, 196, 208, 0.60)',
    accent: '#7a8094',
    track: 'rgba(192, 196, 208, 0.10)',
    border: 'rgba(120, 130, 150, 0.25)',
    shadow: '0 10px 24px rgba(0, 0, 0, 0.35)',
    waves: 'rgba(255,255,255,0.05)',
    sheen: 'none',
  },
}

// Compat: los componentes existentes importan CARD_PALETTES directamente.
// Esto sigue funcionando para SSR y como fallback (light).
export const CARD_PALETTES = PALETTES_LIGHT

export const PALETTE_PAGADO_LIGHT = '#0f6840'
export const PALETTE_PAGADO_DARK = '#34d878'
export const PALETTE_PAGADO = PALETTE_PAGADO_LIGHT

// ── Hook: paletas segun tema ──

import { useTheme } from '@/lib/theme/ThemeProvider'

export function useCardPalettes() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  return {
    palettes: isDark ? PALETTES_DARK : PALETTES_LIGHT,
    pagado: isDark ? PALETTE_PAGADO_DARK : PALETTE_PAGADO_LIGHT,
  }
}

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

export function moodKeyLinea(estado, porcentajeUsado) {
  if (estado === 'cerrada') return 'off'
  if (estado === 'congelada') return 'hot'
  if (porcentajeUsado > 80) return 'crit'
  return 'ok'
}

export function moodKeyRuta(progreso, esperadoHoy) {
  if (esperadoHoy === 0) return 'off'
  if (progreso >= 100) return 'done'
  if (progreso >= 60) return 'ok'
  if (progreso >= 30) return 'hot'
  return 'crit'
}
