import { describe, it, expect } from 'vitest'
import {
  calcularDiasMora, calcularCuotasPendientes, calcularCuotasEnMora,
  calcularMontoEnMora, calcularMontoParaPonerseAlDia, calcularProximoCobro,
} from '@/lib/calculos'

/* ══════════════════════════════════════════════════════════════════════════
   LA MORA DE UN PRÉSTAMO ABIERTO

   Aquí no hay calendario que vencer: no hay última cuota ni fecha final. Lo
   único que se puede deber a tiempo es EL INTERÉS DEL PERÍODO, y eso es lo que
   tiene que mirar la mora.

   Medido antes de tocar nada, en el espejo: un abierto recién creado decía
   «0 días de mora» pero también «8 cuotas pendientes». Cuotas no tiene
   ninguna. Un número que no significa nada en una pantalla de plata se lee
   como que el sistema no sabe lo que dice.

   ⚠ Escritas antes del código, y falladas a propósito.
   ══════════════════════════════════════════════════════════════════════════ */

const HOY = Date.parse('2026-08-18T12:00:00.000Z')
const dia = (s) => `${s}T05:00:00.000Z`

/** Un abierto de $690.000 al 10% mensual, arrancado el 15 de mayo. */
const abierto = (extra = {}) => ({
  estado: 'activo',
  montoPrestado: 690_000,
  totalAPagar: 690_000,
  /* ⚠ SIN `cuotaDiaria` LA MORA ES SIEMPRE 0. La función se planta ahí a
     propósito —un préstamo sin cuota no puede estar atrasado— y mi fixture no
     la traía: la prueba de control daba 0 sobre código correcto. */
  cuotaDiaria: 69_000,
  tasaInteres: 10,
  frecuencia: 'mensual',
  modoInteres: 'solo_interes',
  sinPlazo: true,
  fechaInicio: dia('2026-05-15'),
  fechaFin: dia('2026-06-15'),
  diasPlazo: 30,
  cuotasAmortizacion: [],
  pagos: [],
  devengos: [],
  ...extra,
})

describe('sin interés devengado no hay mora', () => {
  it('recién prestado: cero días', () => {
    /* Y `fechaFin` es el 15 de junio, ya pasado. Si la mora la sacara de ahí
       —que es lo que hacía— diría 64 días de mora de un préstamo al día. */
    expect(calcularDiasMora(abierto(), [], [], HOY)).toBe(0)
  })

  it('y cero cuotas: un abierto no tiene cuotas', () => {
    expect(calcularCuotasPendientes(abierto())).toBe(0)
    expect(calcularCuotasEnMora(abierto(), [], [], HOY)).toBe(0)
    expect(calcularMontoEnMora(abierto(), [], [], HOY)).toBe(0)
  })
})

describe('la mora la marca el interés sin pagar', () => {
  /* Junio y julio cerrados, ninguno pagado. El más viejo venció el 15 de junio
     y hoy es 18 de agosto: 64 días. */
  const dosSinPagar = abierto({
    totalAPagar: 690_000 + 138_000,
    devengos: [
      { periodo: '2026-06-15', interes: 69_000, capitalBase: 690_000 },
      { periodo: '2026-07-15', interes: 69_000, capitalBase: 690_000 },
    ],
  })

  it('cuenta desde el interés más viejo sin pagar', () => {
    expect(calcularDiasMora(dosSinPagar, [], [], HOY)).toBe(64)
  })

  it('debe dos períodos, no ocho cuotas', () => {
    expect(calcularCuotasPendientes(dosSinPagar)).toBe(2)
    expect(calcularCuotasEnMora(dosSinPagar, [], [], HOY)).toBe(2)
  })

  it('lo que debe es el interés, nunca el capital', () => {
    /* El capital no vence: es la razón de existir de este modo. Meterlo en «lo
       que debe hoy» convertiría un préstamo al día en uno con $690.000 en mora. */
    expect(calcularMontoEnMora(dosSinPagar, [], [], HOY)).toBe(138_000)
    expect(calcularMontoParaPonerseAlDia(dosSinPagar, [], [], HOY)).toBe(138_000)
  })

  it('pagando uno, la mora se cuenta desde el que queda', () => {
    const unoPagado = {
      ...dosSinPagar,
      pagos: [{ tipo: 'intereses', montoPagado: 69_000, fechaPago: dia('2026-06-20') }],
    }
    // Queda el del 15 de julio: del 15 jul al 18 ago son 34 días.
    expect(calcularDiasMora(unoPagado, [], [], HOY)).toBe(34)
    expect(calcularCuotasPendientes(unoPagado)).toBe(1)
    expect(calcularMontoEnMora(unoPagado, [], [], HOY)).toBe(69_000)
  })

  it('al día en interés: cero mora, aunque deba todo el capital', () => {
    const alDia = {
      ...dosSinPagar,
      pagos: [{ tipo: 'intereses', montoPagado: 138_000, fechaPago: dia('2026-07-16') }],
    }
    expect(calcularDiasMora(alDia, [], [], HOY)).toBe(0)
    expect(calcularCuotasPendientes(alDia)).toBe(0)
    expect(calcularMontoEnMora(alDia, [], [], HOY)).toBe(0)
    expect(calcularMontoParaPonerseAlDia(alDia, [], [], HOY)).toBe(0)
  })
})

describe('el próximo cobro es el próximo interés, y nunca se acaba', () => {
  it('apunta al siguiente cierre de período', () => {
    const p = calcularProximoCobro(abierto(), [], [], HOY)
    expect(p && new Date(p).toISOString().slice(0, 10)).toBe('2026-09-15')
  })

  it('con meses debiendo, apunta al más viejo sin pagar', () => {
    /* Es lo que el cobrador va a pedir hoy: el atrasado, no el futuro. */
    const p = calcularProximoCobro(abierto({
      devengos: [{ periodo: '2026-06-15', interes: 69_000, capitalBase: 690_000 }],
    }), [], [], HOY)
    expect(p && new Date(p).toISOString().slice(0, 10)).toBe('2026-06-15')
  })
})

describe('nada de esto le pasa a los demás', () => {
  it('un Globo con plazo sigue calculando su mora por la tabla', () => {
    const conTabla = abierto({
      sinPlazo: false,
      cuotasAmortizacion: [
        { numeroPeriodo: 1, cuotaTotal: 69_000, capital: 0, interes: 69_000, fechaEsperada: dia('2026-06-15'), pagado: 0 },
        { numeroPeriodo: 2, cuotaTotal: 759_000, capital: 690_000, interes: 69_000, fechaEsperada: dia('2026-07-15'), pagado: 0 },
      ],
    })
    expect(calcularDiasMora(conTabla, [], [], HOY)).toBe(64)
    expect(calcularCuotasPendientes(conTabla)).toBe(2)
  })
})
