// lib/__tests__/adaptadores-prestamos.test.js
//
// El adaptador de prestamos era el UNICO de los diez sin pruebas — estaba
// anotado como deuda en el plan. Se cierra aca, con el cotejo de T02-06.

import { describe, it, expect } from 'vitest'
import {
  adaptarPrestamos, contextoDe, estadoDe, etiquetaPrestamo, tresCifras,
  detalleDe, formatearTasa, fechaCorta, RENOVAR_DESDE,
} from '@/lib/adaptadores/prestamos'

describe('T02-06 · el contexto, los estados y las tres cifras', () => {
  const base = {
    id: 'p1', cliente: { nombre: 'Carlos Chaparro', ruta: { nombre: 'Ruta #1' } },
    frecuencia: 'semanal', tasaInteres: 20, totalCuotas: 24, cuotasPendientes: 12,
    saldoPendiente: 160000, totalAPagar: 1200000, porcentajePagado: 54,
    diasMora: 36, estado: 'activo', cuotaDiaria: 50000,
  }

  it('el contexto es «Semanal 20% · cuota 13 de 24 · Ruta #1»', () => {
    // Era «$20.000 diarios · Ruta 2». La cuota ya esta en la tarjeta —es el
    // monto de la derecha— asi que repetirla gastaba el sitio dos veces. Lo que
    // NO estaba es la tasa y por donde va.
    expect(contextoDe(base, 'CO')).toBe('Semanal 20% \u00b7 cuota 13 de 24 \u00b7 Ruta #1')
  })

  it('la cuota que dice es la EN CURSO, no las pagadas', () => {
    // Con 12 pendientes de 24, van 12 pagadas y el cobrador va a por la 13.
    expect(contextoDe({ ...base, cuotasPendientes: 24 }, 'CO')).toMatch(/cuota 1 de 24/)
    // Y en el ultimo pago, pendientes llega a 0: «cuota 25 de 24» no existe.
    expect(contextoDe({ ...base, cuotasPendientes: 0 }, 'CO')).toMatch(/cuota 24 de 24/)
  })

  it('la tasa se escribe sin decimales de mas, y con coma', () => {
    expect(contextoDe({ ...base, tasaInteres: 20 }, 'CO')).toMatch(/Semanal 20%/)
    expect(contextoDe({ ...base, tasaInteres: 7.5 }, 'CO')).toMatch(/Semanal 7,5%/)
  })

  it('el pagado dice la FECHA, no la cuota', () => {
    // «cuota 24 de 24» de algo cerrado es cierto y no sirve.
    const c = contextoDe({ ...base, fechaFin: '2026-07-12T05:00:00.000Z' }, 'CO', { pagado: true })
    expect(c).toMatch(/terminado 12 de jul/)
    expect(c).not.toMatch(/cuota/)
  })

  it('los dos estados propios de esta pantalla', () => {
    // `pagado` se apaga en gris, NO se tiñe de verde: el pie de la lamina lo
    // dice, y es la diferencia entre «va bien» y «esto ya cerro».
    expect(estadoDe({ estado: 'completado' })).toBe('pagado')
    expect(estadoDe({ estado: 'activo', saldoPendiente: 0 })).toBe('pagado')
    // `renovar`: al dia y por encima del 80%. De ahi sale el crecimiento.
    expect(estadoDe({ estado: 'activo', saldoPendiente: 100, diasMora: 0, porcentajePagado: 80 })).toBe('renovar')
    expect(estadoDe({ estado: 'activo', saldoPendiente: 100, diasMora: 0, porcentajePagado: 79 })).toBe('aldia')
    // La mora manda sobre el 80%: un atrasado no es candidato a renovar.
    expect(estadoDe({ estado: 'activo', saldoPendiente: 100, diasMora: 10, porcentajePagado: 95 })).toBe('mora')
  })

  it('ni «renovar» ni «pagado» llevan dias en la pastilla', () => {
    // Uno es una oportunidad y el otro un cierre: en ninguno «0d» significa algo.
    expect(etiquetaPrestamo('renovar', 0)).toBe('Renovar')
    expect(etiquetaPrestamo('pagado', 0)).toBe('Pagado')
    expect(etiquetaPrestamo('mora', 36)).toBe('36d mora')
  })

  it('las tres cifras, y se marca cuando son PARCIALES', () => {
    // Un «$38.4M» que en realidad es la suma de 50 de 68 prestamos es la clase
    // de cifra que hace desconfiar de la app entera.
    const c = tresCifras([base, { ...base, id: 'p2', diasMora: 0, saldoPendiente: 40000 }], 'CO', { cobradoMes: 9200000 })
    expect(c.enLaCalle).toBe('$200.000')
    expect(c.enMora).toBe('$160.000')
    expect(c.cobradoMes).toBe('$9.200.000')
    expect(c.parcial).toBe(true)
  })

  it('sin «cobrado mes» la tarjeta no se pinta, en vez de decir $0', () => {
    // Un «$0 cobrado este mes» se lee como «no cobre nada», que es otra cosa.
    expect(tresCifras([base], 'CO').cobradoMes).toBeNull()
  })
})
