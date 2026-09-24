// lib/__tests__/paso-revisar-minors.test.js
//
// M9. Al lado del nombre, PasoRevisar enseñaba la cédula — o el identificador
// generado `SIN-<NOMBRE>` cuando el archivo no traía cédula (la planilla de
// Crossbox nunca trae). A 412 px ese identificador («SIN-ANA-MARIA-DE-LA-HOZ»)
// exprime el nombre a una sílaba por renglón. No se debe enseñar cuando
// empieza con «SIN-»: no es una cédula, es un identificador interno.
//
// Anclado en el JSX (la condición), no en un comentario.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const src = (f) => readFileSync(resolve(process.cwd(), f), 'utf8')

describe('M9: los identificadores generados (SIN-<NOMBRE>) no se enseñan como cédula', () => {
  const comp = src('components/carga-masiva/PasoRevisar.jsx')

  it('la condición que decide mostrar la cédula excluye las que empiezan con SIN-', () => {
    expect(comp).toMatch(/\{cliente\.cedula && !cliente\.cedula\.startsWith\('SIN-'\) && \(/)
  })
})
