// lib/__tests__/guias-donde-estas.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// El dueño, con cinco capturas y las dos mitades del problema:
//
//   «dentro del préstamo, si alguien quiere saber cómo renovar con un tutorial,
//    no va a poder porque no sale. Sale la opción rápida de que lo lleva a
//    renovar el préstamo, pero no le explica cómo.»
//
//   «en el buscador general puse "instalar" y me sale cómo instalar la app. Ahí
//    sí me explica, pero me manda al apartado de tutoriales. Y el apartado de
//    tutoriales, aparte de que no es lo que quiero, está roto. […] Yo quería
//    que en un modal, ahí mismo sin moverse para ningún otro lado. Que esté la
//    explicación y que al final lo mande a renovar el préstamo.»
//
// Las 34 guías estaban escritas desde el 8 de agosto. Lo que faltaba era que
// alguien las encontrara desde donde se necesitan, y que no costaran salir de
// la pantalla para leerlas.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { buscarGuias, guiaPorId, accionDeGuia } from '../tutoriales/guias'
import { TUTORIALES } from '../tutorialesData'

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

/* ⚠ SIN COMENTARIOS. Las notas de este proyecto CITAN lo que se quitó —«iban
   con href: /tutoriales?t=…»— para poder explicar por qué. Una prueba sobre el
   texto entero se acusa a sí misma; ya pasó en `marca-no-es-el-acreedor`. */
const sinNotas = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .split(/\r?\n/).filter((l) => !l.trim().startsWith('//')).join('\n')

describe('la guía aparece cuando se pregunta por ella', () => {
  /* Las frases de la izquierda son cómo pregunta la gente, no cómo se llama el
     tutorial. La de arriba es LITERALMENTE la que él tecleó en la captura. */
  const CASOS = [
    ['Como renovar?', 'renovar-prestamo'],
    ['como renovar un prestamo', 'renovar-prestamo'],
    ['quiero prestarle mas', 'renovar-prestamo'],
    ['instalar', 'offline'],
    ['como cobro sin internet', 'offline'],
    ['como cancelo este prestamo', 'cancelar-prestamo'],
    ['darle mas tiempo', 'modificar-plazo'],
    ['cierre de caja', 'cierre-caja'],
    ['abono a capital', 'abono-capital'],
    ['dar por perdido', 'dar-por-perdido'],
    ['permisos del cobrador', 'permisos-cobrador'],
    ['si paga todo hoy', 'cerrar-anticipado'],
  ]

  for (const [frase, esperada] of CASOS) {
    it(`«${frase}» → ${esperada}`, () => {
      const ids = buscarGuias(frase, 2).map((g) => g.id)
      expect(ids, `salió ${ids.join(', ') || '(nada)'}`).toContain(esperada)
    })
  }

  it('sin escribir nada no devuelve guías', () => {
    expect(buscarGuias('', 2)).toEqual([])
    expect(buscarGuias('   ', 2)).toEqual([])
  })

  it('⚠ DOS como mucho: primero hacer, después aprender a hacerlo', () => {
    /* Con más de dos, la acción —que es lo que se pulsa mil veces más— se sale
       de la pantalla del teléfono y la prioridad queda invertida. */
    expect(buscarGuias('prestamo', 2).length).toBeLessThanOrEqual(2)
  })
})

describe('la guía termina en la acción de ESTA pantalla', () => {
  /* Simula lo que registra la ficha del préstamo. */
  const DEL_PRESTAMO = [
    { id: 'prestamo-renovar', label: 'Renovar el préstamo' },
    { id: 'prestamo-cancelar', label: 'Cancelar el préstamo' },
    { id: 'prestamo-perdidos', label: 'Mover a perdidos', disponible: false },
    { id: 'prestamo-recuperar', label: 'Sacar de perdidos' },
  ]

  it('renovar acaba en el botón que abre la hoja de renovar', () => {
    const a = accionDeGuia(guiaPorId('renovar-prestamo'), DEL_PRESTAMO)
    expect(a?.id).toBe('prestamo-renovar')
    expect(a?.label).toBe('Renovar el préstamo')
  })

  it('la lista de ids salta la que no está disponible', () => {
    /* «Mover a perdidos» no sale en un préstamo que ya es clavo; ahí la que
       vale es la contraria. Por eso `accion` admite lista. */
    expect(accionDeGuia(guiaPorId('dar-por-perdido'), DEL_PRESTAMO)?.id)
      .toBe('prestamo-recuperar')
  })

  it('desde otra pantalla no inventa un botón: se cae al enlace', () => {
    expect(accionDeGuia(guiaPorId('renovar-prestamo'), [])).toBeNull()
    expect(guiaPorId('renovar-prestamo').destino?.href).toBeTruthy()
  })

  it('la guía que no lleva a ninguna pantalla nuestra no finge que sí', () => {
    // Instalar la app se hace con un botón DEL NAVEGADOR.
    expect(guiaPorId('offline').accion).toBeUndefined()
  })

  it('⚠ ningún `accion` apunta a una acción que no existe', () => {
    /* Un id equivocado no revienta: se cae al enlace y nadie se entera de que
       el botón bueno nunca aparece. Se comprueba contra los ids REALES que
       registran las pantallas. */
    const fuentes = []
    const barrer = (dir) => {
      if (!existsSync(dir)) return
      for (const e of readdirSync(dir)) {
        if (['node_modules', '.next', '.git', '__tests__'].includes(e)) continue
        const f = join(dir, e)
        if (statSync(f).isDirectory()) barrer(f)
        else if (/\.jsx?$/.test(f)) fuentes.push(readFileSync(f, 'utf8'))
      }
    }
    barrer(resolve(process.cwd(), 'app'))
    barrer(resolve(process.cwd(), 'components'))
    const todo = fuentes.join('\n')

    const huerfanos = []
    for (const t of TUTORIALES) {
      if (!t.accion) continue
      for (const id of [].concat(t.accion)) {
        // `prestamo-renovar` se compone: `id: \`prestamo-${a.id}\`` + el id de
        // la fila de «Gestión». Se acepta cualquiera de las dos formas.
        const suelto = id.replace(/^prestamo-/, '')
        const literal = todo.includes(`'${id}'`)
        const compuesto = id.startsWith('prestamo-') && todo.includes(`id: '${suelto}',`)
        if (!literal && !compuesto) huerfanos.push(`${t.id} → ${id}`)
      }
    }
    expect(huerfanos, 'estas guías apuntan a una acción inexistente').toEqual([])
  })
})

describe('la guía se lee donde estás, no en otra pantalla', () => {
  it('la caja de la sección abre el modal, no navega', () => {
    const caja = leer('components/acciones/QueNecesitas.jsx')
    expect(caja, 'la caja no busca guías').toMatch(/buscarGuias/)
    expect(caja).toMatch(/<ModalGuia/)
  })

  it('⚠ el buscador general dejó de mandar a /tutoriales', () => {
    /* Iba con `href: /tutoriales?t=…`. Dos razones para quitarlo, y la primera
       la dio la pantalla: estaba ROTA. */
    const buscador = sinNotas(leer('components/layout/GlobalSearch.jsx'))
    expect(buscador, 'volvió el salto a la pantalla de tutoriales').not.toMatch(/\/tutoriales\?t=/)
    expect(buscador).toMatch(/<ModalGuia/)
  })

  it('⚠ el modal sobrevive al cierre del buscador', () => {
    /* Elegir una guía cierra el panel. Colgado del `return` de abajo, el modal
       se desmontaría en el mismo golpe que lo abre: se ve un parpadeo y nada
       más. Por eso se pinta también en la rama de «cerrado». */
    const buscador = leer('components/layout/GlobalSearch.jsx')
    expect(buscador).toMatch(/if \(!open\) return guia \?/)
  })

  it('⚠ y la pantalla de tutoriales dejó de reventar', () => {
    /* `tutorial.id` donde la variable del `map` se llama `t`: un
       `ReferenceError` en pleno render. La rama afectada es justo la de
       buscar/filtrar, que es a la que llegaba el enlace `?t=`. Aquí no hay
       TypeScript, así que pasó build, pruebas y despliegue. */
    const lista = leer('components/TutorialesList.jsx')
    expect(lista, 'volvió la variable que no existe').not.toMatch(/tutorial\.id === pedido/)
    expect(lista).toMatch(/t\.id === pedido/)
  })
})
