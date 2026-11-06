// Prestamos juan, 6 nov 2026: el recordatorio desde la lista de clientes decía «el 8
// de noviembre» y desde la ficha del préstamo «el 6». Quincenal, días 6 y 23.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { generarTextoPlantilla } from '@/lib/whatsapp-plantillas'
import { generarTextoRecordatorio } from '@/lib/whatsapp'
import { proximoCobroDe } from '@/lib/calculos'

// Lo que manda la lista de clientes antes del arreglo: sin días de cobro ni pagos,
// con la fecha ya calculada por el servidor.
const DE_LA_LISTA = {
  estado: 'activo', frecuencia: 'quincenal', modoInteres: 'fijo', montoPrestado: 500_000, totalAPagar: 600_000,
  cuotaDiaria: 300_000, diasPlazo: 30, fechaInicio: '2026-10-09T05:00:00.000Z', fechaFin: '2026-11-06T05:00:00.000Z',
  totalPagado: 300_000, saldoPendiente: 300_000, cuotasPendientes: 1, cuotasAmortizacion: [],
  proximoCobro: '2026-11-06T05:00:00.000Z',
}
const linea = (t) => t.match(/Próximo pago: .*/)?.[0]

describe('el recordatorio usa la fecha que calculó el servidor', () => {
  it('⚠ desde la lista de clientes dice el 6, no el 8', () => {
    const t = generarTextoPlantilla('recordatorio', { cliente: { nombre: 'X' }, prestamo: DE_LA_LISTA, orgNombre: 'N' }, 'x')
    expect(linea(t)).toBe('Próximo pago: el 6 de noviembre')
  })
  it('la vía vieja también', () => {
    expect(generarTextoRecordatorio({ nombre: 'X' }, DE_LA_LISTA, { orgNombre: 'N' })).toContain('6 de noviembre')
  })
  it('la del servidor manda; si no viene o no es fecha, se calcula como antes', () => {
    expect(proximoCobroDe(DE_LA_LISTA).toISOString()).toBe('2026-11-06T05:00:00.000Z')
    expect(proximoCobroDe({ proximoCobro: 'basura' })).toBeNull()
    expect(proximoCobroDe(null)).toBeNull()
  })
  it('la lista de clientes manda el calendario del préstamo', () => {
    const api = readFileSync('app/api/clientes/route.js', 'utf8')
    for (const c of ['diaCobroMes:      p.diaCobroMes,', 'diaCobroMes2:     p.diaCobroMes2,', 'primerCobro:      p.primerCobro,']) expect(api).toContain(c)
  })
})
