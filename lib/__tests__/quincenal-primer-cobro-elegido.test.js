/**
 * «HOY ES 13 DE NOVIEMBRE […] SU PRIMER CUOTA QUEDA PARA EL 30 DE NOVIEMBRE
 *  YA QUE SU PAGO ES QUINCENAL» — un prestamista, 13 nov 2026.
 *
 * Quincenal por días del mes, 15 y 30. Prestado el 13, el calendario ponía la
 * primera cuota el 15, a dos días. Escribió «30» en la casilla que decía
 * «Primer cobro» creyendo que así lo elegía, y el sistema ordena los días.
 * Ahora el formulario pregunta cuál es el primer cobro entre los dos primeros
 * cortes, y el servidor lo valida contra el mismo calendario.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { calcularPrestamo, calcularDiasMora, calcularProximoCobro, fechaDePeriodo } from '@/lib/calculos'
import { tocaCobrarEn } from '@/lib/dinero/esperado'

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const T = (d) => new Date(`${d}T05:00:00.000Z`)
const iso = (f) => new Date(f).toISOString().slice(0, 10)

// Su préstamo: $1.500.000, 6 quincenas de $400.000 (total $2.400.000).
const base = {
  montoPrestado: 1500000, tasaInteres: 20, diasPlazo: 90, fechaInicio: '2026-11-13',
  frecuencia: 'quincenal', modoInteres: 'fijo', diaCobroMes: 15, diaCobroMes2: 30,
}

describe('el primer cobro el 30, no el 15', () => {
  const sin = calcularPrestamo(base)
  const con = calcularPrestamo({ ...base, primerCobro: T('2026-11-30') })

  const cal = (pc) => ({ fechaInicio: T('2026-11-13'), freq: 'quincenal', diasPeriodo: 15, diaCobroMes: 15, diaCobroMes2: 30, ...(pc && { primerCobro: pc }) })
  const seis = (pc) => [1, 2, 3, 4, 5, 6].map((n) => iso(fechaDePeriodo(n, cal(pc))))

  it('sin elegir, como siempre: el 15, a dos días, y termina el 30 ene', () => {
    expect(sin.primerCobro).toBeUndefined()
    expect(seis(null).slice(0, 2)).toEqual(['2026-11-15', '2026-11-30'])
    expect(iso(sin.fechaFin)).toBe('2027-01-30')
  })

  it('eligiendo el 30: 30 nov, 15 dic, 30 dic… seis cuotas, terminando el 15 feb', () => {
    expect(seis(con.primerCobro)).toEqual([
      '2026-11-30', '2026-12-15', '2026-12-30', '2027-01-15', '2027-01-30', '2027-02-15',
    ])
    expect(iso(con.primerCobro)).toBe('2026-11-30')
    expect(iso(con.fechaFin)).toBe('2027-02-15')
  })

  it('⚠ la plata no cambia: la misma cuota y el mismo total', () => {
    expect(con.totalAPagar).toBe(sin.totalAPagar)
    expect(con.cuotaDiaria).toBe(sin.cuotaDiaria)
    expect(con.totalAPagar).toBe(2400000)
    expect(con.cuotaDiaria).toBe(400000)
  })

  it('el 16 de noviembre NO está en mora; el 1 de diciembre sí', () => {
    const prestamo = {
      ...base, fechaInicio: T('2026-11-13'), primerCobro: con.primerCobro, fechaFin: con.fechaFin,
      totalAPagar: con.totalAPagar, cuotaDiaria: con.cuotaDiaria, estado: 'activo',
      pagos: [], devengos: [], cuotasAmortizacion: [],
    }
    expect(calcularDiasMora(prestamo, [], [], new Date('2026-11-16T17:00:00Z').getTime())).toBe(0)
    expect(calcularDiasMora(prestamo, [], [], new Date('2026-12-01T17:00:00Z').getTime())).toBeGreaterThan(0)
    expect(iso(calcularProximoCobro(prestamo, [], [], new Date('2026-11-14T17:00:00Z').getTime()))).toBe('2026-11-30')
  })

  it('⚠ el 15 de noviembre no le sale al cobrador como cuota del día; el 30 sí', () => {
    const prestamo = {
      ...base, fechaInicio: T('2026-11-13'), primerCobro: con.primerCobro,
      totalAPagar: con.totalAPagar, cuotaDiaria: con.cuotaDiaria, estado: 'activo', pagos: [],
    }
    expect(tocaCobrarEn(prestamo, T('2026-11-15'))).toBe(false)
    expect(tocaCobrarEn(prestamo, T('2026-11-30'))).toBe(true)
    expect(tocaCobrarEn(prestamo, T('2026-12-15'))).toBe(true)
    // Sin elegir, el 15 sí: el de siempre no cambia.
    expect(tocaCobrarEn({ ...prestamo, primerCobro: null }, T('2026-11-15'))).toBe(true)
  })
})

describe('el servidor y el formulario', () => {
  const post = leer('app/api/prestamos/route.js')
  const form = leer('app/(dashboard)/prestamos/nuevo/page.jsx')

  it('el servidor solo acepta el primer corte o el siguiente, del mismo calendario', () => {
    expect(post).toMatch(/const \[c1, c2\] = \[1, 2\]\.map\(\(n\) => fechaDePeriodo\(n, args\)\)/)
    expect(post).toMatch(/if \(diaPedido === iso\(c2\)\) primerCobroQuincenaMes = c2/)
    expect(post).toMatch(/\.\.\.\(primerCobroQuincenaMes && \{ primerCobro: primerCobroQuincenaMes \}\),/)
    expect(post.indexOf('let primerCobroQuincenaMes')).toBeLessThan(post.indexOf('const calc = calcularPrestamo({'))
  })

  it('los dos cortes que ofrece el formulario son los del calendario', () => {
    const args = { fechaInicio: T('2026-11-13'), freq: 'quincenal', diasPeriodo: 15, diaCobroMes: 15, diaCobroMes2: 30 }
    expect([1, 2].map((n) => iso(fechaDePeriodo(n, args)))).toEqual(['2026-11-15', '2026-11-30'])
  })

  it('el formulario pregunta, y manda la elegida al guardar y al previsualizar', () => {
    expect(form).toMatch(/¿Cuál es el primer cobro\?/)
    expect(form.match(/\.\.\.\(cortesQuincenaMes\?\.saltado && \{ primerCobro: new Date\(`\$\{cortesQuincenaMes\.elegido\}T05:00:00\.000Z`\) \}\),/g)?.length,
      'la previsualización y el resumen').toBe(2)
    expect(form).toMatch(/\.\.\.\(cortesQuincenaMes\?\.saltado && \{ primerCobro: cortesQuincenaMes\.elegido \}\),/)
  })

  it('las casillas ya no dicen «Primer cobro»: son los dos días del mes', () => {
    expect(form).toMatch(/label="Cobra el día"/)
    expect(form).toMatch(/label="Y el día"/)
    expect(form).not.toMatch(/label="Segundo cobro"/)
  })

  it('⚠ `cortesQuincenaMes` se declara antes de quien lo lee (un const antes de tiempo deja la pantalla en blanco)', () => {
    const decl = form.indexOf('const cortesQuincenaMes = useMemo(')
    expect(form.indexOf('const [primerCobroQuincenaMes, setPrimerCobroQuincenaMes]')).toBeLessThan(decl)
    expect(form.indexOf('const esAbierto =')).toBeLessThan(decl)
    expect(decl).toBeLessThan(form.indexOf('const dosPrimerosCobros = useMemo('))
    expect(decl).toBeLessThan(form.indexOf('const calcularConTasa = useCallback('))
    expect(decl).toBeLessThan(form.indexOf('const cuerpoDelPrestamo = () =>'))
  })
})
