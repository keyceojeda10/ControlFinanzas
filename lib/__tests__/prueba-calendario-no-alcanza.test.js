// Inversiones Medina, 6 nov 2026: «sí uso la plataforma, pero cobro semanal». El
// regalo de la prueba pedía cobrar 3 días distintos en 7, y su primer cobro caía el
// mismo día en que vencía. Y el aviso le decía «registró 0 cobros por $0».
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'

const prisma = vi.hoisted(() => ({
  envioSeguimiento: { findFirst: vi.fn(), create: vi.fn(() => ({})) },
  suscripcion: { findFirst: vi.fn(), update: vi.fn(() => ({})) },
  pagoSuscripcion: { count: vi.fn(async () => 0) },
  pago: { findMany: vi.fn(async () => []) },
  cliente: { findMany: vi.fn(async () => []) },
  organization: { findUnique: vi.fn(async () => ({ diasSinCobro: null })), update: vi.fn(() => ({})) },
  festivo: { findMany: vi.fn(async () => []) },
  user: { findFirst: vi.fn(async () => ({ nombre: 'Arnei', telefono: '3000000000' })) },
  $transaction: vi.fn(async () => []),
}))
const enviarPaso = vi.hoisted(() => vi.fn(async () => ({ enviado: true })))
const notificar = vi.hoisted(() => vi.fn(async () => ({ avisados: 1 })))
vi.mock('@/lib/prisma', () => ({ prisma }))
vi.mock('@/lib/seguimiento/enviar', () => ({ enviarPaso }))
vi.mock('@/lib/notificar', () => ({ notificar }))

const { evaluarPremioPrueba, diasConCobroProgramado, finPorCalendario } = await import('@/lib/seguimiento/prueba')
const { pasoPrueba, diaBogota } = await import('@/lib/seguimiento/reglas')
const { PLANTILLAS_SEGUIMIENTO } = await import('@/lib/seguimiento/plantillas')

const prestamo = (frecuencia, fechaInicio, extra = {}) => ({
  id: fechaInicio + frecuencia, estado: 'activo', frecuencia, fechaInicio: `${fechaInicio}T05:00:00.000Z`,
  cuotaDiaria: 50_000, totalAPagar: 400_000, diasPlazo: 56, modoInteres: 'fijo', pagos: [], cuotasAmortizacion: [], ...extra,
})
const cartera = (...prestamos) => [{ diasSinCobro: null, ruta: null, prestamos }]

const MARCA = new Date('2026-11-01T15:00:00.000Z')
const VENCE = new Date('2026-11-08T15:00:00.000Z')
const AHORA = new Date('2026-11-06T23:00:00.000Z')

beforeEach(() => {
  vi.clearAllMocks()
  prisma.envioSeguimiento.findFirst.mockImplementation(async ({ where }) => (where.paso === 'inicio' ? { createdAt: MARCA } : null))
  prisma.suscripcion.findFirst.mockResolvedValue({ id: 's1', fechaVencimiento: VENCE })
  prisma.pago.findMany.mockResolvedValue([])
})

describe('cuántos días de cobro le da su calendario', () => {
  it('semanal del 1 nov: el 8 y nada más antes de vencer', () => {
    expect(diasConCobroProgramado({ clientes: cartera(prestamo('semanal', '2026-11-01')) }, MARCA, VENCE)).toBe(1)
  })
  it('diario: todos los días', () => {
    expect(diasConCobroProgramado({ clientes: cartera(prestamo('diario', '2026-11-01')) }, MARCA, VENCE)).toBeGreaterThanOrEqual(3)
  })
  it('semanales con cartera vieja, repartidos en la semana: sí le alcanza', () => {
    const c = cartera(prestamo('semanal', '2026-10-05'), prestamo('semanal', '2026-10-07'), prestamo('semanal', '2026-10-09'))
    expect(diasConCobroProgramado({ clientes: c }, MARCA, VENCE)).toBeGreaterThanOrEqual(3)
  })
})

describe('el regalo cuando el calendario no le alcanza', () => {
  it('⚠ Medina: semanal, 0 cobros, a 2 días de vencer: se le extiende a los 14 días', async () => {
    prisma.cliente.findMany.mockResolvedValue(cartera(prestamo('semanal', '2026-11-01')))
    const r = await evaluarPremioPrueba('o1', { ahora: AHORA })
    expect(r).toMatchObject({ premio: true, porCalendario: true })
    expect(r.hasta.toISOString().slice(0, 10)).toBe('2026-11-15')
    expect(notificar.mock.calls[0][0].titulo).toBe('Su prueba se extendió')
    expect(enviarPaso.mock.calls[0][0].plantilla).toBe('prueba_extendida_primeros_cobros')
  })
  it('⚠ mensual del 1 nov: la prueba va hasta 2 días después de su primer cobro (1 dic → 3 dic)', async () => {
    prisma.cliente.findMany.mockResolvedValue(cartera(prestamo('mensual', '2026-11-01')))
    const r = await evaluarPremioPrueba('o1', { ahora: AHORA })
    expect(r).toMatchObject({ premio: true, porCalendario: true })
    expect(diaBogota(r.hasta)).toBe('2026-12-03')
  })
  it('quincenal del 1 nov: primer cobro el 16, va hasta el 18', async () => {
    prisma.cliente.findMany.mockResolvedValue(cartera(prestamo('quincenal', '2026-11-01')))
    expect(diaBogota((await evaluarPremioPrueba('o1', { ahora: AHORA })).hasta)).toBe('2026-11-18')
  })
  it('primer cobro más allá de 35 días: se queda en los 14', () => {
    expect(finPorCalendario(MARCA, ['2026-12-20'], AHORA).toISOString().slice(0, 10)).toBe('2026-11-15')
    expect(finPorCalendario(MARCA, [], AHORA).toISOString().slice(0, 10)).toBe('2026-11-15')
  })
  it('de madrugada no: lo dispara el reloj y le llegaría un WhatsApp a las 3 a. m.', async () => {
    prisma.cliente.findMany.mockResolvedValue(cartera(prestamo('semanal', '2026-11-01')))
    expect(await evaluarPremioPrueba('o1', { ahora: new Date('2026-11-07T08:00:00.000Z') })).toMatchObject({ premio: false, motivo: 'faltan_dias' })
  })
  it('todavía lejos de vencer no se decide: puede cargar más cartera', async () => {
    prisma.cliente.findMany.mockResolvedValue(cartera(prestamo('semanal', '2026-11-01')))
    expect(await evaluarPremioPrueba('o1', { ahora: new Date('2026-11-03T15:00:00.000Z') })).toMatchObject({ premio: false, motivo: 'faltan_dias' })
  })
  it('sin préstamos no hay regalo', async () => {
    prisma.cliente.findMany.mockResolvedValue([{ diasSinCobro: null, ruta: null, prestamos: [] }])
    expect(await evaluarPremioPrueba('o1', { ahora: AHORA })).toMatchObject({ premio: false, motivo: 'faltan_dias' })
  })
  it('quien cobra a diario y no cobró, no lo gana: sí podía', async () => {
    prisma.cliente.findMany.mockResolvedValue(cartera(prestamo('diario', '2026-11-01')))
    expect(await evaluarPremioPrueba('o1', { ahora: AHORA })).toMatchObject({ premio: false, motivo: 'faltan_dias' })
  })
  it('cobrar 3 días sigue dando el regalo de siempre, con su mensaje', async () => {
    prisma.pago.findMany.mockResolvedValue(['2026-11-02', '2026-11-03', '2026-11-04'].map((d) => ({ createdAt: new Date(`${d}T17:00:00Z`), montoPagado: 1000 })))
    const r = await evaluarPremioPrueba('o1', { ahora: new Date('2026-11-04T18:00:00.000Z') })
    expect(r).toMatchObject({ premio: true, porCalendario: false })
    expect(enviarPaso.mock.calls[0][0].plantilla).toBe('prueba_extendida')
  })
})

describe('el aviso de «vence»', () => {
  const base = (x = {}) => ({
    horasDesdeRegistro: 30, clientes: 10, diasCobro: 1, diasParaRegalo: 3, cobroHoy: false, cobroAyer: false,
    horasSinUso: 2, diasParaVencer: 1.5, premio: false, cobrosHoy: 8, hora: 12, dia: '2026-10-14', finPrueba: '2026-10-19',
    enviados: new Set(), ...x,
  })
  it('⚠ sin cobros no dice «registró 0 cobros por $0»', () => {
    expect(pasoPrueba(base({ cobrosEnPrueba: 0 })).plantilla).toBe('prueba_por_vencer_sin_cobros')
    expect(PLANTILLAS_SEGUIMIENTO.prueba_por_vencer_sin_cobros.texto).not.toMatch(/cobros/)
  })
  it('con cobros, el de siempre', () => {
    expect(pasoPrueba(base({ cobrosEnPrueba: 4 })).plantilla).toBe('prueba_por_vencer')
  })
  it('las plantillas nuevas no empiezan ni terminan en variable (Meta las rechaza)', () => {
    for (const n of ['prueba_por_vencer_sin_cobros', 'prueba_extendida_primeros_cobros']) {
      expect(PLANTILLAS_SEGUIMIENTO[n].texto).not.toMatch(/^\{\{|\}\}$/)
    }
  })
  it('el motor le pasa los cobros y los datos de la plantilla nueva', () => {
    const motor = readFileSync('lib/seguimiento/motor.js', 'utf8')
    expect(motor).toContain('cobrosEnPrueba: cobros,')
    expect(motor).toContain('prueba_por_vencer_sin_cobros: { nombre, fecha: fechaLarga(fin) },')
  })
})
