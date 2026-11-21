// 21 nov 2026: cobrar mora sin haberla configurado, de las dos formas.
// El caso de la captura del cliente: quincenal, $145.000 × 6 cuotas, prestó
// $600.000, venció el 20 sep; a 21 nov lleva 62 días y le falta $170.000.
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import { calcularInteresMoratorio } from '@/lib/calculos'
import { montoMoratorioCon, periodosDeMas, periodosYaCobrados, notaPeriodos, tasaMensualPactada } from '@/lib/dinero/mora-a-mano'

const HOY = new Date('2026-11-21T17:00:00Z')
const base = (extra = {}) => ({
  id: 'p1', estado: 'activo', frecuencia: 'quincenal', modoInteres: 'fijo',
  montoPrestado: 600000, cuotaDiaria: 145000, totalAPagar: 870000, diasPlazo: 90, tasaInteres: 15,
  fechaInicio: new Date('2026-06-22T17:00:00Z'), fechaFin: new Date('2026-09-20T17:00:00Z'),
  pagos: [{ tipo: 'completo', montoPagado: 700000, fechaPago: new Date('2026-09-01T17:00:00Z'), nota: null }],
  ...extra,
})

describe('opción 2: cada quincena de más cobra otra quincena de interés', () => {
  it('el caso del cliente: 4 quincenas cumplidas a $45.000', () => {
    const r = periodosDeMas(base(), { ahora: HOY })
    expect(r.disponible).toBe(true)
    expect(r.diasDesdeFin).toBe(62)
    expect(r.cumplidos).toBe(4)
    expect(r.interesPorPeriodo).toBe(45000) // (145.000 × 6 − 600.000) ÷ 6
    expect(r.porCobrar).toBe(4)
    expect(r.nombre).toEqual(['quincena', 'quincenas'])
  })
  it('el interés es el PACTADO: un recargo anterior no lo encarece', () => {
    const r = periodosDeMas(base({ totalAPagar: 870000 + 90000 }), { ahora: HOY })
    expect(r.interesPorPeriodo).toBe(45000)
  })
  it('lo ya cobrado se descuenta, leyendo la nota', () => {
    const pagos = [...base().pagos, { tipo: 'recargo', montoPagado: 90000, fechaPago: new Date('2026-10-21T17:00:00Z'), nota: notaPeriodos(2, 'quincenal', new Date('2026-09-20T17:00:00Z')) }]
    const r = periodosDeMas(base({ pagos }), { ahora: HOY })
    expect(r.yaCobrados).toBe(2)
    expect(r.porCobrar).toBe(2)
  })
  it('la nota empieza siempre igual y se vuelve a leer', () => {
    expect(notaPeriodos(1, 'quincenal')).toBe('Interés de 1 quincena de más')
    expect(notaPeriodos(3, 'mensual')).toBe('Interés de 3 meses de más')
    expect(periodosYaCobrados([{ tipo: 'recargo', nota: notaPeriodos(3, 'semanal'), fechaPago: HOY }])).toBe(3)
    // Un recargo cualquiera o un moratorio no cuentan como períodos.
    expect(periodosYaCobrados([{ tipo: 'recargo', nota: 'Interés moratorio: 10 días', fechaPago: HOY }, { tipo: 'recargo', nota: 'mora', fechaPago: HOY }])).toBe(0)
  })
  it('no se ofrece si no ha vencido, si es abierto o si la cuota no lleva interés separable', () => {
    expect(periodosDeMas(base({ fechaFin: new Date('2026-12-01T17:00:00Z') }), { ahora: HOY }).disponible).toBe(false)
    expect(periodosDeMas(base(), { ahora: HOY, esAbierto: true }).disponible).toBe(false)
    expect(periodosDeMas(base({ cuotaDiaria: 90000 }), { ahora: HOY }).disponible).toBe(false) // 90.000 × 6 < 600.000
    expect(periodosDeMas(base({ estado: 'completado' }), { ahora: HOY }).disponible).toBe(false)
  })
})

describe('opción 1: % al mes, la misma cuenta del interés moratorio', () => {
  it('con las piezas de tasa 1, cualquier tasa da lo mismo que el cálculo de siempre', () => {
    const p = base()
    const piezas = calcularInteresMoratorio(p, [], [], 1, 5)
    expect(piezas.diasMoraEfectivos).toBeGreaterThan(0)
    for (const tasa of [2, 5, 10, 15, 20, 40]) {
      expect(montoMoratorioCon(piezas, tasa)).toBe(calcularInteresMoratorio(p, [], [], tasa, 5).montoMoratorio)
    }
  })
  it('sin tasa o sin días no ofrece nada', () => {
    expect(montoMoratorioCon({ montoBase: 100000, diasMoraEfectivos: 10, tope: 50000 }, 0)).toBe(0)
    expect(montoMoratorioCon({ montoBase: 100000, diasMoraEfectivos: 0, tope: 50000 }, 10)).toBe(0)
  })
})

describe('conectado de punta a punta', () => {
  const api = fs.readFileSync('app/api/prestamos/[id]/route.js', 'utf8')
  const ficha = fs.readFileSync('app/(dashboard)/prestamos/[id]/page.jsx', 'utf8')
  const hoja = fs.readFileSync('components/prestamos/CobrarMora.jsx', 'utf8')
  it('la API la manda a todo dueño, con su tasa y la del préstamo', () => {
    expect(api).toMatch(/if \(p\.estado === 'activo' && session\.user\.rol === 'owner'\) \{/)
    expect(api).toMatch(/tasaConfigurada: org\?\.tasaMoratorio > 0 \? org\.tasaMoratorio : 0,/)
    expect(api).toMatch(/tasaDelPrestamo: tasaMensualPactada\(p\),/)
    expect(api).toMatch(/periodosDeMas\(conTiempoComprado\(p\), \{ esAbierto: esAbiertoConDevengo\(p\) \}\)/)
    expect(api).toMatch(/\n    moraAMano,\n  \}\)/)
  })
  it('la ficha la pinta y la hoja escribe un recargo con la nota que la vuelve a leer', () => {
    expect(ficha).toMatch(/\{moraAMano && estaActivo && !completado && esOwner && \(\n\s+<CobrarMora/)
    expect(hoja).toMatch(/body: JSON\.stringify\(\{ montoPagado: Math\.round\(monto\), tipo: 'recargo', nota: nota\(\) \}\)/)
    expect(hoja).toMatch(/`Interés moratorio: \$\{pct\(tasa\)\} % al mes/)
    expect(hoja).toMatch(/notaPeriodos\(n, periodos\.frecuencia, periodos\.vencio\)/)
  })
})

describe('la tasa con la que se prestó', () => {
  it('el caso del cliente: «yo presto al 15 %»', () => {
    // 270.000 de interés ÷ 600.000 ÷ 3 meses
    expect(tasaMensualPactada(base())).toBe(15)
  })
  it('sin interés o sin plazo, no se inventa', () => {
    expect(tasaMensualPactada(base({ cuotaDiaria: 90000 }))).toBeNull()
    expect(tasaMensualPactada(base({ diasPlazo: 0 }))).toBeNull()
  })
})

describe('una sola puerta para la mora en la ficha', () => {
  const ficha = fs.readFileSync('app/(dashboard)/prestamos/[id]/page.jsx', 'utf8')
  const hoja = fs.readFileSync('components/prestamos/CobrarMora.jsx', 'utf8')
  it('la tarjeta y el modal viejos ya no están', () => {
    expect(ficha).not.toMatch(/>\s*Aplicar como recargo\s*</)
    expect(ficha).not.toMatch(/title="Aplicar interés moratorio"/)
    expect(ficha.match(/<CobrarMora/g)?.length).toBe(1)
  })
  it('abre con la tasa del negocio, si no la del préstamo, si no 10', () => {
    expect(hoja).toMatch(/const tasaInicial = tasaConfigurada > 0 \? tasaConfigurada : \(tasaDelPrestamo \?\? 10\)/)
  })
  it('con tasa y todo ya cobrado, no avisa', () => {
    expect(hoja).toMatch(/if \(tasaConfigurada > 0 && !\(conSuTasa > 0\) && !\(periodos\?\.porCobrar > 0\)\) return null/)
  })
})

describe('se lee bien', () => {
  const hoja = fs.readFileSync('components/prestamos/CobrarMora.jsx', 'utf8')
  it('«otro día», «otra quincena», y el porcentaje con coma', () => {
    expect(hoja).toMatch(/const MASCULINOS = new Set\(\['día', 'mes'\]\)/)
    expect(hoja).toMatch(/etiqueta: `\$\{otro\} \$\{uno\} de interés`/)
    expect(hoja).toMatch(/const pct = \(t\) => String\(Number\(t\)\)\.replace\('\.', ','\)/)
  })
})
