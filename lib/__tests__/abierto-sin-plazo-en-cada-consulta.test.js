/* EL ABIERTO SE LEÍA COMO UN GLOBO VENCIDO — 27 oct 2026.
 *
 * Soporte de CREDITOS E y M: le cobraron el interés del mes y la lista de
 * Clientes seguía diciendo «le falta $4.000.000» —todo el capital—, y el aviso
 * de las 7, «Debe $4.600.000». La ficha del préstamo, que sí pedía `sinPlazo`,
 * decía «al día».
 *
 * 16 consultas esparcían CAMPOS_DEL_REPARTO sin pedir `sinPlazo`. Sin él,
 * `esAbiertoConDevengo` da falso y el abierto cae en la rama del «solo interés»
 * con plazo: vencido entero en su primer corte. Y Cobrar hoy y la ruta le daban
 * al cálculo solo los pagos de HOY: el interés pagado ayer no existía. */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import { CAMPOS_DEL_REPARTO } from '@/lib/dinero/capital-base'
import { PAGOS_DEL_CALCULO, pagosDelCalculoPorPrestamo } from '@/lib/dinero/pagos-del-calculo'
import { calcularDiasMora, calcularMontoEnMora, calcularEstadoCliente } from '@/lib/calculos'

const leer = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8')
const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

// El caso, sin nombres: $4.000.000 al 15 % mensual desde el 25 sep, el primer
// corte asentado el 25 oct y el interés pagado el 26.
const abierto = (extra = {}) => ({
  id: 'p1', estado: 'activo', modoInteres: 'solo_interes', sinPlazo: true, frecuencia: 'mensual',
  montoPrestado: 4000000, tasaInteres: 15, totalAPagar: 4600000, totalPagado: 600000, abonadoCapital: 0,
  cuotaDiaria: 600000, diasPlazo: 30,
  fechaInicio: new Date('2026-09-25T05:00:00Z'), fechaFin: new Date('2026-10-25T05:00:00Z'),
  devengos: [{ periodo: '2026-10-25', interes: 600000 }],
  pagos: [{ tipo: 'completo', montoPagado: 600000 }],
  cuotasAmortizacion: [],
  ...extra,
})

// `calcularMontoEnMora` mira la fecha de hoy: se fija para que la prueba no
// cambie de resultado al día siguiente de escrita.
beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-27T17:00:00Z')) })
afterAll(() => { vi.useRealTimers() })

describe('el préstamo abierto, con y sin `sinPlazo`', () => {
  it('pagado el interés del mes queda al día; sin `sinPlazo` el mismo préstamo «debía» todo el capital', () => {
    const p = abierto()
    expect(calcularDiasMora(p)).toBe(0)
    expect(calcularMontoEnMora(p)).toBe(0)
    const { sinPlazo, ...ciego } = p
    expect(sinPlazo).toBe(true)
    expect(calcularMontoEnMora(ciego)).toBe(4000000)
  })

  it('sin pagar el interés, debe el interés del mes, no la deuda entera', () => {
    const p = abierto({ totalPagado: 0, pagos: [] })
    expect(calcularMontoEnMora(p)).toBe(600000)
    expect(calcularDiasMora(p)).toBe(2)
    expect(calcularEstadoCliente([p])).toBe('mora')
  })

  it('CAMPOS_DEL_REPARTO lo pide: viaja en cada consulta de plata', () => {
    expect(CAMPOS_DEL_REPARTO).toEqual({ totalAPagarPrevio: true, interesArrastrado: true, sinPlazo: true })
  })
})

/* Todas las rutas que calculan mora, capital o la cuota tienen que leer el
   préstamo con `sinPlazo`: pidiéndolo, esparciendo CAMPOS_DEL_REPARTO o con el
   `select` compartido del día. Las de la lista leen el préstamo entero con
   `include` (revisadas a mano el 27 oct 2026); si una pasa a `select`, tiene
   que pedirlo y salir de la lista. */
const LEEN_EL_PRESTAMO_ENTERO = [
  'app/api/cobradores/[id]/route.js',
  'app/api/mora/route.js',
  'app/api/offline/sync/route.js',
  'app/api/pagos/[id]/route.js',
  'app/api/prestamos/[id]/pagos/route.js',
  'app/api/prestamos/[id]/trasladar/route.js',
  'app/api/prestamos/[id]/cuota-que-toca/route.js',
  'app/api/prestamos/moratorio/route.js',
  'app/api/socios/[id]/route.js',
]
const CALCULA = /\b(calcularDiasMora|calcularMontoEnMora|calcularEstadoCliente|calcularCapitalRestante|calcularMontoParaPonerseAlDia|calcularCuotaQueToca)\(/
const PIDE_SIN_PLAZO = /sinPlazo|\.\.\.CAMPOS_DEL_REPARTO|selectPrestamoDelDia\(|SELECT_PARA_DEVENGAR|SELECT_PARA_INTERES/

function rutas(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? rutas(p) : e.name === 'route.js' ? [p] : []
  })
}

describe('ninguna ruta calcula a ciegas del abierto', () => {
  const todas = rutas(path.join(process.cwd(), 'app/api')).map((p) => path.relative(process.cwd(), p))
  const calculan = todas.filter((f) => CALCULA.test(sinComentarios(leer(f))))

  it('hay rutas que revisar (si sale 0, el barrido no está mirando)', () => {
    expect(calculan.length).toBeGreaterThan(20)
  })
  for (const f of calculan) {
    it(f, () => {
      const src = sinComentarios(leer(f))
      if (LEEN_EL_PRESTAMO_ENTERO.includes(f)) expect(src).toMatch(/include:/)
      else expect(src).toMatch(PIDE_SIN_PLAZO)
    })
  }
})

describe('los caminos de este arreglo', () => {
  it('Cobrar hoy y la ruta: «cobrado hoy» con los de hoy, el cálculo con los suyos', () => {
    for (const f of ['app/api/cobros-hoy/route.js', 'app/api/rutas/[id]/route.js']) {
      const src = sinComentarios(leer(f))
      expect(src, f).toMatch(/const delCalculo = await pagosDelCalculoPorPrestamo\(prisma, /)
      expect(src, f).toMatch(/p\.pagosHoy = p\.pagos; p\.pagos = delCalculo\.get\(p\.id\) \?\? \[\]/)
      expect(src, f).toMatch(/const pagosHoy = p\.pagosHoy\n/)
    }
  })
  it('el aviso de mora de las 7 lee los pagos contra lo devengado', () => {
    expect(sinComentarios(leer('app/api/cron/mora-alertas/route.js'))).toMatch(/devengos: \{ select: \{ periodo: true, interes: true \} \},\s*pagos: PAGOS_DEL_CALCULO,/)
  })
  it('el PDF del resumen pide lo mismo que el resumen en pantalla', () => {
    const src = sinComentarios(leer('app/api/reportes/resumen-pdf/route.js'))
    expect(src).toMatch(/modoInteres: true, totalPagado: true, abonadoCapital: true,\s*devengos: \{ select: \{ periodo: true, interes: true \} \},/)
  })
  it('el score por cédula reconoce al abierto', () => {
    const src = sinComentarios(leer('app/api/clientes/score/route.js'))
    expect(src).toMatch(/modoInteres: true, \.\.\.CAMPOS_DEL_REPARTO,\s*devengos: \{ select: \{ periodo: true, interes: true \} \},/)
  })
})

describe('pagosDelCalculoPorPrestamo', () => {
  it('una consulta, con la regla de PAGOS_DEL_CALCULO, agrupada por préstamo', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { prestamoId: 'a', tipo: 'intereses', montoPagado: 100 },
      { prestamoId: 'b', tipo: 'capital', montoPagado: 50 },
      { prestamoId: 'a', tipo: 'completo', montoPagado: 600 },
    ])
    const m = await pagosDelCalculoPorPrestamo({ pago: { findMany } }, ['a', 'b', 'c'])
    expect(findMany).toHaveBeenCalledTimes(1)
    expect(findMany.mock.calls[0][0]).toEqual({
      where: { prestamoId: { in: ['a', 'b', 'c'] }, ...PAGOS_DEL_CALCULO.where },
      select: { prestamoId: true, ...PAGOS_DEL_CALCULO.select },
    })
    expect(m.get('a')).toEqual([{ tipo: 'intereses', montoPagado: 100 }, { tipo: 'completo', montoPagado: 600 }])
    expect(m.get('b')).toEqual([{ tipo: 'capital', montoPagado: 50 }])
    expect(m.get('c')).toBeUndefined()
  })
  it('sin préstamos no pregunta', async () => {
    const findMany = vi.fn()
    expect((await pagosDelCalculoPorPrestamo({ pago: { findMany } }, [])).size).toBe(0)
    expect(findMany).not.toHaveBeenCalled()
  })
})
