// lib/__tests__/acciones-reconoce-frases.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «La gente entra a un préstamo y no sabe cómo cancelarlo o renovarlo, entonces
// escriben por WhatsApp.» El objetivo de todo esto es que la app reconozca
// **la frase tal y como la escribe una persona**, no la palabra suelta que
// esperaría un programador.
//
// ⚠ Y ese era el fallo real del emparejador que ya existía: `filtrarComandos`
// exige, con varias palabras, que TODAS acierten en algún campo. Así que
// «quiero renovar este préstamo» daba CERO resultados, porque «quiero» y
// «este» no aparecen en ninguna etiqueta. Justo la forma en que se pregunta.
//
// Las frases de aquí abajo no son inventadas: son las que el dueño dijo que le
// llegan, y las que se ven en los mensajes de entrada de WhatsApp.

import { describe, it, expect } from 'vitest'
import { limpiarFrase, buscarAcciones } from '../acciones/registro.js'

/* Un préstamo con lo que de verdad se puede hacer en él. */
const ACCIONES = [
  { id: 'renovar', label: 'Renovar el préstamo',
    sinonimos: ['renovar', 'renovacion', 'volver a prestar', 'prestarle mas', 'refinanciar'] },
  { id: 'cancelar', label: 'Cancelar el préstamo',
    sinonimos: ['cancelar', 'anular prestamo', 'eliminar prestamo', 'borrar prestamo'] },
  { id: 'liquidar', label: 'Cerrar anticipado',
    sinonimos: ['liquidar', 'cerrar hoy', 'pagar todo', 'cancelar la deuda hoy', 'saldar'] },
  { id: 'plazo', label: 'Modificar el plazo',
    sinonimos: ['plazo', 'mas tiempo', 'alargar', 'cambiar cuotas'] },
  { id: 'perdido', label: 'Mover a perdidos',
    sinonimos: ['clavo', 'perdido', 'incobrable', 'no me va a pagar'] },
  { id: 'instalar', label: 'Instalar la app en el celular',
    sinonimos: ['instalar', 'instalar aplicacion', 'descargar app', 'sin internet', 'offline'] },
]

const primera = (frase) => buscarAcciones(ACCIONES, frase)[0]?.id

describe('reconoce la frase como la escribe una persona', () => {
  it('⚠ la frase completa, con relleno y todo', () => {
    // Esta es LA prueba: sin quitar las palabras de relleno, todas daban cero.
    expect(primera('quiero renovar este préstamo')).toBe('renovar')
    expect(primera('quiero cancelar este préstamo')).toBe('cancelar')
    expect(primera('¿cómo hago para renovar?')).toBe('renovar')
    expect(primera('necesito instalar la aplicación')).toBe('instalar')
  })

  it('la palabra suelta sigue funcionando', () => {
    expect(primera('renovar')).toBe('renovar')
    expect(primera('cancelar')).toBe('cancelar')
    expect(primera('instalar')).toBe('instalar')
  })

  it('encuentra por sinónimo, que es como lo dice quien no sabe el nombre', () => {
    expect(primera('quiero prestarle más a este cliente')).toBe('renovar')
    expect(primera('este señor no me va a pagar')).toBe('perdido')
    expect(primera('darle más tiempo')).toBe('plazo')
    expect(primera('descargar app')).toBe('instalar')
  })

  it('sin tildes y en mayúsculas también', () => {
    expect(primera('RENOVAR EL PRESTAMO')).toBe('renovar')
    expect(primera('cancelacion')).toBeUndefined()   // no inventa
    expect(primera('prestamo')).toBeDefined()
  })

  it('⚠ no ofrece lo que el usuario no puede hacer', () => {
    /* Mismo fallo que ya tuvimos con los permisos del cobrador: se guardaban
       bien y la pantalla los ignoraba. Aquí `disponible: false` tiene que
       sacar la acción de los resultados, no solo apagarla al pulsarla. */
    const recortadas = ACCIONES.map((a) =>
      a.id === 'cancelar' ? { ...a, disponible: false } : a)
    expect(buscarAcciones(recortadas, 'cancelar este préstamo').map((a) => a.id))
      .not.toContain('cancelar')
  })

  it('una pregunta que es TODA relleno no se queda en blanco', () => {
    /* «¿cómo hago?» se queda sin palabras útiles. Vaciar la búsqueda haría que
       no encontrara nada y pareciera que el buscador está roto; se busca con
       el texto tal cual. */
    expect(limpiarFrase('¿cómo hago?')).toBe('como hago')
    expect(() => buscarAcciones(ACCIONES, '¿cómo hago?')).not.toThrow()
  })

  it('limpiarFrase deja lo que de verdad se busca', () => {
    expect(limpiarFrase('quiero renovar este préstamo')).toBe('renovar prestamo')
    expect(limpiarFrase('¿Cómo hago para cancelar el préstamo?')).toBe('cancelar prestamo')
    expect(limpiarFrase('  ')).toBe('')
  })
})
