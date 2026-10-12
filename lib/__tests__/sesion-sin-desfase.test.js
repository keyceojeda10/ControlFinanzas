// El #418 del Inicio (12 oct 2026): el proveedor de sesión arrancaba en el
// cliente con la sesión de localStorage y en el servidor sin ninguna, y todo lo
// que dependía de la sesión en el primer render pintaba un árbol distinto.
// Ancladas en el código, no en los comentarios (que citan estas mismas frases).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const layout = readFileSync('app/layout.js', 'utf8')
const proveedor = readFileSync('components/providers/SessionProvider.jsx', 'utf8')

describe('la sesión es la misma en el servidor y en el primer render del cliente', () => {
  it('el layout raíz baja la sesión del servidor al proveedor', () => {
    expect(layout).toMatch(/await getServerSession\(authOptions\)/)
    expect(layout).toMatch(/<SessionProvider session=\{session\}>/)
  })
  it('con red y sesión del servidor, el cliente arranca con ESA, no con la guardada', () => {
    const inicial = proveedor.slice(proveedor.indexOf('useState(() => {'), proveedor.indexOf('})', proveedor.indexOf('useState(() => {')))
    expect(inicial).toMatch(/if \(typeof window === 'undefined'\) return session/)
    expect(inicial).toMatch(/if \(navigator\.onLine === false\) return leerSessionCache\(\) \?\? session/)
    expect(inicial.trim().split('\n').at(-1).trim()).toBe('return session')
    expect(proveedor).not.toMatch(/useState\(\(\) => session \|\| leerSessionCache\(\)\)/)
  })
})
