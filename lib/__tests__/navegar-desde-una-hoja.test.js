/**
 * NAVEGAR DESDE UNA HOJA NO ES «CERRARLA Y EMPUJAR».
 *
 * El dueño, 9 sep 2026, sobre los tres accesos de «Tu cuenta» —Configuración,
 * Plan y pagos, Soporte—:
 *
 *   «esos botones no están sirviendo, al darle no pasa nada y nos saca de ese
 *    menú, que es el que se abre al darle al icono de perfil»
 *
 * La causa no era el botón. `HojaInferior` mete una entrada en el historial al
 * abrirse y la retira con un `history.back()` diferido un tick al cerrarse la
 * última hoja. En App Router `router.push` NO toca el historial en el acto
 * —pide antes el contenido de la página—, así que a los 0 ms la entrada de
 * arriba sigue siendo la de la hoja, la guarda de `history.state.cfHoja` la da
 * por buena, y el `back()` llega en mitad de la transición y la aborta.
 *
 * Medido en el espejo con el historial instrumentado: tras tocar
 * «Configuración» el registro era `pushState cfHoja` · `back()` · `popstate`,
 * y NI UN SOLO `pushState` de Next. La navegación no se deshacía: no llegaba a
 * empezar. Tras el arreglo los tres van a su pantalla y el «atrás» del teléfono
 * devuelve al dashboard de un toque.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('la salida está en un solo sitio', () => {
  it('`salirDeHojaHacia` reemplaza en vez de empujar', () => {
    const src = leer('components/cf/HojaInferior.jsx')
    expect(src).toMatch(/export function salirDeHojaHacia\(router, ruta\)/)
    // Reemplazar: la entrada de la hoja no es una página, es un marcador, y la
    // página destino ocupa su sitio. Con `push` quedaría debajo y el «Volver»
    // de la pantalla nueva se la comería sin moverse.
    expect(src).toMatch(/router\.replace\(ruta\)/)
    // Y cancela la retirada, que es lo que abortaba la navegación.
    expect(src).toMatch(/clearTimeout\(retiradaPendiente\)\s*\n\s*entradaViva = false/)
  })
})

describe('⚠ nadie cierra una hoja y empuja en el mismo gesto', () => {
  const SITIOS = [
    'components/armazon/Armazon.jsx',
    'app/(dashboard)/rutas/page.jsx',
  ]

  it('los tres accesos de «Tu cuenta» salen por la función, no por push', () => {
    const src = leer('components/armazon/Armazon.jsx')
    for (const ruta of ['/configuracion', '/configuracion/plan', '/soporte']) {
      expect(src, `${ruta} volvió a router.push`).toContain(`salirDeHojaHacia(router, '${ruta}')`)
    }
    expect(src).not.toMatch(/setCuenta\(false\); router\.push/)
  })

  it('y la ruta recién creada también', () => {
    const src = leer('app/(dashboard)/rutas/page.jsx')
    expect(src).toMatch(/salirDeHojaHacia\(router, `\/rutas\/\$\{data\.id\}`\)/)
    expect(src).not.toMatch(/setShowForm\(false\)\s*\n\s*router\.push/)
  })

  it('ninguno de esos archivos cierra una hoja y empuja en la misma línea', () => {
    /* El patrón exacto que falla: apagar el estado que sostiene la HOJA y
       empujar acto seguido.

       ⚠ Solo cuenta si lo que se cierra es una hoja. La primera versión de esta
       prueba marcó `setMenuCrear(false); router.push(destino)` en el mismo
       archivo, y ESE está bien: `MenuCrear` es un `<div>` fijo, no una
       `HojaInferior`, así que no mete entrada en el historial y no hay `back()`
       que aborte nada. Comprobado en el espejo: el + lleva a /clientes/nuevo.
       Marcarlo habría hecho «arreglar» algo que funciona. */
    const malos = []
    for (const p of SITIOS) {
      const src = leer(p)
      // Los estados que de verdad sostienen una hoja, leídos del propio archivo.
      const deHoja = [...src.matchAll(/<HojaInferior[\s\S]{0,200}?abierta=\{(\w+)\}/g)].map((m) => m[1])
      const deCuenta = /<HojaCuenta[\s\S]{0,120}?abierta=\{(\w+)\}/.exec(src)
      if (deCuenta) deHoja.push(deCuenta[1])
      for (const m of src.matchAll(/set(\w+)\(false\);?\s*router\.push\(/g)) {
        const estado = m[1][0].toLowerCase() + m[1].slice(1)
        if (deHoja.includes(estado)) malos.push(`${p}: cierra «${estado}», que es una hoja, y hace push`)
      }
    }
    expect(malos, malos.join('\n')).toEqual([])
  })
})
