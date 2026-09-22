// lib/__tests__/financiar-no-es-prestar.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// PRESTA MIL, 22 sep 2026, al día siguiente de estrenar «Financiar el saldo»:
//
//   «Los préstamos del día de hoy fueron 2 millones, pero le financié el saldo a
//    una cartulina que era un saldo de 1.181.000 y este saldo se me sumó […]
//    Solamente acá me sume lo que es cartulina renovada o cartulina de
//    préstamos, pero cartulina que yo financié el saldo, que no me sume acá.»
//
// Y en el mismo envío: «que por acá donde dice recargo me aparezca también
// financiar tarjeta […] cuánto fue lo que financiamos en el día en interés».
//
// Por dentro financiar ES renovar —cierra el viejo, abre uno con
// `renovadoDeId`— y la caja no tenía cómo distinguirlos: «Lo que prestó hoy»
// lo contaba como renovación, con su saldo entero como «saldo que ya le
// debían» y, en la vista bruta, dentro de «Total prestado».
//
// La marca es `interesFinanciado`: la escribe SOLO la ruta de renovar al
// financiar (0 si fue sin interés). Null = no es una financiación.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { esFinanciacion, vistaFinanciar } from '@/lib/financiar'

const src = (f) => readFileSync(resolve(process.cwd(), f), 'utf8')
const caja = src('app/api/caja/cobrador/[id]/route.js')

describe('la marca', () => {
  it('null no es financiación; un interés —también cero— sí', () => {
    expect(esFinanciacion({ interesFinanciado: null })).toBe(false)
    expect(esFinanciacion({})).toBe(false)
    expect(esFinanciacion(null)).toBe(false)
    // Financiar sin cobrar interés sigue siendo financiar: el cero es un dato.
    expect(esFinanciacion({ interesFinanciado: 0 })).toBe(true)
    expect(esFinanciacion({ interesFinanciado: 400000 })).toBe(true)
  })

  it('la escribe la ruta de renovar, solo al financiar, con lo que de verdad subió la deuda', () => {
    expect(src('app/api/prestamos/[id]/renovar/route.js'))
      .toMatch(/\.\.\.\(financiar \? \{ interesFinanciado: Math\.max\(0, Math\.round\(totalAPagar - montoFinal\)\) \} : \{\}\)/)
  })

  it('está en el esquema', () => {
    expect(src('prisma/schema.prisma')).toMatch(/^\s+interesFinanciado Float\?$/m)
  })
})

describe('la caja del administrador no lo cuenta como prestado', () => {
  it('ni como préstamo nuevo ni como renovación', () => {
    expect(caja).toMatch(/const itemsNuevos = desembolsos\.filter\(\(d\) => !d\.esRenovacion && !d\.esFinanciacion\)/)
    expect(caja).toMatch(/const itemsRenov {2}= desembolsos\.filter\(\(d\) => d\.esRenovacion && !d\.esFinanciacion\)/)
  })

  it('su saldo no entra al absorbido ni a la vista bruta', () => {
    expect(caja).toMatch(/const renovacionesPrestadas = renovacionesDia\.filter\(\(r\) => !esFinanciacion\(r\)\)/)
    // El absorbido y el reparto por ruta de la vista bruta recorren SOLO esas.
    expect(caja).toMatch(/for \(const r of renovacionesPrestadas\) \{\n\s+renovadoValorTotal \+=/)
    expect(caja).toMatch(/if \(brutoRenovaciones && renovacionesPrestadas\.length > 0\)/)
  })

  it('ni en el conteo por ruta', () => {
    expect(caja).toMatch(/if \(esFinanciacion\(p\)\) b\.financiados \+= 1\n\s+else if \(p\.renovadoDeId\) b\.renovaciones \+= 1/)
  })

  it('las consultas piden la marca (sin ella todo parece renovación, en silencio)', () => {
    expect((caja.match(/interesFinanciado: true/g) ?? []).length).toBeGreaterThanOrEqual(4)
  })
})

describe('y lo enseña aparte, como los recargos', () => {
  it('una línea «Saldos financiados» con el INTERÉS del día, después de recargos', () => {
    const linea = /\{ id: 'financiados', rotulo: 'Saldos financiados', uno: 'Saldo financiado', cantidad: itemsFinanciados\.length, monto: sum\(itemsFinanciados, 'interesFinanciado'\), nota: 'de interés por financiar' \}/
    expect(caja).toMatch(linea)
    expect(caja.search(linea)).toBeGreaterThan(caja.indexOf("{ id: 'recargos'"))
  })

  it('con su explicación en el «?» y su lista al tocarla', () => {
    expect(src('lib/dinero/definiciones.js')).toMatch(/\n {2}financiados: \{\n {4}rotulo: 'Saldos financiados',/)
    const proc = src('app/api/caja/procedencia/route.js')
    expect(proc).toMatch(/\.\.\.\(soloFinanciados \? \{ NOT: \{ interesFinanciado: null \} \} : \{\}\)/)
    // Y la lista de renovaciones ya no la trae.
    expect(proc).toMatch(/\.\.\.\(soloRenovaciones \? \{ NOT: \{ renovadoDeId: null \}, interesFinanciado: null \} : \{\}\)/)
  })

  it('la pantalla pinta la nota que dice que la cifra es el interés', () => {
    expect(src('components/caja/CajaCobradorDetalle.jsx')).toMatch(/\{h\.nota && !enCero\(h\) && \(/)
  })
})

describe('donde sale en una lista, dice lo que fue', () => {
  it('la caja del cobrador: «financió el saldo», no «renovación»', () => {
    expect(src('lib/dinero/desembolsado.js')).toMatch(/esFinanciacion: esFinanciacion\(p\),/)
    expect(src('app/(dashboard)/caja/page.jsx')).toMatch(/\? `financió el saldo · \$\{formatMoney\(d\.montoPrestado\)\}`/)
  })

  it('la ruta: «Saldo financiado»', () => {
    expect(src('app/api/rutas/[id]/route.js')).toMatch(/tipo: esFinanciacion\(p\) \? 'financiacion' : p\.renovadoDeId \? 'renovacion' : 'prestamo_nuevo',/)
  })

  it('«abonó y financió X después», no «renovó»', () => {
    expect(caja).toMatch(/financio: financiadas\.has\(p\.prestamoId\),/)
    expect(src('components/caja/CajaCobradorDetalle.jsx')).toMatch(/cuantoDespues\(a\.minutos, a\.financio \? 'financió' : 'renovó'\)/)
  })
})

describe('⚠ el interés que se pacta es el que se cobra, en CUALQUIER plazo', () => {
  /* En `fijo` la tasa es MENSUAL. La tasa se sacaba como interés ÷ deuda —la
     «tasa del plazo entero»— y a más de un mes el interés se multiplicaba. El
     caso real, 21 sep 2026: $1.227.400 a 8 semanas con $184.110 de interés
     quedó con $368.600. */
  const CASOS = [
    [1227400, 184110, 8, 'semanal'],   // el de producción
    [1000000, 200000, 60, 'diario'],
    [1000000, 200000, 4, 'quincenal'],
    [1000000, 200000, 3, 'mensual'],
    [1000000, 200000, 5, 'semanal'],
    [1181600, 120000, 30, 'diario'],   // a un mes: igual que antes
  ]
  for (const [deuda, interes, periodos, frecuencia] of CASOS) {
    it(`${periodos} cuotas ${frecuencia}: la deuda sube el interés pactado (más el redondeo de la cuota)`, () => {
      const v = vistaFinanciar({ deuda, interes, periodos, frecuencia, fechaInicio: '2026-09-22' })
      const subio = v.total - deuda
      expect(subio).toBeGreaterThanOrEqual(interes)
      // La cuota se redondea a la centena hacia arriba: como mucho $100 por cuota.
      expect(subio).toBeLessThanOrEqual(interes + 100 * periodos)
    })
  }

  it('el servidor reparte la tasa con las mismas cuotas que `calcularPrestamo`', () => {
    const ruta = src('app/api/prestamos/[id]/renovar/route.js')
    expect(ruta).toMatch(/tasaDeFinanciar\(minimoRenovacion, interesFinanciado, \{\n\s+periodos: Math\.ceil\(Number\(diasPlazo\) \/ \(DIAS_POR_PERIODO\[freq\] \?\? 1\)\), frecuencia: freq,/)
    // Y al financiar no hereda el día de corte: la fecha final es la de la hoja.
    expect(ruta).toMatch(/const mismaFrecuencia = freq === original\.frecuencia && !financiar/)
  })
})
