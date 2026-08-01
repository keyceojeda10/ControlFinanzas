import { describe, it, expect } from 'vitest'

// La espina no se puede testear renderizando sin DOM, pero SÍ se puede fijar el
// invariante que la hace fácil de romper: es 1-indexada, igual que el título que
// va siempre a su lado ("Cobro 3 de 11").
//
// Este test lee el propio archivo. Es feo, y es a propósito: el desfase de uno
// no rompe nada visible —la pantalla se ve bien, solo está en el paso
// equivocado— así que necesita algo que grite cuando alguien lo revierta.
import fs from 'node:fs'
import path from 'node:path'

const RUTA = path.join(process.cwd(), 'components/armazon/CabeceraMovil.jsx')
const fuente = fs.readFileSync(RUTA, 'utf8')

describe('EspinaProgreso · el contador es 1-indexado', () => {
  it('no vuelve a comparar el índice crudo contra paso', () => {
    // `i < paso` / `i === paso` es la forma 0-indexada. Con el título 1-indexado
    // al lado, marca siempre un paso de más.
    expect(fuente).not.toMatch(/i\s*<\s*paso/)
    expect(fuente).not.toMatch(/i\s*===\s*paso/)
  })

  it('compara contra el número de paso, no contra el índice', () => {
    expect(fuente).toMatch(/const n = i \+ 1/)
    expect(fuente).toMatch(/n\s*<\s*actual/)
    expect(fuente).toMatch(/n\s*===\s*actual/)
  })

  it('acota el paso al rango válido en vez de dejarlo salirse', () => {
    expect(fuente).toMatch(/Math\.min\(Math\.max\(paso, 1\), total\)/)
  })
})
