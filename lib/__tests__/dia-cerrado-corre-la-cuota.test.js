// EL DÍA CERRADO NO BORRA LA CUOTA: LA CORRE AL SIGUIENTE DÍA COBRABLE.
//
// El dueño, 20 sep 2026: «se mueve al día siguiente, es lo lógico».
//
// Antes esto solo lo miraba la frecuencia DIARIA. Un semanal cuyo ciclo caía en
// un día marcado sin cobro sumaba igual a «lo que toca cobrar hoy» con el
// negocio cerrado, mientras la ficha de la ruta decía «0 cobros programados
// hoy»: en la misma pantalla se leía «$173.000 por cobrar hoy» al lado de «0
// cobros programados hoy». Medido en el espejo: 23 préstamos en 13 negocios,
// $2.787.500 un domingo.
//
// Las DOS funciones cambian a la vez —`tienePeriodoEsperadoHoy` (lib/calculos)
// y `tocaCobrarEn` (lib/dinero/esperado)— y `esperado-vs-calculos.test.js`
// vigila que no se separen.
import { describe, it, expect } from 'vitest'
import { tocaCobrarEn, inicioDia, esDiaMuerto } from '@/lib/dinero/esperado'
import { tienePeriodoEsperadoHoy } from '@/lib/calculos'

const DIA = 86400000
const dia = (iso) => inicioDia(new Date(`${iso}T12:00:00.000Z`))

// Un semanal anclado en DOMINGO: 6 sep 2026 es domingo, 13 y 20 también.
const semanalDomingo = {
  cuotaDiaria: 50000, frecuencia: 'semanal', fechaInicio: dia('2026-08-30'),
  totalAPagar: 400000, totalPagado: 0, modoInteres: 'fijo',
}

describe('un domingo cerrado corre la cuota al lunes', () => {
  const DOMINGOS_CERRADOS = [0]

  it('el domingo NO vence nada', () => {
    expect(tocaCobrarEn(semanalDomingo, dia('2026-09-06'), [], [])).toBe(true)
    expect(tocaCobrarEn(semanalDomingo, dia('2026-09-06'), DOMINGOS_CERRADOS, [])).toBe(false)
  })

  it('y el lunes sí, que es el primer día en que se puede cobrar', () => {
    expect(tocaCobrarEn(semanalDomingo, dia('2026-09-07'), [], [])).toBe(false)
    expect(tocaCobrarEn(semanalDomingo, dia('2026-09-07'), DOMINGOS_CERRADOS, [])).toBe(true)
  })

  it('el martes ya no: la cuota se cobró el lunes', () => {
    expect(tocaCobrarEn(semanalDomingo, dia('2026-09-08'), DOMINGOS_CERRADOS, [])).toBe(false)
  })

  it('con el negocio abierto los domingos nada cambia', () => {
    expect(tocaCobrarEn(semanalDomingo, dia('2026-09-06'), [], [])).toBe(true)
    expect(tocaCobrarEn(semanalDomingo, dia('2026-09-07'), [], [])).toBe(false)
  })
})

describe('una racha de días cerrados', () => {
  // Solo se cobra el sábado (cierra de domingo a viernes): el caso real de la
  // cartera, `diasSinCobro [0,1,2,3,4,5]`.
  const SOLO_SABADO = [0, 1, 2, 3, 4, 5]

  it('la cuota del miércoles se cobra el sábado siguiente', () => {
    const p = { ...semanalDomingo, fechaInicio: dia('2026-09-02') } // miércoles
    expect(tocaCobrarEn(p, dia('2026-09-09'), [], [])).toBe(true)   // el ciclo cae miércoles
    expect(tocaCobrarEn(p, dia('2026-09-09'), SOLO_SABADO, [])).toBe(false)
    expect(tocaCobrarEn(p, dia('2026-09-12'), SOLO_SABADO, [])).toBe(true) // sábado
  })

  it('ningún día cerrado tiene cobro, ni con la racha más larga', () => {
    const p = { ...semanalDomingo, fechaInicio: dia('2026-09-02') }
    for (let i = 0; i < 28; i++) {
      const d = new Date(dia('2026-09-30').getTime() - i * DIA)
      if (esDiaMuerto(d, SOLO_SABADO, [])) {
        expect(tocaCobrarEn(p, d, SOLO_SABADO, []), d.toISOString().slice(0, 10)).toBe(false)
      }
    }
  })

  it('la cuota no se pierde: cada día del ciclo aterriza en el primer día abierto', () => {
    // La invariante que se midió contra la cartera del espejo: 6.771 días de
    // cobro de 5.045 préstamos no diarios, los 6.771 aterrizando bien.
    const p = { ...semanalDomingo, fechaInicio: dia('2026-08-05') }
    let cicloDias = 0
    for (let i = 28; i >= 8; i--) {
      const C = new Date(dia('2026-09-30').getTime() - i * DIA)
      if (!tocaCobrarEn(p, C, [], [])) continue
      cicloDias += 1
      let L = C
      for (let k = 0; k < 8 && esDiaMuerto(L, SOLO_SABADO, []); k++) L = new Date(L.getTime() + DIA)
      expect(tocaCobrarEn(p, L, SOLO_SABADO, []), `del ${C.toISOString().slice(0, 10)}`).toBe(true)
    }
    expect(cicloDias).toBeGreaterThan(0)
  })
})

describe('lo que no cambia', () => {
  it('la frecuencia diaria se queda como estaba: el día cerrado no acumula', () => {
    const p = { ...semanalDomingo, frecuencia: 'diario', cuotaDiaria: 20000, fechaInicio: dia('2026-08-30') }
    expect(tocaCobrarEn(p, dia('2026-09-06'), [0], [])).toBe(false) // domingo cerrado
    expect(tocaCobrarEn(p, dia('2026-09-07'), [0], [])).toBe(true)  // lunes, como siempre
  })

  it('un festivo también corre la cuota', () => {
    const festivos = [{ fecha: '2026-09-06' }]
    expect(tocaCobrarEn(semanalDomingo, dia('2026-09-06'), [], festivos)).toBe(false)
    expect(tocaCobrarEn(semanalDomingo, dia('2026-09-07'), [], festivos)).toBe(true)
  })

  it('`tienePeriodoEsperadoHoy` contesta lo mismo que `tocaCobrarEn` para hoy', () => {
    const hoy = inicioDia()
    for (const sinCobro of [[], [0], [0, 6], [0, 1, 2, 3, 4, 5], [1, 2, 3, 4, 5, 6]]) {
      for (const dias of [7, 14, 15, 30, 31]) {
        for (const frecuencia of ['semanal', 'quincenal', 'mensual']) {
          const p = { ...semanalDomingo, frecuencia, fechaInicio: new Date(hoy.getTime() - dias * DIA) }
          const cerradoHoy = esDiaMuerto(hoy, sinCobro, [])
          expect(
            tienePeriodoEsperadoHoy(p, cerradoHoy, sinCobro, []),
            `${frecuencia} · hace ${dias}d · [${sinCobro}]`,
          ).toBe(tocaCobrarEn(p, hoy, sinCobro, []))
        }
      }
    }
  })
})
