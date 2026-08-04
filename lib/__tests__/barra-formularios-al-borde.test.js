import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// La barra de botones de un formulario VA PEGADA AL BORDE.
//
// Cuando el botón de guardar salía tapado por la pastilla, lo arreglé subiendo
// la barra por encima de ella. Pero la pastilla solo estaba en «editar
// cliente»; en «nuevo cliente» y «nuevo préstamo» no hay ninguna, así que ahí
// la barra quedó flotando a media pantalla con un hueco muerto debajo.
//
// El arreglo correcto va en `lib/armazon.js`: el formulario es TAREA y no lleva
// pastilla. Aquí se fija que la barra no vuelva a levantarse.
const ARCHIVOS = [
  'components/clientes/ClienteForm.jsx',
  'app/(dashboard)/prestamos/nuevo/page.jsx',
]

describe('la barra de acciones de los formularios', () => {
  for (const rel of ARCHIVOS) {
    it(`${rel} la ancla abajo, sin esquivar la pastilla`, () => {
      const src = readFileSync(resolve(process.cwd(), rel), 'utf8')
      // OJO: el formulario de préstamo tiene DOS barras fijas. La otra es la
      // tira de la cuota en vivo, que SÍ va levantada porque se apoya sobre
      // esta. La de los botones es la que lleva relleno vertical (`pt-3`).
      // El borde IZQUIERDO no se fija aquí —eso lo vigila
      // `barra-fija-sidebar.test.js`, que exige el token—. Este regex traía
      // `lg:left-60` escrito dentro y dejó de encontrar la barra en cuanto ese
      // valor cambió: la prueba se cayó sin que la barra tuviera nada malo.
      // Lo que le importa a ESTA prueba es que la barra vaya pegada abajo.
      const barras = src.match(/className="fixed left-0 right-0 lg:left-[^"]*"/g) ?? []
      // `pt-3` o `pt-4`: en crear préstamo la franja lleva la cuota dentro y
      // necesita algo más de aire arriba. Fijar el número exacto ya rompió esta
      // prueba una vez —traía `lg:left-60` escrito— sin que la barra tuviera
      // nada malo. Lo que identifica a la barra es que tenga relleno arriba,
      // no cuánto.
      const botones = barras.filter((c) => /\bpt-[34]\b/.test(c))
      expect(botones.length, `barras halladas: ${barras.length}`).toBe(1)
      const clases = botones[0]
      expect(clases).toContain('bottom-0')
      // Un `bottom` calculado con el alto de la pastilla es justo el error.
      expect(clases).not.toMatch(/--cf-h-nav|--cf-nav-inset/)
    })
  }
})
