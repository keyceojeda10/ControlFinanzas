// Mover a mano en la ruta (19 nov 2026, decisión del dueño): el cobrador mueve
// al instante, pero antes de su primer movimiento del día se guarda el orden y
// se avisa al dueño UNA vez; el dueño puede volver con «Orden anterior».
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { inicioDelDiaBogota } from '../rutas/orden-de-ruta'

const api = readFileSync('app/api/rutas/[id]/reordenar/route.js', 'utf8')
const lib = readFileSync('lib/rutas/orden-de-ruta.js', 'utf8')

describe('mover a mano, con vuelta atrás', () => {
  it('solo el cobrador guarda respaldo y avisa, y ANTES de aplicar el movimiento', () => {
    const i = api.indexOf("if (rol === 'cobrador') {\n    const r = await guardarAntesDeMoverAMano(")
    expect(i).toBeGreaterThan(0)
    expect(i).toBeLessThan(api.indexOf('// Actualizar orden en una transacción'))
    expect(api).toMatch(/if \(r\?\.primeroDelDia\) \{\s*notificar\(/)
  })
  it('un respaldo por cobrador, ruta y día de Bogotá', () => {
    expect(lib).toMatch(/clase: 'anterior', pedidoPorId: userId, createdAt: \{ gte: inicioDelDiaBogota\(ahora\) \}/)
    // 19 nov 2026 a las 2 a. m. UTC todavía es 18 nov en Bogotá.
    expect(inicioDelDiaBogota(new Date('2026-11-19T02:00:00Z')).toISOString()).toBe('2026-11-18T05:00:00.000Z')
    expect(inicioDelDiaBogota(new Date('2026-11-19T15:00:00Z')).toISOString()).toBe('2026-11-19T05:00:00.000Z')
  })
  it('si el respaldo falla, el movimiento sigue', () => {
    expect(api).toMatch(/guardarAntesDeMoverAMano\([^)]*\)\.catch\(\(\) => null\)/)
  })
  it('«Orden anterior» dice quién la cambió', () => {
    expect(lib).toMatch(/anteriorPor: autorAnterior\?\.rol === 'cobrador' \? autorAnterior\.nombre : null/)
  })
})
