// lib/__tests__/admin-busca-por-telefono.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Mi panel de administrador no me deja encontrar los usuarios por número de
// teléfono y es muy importante.» Buscó 3008875156 y le salió «0 de 0
// resultados» — con CINCO usuarios que tienen ese número en producción.
//
// ⚠ Y el comentario del código prometía justo lo que no hacía: decía «Búsqueda
// por nombre de org, email de usuario o teléfono de usuario» y en el `OR` no
// había ninguna cláusula de teléfono. Un comentario que miente es peor que no
// tenerlo: al leerlo se da por resuelto lo que falta.

import { describe, it, expect } from 'vitest'
import { condicionesDeBusqueda } from '../admin/buscar-organizacion.js'

/* Aplana el árbol de condiciones a los pares campo→valor que se comparan, para
   poder preguntar «¿esto llega a mirar el teléfono?» sin fijar la forma exacta
   del objeto de Prisma. */
function comparaciones(cond, salida = []) {
  for (const c of cond) {
    for (const [campo, valor] of Object.entries(c)) {
      if (campo === 'users') comparaciones([valor.some], salida)
      else if (valor && typeof valor === 'object' && 'contains' in valor) {
        salida.push([campo, valor.contains])
      }
    }
  }
  return salida
}

const busca = (q, o) => comparaciones(condicionesDeBusqueda(q, o))
const campos = (q, o) => [...new Set(busca(q, o).map(([c]) => c))]
const valores = (q, o) => busca(q, o).filter(([c]) => c === 'telefono').map(([, v]) => v)

describe('el panel encuentra por teléfono', () => {
  it('⚠ el número que el dueño buscó llega a mirar el teléfono', () => {
    expect(campos('3008875156')).toContain('telefono')
  })

  it('y sigue buscando por nombre y correo', () => {
    const c = campos('Carlos')
    expect(c).toContain('nombre')
    expect(c).toContain('email')
  })
})

describe('el teléfono, como se escribe y como se guarda', () => {
  it('pegado con espacios, signos o el indicativo', () => {
    // En la base son dígitos puros; quien busca pega lo que tiene a mano.
    for (const q of ['+57 300 887 5156', '(300) 887-5156', '300 887 5156']) {
      expect(valores(q), `«${q}» no llegó al teléfono`).not.toHaveLength(0)
    }
  })

  it('⚠ busca en las dos direcciones cuando trae indicativo', () => {
    /* Hay cinco números guardados con el 57 delante y 401 sin él. Si se busca
       «+573008875156» contra un guardado «3008875156», `contains` NO acierta:
       por eso se prueba también con los últimos diez dígitos. */
    const v = valores('+573008875156')
    expect(v).toContain('573008875156')
    expect(v).toContain('3008875156')
  })

  it('un fragmento corto no barre media base', () => {
    // Con dos o tres dígitos, `contains` devolvería cualquier cosa.
    expect(valores('300')).toHaveLength(0)
    expect(campos('300')).not.toContain('telefono')
  })
})

describe('el CRM busca igual, pero solo al dueño', () => {
  it('limita las personas al rol owner', () => {
    const conRol = JSON.stringify(condicionesDeBusqueda('3008875156', { soloOwner: true }))
    expect(conRol).toContain('owner')
    // Y sin la opción, no se limita.
    expect(JSON.stringify(condicionesDeBusqueda('3008875156'))).not.toContain('owner')
  })
})

describe('texto vacío no filtra nada', () => {
  it('devuelve una lista vacía, no una condición que no encuentra nada', () => {
    expect(condicionesDeBusqueda('')).toEqual([])
    expect(condicionesDeBusqueda('   ')).toEqual([])
    expect(condicionesDeBusqueda(null)).toEqual([])
  })
})
