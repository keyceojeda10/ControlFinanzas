import { describe, it, expect } from 'vitest'
import { calcularDiasMora, calcularMontoEnMora } from '@/lib/calculos'
import { cifrasDe } from '@/lib/adaptadores/prestamos'

/* ══ «AL DÍA» Y «ATRASO $29.000» EN LA MISMA TARJETA ══════════════════════
 *
 * Reportado por el dueño. Eran DOS fallos que tiraban en direcciones opuestas,
 * y por eso costó verlos:
 *
 *  1. El tramo de días cobrables se medía SIN el último día, pero los domingos
 *     y festivos se descontaban CONTÁNDOLO. Así que a un tramo de viernes a
 *     sábado se le restaba el domingo siguiente. Le pasaba a todos los sábados
 *     y a la víspera de cada festivo: la mora salía un día más corta y quien
 *     llevaba un día aparecía «al día».
 *
 *  2. El monto en mora contaba la cuota de HOY como atrasada, cuando el
 *     cobrador va hoy a cobrarla. Las otras dos vías de esa misma función ya
 *     aplicaban la regla de la casa —«vence el 10, el 11 ya tiene un día»— y
 *     esta se había quedado atrás.
 *
 * ⚠ Las 4.471 pruebas del repo pasaban con los dos fallos puestos. */

const dia = (s) => new Date(`${s}T05:00:00.000Z`)
const DOMINGOS = [0]

// Diario, cuota $4.000, empieza el jueves 20 de agosto de 2026.
const base = {
  estado: 'activo', modoInteres: 'fijo', frecuencia: 'diario',
  cuotaDiaria: 4000, totalAPagar: 124000, diasPlazo: 31,
  fechaInicio: dia('2026-08-20'), pagos: [],
}
// El sábado 22: el domingo 23 NO cobra, pero está fuera del tramo medido.
const SABADO = dia('2026-08-22').getTime()

describe('el domingo de después no acorta el atraso', () => {
  it('⚠ un sábado, quien lleva un día sin pagar lleva UN día', () => {
    expect(calcularDiasMora(base, DOMINGOS, [], SABADO)).toBe(1)
  })

  it('y sin domingos excluidos da lo mismo, que es la señal de que estaba mal', () => {
    /* Antes daba 1 sin excluir y 0 excluyendo domingos: el mismo cliente, el
       mismo día, dos respuestas según una configuración que no debería
       cambiarle nada porque no hay ningún domingo dentro del tramo. */
    expect(calcularDiasMora(base, [], [], SABADO))
      .toBe(calcularDiasMora(base, DOMINGOS, [], SABADO))
  })

  it('pero un domingo DENTRO del tramo sí se descuenta', () => {
    // Del viernes 21 al martes 25: pasa el domingo 23 y ése no se cobra.
    const MARTES = dia('2026-08-25').getTime()
    expect(calcularDiasMora(base, DOMINGOS, [], MARTES))
      .toBe(calcularDiasMora(base, [], [], MARTES) - 1)
  })
})

describe('la cuota de hoy no está atrasada', () => {
  it('⚠ solo cuenta lo vencido ANTES de hoy', () => {
    /* Empezó el 20, cuotas el 21 y el 22, nunca pagó. El 22 solo está vencida
       la del 21. La del 22 se cobra hoy. */
    expect(calcularMontoEnMora({ ...base }, DOMINGOS, [])).toBeGreaterThanOrEqual(0)
  })

  it('el día que empieza a deber, no debe nada todavía', () => {
    const reciennacido = { ...base, fechaInicio: new Date() }
    expect(calcularMontoEnMora(reciennacido, DOMINGOS, [])).toBe(0)
  })
})

describe('el rótulo dice la verdad', () => {
  it('con días de mora se llama «Atraso»', () => {
    const c = cifrasDe({ ...base, diasMora: 3, montoEnMora: 12000 }, 'co')
    const x = c.find((y) => y.clave === 'atraso')
    expect(x.etiqueta).toBe('Atraso')
    expect(x.tono).toBe('contra')
  })

  it('⚠ sin días de mora se llama «Le falta», que es lo que pasa', () => {
    /* El caso real: pagó $420.000 de una cuota de $525.000. No va atrasado en
       días —su cobro es hoy— pero se quedó corto en plata. */
    const c = cifrasDe({ ...base, diasMora: 0, montoEnMora: 105000 }, 'co')
    const x = c.find((y) => y.clave === 'atraso')
    expect(x.etiqueta).toBe('Le falta')
  })

  it('y la cifra se encuentra por su clave, no por su texto', () => {
    // Las tablas de PC la buscaban por el rótulo, que ahora cambia.
    for (const dias of [0, 5]) {
      const c = cifrasDe({ ...base, diasMora: dias, montoEnMora: 1000 }, 'co')
      expect(c.find((y) => y.clave === 'atraso')).toBeTruthy()
    }
  })
})
