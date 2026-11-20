// 20 nov 2026, dos cabos del arreglo del interés que compra tiempo.
//  · Quincenal con UN solo día del mes: el calendario cobraba una vez al mes
//    mientras la ficha decía «cada 15 días» (Geovanny Arce, Leyder).
//  · La fecha que anuncia «Aplazar el próximo cobro» la calculaba la hoja por su
//    cuenta; ahora es la misma que guarda el servidor.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { calendarioDeCobro } from '@/lib/dias-sin-cobro'
import { calcularProximoCobro } from '@/lib/calculos'

const leer = (r) => readFileSync(r, 'utf8')
const d = (s) => new Date(`${s}T05:00:00.000Z`)

describe('quincenal con un solo día del mes', () => {
  it('al crearlo se completa el segundo día a 15 del primero (no en el abierto)', () => {
    const src = leer('app/api/prestamos/route.js')
    expect(src).toMatch(/if \(freq === 'quincenal' && !esAbierto && Number\.isInteger\(diaCobroMesDb\) && !Number\.isInteger\(diaCobroMes2Db\)\)/)
    expect(src).toMatch(/const otro = diaCobroMesDb <= 15 \? diaCobroMesDb \+ 15 : diaCobroMesDb - 15/)
  })

  it('al cambiar el día de cobro, igual', () => {
    const src = leer('app/api/prestamos/[id]/route.js')
    expect(src).toMatch(/if \(freq === 'quincenal' && !abierto && !Number\.isInteger\(segundo\)\)/)
  })

  it('los que ya existen así dicen la verdad: una vez al mes', () => {
    expect(calendarioDeCobro({ frecuencia: 'quincenal', diaCobroMes: 10, fechaInicio: '2026-09-20' })).toBe('Se cobra el 10 de cada mes')
    expect(calendarioDeCobro({ frecuencia: 'quincenal', diaCobroMes: 10, diaCobroMes2: 25, fechaInicio: '2026-09-20' })).toBe('Se cobra el 10 y el 25 de cada mes')
  })
})

describe('la fecha que anuncia «Aplazar el próximo cobro»', () => {
  it('es el préstamo con un período comprado más, como en el servidor', () => {
    const src = leer('components/prestamos/RegistrarPago.jsx')
    expect(src).toMatch(/calcularProximoCobro\(\{ \.\.\.prestamo, periodosComprados: prestamo\.periodosComprados \+ 1, proximoCobroManual: null, proximoCobroPorInteres: false \}\)/)
  })

  it('Vladimir con una quincena comprada: un período más lleva al 29 nov', () => {
    const p = {
      estado: 'activo', modoInteres: 'unico', frecuencia: 'quincenal', montoPrestado: 150000,
      totalAPagar: 320200, cuotaDiaria: 235100, diasPlazo: 15, totalPagado: 85100,
      fechaInicio: d('2026-10-15'), fechaFin: d('2026-10-30'), periodosComprados: 1, interesComprado: 85100,
    }
    expect(calcularProximoCobro(p).toISOString().slice(0, 10)).toBe('2026-11-14')
    expect(calcularProximoCobro({ ...p, periodosComprados: 2 }).toISOString().slice(0, 10)).toBe('2026-11-29')
  })
})
