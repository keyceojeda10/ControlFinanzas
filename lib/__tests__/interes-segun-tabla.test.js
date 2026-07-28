// El interes reconocido en un prestamo CON tabla de amortizacion.
//
// Reporte del cliente (28 jul 2026): la tabla decia $7.742 de interes en el mes
// 1 y analiticas registraba $6.896 sobre un pago de $100.000 — $846 menos.
// Analiticas repartia el interes proporcionalmente sobre cada peso cobrado, que
// es correcto sin tabla pero falso con ella: en un prestamo lineal el interes
// del primer periodo se calcula sobre el saldo completo.
//
// Medido sobre los 295 prestamos activos con tabla en produccion, el metodo
// proporcional subestimaba la ganancia en $7.690.180 (27,3%).

import { describe, it, expect } from 'vitest'
import {
  interesAcumuladoTabla,
  interesDelPagoSegunTabla,
  desglosarPago,
} from '@/lib/calculos'

// La tabla exacta de la captura del cliente.
const TABLA = [
  { numeroPeriodo: 1, cuotaTotal: 72300, interes: 7742 },
  { numeroPeriodo: 2, cuotaTotal: 72300, interes: 5806 },
  { numeroPeriodo: 3, cuotaTotal: 72300, interes: 3811 },
  { numeroPeriodo: 4, cuotaTotal: 60295, interes: 1756 },
]
const TOTAL_A_PAGAR = TABLA.reduce((s, f) => s + f.cuotaTotal, 0)   // 277.195
const INTERES_TOTAL = TABLA.reduce((s, f) => s + f.interes, 0)      //  19.115
const MONTO_PRESTADO = TOTAL_A_PAGAR - INTERES_TOTAL                // 258.080

describe('interes segun la tabla — el caso reportado', () => {
  it('un pago de $100.000 reconoce los $7.742 del mes 1, no $6.896', () => {
    const interes = interesDelPagoSegunTabla(TABLA, 0, 100000)
    // cubre la cuota 1 completa (72.300 -> interes 7.742) y le quedan 27.700
    // para la cuota 2, que alcanzan de sobra para su interes de 5.806
    expect(interes).toBe(7742 + 5806)
    expect(interes).toBeGreaterThan(7742)
  })

  it('reproduce el $6.896 del metodo viejo, para dejar constancia del defecto', () => {
    const { interes } = desglosarPago({
      montoPagado: 100000, totalAPagar: TOTAL_A_PAGAR, montoPrestado: MONTO_PRESTADO,
    })
    expect(interes).toBe(6896)
    // y la diferencia de $846 que reporto el cliente, contra el interes del mes 1
    expect(7742 - interes).toBe(846)
  })

  it('pagar exactamente la cuota 1 reconoce exactamente su interes', () => {
    expect(interesDelPagoSegunTabla(TABLA, 0, 72300)).toBe(7742)
  })

  it('un pago parcial menor al interes del periodo no inventa capital', () => {
    expect(interesDelPagoSegunTabla(TABLA, 0, 5000)).toBe(5000)
    expect(interesDelPagoSegunTabla(TABLA, 0, 7742)).toBe(7742)
    // pasado el interes, lo demas ya es capital
    expect(interesDelPagoSegunTabla(TABLA, 0, 10000)).toBe(7742)
  })
})

describe('invariantes', () => {
  it('pagar el prestamo entero reconoce TODO el interes, ni mas ni menos', () => {
    expect(interesAcumuladoTabla(TABLA, TOTAL_A_PAGAR)).toBe(INTERES_TOTAL)
  })

  it('pagar de mas no inventa ganancia', () => {
    expect(interesAcumuladoTabla(TABLA, TOTAL_A_PAGAR * 3)).toBe(INTERES_TOTAL)
  })

  it('la suma de los pagos uno por uno da lo mismo que el acumulado', () => {
    // esta es la propiedad que hace que el desglose mensual cuadre con el total
    const pagos = [30000, 45000, 100000, 12000, 60000, 30195]
    let acumulado = 0, sumaPorPago = 0
    for (const monto of pagos) {
      sumaPorPago += interesDelPagoSegunTabla(TABLA, acumulado, monto)
      acumulado += monto
    }
    expect(acumulado).toBe(TOTAL_A_PAGAR)
    expect(sumaPorPago).toBe(interesAcumuladoTabla(TABLA, TOTAL_A_PAGAR))
    expect(sumaPorPago).toBe(INTERES_TOTAL)
  })

  it('es monotono: pagar mas nunca reconoce menos interes', () => {
    let previo = 0
    for (let t = 0; t <= TOTAL_A_PAGAR; t += 5000) {
      const actual = interesAcumuladoTabla(TABLA, t)
      expect(actual).toBeGreaterThanOrEqual(previo)
      previo = actual
    }
  })

  it('el interes se reconoce ANTES que el capital, no despues', () => {
    // A mitad del prestamo, la tabla ya reconocio mas de la mitad del interes:
    // esa es justamente la diferencia con el reparto plano.
    const mitad = TOTAL_A_PAGAR / 2
    const porTabla = interesAcumuladoTabla(TABLA, mitad)
    const proporcional = desglosarPago({
      montoPagado: mitad, totalAPagar: TOTAL_A_PAGAR, montoPrestado: MONTO_PRESTADO,
    }).interes
    expect(porTabla).toBeGreaterThan(proporcional)
  })
})

describe('modo globo (solo_interes): donde el defecto era mayor', () => {
  // 5 periodos de solo interes y el capital entero al final.
  const GLOBO = [
    { numeroPeriodo: 1, cuotaTotal: 100000, interes: 100000 },
    { numeroPeriodo: 2, cuotaTotal: 100000, interes: 100000 },
    { numeroPeriodo: 3, cuotaTotal: 100000, interes: 100000 },
    { numeroPeriodo: 4, cuotaTotal: 100000, interes: 100000 },
    { numeroPeriodo: 5, cuotaTotal: 1100000, interes: 100000 },
  ]
  it('las primeras cuotas son 100% interes', () => {
    expect(interesDelPagoSegunTabla(GLOBO, 0, 100000)).toBe(100000)
    expect(interesAcumuladoTabla(GLOBO, 400000)).toBe(400000)
  })

  it('el proporcional las subestima brutalmente', () => {
    const total = 1500000, prestado = 1000000
    const proporcional = desglosarPago({ montoPagado: 400000, totalAPagar: total, montoPrestado: prestado }).interes
    expect(proporcional).toBe(133333)                    // 1/3 de cada peso
    expect(interesAcumuladoTabla(GLOBO, 400000)).toBe(400000)   // la realidad
  })
})

describe('la guarda que evita borrar cifras', () => {
  // Primera version de este arreglo: las consultas SQL excluian los modos con
  // tabla y el calculo en JS los sumaba aparte. Pero 19 prestamos en produccion
  // estan en un modo con tabla y NO la tienen (17 en modo saldo, 2 lineal), asi
  // que quedaban fuera de los dos caminos. En la simulacion previa al despliegue
  // dos negocios pasaban a ganancia CERO.
  //
  // El diseño final calcula una DIFERENCIA sobre el proporcional, y solo para
  // prestamos que de verdad tienen filas. El peor caso es no corregir nada.
  const RUTAS = [
    'app/api/dashboard/analiticas/route.js',
    'app/api/dashboard/analiticas/reporte-pdf/route.js',
  ]

  for (const ruta of RUTAS) {
    it(`${ruta} solo corrige prestamos que tienen filas`, async () => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const src = fs.readFileSync(path.resolve(__dirname, '..', '..', ruta), 'utf8')

      // trae solo los que tienen tabla
      expect(src).toMatch(/cuotasAmortizacion:\s*\{\s*some:\s*\{\}\s*\}/)
      // y el SQL NO debe filtrar por modo: si lo hiciera, los que no tienen
      // tabla se quedarian sin cifra por ningun lado
      expect(src).not.toMatch(/modoInteres NOT IN/)
    })
  }
})

describe('casos borde', () => {
  it('sin tabla, sin pagos o con basura devuelve 0 en vez de romper', () => {
    expect(interesAcumuladoTabla([], 50000)).toBe(0)
    expect(interesAcumuladoTabla(null, 50000)).toBe(0)
    expect(interesAcumuladoTabla(undefined, 50000)).toBe(0)
    expect(interesAcumuladoTabla(TABLA, 0)).toBe(0)
    expect(interesAcumuladoTabla(TABLA, -100)).toBe(0)
    expect(interesDelPagoSegunTabla(TABLA, 0, 0)).toBe(0)
  })

  it('no depende del orden en que lleguen las filas', () => {
    const revuelta = [...TABLA].reverse()
    expect(interesAcumuladoTabla(revuelta, 100000)).toBe(interesAcumuladoTabla(TABLA, 100000))
  })
})

describe('guarda: prestar a perdida', () => {
  it('un prestamo que devuelve MENOS de lo prestado se detecta', async () => {
    const { prestamoDevuelveMenosDeLoPrestado } = await import('@/lib/calculos')
    // el caso real de produccion: presta $400.000, recibe $40.000
    expect(prestamoDevuelveMenosDeLoPrestado({ totalAPagar: 40000, montoPrestado: 400000 })).toBe(true)
  })

  it('un prestamo sin interes (devuelve lo mismo) NO se bloquea', async () => {
    const { prestamoDevuelveMenosDeLoPrestado } = await import('@/lib/calculos')
    expect(prestamoDevuelveMenosDeLoPrestado({ totalAPagar: 500000, montoPrestado: 500000 })).toBe(false)
    // ni por un peso de redondeo
    expect(prestamoDevuelveMenosDeLoPrestado({ totalAPagar: 499999.5, montoPrestado: 500000 })).toBe(false)
  })

  it('un prestamo normal no se bloquea', async () => {
    const { prestamoDevuelveMenosDeLoPrestado } = await import('@/lib/calculos')
    expect(prestamoDevuelveMenosDeLoPrestado({ totalAPagar: 600000, montoPrestado: 500000 })).toBe(false)
  })

  it('datos vacios o basura no bloquean nada', async () => {
    const { prestamoDevuelveMenosDeLoPrestado } = await import('@/lib/calculos')
    expect(prestamoDevuelveMenosDeLoPrestado({})).toBe(false)
    expect(prestamoDevuelveMenosDeLoPrestado({ totalAPagar: 0, montoPrestado: 500000 })).toBe(false)
    expect(prestamoDevuelveMenosDeLoPrestado({ totalAPagar: 100, montoPrestado: 0 })).toBe(false)
  })

  it('el mensaje explica el caso de la cuota unica, que es el que ocurrio', async () => {
    const { mensajePrestamoConPerdida } = await import('@/lib/calculos')
    const m = mensajePrestamoConPerdida({
      totalAPagar: 40000, montoPrestado: 400000, numPeriodos: 1, frecuencia: 'quincenal',
    })
    expect(m).toContain('$400.000')
    expect(m).toContain('$40.000')
    expect(m).toContain('una sola cuota')
    expect(m).toContain('quincenas')
  })

  it('las tres rutas que crean o editan prestamos tienen la guarda', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    for (const ruta of [
      'app/api/prestamos/route.js',
      'app/api/prestamos/[id]/route.js',
      'app/api/prestamos/[id]/renovar/route.js',
    ]) {
      const src = fs.readFileSync(path.resolve(__dirname, '..', '..', ruta), 'utf8')
      expect(src, `${ruta} deberia usar la guarda`).toMatch(/prestamoDevuelveMenosDeLoPrestado\(/)
    }
  })
})
