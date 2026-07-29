import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import * as XLSX from 'xlsx'
import { leerExcel } from '@/lib/importar/excel'
import { aCargaMasiva, diasDePlazo, marcadorCedula, esMarcador, tasaMensualEquivalente } from '@/lib/importar/aCargaMasiva'
import { calcularPrestamo } from '@/lib/calculos'

// El importador agrupa POR CÉDULA. El export real no trae ninguna: mandado tal
// cual, las 68 filas caen en el mismo grupo y se crea UN cliente con 68
// préstamos. No falla, no avisa: importa mal y calla. Eso es lo que se prueba.

const ARCHIVO = path.join(process.cwd(), 'CF Diseño 2026', 'Docuemntos para prueba',
  'cred-activos-general-7c08518ae74-2026-07-15-16_15_33.328.xlsx')
const hayArchivo = fs.existsSync(ARCHIVO)

const lecturaReal = () => {
  const wb = XLSX.read(fs.readFileSync(ARCHIVO), { type: 'buffer' })
  return leerExcel(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }))
}

describe('diasDePlazo', () => {
  it('el archivo dice «semanal, 6 cuotas»; el importador quiere 42 días', () => {
    expect(diasDePlazo('semanal', 6)).toBe(42)
    expect(diasDePlazo('mensual', 3)).toBe(90)
    expect(diasDePlazo('quincenal', 4)).toBe(60)
    expect(diasDePlazo('diario', 30)).toBe(30)
  })

  it('sin frecuencia o sin cuotas devuelve null: el préstamo se descarta con nombre', () => {
    expect(diasDePlazo(null, 6)).toBeNull()
    expect(diasDePlazo('semanal', 0)).toBeNull()
    expect(diasDePlazo('semanal', null)).toBeNull()
  })
})

describe('marcadorCedula', () => {
  it('se ve a simple vista que NO es una cédula', () => {
    expect(marcadorCedula(3, 'ab')).toBe('SIN-ab003')
    expect(esMarcador('SIN-ab003')).toBe(true)
    expect(esMarcador('81283812')).toBe(false)
  })
})

describe('tasaMensualEquivalente — el 20% que significa dos cosas', () => {
  it('un préstamo de un mes justo no cambia: ahí plano y mensual coinciden', () => {
    expect(tasaMensualEquivalente(20, 'mensual', 1)).toBe(20)
    expect(tasaMensualEquivalente(20, 'semanal', 4)).toBe(20)
  })

  it('a dos meses, la mensual es la mitad de la plana', () => {
    expect(tasaMensualEquivalente(20, 'semanal', 8)).toBe(10)
    expect(tasaMensualEquivalente(20, 'mensual', 2)).toBe(10)
  })

  it('sin frecuencia o sin cuotas no adivina', () => {
    expect(tasaMensualEquivalente(20, null, 8)).toBeNull()
    expect(tasaMensualEquivalente(20, 'semanal', 0)).toBeNull()
  })
})

// LA PRUEBA QUE IMPORTA: no comprueba mi fórmula contra mi aritmética, sino
// contra calcularPrestamo, que es quien de verdad escribe la deuda en la tabla.
// La primera importación real metió $73.138.900 de más porque nadie las comparó.
describe('la deuda que sale de calcularPrestamo es la del archivo', () => {
  const casos = [
    { nombre: 'semanal 8 cobros (~2 meses)', capital: 2000000, frecuencia: 'semanal', nCuotas: 8 },
    { nombre: 'semanal 6 cobros',            capital: 1000000, frecuencia: 'semanal', nCuotas: 6 },
    { nombre: 'mensual 3 cuotas',            capital: 3000000, frecuencia: 'mensual', nCuotas: 3 },
    { nombre: 'quincenal 4 cuotas',          capital: 1500000, frecuencia: 'quincenal', nCuotas: 4 },
    { nombre: 'semanal 12 cobros (3 meses)', capital: 1500000, frecuencia: 'semanal', nCuotas: 12 },
  ]

  for (const c of casos) {
    it(c.nombre, () => {
      const { filas } = aCargaMasiva(
        [{ nombre: 'X', capital: c.capital, interes: 20, frecuencia: c.frecuencia, nCuotas: c.nCuotas }],
        { hoy: '2026-07-29' },
      )
      const p = filas[0]
      const r = calcularPrestamo({
        montoPrestado: p.montoPrestado,
        tasaInteres: p.tasaInteres,
        diasPlazo: p.diasPlazo,
        fechaInicio: p.fechaInicio,
        frecuencia: p.frecuencia,
        modoInteres: 'fijo',
      })
      // El archivo dice capital × 1,20. Eso es lo que tiene que quedar guardado.
      expect(r.totalAPagar).toBe(Math.round(c.capital * 1.20))
    })
  }
})

describe('aCargaMasiva', () => {
  const base = { nombre: 'Ana', capital: 1_000_000, interes: 20, frecuencia: 'semanal', nCuotas: 6 }

  it('cada fila sin cédula lleva un marcador DISTINTO', () => {
    const { filas } = aCargaMasiva([base, { ...base, nombre: 'Beto' }], { semilla: 'x' })
    expect(filas[0].cedula).not.toBe(filas[1].cedula)
    expect(new Set(filas.map((f) => f.cedula)).size).toBe(2)
  })

  it('si el archivo SÍ trae cédula, se respeta', () => {
    const { filas } = aCargaMasiva([{ ...base, cedula: '81283812' }])
    expect(filas[0].cedula).toBe('81283812')
  })

  it('lo que no se puede importar se dice con el nombre delante, no en silencio', () => {
    const { filas, descartadas } = aCargaMasiva([base, { ...base, nombre: 'Sin monto', capital: 0 }])
    expect(filas).toHaveLength(1)
    expect(descartadas).toEqual([{ nombre: 'Sin monto', motivo: 'sin monto' }])
  })

  it('sin fecha en el archivo usa la de hoy, no la deja vacía', () => {
    const { filas } = aCargaMasiva([base], { hoy: '2026-07-29' })
    expect(filas[0].fechaInicio).toBe('2026-07-29')
  })
})

describe.skipIf(!hayArchivo)('contra el archivo real de 68 créditos', () => {
  it('salen 68 claves distintas, no una', () => {
    const { filas } = aCargaMasiva(lecturaReal().filas, { semilla: 'r', hoy: '2026-07-29' })
    expect(filas).toHaveLength(68)
    expect(new Set(filas.map((f) => f.cedula)).size).toBe(68)
  })

  it('ninguna se queda sin plazo: las tres frecuencias del archivo se traducen', () => {
    const { descartadas } = aCargaMasiva(lecturaReal().filas, { hoy: '2026-07-29' })
    expect(descartadas.filter((d) => d.motivo === 'sin plazo')).toHaveLength(0)
  })

  it('los montos van ya en pesos, no en miles', () => {
    const { filas } = aCargaMasiva(lecturaReal().filas, { hoy: '2026-07-29' })
    const total = filas.reduce((s, f) => s + f.montoPrestado, 0)
    expect(total).toBeGreaterThan(50_000_000)
  })
})
