import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

/* ══════════════════════════════════════════════════════════════════════════
   LA FICHA DE UNA LÍNEA DE CRÉDITO DEVOLVÍA 500

   Salió preguntando un usuario nuevo por su modalidad: presta $690.000 al 10%
   mensual, el cliente paga solo los intereses y el capital queda abierto sin
   fecha. La línea de crédito hace exactamente eso — y su ficha no abría.

   La causa: `abonadoCapital: true` colado en el `select` de `CorteLinea`. Es un
   campo de `Prestamo`; en los otros catorce sitios donde aparece pegado a
   `totalPagado` está sobre `Prestamo` y ahí es correcto. Aquí reventaba el
   `select` entero.

   Es el fallo RUIDOSO de [[feedback_verificar_prisma_select]]: campo que no
   existe → 500. El silencioso —pedir de menos— es el que no se ve.
   ══════════════════════════════════════════════════════════════════════════ */

/* ⚠ SIN COMENTARIOS. La nota que explica el fallo NOMBRA el campo, así que la
   primera versión de esta prueba se encontraba a sí misma y fallaba sobre
   código correcto. Es la trampa de siempre al buscar por texto. */
const ruta = fs.readFileSync('app/api/lineas-credito/[id]/route.js', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const esquema = fs.readFileSync('prisma/schema.prisma', 'utf8')

/** Los campos que el esquema declara para un modelo. */
function camposDe(modelo) {
  const i = esquema.indexOf(`model ${modelo} {`)
  const j = esquema.indexOf('\n}', i)
  return esquema.slice(i, j).split('\n').slice(1)
    .map((l) => l.trim().split(/\s+/)[0])
    .filter((n) => n && !n.startsWith('@') && !n.startsWith('//'))
}

describe('el select de los cortes solo pide campos que existen', () => {
  it('`CorteLinea` no tiene `abonadoCapital`, y ya no se le pide', () => {
    expect(camposDe('CorteLinea')).not.toContain('abonadoCapital')
    const bloque = ruta.slice(ruta.indexOf('cortesLinea'), ruta.indexOf('cortesLinea') + 700)
    expect(bloque, 'volvió el campo que no existe').not.toMatch(/abonadoCapital/)
  })

  it('y sí lo tiene `Prestamo`, que es de donde se copió', () => {
    /* Si algún día desapareciera de `Prestamo`, los catorce sitios que lo piden
       empezarían a devolver 500 a la vez. */
    expect(camposDe('Prestamo')).toContain('abonadoCapital')
  })

  it('cada campo del select de cortes está en el modelo', () => {
    const bloque = ruta.slice(ruta.indexOf('cortesLinea'), ruta.indexOf('cortesLinea') + 700)
    const pedidos = [...bloque.matchAll(/^\s{6,}(\w+): true,/gm)].map((m) => m[1])
    expect(pedidos.length, 'no se encontró el select de los cortes').toBeGreaterThan(4)
    const existen = camposDe('CorteLinea')
    for (const c of pedidos) {
      expect(existen, `«${c}» no existe en CorteLinea`).toContain(c)
    }
  })
})
