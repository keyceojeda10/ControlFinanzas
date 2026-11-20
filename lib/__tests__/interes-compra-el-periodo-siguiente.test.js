// EL TIEMPO QUE COMPRA EL INTERÉS (19 nov 2026). Ver lib/dinero/tiempo-comprado.js.
//
// Dos fallos del modelo viejo (una sola fecha en `proximoCobroManual`):
//  · Vladimir (Leyder) pagó el interés el 3 y el 19 nov y los dos aplazaron al
//    14 nov: seguía en «Cobros de hoy» con 5 días de atraso.
//  · Jhon Jairo (Prestamos juan) compró tres semanas con interés y siguió pagando
//    sus cuotas a tiempo; cada cuota normal borraba la fecha y salía 3 atrás.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { conTiempoComprado } from '@/lib/dinero/tiempo-comprado'
import { tablaDe } from '@/lib/dinero/tabla'
import {
  calcularMontoEnMora, calcularMontoParaPonerseAlDia, calcularDiasMora, calcularProximoCobro,
  calcularSaldoPendiente, calcularCuotasEnMora,
} from '@/lib/calculos'

const d = (s) => new Date(`${s}T05:00:00.000Z`)
const d10 = (x) => x.toISOString().slice(0, 10)
afterEach(() => vi.useRealTimers())
const el = (s) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(`${s}T23:00:00Z`)) }

// $150.000 «De una vez», vencía el 30 oct; dos intereses de $85.100 que compraron período.
const vladimir = (comprados = 2) => ({
  estado: 'activo', modoInteres: 'unico', frecuencia: 'quincenal',
  montoPrestado: 150000, tasaInteres: 56.7, totalAPagar: 235100 + 85100 * 2, cuotaDiaria: 235100, diasPlazo: 15,
  fechaInicio: d('2026-10-15'), fechaFin: d('2026-10-30'), totalPagado: 170200,
  periodosComprados: comprados, interesComprado: 85100 * comprados,
  pagos: [
    { tipo: 'intereses', montoPagado: 85100, fechaPago: d('2026-11-03'), compraPeriodo: comprados >= 1 },
    { tipo: 'intereses', montoPagado: 85100, fechaPago: d('2026-11-19'), compraPeriodo: comprados >= 2 },
  ],
})

// Semanal de los miércoles, 8 cuotas de $175.000; 3 intereses de $35.000 que
// compraron semana y 4 cuotas pagadas.
const jhonJairo = (comprados = 3) => ({
  estado: 'activo', modoInteres: 'fijo', frecuencia: 'semanal', diaCobroSemana: 3,
  montoPrestado: 1000000, totalAPagar: 1400000 + 105000, cuotaDiaria: 175000, diasPlazo: 56,
  fechaInicio: d('2026-09-30'), fechaFin: d('2026-11-25'), totalPagado: 700000 + 105000,
  periodosComprados: comprados, interesComprado: 35000 * comprados, pagos: [],
})

describe('conTiempoComprado', () => {
  it('sin períodos comprados devuelve el MISMO objeto', () => {
    const p = { fechaInicio: d('2026-10-01'), periodosComprados: 0 }
    expect(conTiempoComprado(p)).toBe(p)
    expect(conTiempoComprado(undefined)).toBe(undefined)
  })

  it('corre el calendario y aparta el interés sin cambiar el saldo', () => {
    const c = conTiempoComprado(vladimir())
    expect(d10(c.fechaInicio)).toBe('2026-11-14')
    expect(d10(c.fechaFin)).toBe('2026-11-29')
    expect(c.totalAPagar).toBe(235100)
    expect(c.totalPagado).toBe(0)
    expect(calcularSaldoPendiente(c)).toBe(calcularSaldoPendiente(vladimir()))
    expect(conTiempoComprado(c)).toBe(c) // idempotente
  })
})

describe('⚠ Vladimir: el segundo interés compra la quincena SIGUIENTE', () => {
  it('el 19 nov: próximo cobro 29 nov, nada atrasado', () => {
    el('2026-11-19')
    const p = vladimir()
    expect(d10(calcularProximoCobro(p))).toBe('2026-11-29')
    expect(calcularDiasMora(p)).toBe(0)
    expect(calcularMontoEnMora(p)).toBe(0)
    expect(calcularMontoParaPonerseAlDia(p)).toBe(0)
  })

  it('la tabla dice UNA cuota de $235.100 el 29 nov, no $405.300', () => {
    const t = tablaDe(vladimir())
    expect(t).toHaveLength(1)
    expect(d10(new Date(t[0].fechaEsperada))).toBe('2026-11-29')
    expect(t[0].cuotaTotal).toBe(235100)
  })

  it('pasado el 29 sin pagar vuelve a deber la cuota', () => {
    el('2026-12-01')
    const p = vladimir()
    expect(calcularDiasMora(p)).toBe(2)
    expect(calcularMontoEnMora(p)).toBe(235100)
  })
})

describe('⚠ Jhon Jairo: una cuota normal NO borra el tiempo comprado', () => {
  it('con 3 semanas compradas y 4 cuotas pagadas está al día el 19 nov', () => {
    el('2026-11-19')
    const p = jhonJairo()
    expect(calcularDiasMora(p)).toBe(0)
    expect(calcularCuotasEnMora(p)).toBe(0)
    expect(calcularMontoEnMora(p)).toBe(0)
    expect(d10(calcularProximoCobro(p))).toBe('2026-11-25')
  })

  it('sin el tiempo comprado (el modelo viejo tras la cuota) salía atrasado', () => {
    el('2026-11-19')
    expect(calcularDiasMora(jhonJairo(0))).toBeGreaterThan(0)
  })
})

describe('el cableado', () => {
  const leer = (r) => readFileSync(r, 'utf8')
  it('el pago marca `compraPeriodo` y ya no guarda una fecha comprada', () => {
    const src = leer('app/api/prestamos/[id]/pagos/route.js')
    expect(src).toMatch(/compraPeriodo,\n\s*\},\n\s*\}\)/)
    expect(src).not.toMatch(/proximoCobroPorInteres:\s*true/)
  })

  it('refrescarTotalesPrestamo cuenta los períodos desde los pagos marcados', () => {
    const src = leer('lib/prisma-pago-helpers.js')
    expect(src).toMatch(/where: \{ prestamoId, compraPeriodo: true \}/)
    expect(src).toMatch(/periodosComprados: aggComprado\._count\?\._all \?\? 0/)
  })

  it('⚠ todo select que pide proximoCobroManual pide también los períodos comprados', () => {
    const archivos = []
    const recorrer = (dir) => {
      for (const n of readdirSync(dir)) {
        const r = join(dir, n)
        if (n === 'node_modules' || n === '__tests__' || n.startsWith('.')) continue
        if (statSync(r).isDirectory()) recorrer(r)
        else if (/\.js$/.test(n)) archivos.push(r)
      }
    }
    recorrer('app'); recorrer('lib')
    const faltan = archivos.filter((f) => {
      const src = leer(f)
      return /proximoCobroManual: true/.test(src) && !/periodosComprados: true/.test(src)
    })
    expect(faltan).toEqual([])
  })
})
