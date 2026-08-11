import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// El contraste no se elige a ojo: se mide. Este test existe porque el fallo real
// no lo tenía el bloque negro —los tokens de ahí pasan con holgura— sino el
// menú dorado, donde el propio handoff pide rgba(58,41,0,.55) y .62. Sobre el
// oro eso da 2,61:1 y 2,98:1, la mitad del mínimo. Y no se ve como un bug: se
// ve como un texto "suave".
//
// Umbrales WCAG AA: 4,5:1 para texto normal, 3:1 para texto grande (≥24px o
// ≥18,66px en negrita) y para elementos gráficos.

const raiz = process.cwd()
const css = fs.readFileSync(path.join(raiz, 'app/tokens-2026.css'), 'utf8')
const menu = fs.readFileSync(path.join(raiz, 'components/pantallas/MenuCrear.jsx'), 'utf8')

// Sin RegExp construida a mano: una barra invertida perdida convierte el patrón
// en otra cosa que sigue "funcionando" y devuelve null en silencio.
function token(nombre, fuente = css) {
  const linea = fuente
    .split('\n')
    .find((l) => l.trim().startsWith(`--${nombre}:`))
  const valor = linea && linea.split(':')[1]?.trim().split(';')[0]?.trim()
  if (!valor?.startsWith('#')) throw new Error(`token --${nombre} no encontrado`)
  return rgb(valor)
}

// El tema oscuro redefine los mismos tokens más abajo, bajo
// html[data-theme="dark"]. Para el tema claro hay que cortar ahí.
const CSS_CLARO = css.split('html[data-theme="dark"]')[0]
function rgb(hex) {
  let h = hex.replace('#', '')
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}
function sobre(fg, bg, alfa = 1) {
  return fg.map((c, i) => Math.round(alfa * c + (1 - alfa) * bg[i]))
}
function luminancia([r, g, b]) {
  const f = (c) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
function contraste(a, b) {
  const [hi, lo] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const SALTO = String.fromCharCode(10)
const NEGRO = rgb('#15161A')   // el bloque oscuro, igual en tema claro y oscuro
const ORO   = token('cf-gold', CSS_CLARO)
const TINTA_MENU = rgb('#3A2900')

describe('contraste · texto sobre el bloque oscuro', () => {
  const casos = [
    ['ink sobre oscuro (#F3F3F6) · cifras', rgb('#F3F3F6'), 4.5],
    ['ink-2 sobre oscuro (#A3A8B2) · etiquetas', rgb('#A3A8B2'), 4.5],
    ['ink-3 sobre oscuro (#8A8E98) · notas', rgb('#8A8E98'), 4.5],
    ['oro sobre oscuro (#F5B824)', rgb('#F5B824'), 4.5],
    ['verde sobre oscuro (#2FBE6A)', rgb('#2FBE6A'), 4.5],
    ['rojo sobre oscuro (#F0575C)', rgb('#F0575C'), 4.5],
  ]
  for (const [nombre, color, minimo] of casos) {
    it(`${nombre} ≥ ${minimo}:1`, () => {
      expect(contraste(color, NEGRO)).toBeGreaterThanOrEqual(minimo)
    })
  }
})

describe('contraste · texto sobre el menú del +', () => {
  /* ⚠ ESTE BLOQUE MEDÍA EL MENÚ DORADO, y el menú ya no es dorado.
     El dueño lo tumbó —«el fondo del menú abierto me parece bastante repelente
     ese color naranja»— y la regla estaba escrita desde el principio en
     DESIGN.md: «cuando una pantalla no tiene monto, no tiene nada dorado salvo
     su botón». Este menú no tiene monto.

     Lo que se medía era el apaño que costaba la excepción: alfas subidos a mano
     (.82, .86) hasta que los dos textos más pequeños pasaran de 2,61:1. Sobre el
     bloque oscuro los colores son OPACOS y vienen de la misma receta que
     `BloqueOscuro`, así que ya no hay alfa que ajustar — pero se siguen midiendo
     leyéndolos del propio componente, no copiados aquí. */
  function colorDe(constante) {
    const linea = menu
      .split(SALTO)
      .find((l) => l.trim().startsWith(`const ${constante}`))
    const hex = linea?.match(/#[0-9A-Fa-f]{6}/)?.[0]
    if (!hex) throw new Error(`no se pudo leer el color de ${constante}`)
    return rgb(hex)
  }

  it('⚠ la superficie ya no es el dorado', () => {
    expect(menu, 'volvió el dorado a pantalla completa').not.toMatch(/background: ORO/)
    expect(colorDe('SUPERFICIE')).toEqual(NEGRO)
  })

  const HOJA = () => colorDe('SUPERFICIE')
  const TARJ = () => colorDe('TARJETA')

  const casos = [
    ['el título y los nombres de fila', 'TEXTO', TARJ, 4.5],
    ['la fecha y las cifras al pie (12px)', 'TEXTO_2', TARJ, 4.5],
    ['los rótulos de grupo (10px)', 'ROTULO', HOJA, 4.5],
    ['la flecha de cada acción (grafismo)', 'FLECHA', TARJ, 3],
  ]
  for (const [nombre, constante, fondo, minimo] of casos) {
    it(`${nombre} ≥ ${minimo}:1`, () => {
      expect(contraste(colorDe(constante), fondo())).toBeGreaterThanOrEqual(minimo)
    })
  }

  it('las dos superficies oscuras se separan con filete, no con contraste', () => {
    /* 1,10 entre la hoja y la tarjeta: sin el borde, las filas flotarían. Es la
       misma nota que lleva `BloqueOscuro` para el tema oscuro. */
    expect(contraste(HOJA(), TARJ())).toBeLessThan(1.5)
    expect(menu, 'las tarjetas se quedaron sin filete').toMatch(/const BORDE\s*=\s*'1px solid rgba\(255,255,255/)
  })
})

describe('contraste · texto sobre superficies claras', () => {
  const CARD = token('cf-card', CSS_CLARO)
  const casos = [
    ['ink', token('cf-ink', CSS_CLARO), 4.5],
    ['ink-2', token('cf-ink-2', CSS_CLARO), 4.5],
    ['ink-3 · notas de 11-12px', token('cf-ink-3', CSS_CLARO), 4.5],
    ['gold-dark · enlaces de texto', token('cf-gold-dark', CSS_CLARO), 3.0],
    ['green-dark · montos en verde', token('cf-green-dark', CSS_CLARO), 4.5],
    ['red-dark · montos en rojo', token('cf-red-dark', CSS_CLARO), 3.0],
  ]
  for (const [nombre, color, minimo] of casos) {
    it(`${nombre} ≥ ${minimo}:1 sobre tarjeta`, () => {
      expect(contraste(color, CARD)).toBeGreaterThanOrEqual(minimo)
    })
  }
})
