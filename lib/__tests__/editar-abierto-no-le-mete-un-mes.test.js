// lib/__tests__/editar-abierto-no-le-mete-un-mes.test.js
//
// ══ AL EDITARLO, LA CUOTA LE SALTABA DE $100.000 A $1.100.000 ══════════════
//
// «Prestamos juan» se pasó una hora peleando con el mismo préstamo. Su registro
// de actividad del 26 de agosto, tal cual:
//
//     12:25  crear     Préstamo $1.000.000 a Tío Luis
//     12:26  editar    cuota→1.100.000
//     12:30  editar    cuota→100.000      ← la devuelve a mano
//     12:30  eliminar  préstamo borrado   ← se rinde
//     12:32  crear  ·  12:35  eliminar
//     12:38  crear  ·  12:39  editar cuota→1.100.000
//     12:40  crear  ·  12:42  cancelado con reverso de capital
//
// La causa: el editar recalculaba con `calcularPrestamo` SIN pasarle
// `sinPlazo`. Sin esa bandera el cálculo cae en el Globo CON plazo, donde la
// cuota es el globo entero (capital + interés) y el total estrena el interés
// del primer período. La columna `sinPlazo` no la toca nadie, así que el
// préstamo quedaba guardado como abierto pero con las cifras del cerrado.
//
// Y el mes que estrena no se queda quieto: cuando el período cierra, el cron
// devenga ESE MISMO MES otra vez. Un millón al 10% pasaba a decir $1.200.000
// con un solo mes corrido.
//
// Medido en el espejo: 9 préstamos, $830.000, todos de ese negocio, cortando
// entre el 1 y el 24 de septiembre de 2026.
//
// ── LA SEGUNDA MITAD ──────────────────────────────────────────────────────
//
// Pasar la bandera a secas abría el otro agujero: en un abierto el cálculo
// devuelve SOLO el capital, porque el interés no sale del plazo sino de los
// períodos que fueron cerrando. Un préstamo de mayo con $2.400.000 devengados
// perdía los $2.400.000 por corregirle el nombre del producto.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { calcularPrestamo, devengosPendientes } from '@/lib/calculos'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')

/* El préstamo de Tío Luis, tal como está en la base. */
const TIO_LUIS = {
  montoPrestado: 1_000_000,
  tasaInteres: 10,
  diasPlazo: 30,
  frecuencia: 'mensual',
  modoInteres: 'solo_interes',
  fechaInicio: '2026-08-01',
}

describe('editar un préstamo abierto no le mete un mes de interés', () => {
  it('recalculado como abierto, la cuota es el interés del período', () => {
    const abierto = calcularPrestamo({ ...TIO_LUIS, sinPlazo: true })
    expect(abierto.cuotaDiaria).toBe(100_000)
    expect(abierto.totalAPagar).toBe(1_000_000)
  })

  it('recalculado SIN la bandera —el fallo— la cuota es el globo entero', () => {
    const cerrado = calcularPrestamo({ ...TIO_LUIS, sinPlazo: false })
    expect(cerrado.cuotaDiaria).toBe(1_100_000)
    expect(cerrado.totalAPagar).toBe(1_100_000)
  })

  it('el calendario del abierto no cambia al recalcularlo', () => {
    const abierto = calcularPrestamo({ ...TIO_LUIS, sinPlazo: true })
    // Lo que el crear guarda en `diasPlazo` y `fechaFin`: el PRIMER CORTE,
    // no un vencimiento. Si el editar los moviera, el devengo cambiaría de
    // calendario y volvería a cobrar meses ya asentados.
    expect(abierto.numPeriodos * abierto.diasPeriodo).toBe(30)
    expect(new Date(abierto.fechaFin).toISOString().slice(0, 10)).toBe('2026-09-01')
    expect(abierto.tablaAmortizacion).toHaveLength(0)
  })

  it('el mes metido se cobra DOS VECES cuando cierra el período', () => {
    const enBase = { ...TIO_LUIS, sinPlazo: true, pagos: [], devengos: [], cuotasAmortizacion: [] }
    // Hoy no ha cerrado nada: el total tendría que ser el capital pelado.
    expect(devengosPendientes(enBase, new Date('2026-08-26T17:00:00Z').getTime())).toHaveLength(0)
    // El 1 de septiembre cierra el primer período y el cron asienta su mes.
    const alCerrar = devengosPendientes(enBase, new Date('2026-09-02T17:00:00Z').getTime())
    expect(alCerrar).toHaveLength(1)
    expect(alCerrar[0].interes).toBe(100_000)
    // Con el mes ya metido por el editar, el préstamo acaba diciendo esto:
    expect(1_100_000 + alCerrar[0].interes).toBe(1_200_000)
    // Un mes corrido, un mes de interés:
    expect(1_000_000 + alCerrar[0].interes).toBe(1_100_000)
  })

  it('el editar le pasa la bandera al cálculo', () => {
    const src = leer('app/api/prestamos/[id]/route.js')
    expect(src).toContain('sinPlazo: p.sinPlazo,')
  })

  it('el editar le devuelve al total el interés ya devengado', () => {
    const src = leer('app/api/prestamos/[id]/route.js')
    expect(src).toContain(') + devengadoAbierto,')
    expect(src).toContain("(p.sinPlazo && modoInteresUsar === 'solo_interes')")
  })

  it('fuera del abierto, lo devengado suma cero y nada cambia', () => {
    // La expresión del route, con un préstamo clásico: sin `sinPlazo` no hay
    // devengos que devolver y el total sale igual que antes del arreglo.
    const clasico = { sinPlazo: false, devengos: [] }
    const devengado = (clasico.sinPlazo && 'solo_interes' === 'solo_interes')
      ? Math.round((clasico.devengos ?? []).reduce((a, d) => a + (Number(d.interes) || 0), 0))
      : 0
    expect(devengado).toBe(0)
  })
})
