// lib/__tests__/el-menos-no-se-borra.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Salió al mirar la primera hoja de «Movimientos por cuenta» de Préstamos
// Rincón: la fila de Efectivo decía
//
//     ENTRÓ $0     SALIÓ $17.225.743     QUEDÓ $17.225.743
//
// Quedó no puede ser positivo si no entró nada. El neto era −$17.225.743 y el
// papel imprimía el mismo número EN POSITIVO.
//
// ⚠ NO ERA MI INFORME: es de TODOS los PDF de la app y llevaba ahí desde que
//   existe `limpiarGlifos`. La función borra el rango U+2190–U+2BFF para quitar
//   emojis y flechas que la fuente no tiene, y el MENOS TIPOGRÁFICO (−, U+2212)
//   cae justo dentro. `formatMoney` usa ese menos a propósito —tiene el mismo
//   ancho que el + y así las columnas de cifras no bailan—, así que cada cifra
//   negativa de cada hoja salía sin signo.
//
// Dónde importa: 107 de 253 negocios tienen capital negativo. Un papel que va
// al contador diciendo que le quedaron 17 millones cuando le faltan 17 millones
// no es un error de dibujo.
//
// Se ve en la hoja impresa. En el código, `limpiarGlifos(fmt(n))` parece
// correcto, y ninguna prueba miraba el resultado.

import { describe, it, expect } from 'vitest'
import { limpiarGlifos } from '@/lib/papel/documento'
import { formatMoney } from '@/lib/i18n'

describe('⚠ el signo menos sobrevive al limpiador de glifos', () => {
  it('una cifra negativa sigue siendo negativa después de limpiar', () => {
    const crudo = formatMoney(-17225743, 'co')
    const limpio = limpiarGlifos(crudo)
    expect(limpio).toMatch(/^[-−]/)
    expect(limpio).not.toBe('$17.225.743')
  })

  it('y el número no se toca', () => {
    expect(limpiarGlifos(formatMoney(-17225743, 'co'))).toContain('17.225.743')
  })

  it('lo positivo sigue sin signo', () => {
    expect(limpiarGlifos(formatMoney(17225743, 'co'))).toBe('$17.225.743')
  })

  it('⚠ el menos que queda es el ASCII, que existe en todas las fuentes', () => {
    /* El tipográfico (−, U+2212) puede no estar en Space Grotesk, y un glifo
       que falta se dibuja como una caja o como nada: volveríamos al mismo sitio
       por otro camino. El guion normal está siempre. */
    expect(limpiarGlifos(formatMoney(-1000, 'co'))).toBe('-$1.000')
  })

  it('los emojis y las flechas sí se siguen yendo', () => {
    // Que era para lo que existía la función.
    expect(limpiarGlifos('Pago →  listo')).toBe('Pago listo')
    expect(limpiarGlifos('Hecho ✅')).toBe('Hecho')
  })
})
