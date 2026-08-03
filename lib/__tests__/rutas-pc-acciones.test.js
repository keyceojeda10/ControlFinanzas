import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Tres fallos de la ruta en ESCRITORIO, reportados por el dueño: «hay opciones
// que no salen o no están bien en PC… los administradores entran, intentan
// gestionar eso y es bastante difícil».
//
// No eran opciones que faltaran: eran opciones VISIBLES QUE NO HACÍAN NADA,
// que es peor. Se comprueba leyendo el archivo porque el fallo no está en la
// lógica sino en DÓNDE se monta cada cosa.
const RUTA = 'app/(dashboard)/rutas/[id]/page.jsx'
const src = readFileSync(resolve(process.cwd(), RUTA), 'utf8')
const lineas = src.split('\n')

// Dónde empieza y acaba la rama que solo existe en móvil.
//
// ⚠ NO vale buscar el primer `</div>` seguido de otro: dentro de la rama hay
// decenas de parejas así y el primer intento cerró la ventana en la línea 2242
// cuando la rama acaba pasada la 3600. Con la ventana corta, la prueba daba
// VERDE contra el código roto — que es lo mismo que no tenerla.
//
// ⚠ CONTAR `</div>` NO FUNCIONA AQUÍ, y perdí tres intentos aprendiéndolo:
//   · la PRIMERA pareja consecutiva cae en un bloque anidado (línea ~2242)
//     -> ventana corta -> la prueba pasaba en VERDE contra el código roto;
//   · el ÚLTIMO `</div>` antes del `</>` se pasa de largo;
//   · la ÚLTIMA pareja consecutiva cae DENTRO del toast que acabo de mover.
//
// El único ancla que no se mueve es el rótulo que separa las dos zonas. Si
// alguien lo borra, la prueba avisa en vez de mentir.
const MARCA = 'LO QUE VALE PARA LAS DOS VISTAS VA AQUI'
const iMovil = lineas.findIndex((l) => l.includes('className="lg:hidden"'))
const iCierre = lineas.findIndex((l) => l.includes(MARCA))

describe('la ruta en escritorio', () => {
  it('la hoja de cobro NO vive dentro del `lg:hidden`', () => {
    // Si se monta ahí, en PC queda dentro de un `display:none` y «Cobrar» en la
    // tabla no abre nada: el handler corre, el estado cambia, y no se ve nada.
    expect(iMovil, 'no se encontró la rama de móvil').toBeGreaterThan(0)
    // Sin el rótulo no hay zona común, y entonces los overlays SIGUEN dentro de
    // la rama de móvil. Sin esta línea la prueba pasaría en verde por no
    // encontrar nada que mirar, que es como no tenerla.
    expect(iCierre, `falta el rótulo «${MARCA}»: los overlays volvieron dentro del lg:hidden`).toBeGreaterThan(iMovil)
    const dentro = lineas
      .map((l, i) => ({ l, i }))
      .filter(({ l, i }) => i > iMovil && i < iCierre && l.trim() === '{hojaCobro}')
    expect(dentro.length, `«{hojaCobro}» dentro de lg:hidden en las líneas ${dentro.map((d) => d.i + 1)}`).toBe(0)
  })

  it('el toast de «Deshacer» tampoco', () => {
    expect(iCierre, `falta el rótulo «${MARCA}»`).toBeGreaterThan(iMovil)
    const dentro = lineas
      .map((l, i) => ({ l, i }))
      .filter(({ l, i }) => i > iMovil && i < iCierre && l.includes('{undoPago && ('))
    expect(dentro.length, 'sin él, en PC no se puede echar atrás un cobro mal hecho').toBe(0)
  })

  it('«Agregar cliente» de PC trae la lista de clientes', () => {
    // `setModalClientes` abre el modal SIN pedir los clientes: salía vacío y
    // decía «Todos los clientes ya tienen ruta asignada», que era mentira.
    const accion = /\{ id: 'agregar'[^}]*\}/.exec(src)
    expect(accion, 'ya no existe la acción «agregar»: revisa este test').toBeTruthy()
    expect(accion[0]).toContain('abrirModalClientes')
    expect(accion[0]).not.toMatch(/setModalClientes\(true\)/)
  })

  it('«Reordenar recorrido» tiene quién lo pinte en PC', () => {
    // El enlace ya existía y llamaba a `setModoVista('ordenar')`, pero la rama
    // de PC solo distinguía 'auditoria': cualquier otro valor pintaba la tabla
    // de siempre. Se pulsaba y no pasaba nada.
    expect(src).toContain("onReordenar={() => setModoVista('ordenar')}")
    expect(src, 'nadie reacciona a `ordenar` en la rama de escritorio')
      .toMatch(/\{modoVista === 'ordenar' && \(\s*\n\s*<div className="hidden lg:block">/)
  })
})
