// lib/__tests__/titulo-duplicado.test.js
//
// EL TÍTULO LO PONE EL ARMAZÓN, NO LA PÁGINA.
//
// Ya ha aparecido cuatro veces: cobradores, la ficha del préstamo, tutoriales y
// «nuevo socio» dibujaban su propio <h1> DEBAJO del que ya pinta la cabecera —
// el mismo texto dos veces, uno encima de otro. Y no lo cazaba nada: las
// pruebas de estructura miran componentes, no el encabezado de cada página.
//
// La regla es la misma que la del margen doble: si el armazón ya lo pone, la
// página NO. `useCabecera({ titulo })` existe justo para decirlo una sola vez.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { resolverArmazon, CABECERA } from '@/lib/armazon'

function paginas(dir, salida = []) {
  const abs = path.join(process.cwd(), dir)
  if (!fs.existsSync(abs)) return salida
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`
    if (e.isDirectory()) paginas(rel, salida)
    else if (e.name === 'page.jsx') salida.push(rel)
  }
  return salida
}

/** `app/(dashboard)/clientes/nuevo/page.jsx` → `/clientes/nuevo` */
const rutaDe = (f) => '/' + f
  .replace(/^app\/\(dashboard\)\//, '')
  .replace(/\/page\.jsx$/, '')
  .replace(/\[[^\]]+\]/g, 'x')

const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('el título lo pone el armazón, no la página', () => {
  const PAGINAS = paginas('app/(dashboard)')

  it('hay páginas que comprobar', () => {
    expect(PAGINAS.length).toBeGreaterThan(20)
  })

  it('ninguna página con cabecera dibuja además su propio <h1>', () => {
    const rotas = []
    for (const f of PAGINAS) {
      const { cabecera } = resolverArmazon(rutaDe(f))
      // Sin cabecera del armazón, el <h1> propio es lo correcto.
      if (cabecera === CABECERA.NINGUNA) continue
      const src = sinComentarios(fs.readFileSync(path.join(process.cwd(), f), 'utf8'))
      if (/<h1[\s>]/.test(src)) rotas.push(rutaDe(f))
    }
    // La lista de las que YA estaban así antes de existir esta prueba. Se va
    // vaciando; lo que NO puede es crecer. Sin este cerco la prueba nacería en
    // rojo y se acabaría borrando, que es como se pierden las reglas.
    const CONOCIDAS = [
      '/actividad', '/caja/cobrador/x', '/capital', '/carga-masiva',
      '/clavos', '/clientes/x/editar', '/clientes/x/historial',
      '/clientes/nuevo', '/cobradores/x', '/cobradores/x/editar',
      '/cobradores/nuevo', '/cobradores/ranking', '/configuracion/plan',
      '/dashboard/analiticas', '/lineas-credito', '/lineas-credito/nueva',
      '/migrador', '/mis-estadisticas', '/reportes', '/soporte',
      '/soporte/x', '/soporte/nuevo',
    ]
    const nuevas = rotas.filter((r) => !CONOCIDAS.includes(r))
    expect(nuevas).toEqual([])
  })
})
