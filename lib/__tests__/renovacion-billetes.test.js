import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── LOS «CENTAVOS» DE LAS RENOVACIONES ──────────────────────────────────────
//
// El dueño: «le aparecen centavos y no le gustan esos números, dicen que
// debería cerrar exacto sin esos dígitos».
//
// NO eran centavos: en la base no hay una sola fracción de peso (0 de 13.535
// movimientos, 0 rutas, 0 préstamos). Eran cifras enteras pero no redondas
// —$119.355, $145.161, $306.452— y salen del reparto PROPORCIONAL.
//
// Reconstruido contra producción con JOSÉ DURÁN, y reproduce al peso:
//
//   préstamo $200.000, cuota $8.000 × 31 días = $248.000
//   interés $48.000 = 19,3548…% del total        ← la fracción infinita
//   pagó $148.000 → interés $28.645 + capital $119.355
//   capital que aún debía: $200.000 − $119.355 = $80.645
//   renovó por $200.000 → en mano: $200.000 − $80.645 = $119.355  ✓
//
// El cálculo estaba BIEN. Lo que no encaja es la calle: el cobrador cuenta
// billetes. Así que se redondea lo que SALE DE LA CAJA, y nada más.

const RUTA = 'app/api/prestamos/[id]/renovar/route.js'
const src = readFileSync(resolve(process.cwd(), RUTA), 'utf8')

// La regla, tal como está en el código.
const enBilletes = (exacta) => (exacta > 0 ? Math.ceil(exacta / 100) * 100 : exacta)

describe('lo que se entrega en una renovación', () => {
  it('sube al centenar, nunca baja', () => {
    // Hacia arriba a propósito: el cliente recibe un poco más, no menos.
    expect(enBilletes(119355)).toBe(119400)
    expect(enBilletes(145161)).toBe(145200)
    expect(enBilletes(306452)).toBe(306500)
    expect(enBilletes(85484)).toBe(85500)
  })

  it('lo que ya era redondo no se mueve', () => {
    expect(enBilletes(150000)).toBe(150000)
    expect(enBilletes(400000)).toBe(400000)
    expect(enBilletes(100)).toBe(100)
  })

  it('nunca añade más de $99', () => {
    // Si añadiera más, dejaría de ser un redondeo y sería regalar plata.
    for (const v of [119355, 145161, 306452, 85484, 96296, 216667, 4316667]) {
      const extra = enBilletes(v) - v
      expect(extra, `sobre ${v} añadió ${extra}`).toBeGreaterThanOrEqual(0)
      expect(extra, `sobre ${v} añadió ${extra}`).toBeLessThan(100)
    }
  })

  it('la renovación sin efectivo sigue en cero', () => {
    // Renovar por lo mismo que debía: no sale un peso. Redondear un cero
    // hacia arriba lo dejaría en cero igual, pero el negativo NO se toca:
    // ahí el cliente debe más de lo que se le presta.
    expect(enBilletes(0)).toBe(0)
    expect(enBilletes(-5000)).toBe(-5000)
  })
})

describe('el código', () => {
  it('redondea la diferencia y guarda la exacta aparte', () => {
    expect(src, 'ya no se calcula la diferencia exacta')
      .toContain('const diferenciaExacta = Number(montoPrestado) - minimoRenovacion')
    expect(src, 'no se redondea a billetes').toMatch(/Math\.ceil\(diferenciaExacta \/ 100\) \* 100/)
  })

  it('NO toca la deuda del cliente', () => {
    // Lo único que cambia es cuántos billetes salen. `totalAPagar`, la cuota y
    // el plazo vienen de `calc` y siguen siendo los del monto pactado. Si
    // alguien empieza a derivar la deuda de `diferencia`, esta prueba avisa.
    const i = src.indexOf('const diferenciaExacta')
    const bloque = src.slice(i, i + 400)
    expect(bloque).not.toMatch(/totalAPagar\s*[:=]/)
    expect(bloque).not.toMatch(/cuotaDiaria\s*[:=]/)
    expect(src, 'el total a pagar dejó de venir del cálculo')
      .toContain('const { totalAPagar, cuotaDiaria, fechaFin } = calc')
  })

  it('el movimiento de capital lleva la cifra redondeada', () => {
    // Es la que de verdad salió del bolsillo: si guardara la exacta, la caja
    // volvería a pedirle al cobrador una cifra que no puede contar.
    const i = src.indexOf('registrarMovimientoCapital(tx, {')
    const bloque = src.slice(i, src.indexOf('})', src.indexOf('referenciaTipo', i)))
    expect(bloque).toContain('monto: diferencia')
    expect(bloque, 'guarda la exacta en vez de la de billetes').not.toContain('monto: diferenciaExacta')
  })

  it('el aviso del historial también', () => {
    expect(src).toMatch(/entregó \$\$\{Math\.round\(diferencia\)/)
  })
})
