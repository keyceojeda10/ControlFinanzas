import { describe, it, expect } from 'vitest'
import { reconstruirTabla, repartirPagado } from '@/lib/dinero/reconstruir-tabla'

/* Los préstamos REALES que se reconstruyeron el 4 ago 2026. Se dejan con sus
   cifras de producción: si alguien toca el reconstructor, estas son las tablas
   que ya están escritas en la base y tienen que seguir saliendo iguales. */
const REALES = [
  ['Yaneris',   1000000, 1317200,  329300, 'mensual',   12,  120, 4],
  ['Abraham',   3000000, 3384400,  846100, 'mensual',    5,  120, 4],
  ['Angélica',  2000000, 2774500,  554900, 'mensual',   12,  150, 5],
  ['Diana',     1200000, 1664500,  332900, 'mensual',   12,  150, 5],
  ['Dayana',    1500000, 1652700,  550900, 'mensual',    5,   90, 3],
  ['Irina',     3000000, 4378200,  729700, 'mensual',   12,  180, 6],
  ['John',       100000,  120000,   10000, 'diario',    83,   12, 12],
  ['Polvo',      200000,  240000,    8000, 'diario',    35,   30, 30],
  ['Carlos',     500000,  550000,  550000, 'mensual',   10,   30, 1],
  ['jose luis', 8000000,10737600,  447400, 'mensual',  2.5,  720, 24],
  ['Camell',    1500000, 1650000, 1650000, 'mensual',   10,   30, 1],
]

const armar = ([, monto, total, cuota, freq, tasa, dias]) => reconstruirTabla({
  montoPrestado: monto, totalAPagar: total, cuotaDiaria: cuota,
  frecuencia: freq, tasaInteres: tasa, diasPlazo: dias, fechaInicio: '2026-04-01',
})

describe('la tabla reconstruida NO cambia la deuda', () => {
  for (const caso of REALES) {
    const [nombre, monto, total, , , , , periodos] = caso
    it(`${nombre}: suma su deuda y devuelve lo prestado`, () => {
      const r = armar(caso)
      expect(r.cuadra, r.motivo ?? '').toBe(true)
      expect(r.filas).toHaveLength(periodos)
      // Las dos invariantes que decidieron si se escribía o no.
      expect(r.filas.reduce((a, f) => a + f.cuotaTotal, 0)).toBe(total)
      expect(r.filas.reduce((a, f) => a + f.capital, 0)).toBe(monto)
    })
  }

  it('las cuotas son PAREJAS, que es como se pactaron', () => {
    // Comprobado en 11 de los 12: `total = cuota × períodos`. Cerrar el saldo en
    // la última fila —como hace `calcularPrestamo`— dejaba la tabla entre $53 y
    // $3.154 POR DEBAJO de la deuda: un calendario que no cuadra con lo que el
    // cliente debe.
    const r = armar(REALES[0])
    const montos = new Set(r.filas.map((f) => f.cuotaTotal))
    expect(montos.size).toBe(1)
    expect([...montos][0]).toBe(329300)
  })

  it('ninguna cuota sale con capital o interés negativo', () => {
    for (const caso of REALES) {
      for (const f of armar(caso).filas) {
        expect(f.capital, caso[0]).toBeGreaterThanOrEqual(0)
        expect(f.interes, caso[0]).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('el saldo llega a cero en la última', () => {
    for (const caso of REALES) {
      expect(armar(caso).filas.at(-1).saldoRestante, caso[0]).toBe(0)
    }
  })
})

describe('lo que NO se reconstruye, y por qué', () => {
  it('un préstamo cuyo total ya no es múltiplo de su cuota se rechaza', () => {
    // Leydi y shayleth: tuvieron un abono a capital que movió las cuotas
    // futuras, así que su calendario ya no es el pactado. Reconstruirlo sería
    // adivinar cómo se repartió ese abono — y así es como se infló la deuda de
    // un cliente en el pasado.
    const r = reconstruirTabla({
      montoPrestado: 1200000, totalAPagar: 1674000, cuotaDiaria: 174900,
      frecuencia: 'quincenal', tasaInteres: 15, diasPlazo: 150,
    })
    expect(r.cuadra).toBe(false)
    expect(r.filas).toHaveLength(0)
    expect(r.motivo).toMatch(/múltiplo/)
  })

  it('sin monto, total o cuota no se inventa nada', () => {
    for (const p of [{}, { totalAPagar: 100 }, { montoPrestado: 100, totalAPagar: 200 }]) {
      const r = reconstruirTabla(p)
      expect(r.cuadra).toBe(false)
      expect(r.filas).toHaveLength(0)
    }
  })
})

describe('el reparto de lo ya pagado', () => {
  it('llena las cuotas en cascada', () => {
    const { filas } = armar(REALES[0])            // Yaneris: 4 × 329.300
    const con = repartirPagado(filas, 1020000)    // lo que lleva pagado
    expect(con[0].pagado).toBe(329300)
    expect(con[1].pagado).toBe(329300)
    expect(con[2].pagado).toBe(329300)
    expect(con[3].pagado).toBe(32100)             // el resto
    expect(con.reduce((a, f) => a + f.pagado, 0)).toBe(1020000)
  })

  it('nunca marca más de lo que vale la cuota', () => {
    const { filas } = armar(REALES[0])
    for (const f of repartirPagado(filas, 99999999)) {
      expect(f.pagado).toBeLessThanOrEqual(f.cuotaTotal)
    }
  })

  it('sin pagos, la tabla queda en cero', () => {
    const { filas } = armar(REALES[0])
    for (const f of repartirPagado(filas, 0)) expect(f.pagado).toBe(0)
  })
})
