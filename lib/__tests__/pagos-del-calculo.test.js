/* EL SELECT QUE DEJABA CIEGAS A LAS FUNCIONES DE PLATA — 20 sep 2026.
 *
 * Tres fallos de la misma familia, medidos en el espejo desglosando casos al peso:
 *   1. Cinco pantallas pedían `pagos: { where: { tipo: 'capital' } }`. Las funciones
 *      leen además 'intereses' y, en los abiertos, 'completo'.
 *   2. Cuatro de ellas no pedían `sinPlazo`: el abierto no se reconocía como tal.
 *   3. `SELECT_PARA_INTERES` y las tres consultas de la corrección no pedían
 *      `sinPlazo` ni `devengos`: la rama del abierto de `interesPagoAPago` no
 *      corrió nunca con datos de verdad.
 * Las funciones estaban bien. Lo que fallaba era lo que se les daba de comer. */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { PAGOS_DEL_CALCULO, loLeeElCalculo } from '@/lib/dinero/pagos-del-calculo'
import { SELECT_PARA_INTERES, interesCobradoDelPrestamo } from '@/lib/dinero/interes-cobrado'
import { capitalEnCalle } from '@/lib/dinero/reparto'
import { calcularCapitalRestante, interesesSinPagar } from '@/lib/calculos'

const leer = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8')

const LAS_CINCO = [
  'app/api/dashboard/resumen/route.js',
  'app/api/capital/resumen/route.js',
  'app/api/dashboard/analiticas/route.js',
  'app/api/dashboard/analiticas/reporte-pdf/route.js',
  'app/api/socios/route.js',
]
const LAS_TRES_CORRECCIONES = [
  'app/api/dashboard/analiticas/route.js',
  'app/api/dashboard/analiticas/reporte-pdf/route.js',
  'app/api/socios/repartir/route.js',
]

// Lo que devolvía el `select` viejo y lo que devuelve el nuevo, sobre la misma lista.
const comoAntes = (p) => ({ ...p, pagos: p.pagos.filter((g) => g.tipo === 'capital') })
const comoAhora = (p) => ({ ...p, pagos: p.pagos.filter((g) => loLeeElCalculo(g, p)) })

describe('el caso medido: solo le han pagado interés, el capital sigue entero', () => {
  // Prestó $500.000 y lo único que ha entrado son $200.000 declarados «solo interés».
  const p = {
    // Un cobro de solo interés SUBE `totalAPagar` en lo cobrado: 650.000 pactados + 200.000.
    montoPrestado: 500_000, totalAPagar: 850_000, totalPagado: 200_000, abonadoCapital: 0,
    modoInteres: 'fijo', sinPlazo: false, devengos: [], cuotasAmortizacion: [],
    pagos: [{ tipo: 'intereses', montoPagado: 200_000 }],
  }
  it('con solo los abonos a capital, el capital en la calle BAJABA sin que nadie lo devolviera', () => {
    expect(capitalEnCalle(comoAntes(p))).toBeLessThan(500_000)
    expect(calcularCapitalRestante(comoAntes(p))).toBeLessThan(500_000)
  })
  it('con los pagos que la función lee, sigue entero', () => {
    expect(capitalEnCalle(comoAhora(p))).toBe(500_000)
    expect(calcularCapitalRestante(comoAhora(p))).toBe(500_000)
  })
})

describe('el abierto que paga su interés puntual', () => {
  // $4.000.000 abiertos, 7 meses devengados a $400.000, pagados los $2.800.000.
  const devengos = Array.from({ length: 7 }, (_, i) => ({ periodo: `2026-0${i + 2}`, interes: 400_000 }))
  const abierto = {
    montoPrestado: 4_000_000, totalAPagar: 6_800_000, totalPagado: 2_800_000, abonadoCapital: 0,
    modoInteres: 'solo_interes', sinPlazo: true, devengos, cuotasAmortizacion: [],
    pagos: Array.from({ length: 7 }, (_, i) => ({ tipo: 'completo', montoPagado: 400_000, fechaPago: new Date(Date.UTC(2026, i + 1, 5)) })),
  }

  it('el Inicio lo tenía con SIETE meses sin pagar (salía con 210 días de mora)', () => {
    expect(interesesSinPagar(comoAntes(abierto))).toHaveLength(7)
  })
  it('y no debe ninguno', () => {
    expect(interesesSinPagar(comoAhora(abierto))).toHaveLength(0)
  })
  it('sin `sinPlazo` en el select, Capital daba por devuelta plata que sigue en la calle', () => {
    const { sinPlazo: _no, ...ciego } = comoAntes(abierto)
    expect(capitalEnCalle(ciego)).toBeLessThan(4_000_000)
    expect(capitalEnCalle(comoAhora(abierto))).toBe(4_000_000)
  })
  it('y su interés cobrado son los $2.800.000, no $1.152.941', () => {
    const { sinPlazo: _a, devengos: _b, ...ciego } = abierto
    expect(Math.round(interesCobradoDelPrestamo({ prestamo: ciego, cuotas: [], pagos: abierto.pagos }))).toBe(1_152_941)
    expect(Math.round(interesCobradoDelPrestamo({ prestamo: abierto, cuotas: [], pagos: abierto.pagos }))).toBe(2_800_000)
  })
})

describe('la regla, en un solo sitio', () => {
  it('declarados de todos; corrientes solo de los abiertos', () => {
    expect(PAGOS_DEL_CALCULO.where.OR).toEqual([
      { tipo: { in: ['capital', 'intereses'] } },
      { tipo: 'completo', prestamo: { sinPlazo: true } },
    ])
    expect(PAGOS_DEL_CALCULO.select).toMatchObject({ tipo: true, montoPagado: true })
  })
  it('y el filtro en memoria dice lo mismo que el de Prisma', () => {
    expect(loLeeElCalculo({ tipo: 'capital' }, {})).toBe(true)
    expect(loLeeElCalculo({ tipo: 'intereses' }, {})).toBe(true)
    expect(loLeeElCalculo({ tipo: 'completo' }, { sinPlazo: false })).toBe(false)
    expect(loLeeElCalculo({ tipo: 'completo' }, { sinPlazo: true })).toBe(true)
    expect(loLeeElCalculo({ tipo: 'recargo' }, { sinPlazo: true })).toBe(false)
  })
})

describe('el hilo: las pantallas piden lo que sus funciones leen', () => {
  it('ninguna de las cinco vuelve a pedir «solo los abonos a capital»', () => {
    for (const f of LAS_CINCO) {
      const src = leer(f)
      expect(src, f).not.toMatch(/pagos:\s*\{\s*where:\s*\{\s*tipo:\s*'capital'\s*\}/)
      expect(src, f).toContain('pagos: PAGOS_DEL_CALCULO,')
    }
  })
  it('y las cinco piden `sinPlazo` en ese mismo select', () => {
    for (const f of LAS_CINCO) {
      const src = leer(f)
      const i = src.indexOf('pagos: PAGOS_DEL_CALCULO,')
      expect(src.slice(Math.max(0, i - 2600), i), f).toContain('sinPlazo: true,')
    }
  })
  it('el select del interés trae lo que lee la rama del abierto', () => {
    expect(SELECT_PARA_INTERES.sinPlazo).toBe(true)
    expect(SELECT_PARA_INTERES.devengos).toEqual({ select: { periodo: true, interes: true } })
  })
  it('las tres correcciones meten a los abiertos, y los devengos van en el SELECT, no en el where', () => {
    for (const f of LAS_TRES_CORRECCIONES) {
      const src = leer(f)
      const iOr = src.indexOf("{ sinPlazo: true, modoInteres: 'solo_interes' },")
      expect(iOr, f).toBeGreaterThan(-1)
      const iSelect = src.indexOf('select: {', iOr)
      const iDevengos = src.indexOf('devengos: { select: { periodo: true, interes: true } },', iOr)
      expect(iSelect, f).toBeGreaterThan(iOr)
      expect(iDevengos, f).toBeGreaterThan(iSelect)
    }
  })
  it('devengar.js sigue pidiendo solo el abono a capital: ahí sí es lo único que manda', () => {
    expect(leer('lib/dinero/devengar.js')).toMatch(/pagos:\s*\{\s*where:\s*\{\s*tipo:\s*'capital'\s*\}/)
  })
})
