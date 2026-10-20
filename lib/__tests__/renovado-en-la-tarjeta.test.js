/* Oscar (CREDITOS E y M, 20 oct 2026): «¿por qué sale así, en dos partes?».
   Renovó a Ospina el 14 oct y el préstamo viejo decía «Pagado», «Ya pagó $0»,
   «terminado 25 oct» —el día en que DEBÍA terminar, aún sin llegar— y
   «Capital afuera $100.000», capital que ya estaba en el préstamo nuevo. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { adaptarPrestamos, fichaDe, cierreDe } from '@/lib/adaptadores/prestamos'

// El préstamo viejo de Ospina, como lo manda la API.
const viejoOspina = {
  id: 'v1', estado: 'completado', montoPrestado: 100000, totalAPagar: 0, totalPagado: 0, saldoPendiente: 0,
  capitalRestante: 100000, cuotaDiaria: 20000, frecuencia: 'mensual', modoInteres: 'solo_interes', tasaInteres: 20,
  fechaInicio: '2026-09-25T05:00:00.000Z', fechaFin: '2026-10-25T05:00:00.000Z', ultimoPagoAt: null,
  renovadoEl: '2026-10-14T12:34:09.024Z', cliente: { nombre: 'Ospina' },
}

describe('un préstamo cerrado por renovación', () => {
  it('dice «Renovado» y el día de la renovación, no el vencimiento', () => {
    const t = adaptarPrestamos([viejoOspina], 'co')[0] ?? adaptarPrestamos([viejoOspina], 'co').filas?.[0]
    expect(t.etiquetaEstado).toBe('Renovado')
    expect(t.piezas.cierre).toBe('renovado')
    expect(t.piezas.terminado).toMatch(/14/)
    expect(t.contexto).toMatch(/renovado 14/)
    expect(t.contexto).not.toMatch(/25 oct/)
    // La tira tampoco: «RENOVADO 14 oct», no «VENCE 25 oct».
    const vence = (t.cifras ?? []).find((c) => /Vence|Renovado/.test(c.etiqueta))
    expect(vence).toMatchObject({ etiqueta: 'Renovado' })
    expect(vence.valor).toMatch(/14/)
  })

  it('su desglose: capital afuera $0 y «Renovado el», sin «Vence»', () => {
    const f = fichaDe(viejoOspina, 'co', { largo: true })
    const de = (r) => f.lineas.find((l) => l.rotulo === r)?.valor
    expect(de('Capital afuera')).toBe('$0')
    expect(de('Renovado el')).toMatch(/14/)
    expect(de('Vence')).toBeUndefined()
  })

  it('un préstamo pagado normal termina el día de su último pago', () => {
    const pagado = { ...viejoOspina, renovadoEl: null, totalAPagar: 120000, totalPagado: 120000, ultimoPagoAt: '2026-10-10T15:00:00.000Z' }
    expect(cierreDe(pagado).como).toBe('terminado')
    const f = fichaDe(pagado, 'co', { largo: true })
    expect(f.etiqueta).toBe('Pagado')
    expect(f.lineas.find((l) => l.rotulo === 'Terminó el')?.valor).toMatch(/10/)
    expect(f.lineas.find((l) => l.rotulo === 'Capital afuera')?.valor).toBe('$0')
  })

  it('un activo no cambia: su capital afuera y su vencimiento', () => {
    const activo = { ...viejoOspina, estado: 'activo', totalAPagar: 240000, saldoPendiente: 240000, renovadoEl: null, capitalRestante: 200000 }
    const f = fichaDe(activo, 'co', { largo: true })
    expect(f.lineas.find((l) => l.rotulo === 'Capital afuera')?.valor).toBe('$200.000')
    expect(f.lineas.find((l) => l.rotulo === 'Vence')?.valor).toMatch(/25/)
  })

  it('las dos listas mandan la fecha de la renovación', () => {
    for (const f of ['app/api/prestamos/route.js', 'app/api/clientes/route.js']) {
      expect(readFileSync(f, 'utf8'), f).toContain('renovadoEl:       renovadoEl.get(p.id) ?? null,')
    }
    expect(readFileSync('components/cf/TarjetaCliente.jsx', 'utf8')).toContain("`${piezas.cierre ?? 'terminado'} ${piezas.terminado}`")
  })
})
