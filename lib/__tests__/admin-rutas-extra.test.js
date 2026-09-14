// Rutas extra desde el superadmin (14 sep 2026).
//
// «Lo de la ruta se lo aumenta a ese cliente y también déjalo en el superadmin
//  para no tener que pedírtelo a ti, sino ya hacerlo directamente desde el
//  administrador.» — el dueño.
//
// Era el único de los tres cupos —cobradores, clientes, rutas— que no se podía
// dar desde el panel: `rutasExtra` solo subía por el webhook de Wompi al
// comprar una ruta, así que conceder una obligaba a tocar la base a mano y sin
// rastro de quién ni por qué.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { PLANES_CONFIG } from '@/lib/planes'

const leer = (f) => readFileSync(path.join(process.cwd(), f), 'utf8')
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const API   = sinComentarios(leer('app/api/admin/organizaciones/[id]/route.js'))
const FICHA = sinComentarios(leer('app/admin/organizaciones/[id]/page.jsx'))

describe('el cupo de rutas se concede desde el panel', () => {
  it('el API tiene la acción, con su tope y su registro', () => {
    expect(API).toMatch(/accion === 'cambiarRutas'/)
    expect(API).toMatch(/parseInt\(body\.rutasExtra\)/)
    // El tope: por encima, lo que toca es cambiar de plan.
    expect(API).toMatch(/cantidad < 0 \|\| cantidad > 20/)
    expect(API).toMatch(/accion:\s+'cambiar_rutas'/)
    expect(API).toMatch(/data: \{ rutasExtra: cantidad \}/)
  })

  it('queda rastro de quién lo concedió, como en los otros dos cupos', () => {
    for (const a of ['cambiar_rutas', 'cambiar_cobradores', 'cambiar_clientes']) {
      expect(API).toMatch(new RegExp(`accion:\\s+'${a}'`))
    }
  })

  it('la ficha lo enseña y puede contar las rutas creadas', () => {
    expect(FICHA).toMatch(/Rutas extra/)
    expect(FICHA).toMatch(/ejecutarAccion\('cambiarRutas', \{ rutasExtra: val \}\)/)
    /* Sin `rutas` en el `_count` la ficha concede a ciegas: no sabe cuántas
       tiene creadas. Ver [[feedback_verificar_prisma_select]]. */
    expect(API).toMatch(/select: \{ clientes: true, prestamos: true, rutas: true \}/)
    expect(FICHA).toMatch(/org\._count\?\.rutas/)
  })
})

describe('los límites salen de la fuente única', () => {
  it('la ficha NO se copia su propia tabla de planes', () => {
    /* Estaba copiada aquí y ya se había desfasado: decía 150 clientes para
       Inicial cuando la fuente dice 100, así que el panel enseñaba un tope que
       no existe. */
    expect(FICHA).toMatch(/from '@\/lib\/planes'/)
    expect(FICHA, 'volvió la tabla de límites copiada a mano')
      .not.toMatch(/const LIMITES = \{[\s\S]*?starter:/)
  })

  it('y los usa tal cual: el tope de Inicial es el de planes.js', () => {
    expect(PLANES_CONFIG.starter.maxClientes).toBe(100)
    expect(PLANES_CONFIG.starter.maxRutas).toBe(1)
    // El desfase que había: la ficha decía 150.
    expect(FICHA).not.toMatch(/clientes: 150/)
  })

  it('en Inicial y Básico la ruta extra no está a la venta', () => {
    /* Por eso este cupo no es un atajo del checkout: es la ÚNICA forma de que
       una cuenta de plan bajo tenga una segunda ruta. */
    expect(PLANES_CONFIG.starter.rutaExtra).toBe(0)
    expect(PLANES_CONFIG.basic.rutaExtra).toBe(0)
    expect(PLANES_CONFIG.growth.rutaExtra).toBeGreaterThan(0)
  })
})
