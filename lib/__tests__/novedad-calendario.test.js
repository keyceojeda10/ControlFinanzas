/* La novedad del calendario: vence, la ven dueño y cobrador, y su botón lleva a la pantalla. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { NOVEDADES, NOVEDADES_VERSION, novedadVigente } from '@/lib/novedades'

const n = NOVEDADES[0]
const item = n.items[0]

describe('novedad «El calendario de cobros»', () => {
  it('es la última y la ven dueño y cobrador', () => {
    expect(NOVEDADES_VERSION).toBe(30)
    expect(n.version).toBe(30)
    expect(n.soloDueno).toBeFalsy()
    expect(item.titulo).toBe('El calendario de cobros')
  })
  it('⚠ vence: se abre hasta el 8 de noviembre, no después', () => {
    expect(novedadVigente(n, new Date('2026-11-07T04:30:00Z'))).toBe(true)
    expect(novedadVigente(n, new Date('2026-11-09T04:59:00Z'))).toBe(true)
    expect(novedadVigente(n, new Date('2026-11-09T05:00:00Z'))).toBe(false)
  })
  it('⚠ el botón lleva a una pantalla que existe y está protegida', () => {
    expect(item).toMatchObject({ href: '/calendario', accion: 'Ver el calendario' })
    expect(readFileSync('app/(dashboard)/calendario/page.jsx', 'utf8')).toContain('export default function CalendarioPage')
    expect(readFileSync('middleware.js', 'utf8')).toContain("'/calendario',")
  })
  it('⚠ el modal usa ese botón, cierra al ir, y sin href sigue diciendo «Entendido»', () => {
    const m = readFileSync('components/layout/NovedadesModal.jsx', 'utf8')
    expect(m).toContain("accion: primera.accion ?? 'Entendido',")
    expect(m).toContain('onActivar={() => { cerrar(); if (primera.href) router.push(primera.href) }}')
  })
  it('⚠ las instrucciones nombran lo que dicen los menús', () => {
    expect(readFileSync('components/pantallas/PantallaMas.jsx', 'utf8')).toContain("nombre: 'Calendario',")
    expect(readFileSync('components/pantallas/PantallaMas.jsx', 'utf8')).toContain('<Rotulo>Más herramientas</Rotulo>')
    const barra = readFileSync('components/armazon/BarraLateral.jsx', 'utf8')
    expect(barra).toContain("{ href: '/calendario',           nombre: 'Calendario' },")
    expect(barra).toContain('titulo="Más herramientas"')
    const dice = item.partes.map((p) => p.texto).join(' ')
    expect(dice).toContain('Más → Calendario')
    expect(dice).toContain('Más herramientas → Calendario')
  })
})
