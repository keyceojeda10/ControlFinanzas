// lib/__tests__/borrar-prestamo-donde-esta.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Crediya, 16 ago 2026: no encontraba cómo borrar un préstamo. Escribió
// «Borrar» en el buscador de la pantalla del préstamo y le salieron «Ver y
// gestionar los pagos» y dos tutoriales. Ninguno servía.
//
// Y tenía razón: en TODA la app había UN solo sitio que borra un préstamo
// —`_doDeletePrestamo`— y estaba dentro del modal de eliminar al CLIENTE, el
// que aparece cuando intentas borrarlo y todavía tiene préstamos. Para quitar
// un préstamo había que empezar a borrar al cliente.
//
// Encima, su préstamo ya estaba CANCELADO, así que:
//   · la fila «Cancelar el préstamo» no salía (va con `estaActivo`), y
//   · el chip de Gestión tampoco (iba con `estaActivo && !completado`).
// Se quedó sin ninguna puerta.
//
// Y el aviso de cancelar le decía, literal: «no lo canceles: elimina el
// préstamo». Un consejo que no se podía seguir.
//
// Lo que estas pruebas cuidan:
//
//   1. Que «Eliminar el préstamo» vuelva a existir en un solo sitio escondido.
//   2. Que se vuelva a atar a `estaActivo` — el caso que lo pide es un préstamo
//      YA cancelado.
//   3. Que «borrar» vuelva a apuntar a cancelar, que es otra cosa.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { SINONIMOS_GESTION } from '@/lib/acciones/prestamo'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
const PANTALLA = 'app/(dashboard)/prestamos/[id]/page.jsx'

describe('⚠ eliminar un préstamo se hace desde el préstamo', () => {
  const src = leer(PANTALLA)

  it('la acción está en el grupo «Cierra el préstamo»', () => {
    expect(src).toMatch(/id: 'eliminar', nombre: 'Eliminar el préstamo', peligro: true/)
  })

  it('⚠ NO está atada a que el préstamo esté activo', () => {
    /* El caso que la pide es justo un préstamo cancelado. Si alguien le pone
       `estaActivo`, vuelve a desaparecer exactamente cuando hace falta. */
    const bloque = src.slice(src.indexOf("id: 'eliminar'") - 400, src.indexOf("id: 'eliminar'"))
    const guardia = bloque.slice(bloque.lastIndexOf('if ('))
    expect(guardia, 'volvió a exigir que esté activo').not.toMatch(/estaActivo/)
    expect(guardia).toMatch(/esOwner/)
  })

  it('llama al API de borrado y saca al usuario de la pantalla', () => {
    /* El préstamo deja de existir: quedarse ahí da un 404. */
    const modal = src.slice(src.indexOf('¿Eliminar este préstamo?'))
    expect(modal).toMatch(/method: 'DELETE'/)
    expect(modal).toMatch(/router\.replace/)
  })

  it('avisa de lo que se lleva por delante ANTES de borrar', () => {
    const modal = src.slice(src.indexOf('¿Eliminar este préstamo?'), src.indexOf('¿Eliminar este préstamo?') + 4000)
    // Los cobros que se borran con él
    expect(modal).toMatch(/hayCobrosRegistrados/)
    expect(modal).toMatch(/formatMoney\(totalPagadoReal\)/)
    // Y que si es una renovación, vuelve el saldo del préstamo anterior
    expect(modal).toMatch(/renovadoDeId/)
  })

  it('⚠ el chip de Gestión sale si hay algo que hacer, no solo si está activo', () => {
    /* Iba con `estaActivo && !completado`, así que en un préstamo cancelado la
       hoja no existía — y es donde vive lo único que se puede hacer con uno. */
    const linea = src.slice(src.indexOf('const mostrarGestionPrestamo'), src.indexOf('const mostrarGestionPrestamo') + 220)
    expect(linea).toMatch(/gruposGestion\.some/)
    expect(linea, 'volvió a exigir que esté activo').not.toMatch(/estaActivo/)
  })
})

describe('⚠ «borrar» y «cancelar» no son la misma cosa', () => {
  it('los sinónimos de borrar apuntan a eliminar', () => {
    expect(SINONIMOS_GESTION.eliminar).toContain('borrar')
    expect(SINONIMOS_GESTION.eliminar).toContain('eliminar')
  })

  it('y ya NO apuntan a cancelar', () => {
    /* Cancelar deja el préstamo a la vista con sus cobros; eliminar lo quita y
       devuelve la caja. Que «borrar» llevara a cancelar es lo que dejó a
       Crediya dando vueltas. */
    for (const palabra of ['borrar', 'borrar el prestamo', 'eliminar el prestamo']) {
      expect(SINONIMOS_GESTION.cancelar, `«${palabra}» volvió a los sinónimos de cancelar`)
        .not.toContain(palabra)
    }
  })

  it('cancelar conserva los suyos', () => {
    expect(SINONIMOS_GESTION.cancelar).toContain('anular el prestamo')
    expect(SINONIMOS_GESTION.cancelar).toContain('nunca se le presto')
  })
})

describe('el aviso de cancelar señala una salida que ahora existe', () => {
  it('sigue mandando a eliminar cuando el error fue registrar un cobro', () => {
    /* Esa frase se escribió anoche y era un callejón sin salida: no había cómo
       eliminar. Si alguien la quita, este arreglo pierde su motivo. */
    expect(leer(PANTALLA)).toMatch(/no lo canceles:[\s\S]{0,120}elimina el préstamo/)
  })
})
