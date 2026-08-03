// El tablero del cobrador: los cuadros del día NO desaparecen en cero.
//
// ── POR QUÉ EXISTE ESTA PRUEBA ─────────────────────────────────────────────
//
// Yo metí un filtro que sacaba de la lista todo lo que estuviera en cero y lo
// resumía en una línea gris al pie: «Hoy no hubo préstamos nuevos,
// renovaciones, clientes nuevos...». Razonaba que cinco recuadros diciendo «no
// pasó nada» son ruido.
//
// El cliente con MÁS COBRADORES de la plataforma lo reportó en video: «al
// actualizarse la caja yo pierdo la información que tenía: los cuadritos donde
// me mostraba cantidad de clientes activos, los clientes que renovaba, los
// clientes nuevos. Eso ya no me aparece y necesito que me aparezca».
//
// Dos cosas que no vi:
//   1. Optimicé para el día lleno y rompí el VACÍO. Él abre la caja a las 8 de
//      la mañana, cuando todo está en cero por definición, y justo ahí la
//      sección entera desaparecía.
//   2. «0 clientes nuevos» SIGNIFICA algo —hoy no entró nadie— y no es lo mismo
//      que no saberlo.
//
// Esto vigila que no vuelva a pasar. Es una prueba de TEXTO porque lo que se
// rompió no fue una cuenta, fue una decisión de qué se pinta.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const comp = readFileSync(
  join(process.cwd(), 'components/caja/CajaCobradorDetalle.jsx'), 'utf8')
const api = readFileSync(
  join(process.cwd(), 'app/api/caja/cobrador/[id]/route.js'), 'utf8')
// Sin comentarios: aquí se juzga el código, no lo que explican los comentarios
// (que precisamente hablan del filtro viejo para que no se repita).
const cuerpo = comp.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('lo que hizo hoy se pinta entero, también en cero', () => {
  it('no vuelve el filtro que escondía los ceros', () => {
    // `hizoConAlgo` / `hizoEnCero` eran las dos mitades del filtro.
    expect(cuerpo).not.toMatch(/hizoConAlgo|hizoEnCero/)
  })

  it('no vuelve la línea «Hoy no hubo …» que los resumía', () => {
    expect(cuerpo).not.toMatch(/Hoy no hubo/)
  })

  it('la lista se pinta desde TODAS las filas, sin filtrar', () => {
    // Se recorre `hizoTodo` tal cual: si alguien mete un `.filter(` en medio,
    // esto no lo caza — pero sí caza que se deje de recorrer la lista entera.
    expect(cuerpo).toMatch(/hizoTodo\.map\(/)
  })

  it('el cero se apaga con tinta clara, no se borra', () => {
    // La marca de que el cero SIGUE en pantalla pero sin competir.
    expect(cuerpo).toMatch(/enCero\(h\)\s*\?\s*'var\(--cf-ink-3\)'/)
  })
})

describe('la cartera no depende de que hoy haya pasado algo', () => {
  it('«Clientes activos» tiene su propio cuadro', () => {
    // Estaba metido en una frase de apoyo («0 de 145 clientes le pagaron»), y
    // es lo PRIMERO que nombró el cliente en el video. No es actividad del día.
    expect(cuerpo).toMatch(/Clientes activos/)
    expect(cuerpo).toMatch(/clientesActivos/)
  })

  it('«Cobros hoy» va al lado, que es la pareja que se lee junta', () => {
    expect(cuerpo).toMatch(/Cobros hoy/)
    expect(cuerpo).toMatch(/clientesCobrados/)
  })
})

describe('el servidor manda las filas con su cero', () => {
  it('las cinco cosas del día viajan aunque valgan cero', () => {
    // Si el API empezara a filtrar, la pantalla no podría pintarlas: el filtro
    // se quitó de la pantalla, no puede reaparecer en el servidor.
    for (const id of ['prestamosNuevos', 'renovaciones', 'clientesNuevos', 'seguros', 'recargos', 'gastos']) {
      expect(api, `falta «${id}» en la lista \`hizo\` del API`).toMatch(
        new RegExp(`id:\\s*'${id}'`))
    }
  })

  it('la gestión sigue mandando la cartera y los cobrados', () => {
    expect(api).toMatch(/clientesActivos/)
    expect(api).toMatch(/clientesCobrados/)
  })
})
