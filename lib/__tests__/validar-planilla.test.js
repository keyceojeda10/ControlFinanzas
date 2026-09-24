import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const org = vi.hoisted(() => ({ diasSinCobro: null, llamadas: 0 }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    cliente: { count: vi.fn(async () => 0), findMany: vi.fn(async () => []) },
    prestamo: { findMany: vi.fn(async () => []) },
    ruta: { findMany: vi.fn(async () => []) },
    organization: { findUnique: vi.fn(async () => { org.llamadas++; return { diasSinCobro: org.diasSinCobro } }) },
  },
}))

import { prisma } from '@/lib/prisma'
import { validarFila } from '@/lib/carga-masiva'
import { validarCartera } from '@/lib/importar-cartera'
import { leerPlanillaCrossbox } from '@/lib/importar/planilla-crossbox'

const { filas } = leerPlanillaCrossbox(JSON.parse(readFileSync(resolve(process.cwd(), 'lib/__tests__/fixtures/planilla-crossbox-paginas.json'), 'utf8')))
const fila = (n) => filas.find((f) => f.filaPlanilla === n)
const validar = (n) => validarFila(fila(n), n - 1, new Map(), new Map(), { sinDomingos: true })

beforeEach(() => { org.diasSinCobro = null; org.llamadas = 0 })

describe('validarFila con una fila de la planilla', () => {
  it('deduce, calcula el total y el abono previo sale del saldo', () => {
    const r = validar(2)
    expect(r.estado).toBe('advertencia')
    expect(r.errores).toEqual([])
    expect(r.datos).toMatchObject({ tasaInteres: 20, frecuencia: 'diario', valorCuota: 20000, abonadoHasta: 60000 })
    expect(r.calculado.totalAPagar).toBe(480000)
    expect(r.advertencias).toContain('Deducido: 20 % en 24 cuotas diarias; cuadra con su planilla (al día)')
  })
  it('«Nunca» con cuota que no divide: SIN abono previo inventado, y el total dice su redondeo', () => {
    const r = validar(13)
    expect(r.datos.abonadoHasta).toBe(0)
    expect(r.calculado.totalAPagar).toBe(1280004)
    expect(r.advertencias.some((a) => a.includes('por el redondeo de la cuota'))).toBe(true)
  })
  it('«Nunca» pero con saldo menor que el crédito (fila 46): el saldo SÍ dice cuánto se abonó', () => {
    const r = validar(46)
    expect(r.datos.abonadoHasta).toBe(170000)
    expect(r.calculado.totalAPagar).toBe(560000)
  })
  it('la que no se deduce sale con UN motivo, sin los errores de tasa y plazo', () => {
    const r = validar(45)
    expect(r.estado).toBe('error')
    expect(r.errores).toEqual(['No pudimos deducir la tasa y las cuotas de este crédito: créalo a mano con tus datos'])
  })
  it('una fila normal de Excel (con tasa) no se toca', () => {
    const r = validarFila({ nombre: 'Ana', cedula: '1', montoPrestado: 300000, tasaInteres: 20, numeroCuotas: 24, frecuencia: 'diario', fechaInicio: '2026-09-01' }, 0, new Map())
    expect(r.advertencias.some((a) => a.startsWith('Deducido'))).toBe(false)
  })
})

describe('validarCartera decide los domingos', () => {
  it('cuenta sin configurar: la planilla va sin domingos → se sugiere', async () => {
    const v = await validarCartera({ organizationId: 'o1', plan: 'starter', filas })
    expect(v.resumen.sinDomingosSugerido).toBe(true)
    expect(v.resumen.domingosConfigurados).toBe(false)
    expect(v.resumen.filasConError).toBe(3)
    expect(v.resumen.filasValidas).toBe(46)
  })
  it('la cuenta ya no cobra domingos: se respeta y no se sugiere nada', async () => {
    org.diasSinCobro = '[0]'
    const v = await validarCartera({ organizationId: 'o1', plan: 'starter', filas })
    expect(v.resumen.domingosConfigurados).toBe(true)
    expect(v.resumen.sinDomingosSugerido).toBeNull()
  })
  it('un Excel normal no pregunta por los domingos (ni consulta la cuenta)', async () => {
    const v = await validarCartera({ organizationId: 'o1', plan: 'starter', filas: [{ nombre: 'Ana', cedula: '1', montoPrestado: 300000, tasaInteres: 20, numeroCuotas: 24, frecuencia: 'diario', fechaInicio: '2026-09-01' }] })
    expect(v.resumen.sinDomingosSugerido).toBeNull()
    expect(org.llamadas).toBe(0)
  })
})

// I5. La planilla de Crossbox no trae cédula: cada fila genera SIN-<NOMBRE>.
// Antes `validarCartera` buscaba los clientes existentes con `\D` (solo
// dígitos) sobre `f.cedula` crudo, así que ese SIN-<NOMBRE> nunca se
// encontraba —ni el cliente ni sus préstamos—, y re-subir la MISMA planilla
// la enseñaba entera como nueva.
describe('I5: re-subir la misma planilla reconoce al cliente SIN-<NOMBRE>', () => {
  it('la fila 2 (Cliente 2) sale «repetido»: el cliente y su préstamo ya existen con cedula SIN-CLIENTE-2', async () => {
    const f2 = fila(2)
    prisma.cliente.findMany.mockResolvedValueOnce([
      { cedula: 'SIN-CLIENTE-2', estado: 'activo', nombre: 'Cliente 2', id: 'c2' },
    ])
    prisma.prestamo.findMany.mockResolvedValueOnce([
      // La misma huella que va a salir de deducir la fila 2: 400.000, arranca
      // el 2026-09-21, diario. Guardada como la base la guarda de verdad
      // (medianoche de Bogotá, T05:00Z).
      { clienteId: 'c2', montoPrestado: f2.montoPrestado, fechaInicio: new Date('2026-09-21T05:00:00.000Z'), frecuencia: 'diario' },
    ])
    const v = await validarCartera({ organizationId: 'o1', plan: 'starter', filas })

    // La prueba directa del bug: la CONSULTA que arma validarCartera tiene que
    // pedirle a la base la llave que de verdad usa validarFila (SIN-CLIENTE-2),
    // no lo que salía de `.replace(/\D/g, '')` sobre una cédula que ni existe
    // (esa cuenta daba '' y la fila se quedaba fuera del `in`).
    expect(prisma.cliente.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ cedula: { in: expect.arrayContaining(['SIN-CLIENTE-2']) } }) }),
    )

    const filaValidada = v.filas.find((x) => x.datos.cedula === 'SIN-CLIENTE-2')
    expect(filaValidada).toBeTruthy()
    expect(filaValidada.estado).toBe('repetido')
  })
})

// I6. Un archivo cuyas filas deducibles empatan (3 sin domingos, 3 con
// domingos) no puede sugerir «sin domingos»: `decidirDomingos` ahora exige
// mayoría estricta, y `validarCartera` no debe ofrecer nada en ese caso.
describe('I6: un empate no sugiere nada', () => {
  it('filas 1, 38 y 47 (una sola cuota, empatan 3 a 3): sinDomingosSugerido es null', async () => {
    const soloUnaCuota = [1, 38, 47].map(fila)
    const v = await validarCartera({ organizationId: 'o1', plan: 'starter', filas: soloUnaCuota })
    expect(v.resumen.sinDomingosSugerido).toBeNull()
  })
})
