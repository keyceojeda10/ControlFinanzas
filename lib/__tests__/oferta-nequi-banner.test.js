// El 35 % por Nequi también dentro de la app (12 oct 2026): ver OfertaNequiBanner.jsx.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { debeVerseOfertaNequi } from '@/lib/oferta-nequi-aviso'
import { pesoDe } from '@/lib/adaptadores/avisos'

const base = { ofertaNequi: 35, tipo: 'unico', fechaVencimiento: '2026-10-24T12:00:00Z', diasRestantes: 12 }

describe('debeVerseOfertaNequi', () => {
  it('al dueño con la oferta esperando y pago a mano: sí', () => expect(debeVerseOfertaNequi(base, { rol: 'owner' })).toBe(true))
  it('al cobrador: no', () => expect(debeVerseOfertaNequi(base, { rol: 'cobrador' })).toBe(false))
  it('sin oferta: no', () => expect(debeVerseOfertaNequi({ ...base, ofertaNequi: null }, { rol: 'owner' })).toBe(false))
  it('con el cobro automático ya puesto: no', () => {
    expect(debeVerseOfertaNequi({ ...base, cobroAutomatico: { activo: true } }, { rol: 'owner' })).toBe(false)
    expect(debeVerseOfertaNequi({ ...base, tipo: 'recurrente', mpStatus: 'authorized' }, { rol: 'owner' })).toBe(false)
  })
  it('cerrado hace poco: no; pasados los días, vuelve', () => {
    const ahora = Date.now()
    expect(debeVerseOfertaNequi(base, { rol: 'owner', cerradoHasta: ahora + 1000, ahora })).toBe(false)
    expect(debeVerseOfertaNequi(base, { rol: 'owner', cerradoHasta: ahora - 1000, ahora })).toBe(true)
  })
})

describe('no repite la franja de vencimiento', () => {
  it('a 3 días o menos lo dice la franja de «tu plan vence», con la oferta dentro', () => {
    expect(debeVerseOfertaNequi({ ...base, diasRestantes: 2 }, { rol: 'owner' })).toBe(false)
    expect(debeVerseOfertaNequi({ ...base, diasRestantes: 4 }, { rol: 'owner' })).toBe(true)
  })
})

describe('va en la pila de avisos', () => {
  it('montado en el layout y con prioridad de «caduca»', () => {
    expect(readFileSync('app/(dashboard)/layout.jsx', 'utf8')).toMatch(/<Ranura id="ofertaNequi"><OfertaNequiBanner \/><\/Ranura>/)
    expect(pesoDe('ofertaNequi')).toBe(2)
  })
  it('el botón abre la hoja para guardar el Nequi', () => {
    expect(readFileSync('components/layout/OfertaNequiBanner.jsx', 'utf8')).toMatch(/href="\/configuracion\/plan\?suscribir=1"/)
  })
})
