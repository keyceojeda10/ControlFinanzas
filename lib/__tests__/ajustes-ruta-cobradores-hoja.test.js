/* Los tres ajustes del 2 de septiembre, anclados donde no se puedan deshacer
   sin querer. Anclas en JSX y en la expresión, NO en prosa: este repo cita a
   los clientes en los comentarios, así que buscar una frase suelta encuentra
   el propio comentario y la prueba pasa mirándose al espejo. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const lee = (p) => readFileSync(p, 'utf8')
const RUTA       = lee('app/(dashboard)/rutas/[id]/page.jsx')
const HOJA       = lee('components/cf/HojaInferior.jsx')
const COBRADORES = lee('components/pantallas/Cobradores.jsx')
const GLOBALS    = lee('app/globals.css')
const PRESTAMO   = lee('app/(dashboard)/prestamos/[id]/page.jsx')

describe('la hoja sabe si está en un PC antes de pintarse', () => {
  /* Las hojas que se montan al abrirse —dentro de un `{estado && (…)}`— nacían
     creyendo que eran un teléfono: pegadas abajo y fuera de la pantalla, hasta
     que un efecto las recolocaba. «Se despliega hacia abajo del todo y no se
     alcanza a ver nada.» */
  it('no detecta el ancho en un efecto', () => {
    expect(HOJA).toMatch(/useSyncExternalStore\(suscribirAncho/)
    expect(HOJA, 'volvió el useState(false) + useEffect que causaba el primer cuadro en modo teléfono')
      .not.toMatch(/setAnchaPantalla/)
  })

  it('durante la hidratación sigue diciendo que NO es ancha', () => {
    // Es lo que impedía el desajuste servidor/cliente que tiró el árbol tres veces.
    expect(HOJA).toMatch(/const anchoServidor\s*=\s*\(\)\s*=>\s*false/)
  })
})

describe('un solo botón de volver dentro de una ruta', () => {
  it('la ruta no le pasa su propia miga a RutaEscritorio', () => {
    // `VolverEscritorio` (Armazon) ya pone el suyo encima, y salían los dos.
    expect(RUTA, 'volvieron los dos botones de volver en PC').not.toMatch(/migaVolver=\{/)
  })

  it('el componente sigue admitiendo la miga para quien la necesite', () => {
    expect(COBRADORES).toBeTruthy()
    expect(lee('components/pantallas/RutaEscritorio.jsx')).toMatch(/migaVolver, onVolver/)
  })
})

describe('el cobrador de la ruta se cambia DESDE la ruta', () => {
  it('la acción del buscador abre el selector en vez de mandar a /cobradores', () => {
    const acc = RUTA.slice(RUTA.indexOf("id: 'ruta-cobrador'"))
    const ejecutar = acc.slice(0, acc.indexOf('},'))
    expect(ejecutar).toMatch(/ejecutar:\s*\(\)\s*=>\s*setModalCobrador\(true\)/)
    expect(ejecutar, "volvió a mandar a /cobradores, donde «Asignar» solo sale para los que NO tienen ruta")
      .not.toMatch(/router\.push\('\/cobradores'\)/)
  })

  it('hay un botón visible en el teléfono y otro con rótulo en PC', () => {
    expect(RUTA).toMatch(/aria-label=\{ruta\.cobrador \? 'Cambiar el cobrador de la ruta'/)
    expect(RUTA).toMatch(/texto: ruta\.cobrador \? 'Cambiar cobrador' : 'Asignar cobrador'/)
  })

  it('`cambiarCobrador` ya no es una función huérfana', () => {
    expect(RUTA).toMatch(/await cambiarCobrador\(cobradorId\)/)
  })

  it('se puede dejar la ruta sin nadie', () => {
    expect(RUTA).toMatch(/\{ id: null, nombre: 'Sin cobrador', suelto: true \}/)
    // `|| null` en el cuerpo: sin eso, «sin cobrador» mandaría undefined.
    expect(RUTA).toMatch(/cobradorId: cobradorId \|\| null/)
  })

  it('el modal se cierra con el guardado, no con la recarga de 205 clientes', () => {
    const f = RUTA.slice(RUTA.indexOf('const asignarCobrador'))
    /* ⚠ LAS LÍNEAS QUE SON CÓDIGO, NO EL TEXTO. La primera versión buscaba
       `fetchRuta()` a pelo y lo encontraba en el COMENTARIO de al lado —«lo
       demás lo repone `fetchRuta()`»—, así que fallaba con el código bueno
       puesto. Es la trampa que este fichero advierte arriba, y caí en ella:
       aquí se comparan LÍNEAS ENTERAS, que un comentario no puede imitar. */
    const lineas = f.slice(0, f.indexOf('} catch (e) {')).split('\n').map((l) => l.trim())
    expect(lineas.indexOf('setModalCobrador(false)'))
      .toBeLessThan(lineas.indexOf('fetchRuta()'))
    expect(lineas, 'volvió a esperar a fetchRuta antes de cerrar').not.toContain('await fetchRuta()')
  })
})

describe('«Crear cobrador» no se va bajo el scroll', () => {
  it('el bloque lleva la clase que lo mantiene a la vista', () => {
    expect(COBRADORES).toMatch(/className=\{botonFlotante \? undefined : 'cf-crear-sticky'\}/)
  })

  it('la clase existe y es sticky, no fixed', () => {
    const bloque = GLOBALS.slice(GLOBALS.indexOf('.cf-crear-sticky {'))
    expect(bloque).toMatch(/position:\s*sticky/)
    expect(bloque, 'con `fixed` se ancla al ancestro con transform, no a la pantalla')
      .not.toMatch(/position:\s*fixed/)
  })

  it('en el teléfono se aparta de la pastilla y en PC no, que allí no hay', () => {
    expect(GLOBALS).toMatch(/bottom:\s*calc\(var\(--cf-nav-inset\)/)
    const pc = GLOBALS.slice(GLOBALS.indexOf('@media (min-width: 1024px)', GLOBALS.indexOf('.cf-crear-sticky')))
    expect(pc.slice(0, 90)).toMatch(/\.cf-crear-sticky\s*\{\s*bottom:\s*16px/)
  })
})

describe('«Quiere pagar todo hoy» no se duplica de tamaño al cargar', () => {
  it('el hueco de carga mide lo que va a llegar', () => {
    // Medido en el DOM con los datos puestos: 167 · 201 · 75 · 75.
    const c = PRESTAMO.slice(PRESTAMO.indexOf('{liqCargando && ('))
    const bloque = c.slice(0, 700)
    for (const alto of ['h-[167px]', 'h-[201px]', 'h-[75px]']) {
      expect(bloque).toContain(alto)
    }
    expect(bloque, 'volvió el «Calculando…» de una línea: la hoja abría a 395px y saltaba a 784')
      .not.toMatch(/Calculando/)
  })
})
