// lib/__tests__/adaptadores-prestamos.test.js
//
// El adaptador de prestamos era el UNICO de los diez sin pruebas — estaba
// anotado como deuda en el plan. Se cierra aca, con el cotejo de T03-04 —que
// es el turno que MANDA: corrige a T02-06 y le anade la tira de cifras.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  adaptarPrestamos, contextoDe, estadoDe, etiquetaPrestamo, tresCifras,
  detalleDe, totalDe, avanceDe, cifrasDe, formatearTasa, fechaCorta, RENOVAR_DESDE,
} from '@/lib/adaptadores/prestamos'

describe('T02-06 · el contexto, los estados y las tres cifras', () => {
  const base = {
    id: 'p1', cliente: { nombre: 'Carlos Chaparro', ruta: { nombre: 'Ruta #1' } },
    frecuencia: 'semanal', tasaInteres: 20, totalCuotas: 24, cuotasPendientes: 12,
    saldoPendiente: 160000, totalAPagar: 1200000, porcentajePagado: 54,
    diasMora: 36, estado: 'activo', cuotaDiaria: 50000,
  }

  it('el contexto es «Semanal 20% · Ruta #1» — MANDA T03-04, NO T02-06', () => {
    // Esta prueba fijaba «Semanal 20% · cuota 13 de 24 · Ruta #1», que es el
    // TURNO 02. El turno 03 corrige esa lamina y baja la cuota junto a la
    // barra, donde queda al lado del avance. Aca se queda lo que NO cambia con
    // los pagos: como se pacto y donde se cobra.
    expect(contextoDe(base, 'CO')).toBe('Semanal 20% \u00b7 Ruta #1')
    expect(contextoDe(base, 'CO')).not.toMatch(/cuota/)
  })

  it('la cuota va en el AVANCE, al lado de la barra, y es la EN CURSO', () => {
    // «cuota 13/24 · 54%», literal de T03-04. Con 12 pendientes de 24 van 12
    // pagadas y el cobrador va a por la 13.
    expect(avanceDe(base)).toBe('cuota 13/24 \u00b7 54%')
    expect(avanceDe({ ...base, cuotasPendientes: 24 })).toMatch(/cuota 1\/24/)
    // Y en el ultimo pago, pendientes llega a 0: «cuota 25/24» no existe.
    expect(avanceDe({ ...base, cuotasPendientes: 0 })).toMatch(/cuota 24\/24/)
  })

  it('la tira lleva cuota y vencimiento, y el atraso EN PLATA', () => {
    // La pastilla ya dice «36d»; esta columna dice CUANTO le deben de mas, que
    // es con lo que se decide si vale la pena ir hoy.
    const c = cifrasDe({ ...base, montoEnMora: 48000, fechaFin: '2026-12-04' }, 'CO')
    expect(c.map((x) => x.rotulo)).toEqual(['Cuota', 'Atraso', 'Vence'])
    expect(c[1].valor).toMatch(/48\.000/)
    expect(c[1].tono).toBe('mora')
  })

  it('al dia, el atraso sale en $0 en vez de desaparecer', () => {
    // Una columna que aparece y desaparece obliga a releer la tira en CADA
    // tarjeta, y el «$0» es justo lo que se quiere ver de un cliente al dia.
    const atraso = cifrasDe({ ...base, montoEnMora: 0 }, 'CO').find((x) => x.rotulo === 'Atraso')
    expect(atraso.valor).toMatch(/\$0/)
    expect(atraso.tono).toBeUndefined()
  })

  it('sin el dato medido, la columna NO se inventa', () => {
    // La GANANCIA la pide la lamina —su pie la llama «la razon de ser del
    // prestamo»— y hoy la API no la manda. Derivarla a ojo es el error que ya
    // inflo las analiticas 7,9 veces, asi que la columna falta A PROPOSITO.
    const c = cifrasDe(base, 'CO')
    expect(c.some((x) => /ganancia/i.test(x.rotulo))).toBe(false)
    // El atraso, igual: sin `montoEnMora` no hay columna, no hay un $0 falso.
    expect(c.some((x) => x.rotulo === 'Atraso')).toBe(false)
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
    expect(etiquetaPrestamo('mora', 36)).toBe('36d')
  })

  it('las tres cifras, y se marca cuando son PARCIALES', () => {
    // Un «$38.4M» que en realidad es la suma de 50 de 68 prestamos es la clase
    // de cifra que hace desconfiar de la app entera.
    const c = tresCifras([base, { ...base, id: 'p2', diasMora: 0, saldoPendiente: 40000 }], 'CO', { cobradoMes: 9200000 })
    expect(c.enLaCalle).toBe('$200.000')
    expect(c.enMora).toBe('$160.000')
    // ABREVIADA POR ENCIMA DEL MILLON, y no es cosmetica: medido, cada tarjeta
    // mide 110px y deja 82 de hueco util, y «$8.573.659» a cuerpo 19 necesita
    // 100. Las tres cifras se salian 18px por la derecha — el usuario lo vio
    // antes que yo. Por debajo del millon no se toca: «$200.000» cabe y decir
    // «$0,2M» seria perder precision sin ganar nada.
    expect(c.cobradoMes).toBe('$9,2M')
    expect(c.parcial).toBe(true)
  })

  it('sin «cobrado mes» la tarjeta no se pinta, en vez de decir $0', () => {
    // Un «$0 cobrado este mes» se lee como «no cobre nada», que es otra cosa.
    expect(tresCifras([base], 'CO').cobradoMes).toBeNull()
  })
})

describe('las cifras caben en su caja', () => {
  // ── SE SALIAN, Y LO VIO EL USUARIO ANTES QUE YO ──
  //
  // Medido en la pantalla: tres tarjetas en 390px son 110px cada una y con su
  // relleno dejan 83 de hueco util. «$8.573.659» a cuerpo 19 con cifras
  // tabulares mide 100. Las TRES se salian 17px por la derecha.
  //
  // Esta prueba no mide pixeles —eso solo se puede en un navegador— pero si
  // fija las dos decisiones que hacen que quepan, que es lo que se puede
  // romper sin darse cuenta: abreviar por encima del millon, y que la cifra
  // mas ancha sin abreviar sea «$999.999».
  it('nada por encima del millon se escribe entero', () => {
    const c = tresCifras([], 'CO', {
      totales: { saldoPorCobrar: 8_573_659, saldoEnMora: 3_073_658 },
      cobradoMes: 1_000_000,
    })
    for (const v of [c.enLaCalle, c.enMora, c.cobradoMes]) {
      expect(v, `«${v}» se escribe entero y no cabe`).toMatch(/M$/)
      // Ocho caracteres es «$999.999», el limite que cabe. «$8,6M» son cinco.
      expect(v.length, `«${v}» es demasiado largo`).toBeLessThanOrEqual(8)
    }
  })

  it('por debajo del millon NO se abrevia: se perderia precision sin ganar sitio', () => {
    const c = tresCifras([], 'CO', {
      totales: { saldoPorCobrar: 999_999, saldoEnMora: 200_000 },
      cobradoMes: 0,
    })
    expect(c.enLaCalle).toBe('$999.999')
    expect(c.enMora).toBe('$200.000')
    // La mas ancha posible sin abreviar. Si alguien cambia el umbral, esto lo dice.
    expect(c.enLaCalle.length).toBe(8)
  })

  it('la tarjeta deja sitio para esos ocho caracteres', () => {
    // 110 de ancho − 12 + 12 de relleno = 86 de hueco. «$999.999» mide 84.
    const fuente = fs.readFileSync(
      path.join(process.cwd(), 'components/pantallas/ListaPrestamos.jsx'), 'utf8')
    const bloque = fuente.slice(fuente.indexOf('export function TresCifras'),
      fuente.indexOf('const ORDENES'))
    expect(bloque).toMatch(/padding: '12px'/)
    expect(bloque).toMatch(/fontSize: 19/)
  })
})
