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

describe('el cobrador de la ruta se cambia DESDE la ruta, en el lápiz', () => {
  /* Por la mañana fue un icono propio —una persona con «+»— y su modal. El
     dueño lo leyó como «agregar clientes», y pidió el cobrador en el lápiz,
     con el nombre. Así quedó. */
  it('la acción del buscador abre el editor en vez de mandar a /cobradores', () => {
    const acc = RUTA.slice(RUTA.indexOf("id: 'ruta-cobrador'"))
    const ejecutar = acc.slice(0, acc.indexOf('},'))
    expect(ejecutar).toMatch(/ejecutar:\s*\(\)\s*=>\s*abrirEditarRuta\(\)/)
    expect(ejecutar, "volvió a mandar a /cobradores, donde «Asignar» solo sale para los que NO tienen ruta")
      .not.toMatch(/router\.push\('\/cobradores'\)/)
  })

  it('el lápiz edita nombre Y cobrador; la persona con «+» agrega clientes', () => {
    expect(RUTA).toMatch(/aria-label="Editar la ruta"/)
    expect(RUTA).toMatch(/onClick=\{\(\) => abrirEditarRuta\(\)\}/)
    expect(RUTA).toMatch(/aria-label="Agregar cliente a la ruta"/)
    expect(RUTA).toMatch(/onClick=\{\(\) => abrirModalClientes\(\)\}/)
    // y en PC, con rótulo
    expect(RUTA).toMatch(/texto: ruta\.cobrador \? 'Cambiar cobrador' : 'Asignar cobrador'/)
  })

  it('el cobrador solo viaja al API si cambió: un renombre no choca con el 409 del cierre', () => {
    expect(RUTA).toMatch(/cambiaCobrador \? \{ cobradorId: nuevoCobradorId \|\| null \} : \{\}/)
  })

  it('se puede dejar la ruta sin nadie', () => {
    expect(RUTA).toMatch(/\{ id: null, nombre: 'Sin cobrador', suelto: true \}/)
  })

  it('el modal se cierra con el guardado, no con la recarga de 205 clientes', () => {
    const f = RUTA.slice(RUTA.indexOf('const guardarRuta'))
    /* Líneas ENTERAS, que un comentario no puede imitar: la primera versión
       buscaba `fetchRuta()` a pelo y lo encontraba en el comentario de al lado. */
    const lineas = f.slice(0, f.indexOf('} catch (e) {')).split('\n').map((l) => l.trim())
    expect(lineas.indexOf('setEditandoNombre(false)')).toBeLessThan(lineas.indexOf('fetchRuta()'))
    expect(lineas, 'volvió a esperar a fetchRuta antes de cerrar').not.toContain('await fetchRuta()')
  })

  it('la copia en caché solo se pinta antes del primer pintado', () => {
    // Se leía en cada recarga y pisaba lo recién guardado con lo de antes.
    expect(RUTA).toMatch(/if \(!yaPintadaRef\.current\) \{\s*\n\s*try \{\s*\n\s*const cached = await leerDeCache/)
    expect(RUTA).toMatch(/setRuta\(data\)\s*\n\s*yaPintadaRef\.current = true/)
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
