import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { recorridoDelAbierto } from '@/lib/dinero/recorrido-abierto'
import { calcularCapitalRestante, capitalAbiertoAlDia } from '@/lib/calculos'
import { repartirPagado } from '@/lib/dinero/reparto'

const leer = (f) => readFileSync(f, 'utf8')
const abierto = (o) => ({ modoInteres: 'solo_interes', sinPlazo: true, frecuencia: 'mensual', tasaInteres: 12, ...o })

// Yaneris Díaz (Inversiones Jk), como quedó el 5 nov 2026: $1.500.000 al 12 %,
// cada mes el interés como «intereses» y $250.000 a capital — el de octubre
// metido como «completo» el día del corte.
const yaneris = abierto({
  montoPrestado: 1500000, totalAPagar: 1950000, totalPagado: 1200000, fechaInicio: '2026-08-03T05:00:00.000Z',
  pagos: [
    { tipo: 'intereses', montoPagado: 180000, fechaPago: '2026-09-03T17:00:00.000Z' },
    { tipo: 'capital', montoPagado: 250000, fechaPago: '2026-09-03T17:00:00.000Z' },
    { tipo: 'intereses', montoPagado: 150000, fechaPago: '2026-10-03T17:00:00.000Z' },
    { tipo: 'completo', montoPagado: 250000, fechaPago: '2026-10-03T17:00:00.000Z' },
    { tipo: 'intereses', montoPagado: 120000, fechaPago: '2026-11-03T17:00:00.000Z' },
    { tipo: 'capital', montoPagado: 250000, fechaPago: '2026-11-03T17:00:00.000Z' },
  ],
  devengos: [
    { periodo: '2026-09-03', interes: 180000 },
    { periodo: '2026-10-03', interes: 150000 },
    { periodo: '2026-11-03', interes: 120000 },
  ],
})

describe('⚠ el completo no paga un interés que vence después (Yaneris)', () => {
  it('capital $750.000 y nada de interés debido', () => {
    expect(recorridoDelAbierto(yaneris)).toMatchObject({ capital: 750000, interesDebido: 0 })
    expect(calcularCapitalRestante(yaneris)).toBe(750000)
  })
  it('el capital con que empezó noviembre: $1.000.000 (antes la app decía $1.120.000)', () => {
    expect(capitalAbiertoAlDia(yaneris, new Date('2026-10-03T05:00:00.000Z'))).toBe(1000000)
    expect(capitalAbiertoAlDia(yaneris, new Date('2026-11-03T05:00:00.000Z'))).toBe(750000)
  })
  it('los informes cuentan el mismo capital pagado', () => {
    expect(repartirPagado(yaneris)).toMatchObject({ capital: 750000, interes: 450000 })
  })
})

describe('el completo que paga el mes unos días antes del corte es interés', () => {
  // `oou4cd50`: $1.500.000 al 15 %; paga $225.000 el 28 oct, el interés vence el 31.
  const p = abierto({
    montoPrestado: 1500000, tasaInteres: 15, fechaInicio: '2026-08-31T05:00:00.000Z',
    pagos: [
      { tipo: 'completo', montoPagado: 225000, fechaPago: '2026-09-30T12:28:00.000Z' },
      { tipo: 'completo', montoPagado: 225000, fechaPago: '2026-10-28T17:07:00.000Z' },
    ],
    devengos: [{ periodo: '2026-09-30', interes: 225000 }, { periodo: '2026-10-31', interes: 225000 }],
  })
  it('no baja el capital ni lo deja debiendo', () => {
    expect(recorridoDelAbierto(p)).toMatchObject({ capital: 1500000, interesDebido: 0 })
  })
  it('pero no paga dos meses: el que viene después del corte siguiente queda por pagar', () => {
    const conDiciembre = { ...p, devengos: [...p.devengos, { periodo: '2026-11-30', interes: 225000 }] }
    expect(recorridoDelAbierto(conDiciembre)).toMatchObject({ capital: 1500000, interesDebido: 225000 })
  })
  it('lo que sobra del interés es capital', () => {
    const conMas = { ...p, pagos: [...p.pagos.slice(0, 1), { ...p.pagos[1], montoPagado: 325000 }] }
    expect(recorridoDelAbierto(conMas).capital).toBe(1400000)
  })
})

describe('el abono previo de la carga se cuenta como antes', () => {
  // `7vburv6n`: tasa 0, un completo el mismo día de inicio.
  const p = abierto({
    montoPrestado: 1500000, tasaInteres: 0, fechaInicio: '2026-10-26T05:00:00.000Z',
    pagos: [{ tipo: 'completo', montoPagado: 20000, fechaPago: '2026-10-27T00:57:00.000Z' }], devengos: [],
  })
  it('para el capital de hoy es capital si no hay interés que cubrir', () => {
    expect(calcularCapitalRestante(p)).toBe(1480000)
  })
  it('para el capital con que empieza un mes no cuenta', () => {
    expect(capitalAbiertoAlDia(p, new Date('2026-11-26T05:00:00.000Z'))).toBe(1500000)
  })
})

describe('una sola regla para la ficha y para los informes', () => {
  it('calculos.js y reparto.js usan `recorridoDelAbierto`', () => {
    expect(leer('lib/calculos.js')).toMatch(/return recorridoDelAbierto\(prestamo, \{ base: montoBase \}\)\.capital/)
    expect(leer('lib/dinero/reparto.js')).toMatch(/recorridoDelAbierto\(\{ \.\.\.prestamo, pagos \}, \{ base: monto \}\)\.aCapital/)
  })
})

describe('la cuota de un abierto es el interés del mes que corre', () => {
  const src = leer('lib/dinero/devengar.js')
  it('se recalcula al asentar un mes y al mover un pago', () => {
    expect(src).toMatch(/try \{ await refrescarCuotaAbierto\(prisma, p\.id, ahora\) \}/)
    expect(src).toMatch(/if \(cambios\) await refrescarCuotaAbierto\(tx, prestamoId\)/)
    expect(src).toMatch(/const cuota = periodoEnCursoAbierto\(p, ahora\)\?\.interesPeriodo/)
  })
  it('la ficha dice solo el interés que ya venció', () => {
    expect(leer('app/(dashboard)/prestamos/[id]/page.jsx')).toMatch(/\? Math\.max\(0, Math\.round\(\(saldoPendiente \?\? 0\) - capitalRestante\)\)/)
  })
  it('«Cómo va» (inicio → vencimiento) no sale en un abierto', () => {
    expect(leer('app/(dashboard)/prestamos/[id]/page.jsx')).toMatch(/\{esOwner && estaActivo && fechaInicio && fechaFin && !esAbierto && \(\n\s*<TimelinePrestamo/)
  })
  it('el historial por WhatsApp no cuenta «cuotas» de un abierto', () => {
    expect(leer('lib/whatsapp-plantillas.js')).toMatch(/if \(!esAbiertoConDevengo\(prestamo \?\? \{\}\)\) \{\n\s*resumenLines\.push\(`\\u\{1f522\} Cuotas pagadas/)
  })
})
