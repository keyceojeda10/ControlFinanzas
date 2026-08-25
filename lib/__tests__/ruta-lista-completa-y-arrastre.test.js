import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ── LA LISTA DE COBROS VUELVE A ENSEÑAR A TODOS, Y SE PUEDE MOVER ───────────
//
// Dos peticiones del dueño sobre la misma pantalla:
//
//   «en esa lista de cobros salían absolutamente todos los clientes
//    enumerados […] ahora están saliendo hasta abajo, sin ninguna numeración,
//    sin ningún dato de sus préstamos, sin ningún contexto, nada»
//
//   «antes estas tarjetas, así estuvieran en el modo de cobro y no en el modo
//    de ordenar, también uno las podía dejar apretadas un ratico y se podían
//    correr […] de pronto están haciendo el cobro y rápidamente necesitan
//    moverla hacia arriba o hacia abajo»

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const pagina  = leer('app/(dashboard)/rutas/[id]/page.jsx')
const tarjeta = leer('components/cf/ParadaDeCobro.jsx')
const hook    = leer('hooks/useArrastreLargo.js')
/* Sin comentarios. Las notas de este archivo NOMBRAN lo que se prohíbe —hace
   falta para explicar el fallo— y una prueba que mire el texto entero se acusa
   a sí misma. Ya pasó dos veces esta tarde. */
const hookCodigo = hook
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')

describe('ya no hay una segunda tarjeta para el fondo de la lista', () => {
  it('`FilaFueraDeParada` se borró, no se dejó sin usar', () => {
    /* Dejarla habría sido tener dos tarjetas para lo mismo, que es como se
       llegó al comprobante arreglado por un camino y roto por el otro,
       reportado dos días seguidos. */
    expect(tarjeta).not.toMatch(/export function FilaFueraDeParada/)
    expect(tarjeta).not.toMatch(/function BotonZona/)
    expect(pagina).not.toMatch(/FilaFueraDeParada/)
  })

  it('y `filaZonaDe` con ella: las frases se componen en un solo sitio', () => {
    const adaptador = leer('lib/adaptadores/ruta.js')
    expect(adaptador).not.toMatch(/export function filaZonaDe/)
    expect(adaptador).toMatch(/export function contextoZona/)
  })

  it('la lista plana pinta TODAS las filas, no solo las visitas', () => {
    expect(pagina).toMatch(/\{filas\.map\(\(f\) => renderCard\(f, \{ actual: f\.id === idActual \}\)\)\}/)
    // Y el fondo de saco se fue con su separador.
    expect(pagina).not.toMatch(/zonaDeAbajo/)
  })

  it('la agrupada usa las MISMAS tarjetas, repartidas', () => {
    expect(pagina).toMatch(/gruposDeRuta\(filas\)\.map\(\(g\) =>/)
  })
})

describe('la tarjeta sabe decir que hoy no toca', () => {
  it('una sola pastilla: la de la zona sustituye a la de los días', () => {
    /* Quien hoy no tiene cobro no lleva atraso del día, y dos pastillas
       seguidas se leen como dos estados distintos de la misma persona. */
    expect(tarjeta).toMatch(/const textoPastilla = contexto \? contexto\.pastilla\?\.texto : etiquetaEstado/)
  })

  it('el botón grande no dice «Cobrar» en los cuatro casos', () => {
    /* Con «Cobrar» siempre, el cobrador le pide la cuota a quien no debe nada.
       Cobrar antes / Cobrar (recuperación) / Prestarle / Sacar de la ruta. */
    expect(tarjeta).toMatch(/\{contexto\?\.accion\?\.texto \?\? 'Cobrar'\}/)
    expect(pagina).toMatch(/onAccion=\{\(\) => \{/)
    // ⚠ Desde el 24 ago sale por `irGuardando`, que guarda el sitio antes de
    //   navegar: el cobrador presta desde el grupo «Listos para prestarles» y
    //   volvía arriba del todo. El destino es el mismo.
    expect(pagina).toMatch(/zona === 'sindeuda'\) irGuardando\([\s\S]{0,90}\/prestamos\/nuevo\?clienteId=/)
    expect(pagina).toMatch(/zona === 'inactivo'\) setConfirmQuitar/)
  })

  it('⚠ y el que no debe nada no enseña un «$0» grande', () => {
    // Un cero de ese tamaño se lee como una cifra averiada, no como «está
    // limpio». El clavo sí enseña cifra: la suya es el saldo, no la cuota.
    expect(tarjeta).toMatch(/contexto\?\.monto === 'ninguno' \? null :/)
  })

  it('el carril lo numera igual, pero con menos peso', () => {
    // Lleva su posición en la ruta —eso es lo que se pidió— sin decir que hay
    // que tocar esa puerta hoy.
    expect(tarjeta).toMatch(/tenue = false/)
    expect(pagina).toMatch(/tenue=\{fila\.zona !== 'hoy'\}/)
  })
})

describe('dejarla apretada un momento y moverla', () => {
  it('un toque no basta: hay que mantener', () => {
    // Por debajo de ~400ms se dispararía con solo tocar para cobrar.
    const ms = Number(hook.match(/const MS_LARGO = (\d+)/)[1])
    expect(ms).toBeGreaterThanOrEqual(400)
  })

  it('y un scroll cancela: mover el dedo antes de tiempo era deslizar', () => {
    expect(hook).toMatch(/const PX_TOLERANCIA = \d+/)
    expect(hook).toMatch(/if \(dx > PX_TOLERANCIA \|\| dy > PX_TOLERANCIA\) cancelar\(\)/)
  })

  it('⚠ frena la página con un `touchmove` NO pasivo', () => {
    /* `touch-action` solo se lee al EMPEZAR el gesto, así que ponerlo a `none`
       cuando ya cumplió el tiempo no hace nada. La única forma de parar la
       página con el dedo apoyado es un listener no pasivo con
       `preventDefault`, y React registra los suyos como pasivos. */
    expect(hook).toMatch(/addEventListener\('touchmove', frenar, \{ passive: false \}\)/)
    expect(hook).toMatch(/removeEventListener\('touchmove', frenar\)/)
  })

  it('⚠ al soltar NO se abre la hoja de cobro', () => {
    /* El `pointerup` dispara el `click` de la tarjeta: el cobrador acabaría con
       el teclado del pago abierto cada vez que mueve a alguien de sitio. */
    expect(hook).toMatch(/onClickCapture:/)
    expect(hook).toMatch(/ultimoArrastre\.current = Date\.now\(\)/)
  })

  it('y el bloqueo no puede quedarse pegado', () => {
    /* Era un interruptor que se apagaba al tragarse el siguiente clic, y eso da
       por hecho que siempre viene un clic detras del arrastre: cuando el
       puntero se movio mucho, el navegador no emite ninguno y la bandera se
       quedaria encendida comiendose el TOQUE SIGUIENTE.

       ⚠ Sin medir. Lo persegui por una prueba mia que buscaba el titulo de otra
       hoja de cobro —el modal de la ruta se llama «Cobrar»— y el toque normal
       nunca dejo de funcionar. Es una decision de forma. */
    expect(hookCodigo).not.toMatch(/bloquearClick/)
    expect(hook).toMatch(/Date\.now\(\) - ultimoArrastre\.current > 400/)
  })

  it('los botones de dentro no arrancan el gesto', () => {
    // Quien aprieta «Cobrar» un segundo de más no quiere mover a nadie.
    expect(hook).toMatch(/closest\?\.\('button, a, input, select, textarea, label'\)/)
  })

  it('⚠ pero `[role="button"]` NO puede estar en esa lista', () => {
    /* La tarjeta ENTERA lleva `role="button"` —se toca para cobrar— así que
       `closest('[role=button]')` encuentra la propia tarjeta y el gesto no
       arranca nunca. Se salía en silencio: sin error y sin nada que mirar.
       Lo cazó la prueba en el espejo, no el código. */
    // Sobre el codigo, no sobre el comentario: la nota de arriba explica el
    // fallo y nombra el selector, y sin quitarla la prueba se acusa a si misma.
    const codigo = hook
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
    expect(codigo).not.toMatch(/closest[\s\S]{0,60}role="button"/)
  })

  it('⚠ el estado lo leen desde un `ref`, no desde el `useState`', () => {
    /* El mismo fallo costó dos reportes en «Ordenar»: los manejadores se crean
       en el render y capturan el valor de ESE momento —`null`—, así que al
       soltar no había nada que reordenar. */
    expect(hook).toMatch(/const gesto = useRef\(null\)/)
    expect(hook).toMatch(/if \(!gesto\.current\)/)
  })

  it('guarda sobre la RUTA ENTERA, no sobre lo que se está viendo', () => {
    /* Con «Solo hoy» puesto, guardar solo los visibles deja a los demás con
       números viejos que ahora chocan: la ruta queda revuelta. Ya pasó.
       `reordenarPorNumero` ya usa `moverParadaEnRuta`, que lo traduce. */
    expect(pagina).toMatch(/onReordenar: reordenarPorNumero/)
    expect(pagina).toMatch(/moverParadaEnRuta\(ruta\?\.clientes \?\? \[\], clientesFiltrados, desde, hasta\)/)
  })

  it('⚠ el hook se llama arriba, nunca dentro del render de la lista', () => {
    /* Es un hook: dentro del `(() => …)()` que pinta la lista, cada rama
       —agrupada, vacía, error— dejaría a React con un número de hooks distinto
       entre renders y la pantalla revienta. */
    const iHook = pagina.indexOf('useArrastreLargo({')
    const iLista = pagina.indexOf('const { filas, visitas } = paradasDeRuta(')
    expect(iHook).toBeGreaterThan(0)
    expect(iHook).toBeLessThan(iLista)
  })

  it('⚠ el `ref` envuelve a las DOS vistas', () => {
    /* El gesto mide las tarjetas buscándolas dentro de ese nodo. Colgado de una
       sola rama, al cambiar de vista dejaría de encontrar nada y no pasaría
       nada al soltar: sin error y sin pista. */
    const i = pagina.indexOf('ref={arrastre.lista}')
    expect(i).toBeGreaterThan(0)
    expect(pagina.indexOf('{vistaPlana ? (', i)).toBeGreaterThan(i)
  })

  it('solo en «Cobros»: en «Ordenar» ya hay un arrastre con asa', () => {
    expect(pagina).toMatch(/activo: modoVista === 'trabajo'/)
  })
})
