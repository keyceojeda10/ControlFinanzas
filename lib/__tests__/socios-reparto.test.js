import { describe, it, expect } from 'vitest'
import { porcentajeParticipacion, repartirExacto } from '@/lib/socios'

// Reparto de utilidades entre socios por % de participacion. Pedido por dos
// negocios distintos: en una sociedad con capital en bolsa comun no se puede
// decir "este prestamo es de Fulano", que es lo unico que sabia hacer el modulo.
const socios = (...balances) => balances.map((b, i) => ({ id: `s${i}`, nombre: `Socio ${i}`, balanceNeto: b }))
const suma = (as) => as.reduce((a, x) => a + x.monto, 0)

describe('porcentaje de participacion', () => {
  it('sin meta, los socios suman 100%', () => {
    expect(porcentajeParticipacion(600000, 1000000)).toBe(60)
    expect(porcentajeParticipacion(400000, 1000000)).toBe(40)
  })

  it('con meta, los socios pueden sumar menos de 100% y el resto es del negocio', () => {
    // El ejemplo del reporte: 54,1% + 10,2% = 64,3%. El 35,7% restante es del dueño.
    const base = 10000000
    expect(porcentajeParticipacion(5410000, base)).toBe(54.1)
    expect(porcentajeParticipacion(1020000, base)).toBe(10.2)
  })

  it('sin base no revienta', () => {
    expect(porcentajeParticipacion(500000, 0)).toBe(0)
  })
})

describe('reparto exacto', () => {
  it('el caso del reporte: utilidad neta 650.000 entre dos socios', () => {
    const base = 10000000
    const ss = socios(5410000, 1020000)
    const total = 6430000
    const { asignaciones, totalSocios } = repartirExacto(650000, ss, base, total)
    // 650.000 x 54,1% = 351.650 (el numero exacto que puso el usuario en su carta)
    expect(asignaciones[0].monto).toBe(351650)
    expect(asignaciones[1].monto).toBe(66300)
    // lo que no se reparte se queda en el negocio
    expect(650000 - totalSocios).toBe(232050)
  })

  it('no pierde ni inventa pesos aunque el reparto no sea exacto', () => {
    // 100.000 entre tres socios iguales: 33.333,33 cada uno
    const ss = socios(100, 100, 100)
    const { asignaciones, totalSocios } = repartirExacto(100000, ss, 300, 300)
    expect(suma(asignaciones)).toBe(totalSocios)
    expect(totalSocios).toBe(100000)
    expect(asignaciones.map(a => a.monto).sort((a, b) => b - a)).toEqual([33334, 33333, 33333])
  })

  it('sin meta reparte el 100% del monto', () => {
    const ss = socios(700000, 300000)
    const { asignaciones, totalSocios } = repartirExacto(1000000, ss, 1000000, 1000000)
    expect(totalSocios).toBe(1000000)
    expect(suma(asignaciones)).toBe(1000000)
    expect(asignaciones[0].monto).toBe(700000)
  })

  it('reparte proporcional en muchos casos sin descuadrar', () => {
    const combinaciones = [
      [777777, [3, 5, 11, 2]],
      [1, [10, 10]],
      [999999, [1]],
      [123457, [7, 7, 7, 7, 7, 7, 7]],
      [50000, [1234567, 89, 4200000]],
    ]
    for (const [monto, balances] of combinaciones) {
      const ss = socios(...balances)
      const total = balances.reduce((a, b) => a + b, 0)
      const { asignaciones, totalSocios } = repartirExacto(monto, ss, total, total)
      expect(suma(asignaciones), `monto ${monto} / ${balances}`).toBe(totalSocios)
      expect(totalSocios, `monto ${monto}`).toBe(monto)
      expect(asignaciones.every(a => a.monto >= 0)).toBe(true)
    }
  })

  it('casos borde: sin socios, sin balances, monto cero', () => {
    expect(repartirExacto(1000, [], 100, 100).asignaciones).toEqual([])
    expect(suma(repartirExacto(1000, socios(0, 0), 0, 0).asignaciones)).toBe(0)
    expect(suma(repartirExacto(0, socios(100), 100, 100).asignaciones)).toBe(0)
  })

  it('un socio que retiro mas de lo que aporto no arrastra a los demas a negativo', () => {
    const ss = socios(500000, 0)
    const { asignaciones } = repartirExacto(100000, ss, 500000, 500000)
    expect(asignaciones[0].monto).toBe(100000)
    expect(asignaciones[1].monto).toBe(0)
  })
})
