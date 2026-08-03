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
      const barras = src.match(/className="fixed left-0 right-0 lg:left-60[^"]*"/g) ?? []
      const botones = barras.filter((c) => c.includes('pt-3'))
      expect(botones.length, `barras halladas: ${barras.length}`).toBe(1)
      const clases = botones[0]
      expect(clases).toContain('bottom-0')
      // Un `bottom` calculado con el alto de la pastilla es justo el error.
      expect(clases).not.toMatch(/--cf-h-nav|--cf-nav-inset/)
    })
  }
})
