import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── SEIS FICHAS DE DETALLE CON LA CABECERA VACÍA ────────────────────────────
//
// El dueño lo reportó con un ejemplo: «cuando se entra al detalle de un
// préstamo, la cabecera incluye el nombre del cliente y otros datos. Cuando se
// entra al detalle de un cliente, que usa una estructura equivalente, la
// cabecera únicamente muestra el botón de regresar y queda vacía. Ese tipo de
// diferencias generan la sensación de que son dos aplicaciones distintas».
//
// Tenía razón, y era peor de lo que se veía. Barrido de las 46 pantallas de
// `app/(dashboard)/`: 17 no llamaban a `useCabecera`, y SEIS de ellas eran
// fichas de detalle. Además:
//
//   · `VolverEscritorio` hace `if (!de?.titulo) return null` — o sea que sin
//     cabecera esas pantallas TAMPOCO tenían botón de volver en PC.
//   · Había seis cabeceras hechas a mano, con títulos a 15, 18, 21, 22 y 25px
//     contra los 17px que fija `11-ESCALAS §1B`.
//
// La regla: una ficha de detalle SIEMPRE lleva cabecera del sistema, con el
// nombre del objeto (17px) y una línea de contexto separada por `·` (11px).

const DETALLES = [
  ['clientes/[id]', 'cliente?.nombre'],
  ['prestamos/[id]', 'prestamo?.cliente?.nombre'],
  ['rutas/[id]', 'ruta?.nombre'],
  ['cobradores/[id]', 'data?.nombre'],
  ['soporte/[id]', 'ticket?.asunto'],
  ['lineas-credito/[id]', 'linea?.cliente?.nombre'],
]

describe('toda ficha de detalle tiene cabecera del sistema', () => {
  for (const [ruta, titulo] of DETALLES) {
    const src = readFileSync(resolve(process.cwd(), `app/(dashboard)/${ruta}/page.jsx`), 'utf8')

    it(`${ruta} la llama`, () => {
      expect(src, `${ruta} volvió a quedarse sin cabecera`).toMatch(/^ {2}useCabecera\(\{/m)
    })

    it(`${ruta} la importa`, () => {
      // Un hook sin importar pasa el build y revienta al abrir la pantalla: ya
      // pasó en este proyecto con `formatFechaCalendario` y con `useMemo`.
      expect(src).toMatch(/import \{ useCabecera \}/)
    })

    it(`${ruta} pone el nombre del objeto como título`, () => {
      expect(src).toContain(`titulo: ${titulo}`)
    })

    it(`${ruta} lleva subtítulo, no solo título`, () => {
      // Sin subtítulo la cabecera dice menos que la del préstamo, que era la
      // queja original.
      const bloque = src.slice(src.indexOf('useCabecera({'))
      expect(bloque.slice(0, 900)).toMatch(/subtitulo:/)
    })
  }
})

describe('las cabeceras hechas a mano se retiraron', () => {
  it('rutas ya no pinta su propio título a 21px', () => {
    // Era una copia divergente de `CabeceraMovil.Detalle`: mismo tipo de letra,
    // mismo letter-spacing, pero 21px de título y 12 de subtítulo.
    const src = readFileSync(resolve(process.cwd(), 'app/(dashboard)/rutas/[id]/page.jsx'), 'utf8')
    expect(src, 'volvió la cabecera a mano').not.toMatch(/fontSize: 21, fontWeight: 600/)
  })

  it('…pero conserva la EDICIÓN del nombre', () => {
    /* ⚠ Lo que se retiró es el título duplicado, no la función. El campo de
       edición y sus botones siguen; el lápiz que la abre se pasó a `acciones`
       de la cabecera, que es su sitio.

       Rediseñar no puede llevarse una función por delante: ya pasó en este
       proyecto con el «modo abreviado», y el cobrador creyó que se le había
       desactivado solo. */
    const src = readFileSync(resolve(process.cwd(), 'app/(dashboard)/rutas/[id]/page.jsx'), 'utf8')
    expect(src, 'se perdió el poder renombrar la ruta').toMatch(/setEditandoNombre\(true\)/)
    // El lápiz pasó a decir «Editar la ruta» el 2 sep: edita también el cobrador.
    expect(src).toMatch(/aria-label="Editar la ruta"/)
    expect(src).toMatch(/acciones: accionesCabecera/)
  })

  it('y el lápiz va memoizado', () => {
    // `acciones` NO entra en la clave de re-suscripción del hook: sin memoizar,
    // se re-registra en cada render. Lo pide el docblock de `useCabecera`.
    const src = readFileSync(resolve(process.cwd(), 'app/(dashboard)/rutas/[id]/page.jsx'), 'utf8')
    expect(src).toMatch(/const accionesCabecera = useMemo\(/)
    expect(src, 'useMemo sin importar: revienta al abrir la pantalla')
      .toMatch(/import \{[^}]*useMemo[^}]*\} from 'react'/)
  })

  it('soporte ya no repite el asunto a 25px dentro de una tarjeta', () => {
    // Era el título más grande de la app, y además repetía lo que ahora dice la
    // cabecera: el mismo dato en dos elementos de la misma pantalla.
    const src = readFileSync(resolve(process.cwd(), 'app/(dashboard)/soporte/[id]/page.jsx'), 'utf8')
    expect(src).not.toMatch(/text-\[25px\]/)
  })
})
