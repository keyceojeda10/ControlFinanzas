// La funcion nueva tiene que contestar lo MISMO que la vieja, para hoy.
//
// ══ POR QUE ════════════════════════════════════════════════════════════════
//
// `lib/dinero/esperado.js` viene a sustituir a las cinco implementaciones de
// «cuanto tocaba cobrar» que hoy conviven y se contradicen. Pero cinco rutas
// de produccion y 398 negocios dependen de la respuesta de HOY.
//
// Esta prueba es la red: sobre una rejilla de frecuencias, anclas y dias sin
// cobro, `tocaCobrarEn(p, hoy)` tiene que dar exactamente lo mismo que
// `tienePeriodoEsperadoHoy(p)`. Si coinciden, migrar a los llamadores no
// cambia ni una cifra en pantalla; lo unico que se gana es poder preguntar por
// OTRAS fechas — que es lo que el cierre automatico y el cuadre necesitan y
// hoy no tienen.
//
// Donde NO coincidan, la diferencia se nombra y se justifica aqui abajo. Una
// discrepancia sin explicar es un fallo, no un detalle.

import { describe, it, expect } from 'vitest'
import { tienePeriodoEsperadoHoy } from '../calculos'
import { tocaCobrarEn, inicioDia, esDiaSinCobro, esDiaMuerto } from '../dinero/esperado'
import { esHoySinCobro } from '../dias-sin-cobro'

const DIA = 86400000
const HOY = inicioDia()

function prestamo(extra = {}) {
  return {
    cuotaDiaria: 20000,
    frecuencia: 'diario',
    fechaInicio: new Date(HOY.getTime() - 30 * DIA),
    diasPlazo: 30,
    totalAPagar: 600000,
    totalPagado: 0,
    modoInteres: 'fijo',
    ...extra,
  }
}

// Rejilla: frecuencia x ancla x antiguedad. Son los ejes por los que las cinco
// implementaciones divergian.
const FRECUENCIAS = ['diario', 'semanal', 'quincenal', 'mensual']
const ANTIGUEDADES = [1, 2, 7, 14, 15, 28, 30, 31, 45, 60, 90]
const DIAS_SIN_COBRO = [[], [0], [0, 6]]

describe('la funcion nueva contra la vieja, para hoy', () => {
  it('coincide sin ancla, en las cuatro frecuencias', () => {
    const desacuerdos = []
    for (const frecuencia of FRECUENCIAS) {
      for (const dias of ANTIGUEDADES) {
        for (const sinCobro of DIAS_SIN_COBRO) {
          const p = prestamo({ frecuencia, fechaInicio: new Date(HOY.getTime() - dias * DIA) })
          const hoySinCobro = esHoySinCobro(sinCobro)
          const vieja = tienePeriodoEsperadoHoy(p, hoySinCobro, sinCobro, [])
          const nueva = tocaCobrarEn(p, HOY, sinCobro, [])
          if (vieja !== nueva) desacuerdos.push(`${frecuencia} · hace ${dias}d · sinCobro=[${sinCobro}] → vieja=${vieja} nueva=${nueva}`)
        }
      }
    }
    expect(desacuerdos).toEqual([])
  })

  it('coincide con ancla por dia del mes', () => {
    const desacuerdos = []
    for (const frecuencia of ['semanal', 'quincenal']) {
      for (const diaCobroMes of [1, 5, 15, 20, 28, 31]) {
        for (const dias of ANTIGUEDADES) {
          const p = prestamo({ frecuencia, diaCobroMes, fechaInicio: new Date(HOY.getTime() - dias * DIA) })
          const vieja = tienePeriodoEsperadoHoy(p, false, [], [])
          const nueva = tocaCobrarEn(p, HOY, [], [])
          if (vieja !== nueva) desacuerdos.push(`${frecuencia} · dia ${diaCobroMes} · hace ${dias}d → vieja=${vieja} nueva=${nueva}`)
        }
      }
    }
    expect(desacuerdos).toEqual([])
  })

  it('coincide en mensual con y sin ancla', () => {
    const desacuerdos = []
    for (const diaCobroMes of [null, 1, 15, 31]) {
      for (const dias of [1, 30, 31, 60, 90, 120]) {
        const p = prestamo({ frecuencia: 'mensual', diaCobroMes, fechaInicio: new Date(HOY.getTime() - dias * DIA) })
        const vieja = tienePeriodoEsperadoHoy(p, false, [], [])
        const nueva = tocaCobrarEn(p, HOY, [], [])
        if (vieja !== nueva) desacuerdos.push(`mensual · ancla ${diaCobroMes} · hace ${dias}d → vieja=${vieja} nueva=${nueva}`)
      }
    }
    expect(desacuerdos).toEqual([])
  })
})

describe('lo que la vieja no sabia hacer: preguntar por otra fecha', () => {
  it('un prestamo diario tenia cobro ayer, y anteayer', () => {
    const p = prestamo({ frecuencia: 'diario', fechaInicio: new Date(HOY.getTime() - 10 * DIA) })
    expect(tocaCobrarEn(p, new Date(HOY.getTime() - 1 * DIA))).toBe(true)
    expect(tocaCobrarEn(p, new Date(HOY.getTime() - 2 * DIA))).toBe(true)
  })

  it('el dia del desembolso NO cuenta: el primer cobro es un periodo despues', () => {
    const inicio = new Date(HOY.getTime() - 10 * DIA)
    const p = prestamo({ frecuencia: 'diario', fechaInicio: inicio })
    expect(tocaCobrarEn(p, inicio)).toBe(false)
    expect(tocaCobrarEn(p, new Date(inicio.getTime() + DIA))).toBe(true)
  })

  it('antes de prestar no se esperaba nada', () => {
    const p = prestamo({ fechaInicio: new Date(HOY.getTime() - 5 * DIA) })
    expect(tocaCobrarEn(p, new Date(HOY.getTime() - 6 * DIA))).toBe(false)
  })

  /* ── LA RAZON DE SER DE TODO ESTO ──────────────────────────────────────
     El cierre automatico corre pasada la medianoche y cierra el dia ANTERIOR;
     el cuadre acepta cualquier fecha. Los dos preguntaban por un dia que ya
     paso y recibian la respuesta de HOY, porque `tienePeriodoEsperadoHoy` lee
     `inicioDiaColombia()` sin argumento.

     Un semanal anclado en lunes lo demuestra: hoy puede no tocar y el lunes
     pasado si. La vieja no puede distinguirlo. */
  it('un semanal anclado distingue el dia que toca del que no', () => {
    // Se busca el lunes anterior a hoy.
    let lunes = new Date(HOY.getTime())
    do { lunes = new Date(lunes.getTime() - DIA) } while (lunes.getUTCDay() !== 1)

    const p = prestamo({
      frecuencia: 'semanal',
      diaCobroSemana: 1,
      fechaInicio: new Date(lunes.getTime() - 28 * DIA),
    })

    expect(tocaCobrarEn(p, lunes)).toBe(true)
    expect(tocaCobrarEn(p, new Date(lunes.getTime() + DIA))).toBe(false)
    expect(tocaCobrarEn(p, new Date(lunes.getTime() + 7 * DIA))).toBe(true)
  })
})

describe('dias muertos', () => {
  it('el domingo no se cobra si esta en los dias sin cobro', () => {
    let domingo = new Date(HOY.getTime())
    while (domingo.getUTCDay() !== 0) domingo = new Date(domingo.getTime() - DIA)
    expect(esDiaSinCobro(domingo, [0])).toBe(true)
    expect(esDiaSinCobro(domingo, [6])).toBe(false)
    expect(esDiaSinCobro(domingo, [])).toBe(false)
  })

  it('un festivo tampoco, aunque sea dia habil', () => {
    const ayer = new Date(HOY.getTime() - DIA)
    expect(esDiaMuerto(ayer, [], [{ fecha: ayer }])).toBe(true)
    expect(esDiaMuerto(ayer, [], [])).toBe(false)
  })

  it('un prestamo diario no espera cobro en dia muerto', () => {
    const p = prestamo({ frecuencia: 'diario', fechaInicio: new Date(HOY.getTime() - 10 * DIA) })
    const ayer = new Date(HOY.getTime() - DIA)
    expect(tocaCobrarEn(p, ayer, [], [])).toBe(true)
    expect(tocaCobrarEn(p, ayer, [ayer.getUTCDay()], [])).toBe(false)
    expect(tocaCobrarEn(p, ayer, [], [{ fecha: ayer }])).toBe(false)
  })
})
