import { describe, it, expect } from 'vitest'
import { calcularPrestamo } from '@/lib/calculos'

// GUARDIA: el calendario de cobro y el DINERO son cosas separadas.
//
// El arreglo de fechas mensuales cambia CUANDO se cobra. Si ademas cambiara
// CUANTO se cobra, seria un desastre silencioso: 2.941 prestamos vivos con otro
// total a pagar. Estos tests fijan que el dinero no depende de la fecha de
// inicio — solo de monto, tasa, plazo, frecuencia y modo.
//
// Ver tambien PERIODOS_POR_MES en calculos.js: la convencion del negocio
// (semanal = 4 semanas por mes) manda sobre el calendario real, y ya rompio
// cuentas de dos clientes una vez. El interes NO se prorratea por dias.

const MODOS = ['fijo', 'unico', 'lineal', 'lineal_dinamico', 'solo_interes', 'saldo']
const FRECUENCIAS = ['diario', 'semanal', 'quincenal', 'mensual']

// Mismo prestamo empezado en dias distintos del mes, y con la fecha entrando
// como string del formulario o como Date de la base.
const FECHAS = [
  '2026-01-01', '2026-01-15', '2026-01-31',
  '2026-02-28', '2026-07-05', '2026-11-30',
  new Date('2026-07-05T05:00:00.000Z'),
]

describe('la fecha de inicio no mueve el dinero', () => {
  for (const modo of MODOS) {
    for (const freq of FRECUENCIAS) {
      it(`${modo} / ${freq}: total, cuota e interes identicos empiece cuando empiece`, () => {
        const referencia = calcularPrestamo({
          montoPrestado: 10000000, tasaInteres: 6, diasPlazo: 180,
          fechaInicio: FECHAS[0], frecuencia: freq, modoInteres: modo,
        })

        for (const fecha of FECHAS.slice(1)) {
          const otro = calcularPrestamo({
            montoPrestado: 10000000, tasaInteres: 6, diasPlazo: 180,
            fechaInicio: fecha, frecuencia: freq, modoInteres: modo,
          })
          const etiqueta = `${modo}/${freq} con inicio ${fecha}`
          expect(otro.totalAPagar, `totalAPagar ${etiqueta}`).toBe(referencia.totalAPagar)
          expect(otro.cuotaDiaria, `cuota ${etiqueta}`).toBe(referencia.cuotaDiaria)
          expect(otro.totalInteres, `interes ${etiqueta}`).toBe(referencia.totalInteres)
          expect(otro.numPeriodos, `numPeriodos ${etiqueta}`).toBe(referencia.numPeriodos)

          // Los montos de cada cuota tambien deben ser iguales; lo unico que
          // cambia entre fechas de inicio es la fechaEsperada de cada fila.
          if (referencia.tablaAmortizacion) {
            expect(
              otro.tablaAmortizacion.map((f) => [f.capital, f.interes, f.cuotaTotal]),
              `tabla ${etiqueta}`,
            ).toEqual(
              referencia.tablaAmortizacion.map((f) => [f.capital, f.interes, f.cuotaTotal]),
            )
          }
        }
      })
    }
  }

  it('el caso reportado da los mismos numeros que muestra la app hoy', () => {
    // Captura del cliente: $10.000.000 al 6% mensual, 6 meses, Globo.
    // Cuota mensual $600.000, total a pagar $13.600.000.
    const r = calcularPrestamo({
      montoPrestado: 10000000, tasaInteres: 6, diasPlazo: 180,
      fechaInicio: '2026-07-05', frecuencia: 'mensual', modoInteres: 'solo_interes',
    })
    expect(r.cuotaDiaria).toBe(600000)
    expect(r.totalAPagar).toBe(13600000)
    // 5 cuotas de solo interes + una final con capital + interes
    expect(r.tablaAmortizacion.map((f) => f.cuotaTotal)).toEqual([
      600000, 600000, 600000, 600000, 600000, 10600000,
    ])
  })
})

describe('la fecha de vencimiento coincide con la ultima cuota', () => {
  // Si fechaFin y la ultima fila de la tabla no coinciden, la ficha del prestamo
  // muestra un "Vencimiento" que contradice al propio calendario de cobro.
  const enBogota = (d) => d.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota', day: 'numeric', month: 'numeric', year: 'numeric',
  })

  for (const freq of FRECUENCIAS) {
    it(`${freq}: fechaFin == fechaEsperada de la ultima cuota`, () => {
      const r = calcularPrestamo({
        montoPrestado: 10000000, tasaInteres: 6, diasPlazo: 180,
        fechaInicio: '2026-07-05', frecuencia: freq, modoInteres: 'lineal',
      })
      const ultima = r.tablaAmortizacion[r.tablaAmortizacion.length - 1]
      expect(enBogota(r.fechaFin)).toBe(enBogota(ultima.fechaEsperada))
    })
  }
})
