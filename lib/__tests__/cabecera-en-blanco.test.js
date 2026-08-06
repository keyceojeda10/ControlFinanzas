import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { resolverArmazon, CABECERA } from '@/lib/armazon'

// ── LA CABECERA ESTÁ, PERO NO DICE NADA ─────────────────────────────────────
//
// El dueño lo precisó cuando yo daba las pantallas por buenas:
//
//   «puede que sí tenga cabecera, a lo que me refiero es que algunas no tienen
//    contenido, o sea tienen cabecera pero en blanco sin texto»
//
// Tenía razón, y mi comprobación anterior era la equivocada: medía «¿existe un
// <header>?» en vez de «¿dice algo?». Barrido de las 33 pantallas de
// `app/(dashboard)` midiendo el TEXTO de dentro: una salía literalmente en
// blanco, y era `/prestamos/nuevo` — la pantalla con la que se crea un préstamo.
//
// Su variante es `TAREA`, que acepta `titulo`, `paso` y `total` y pinta una
// espina de progreso. Los tres datos YA existían en la pantalla (`paso` y
// `PASOS`); simplemente nadie se los pasaba al hook. Es el mismo patrón que el
// selector de cuenta al renovar: la pieza montada y sin alimentar.

describe('crear préstamo ya no tiene la cabecera en blanco', () => {
  const src = readFileSync(resolve(process.cwd(), 'app/(dashboard)/prestamos/nuevo/page.jsx'), 'utf8')

  it('llama al hook', () => {
    expect(src, 'volvió a quedarse sin cabecera').toMatch(/^ {2}useCabecera\(\{/m)
    expect(src).toMatch(/import \{ useCabecera \}/)
  })

  it('el título dice EN QUÉ PASO se está', () => {
    // La espina ya cuenta cuántos van; lo que le falta al que teclea es saber
    // qué le están preguntando.
    expect(src).toMatch(/titulo: PASOS\[paso\]\?\.label/)
  })

  it('y alimenta la espina de progreso', () => {
    // `paso` y `total` existían en el hook desde el principio y NINGUNA pantalla
    // los pasaba: la espina estaba construida y muerta.
    expect(src).toMatch(/paso: paso \+ 1/)
    expect(src).toMatch(/total: PASOS\.length/)
  })

  it('su variante sigue siendo TAREA: salirse a medias pierde lo tecleado', () => {
    expect(resolverArmazon('/prestamos/nuevo').cabecera).toBe(CABECERA.TAREA)
  })
})

describe('el conteo de líneas de crédito subió a la cabecera', () => {
  const src = readFileSync(resolve(process.cwd(), 'app/(dashboard)/lineas-credito/page.jsx'), 'utf8')

  it('la cabecera lleva el conteo', () => {
    /* Iba en un renglón suelto DENTRO de la pantalla, con un comentario que
       decía «es lo único que la cabecera no puede saber». Sí puede: el hook se
       llama dentro del componente, con los datos a mano. */
    expect(src).toMatch(/subtitulo: lineas\.length/)
    expect(src).toMatch(/saldo \$\{formatMoney\(totalSaldo\)\}/)
  })

  it('y ya no se repite dentro de la pantalla', () => {
    const codigo = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('{/*')).join('\n')
    expect(codigo, 'el conteo salía dos veces en la misma pantalla')
      .not.toMatch(/Saldo total \{formatMoney\(totalSaldo\)\}/)
  })
})

describe('sin subtítulo la cabecera no queda coja', () => {
  it('el título se centra solo', () => {
    /* Cuatro pantallas —analíticas, mi plan, mi resumen, configuración— no
       tienen un dato que añadir, y eso está BIEN: un subtítulo de relleno es
       peor que ninguno («un número inventado es peor que un hueco»).

       Lo que importa es que la cabecera no se vea coja: el contenedor centra
       verticalmente, así que sin subtítulo el título queda en medio de los
       56px, no arriba con un hueco debajo. */
    const cab = readFileSync(resolve(process.cwd(), 'components/armazon/CabeceraMovil.jsx'), 'utf8')
    expect(cab).toMatch(/flexDirection: 'column', justifyContent: 'center'/)
    expect(cab).toMatch(/\{subtitulo && \(/)
  })
})
