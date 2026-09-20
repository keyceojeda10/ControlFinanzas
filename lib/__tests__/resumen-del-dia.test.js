// «Tu resumen del día» — el dueño, 20 sep 2026.
import { describe, it, expect } from 'vitest'
import { armarResumen, tocaOfrecerlo, fechaLocal, POSPONER_MS } from '@/lib/resumen-del-dia'

const a = (h, m = 0) => new Date(2026, 8, 20, h, m)

describe('cuándo se ofrece', () => {
  it('a la hora elegida, y también si la app se abre después', () => {
    expect(tocaOfrecerlo({ hora: 21, ahora: a(20, 59) })).toBe(false)
    expect(tocaOfrecerlo({ hora: 21, ahora: a(21, 0) })).toBe(true)
    expect(tocaOfrecerlo({ hora: 21, ahora: a(23, 40) })).toBe(true)
  })
  it('una vez al día: visto hoy, no vuelve; mañana sí', () => {
    expect(tocaOfrecerlo({ hora: 21, ahora: a(22), visto: fechaLocal(a(22)) })).toBe(false)
    expect(tocaOfrecerlo({ hora: 21, ahora: a(22), visto: '2026-09-19' })).toBe(true)
  })
  it('«todavía no termino» lo calla una hora, no todo el día', () => {
    const ahora = a(21, 5)
    expect(tocaOfrecerlo({ hora: 21, ahora, pospuestoHasta: ahora.getTime() + POSPONER_MS })).toBe(false)
    expect(tocaOfrecerlo({ hora: 21, ahora: a(22, 6), pospuestoHasta: ahora.getTime() + POSPONER_MS })).toBe(true)
  })
  it('apagado (null) no sale nunca', () => {
    expect(tocaOfrecerlo({ hora: null, ahora: a(23) })).toBe(false)
  })
})

describe('lo que dice: las MISMAS cifras del Inicio, ordenadas', () => {
  const d = {
    cobros: { hoy: 546667, cantidadHoy: 5, ayer: 228400, interesGanadoHoy: 96667, capitalRecuperadoHoy: 450000, sparkline7d: [100, 900000, 50, 0, 0, 228400, 546667] },
    prestamos: { esperadoHoy: 800000, clientesConCobroHoy: 12, clientesCobradosHoy: 5 },
    actividadHoy: { prestamos: { cantidad: 1, monto: 1000000 }, gastos: { cantidad: 2, monto: 31220 }, retiros: { monto: 0 }, inyecciones: { monto: 0 },
      desgloseCobradores: [{ nombre: 'Ana', monto: 400000, pagos: 3 }, { nombre: 'Beto', monto: 146667, pagos: 2 }] },
    clientes: { enMora: 18 }, finanzas: { cajaDisponible: 7664318 },
  }
  const r = armarResumen(d, { nombre: 'Carlos Castro' })

  it('no recalcula nada: copia lo del Inicio', () => {
    expect(r).toMatchObject({ cobrado: 546667, tocaba: 800000, cobros: 5, prestado: 1000000, gastos: 31220, ayer: 228400, enMora: 18, enCaja: 7664318 })
    expect(r.clientesHoy).toBe(12); expect(r.clientesCobrados).toBe(5); expect(r.clientesSinCobrar).toBe(7)
  })
  it('lo cobrado se parte en ganancia y plata que vuelve', () => {
    expect(r.interes + r.capitalDeVuelta).toBe(r.cobrado)
  })
  it('saca las cuentas simples que el dueño haría de cabeza', () => {
    expect(r.avance).toBe(68)
    expect(r.faltoPorCobrar).toBe(253333)
    expect(r.movimientoNeto).toBe(546667 - 1000000 - 31220)
    expect(r.vsAyer).toBe(139)
    expect(r.nombre).toBe('Carlos')
  })
  it('el titular es una frase, y no regaña en un día sin cobro', () => {
    expect(r.titular).toBe('Un día a medias')
    expect(armarResumen({ cobros: { hoy: 0 }, prestamos: { esperadoHoy: 0 } }).titular).toBe('Hoy no se movió plata')
    expect(armarResumen({ cobros: { hoy: 50000 }, prestamos: { esperadoHoy: 0 } }).titular).toBe('Hoy no tocaba cobrarle a nadie')
    expect(armarResumen({ cobros: { hoy: 100 }, prestamos: { esperadoHoy: 100 } }).titular).toBe('Cobraste todo lo que tocaba')
  })
  it('sin datos no revienta ni inventa', () => {
    const v = armarResumen(undefined)
    expect(v).toMatchObject({ cobrado: 0, tocaba: 0, avance: null, vsAyer: null, cobradores: [], semana: [] })
  })
})
