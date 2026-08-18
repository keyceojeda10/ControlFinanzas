// lib/__tests__/suscripcion-dias-y-fecha.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Yo puedo agregar días, pero no puedo quitar días. No puedo ubicarle una
//  fecha específica o establecerle una fecha con un calendario.»
//                                                    — el dueño, 16 ago 2026
//
// `dias < 1` rechazaba cualquier negativo: un dedazo de +30 días no se podía
// deshacer más que dando la vuelta al año con 335 días más.
//
// Lo que se cuida aquí es que las tres puertas nuevas no se abran de más:
// restar es útil, restar sin freno regala o quita meses de servicio pagado.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const src = readFileSync(resolve(process.cwd(), 'app/api/admin/suscripciones/[id]/route.js'), 'utf8')
const bloqueDe = (accion) => {
  const i = src.indexOf(`if (accion === '${accion}')`)
  const resto = src.slice(i + 10)
  const j = resto.indexOf("if (accion === '")
  return resto.slice(0, j > 0 ? j : resto.length)
}

describe('⚠ quitar días', () => {
  const extender = bloqueDe('extender')

  it('acepta negativos', () => {
    expect(extender, 'sigue rechazando cualquier número negativo').toMatch(/dias < -365/)
  })

  it('pero no más de un año, ni cero', () => {
    /* El cero no es una orden: es un formulario a medio llenar. Y sin tope,
       −3.650 le quita diez años a alguien que está pagando. */
    expect(extender).toMatch(/!dias \|\| dias < -365 \|\| dias > 365/)
  })

  it('al restar parte del vencimiento, no de hoy', () => {
    /* Si partiera de hoy, quitarle 5 días a una que vence en 60 la dejaría
       vencida hace 5. Es lo contrario de lo que se pidió. */
    expect(extender).toMatch(/dias < 0 \? vence :/)
  })

  it('y si la deja vencida, lo dice', () => {
    /* Una fila que venció ayer y sigue marcada «activa» es exactamente lo que
       hace que el panel enseñe un MRR que nadie va a pagar. */
    expect(extender).toMatch(/estado: nuevaFecha > ahora \? 'activa' : 'vencida'/)
  })

  it('el registro distingue quitar de poner', () => {
    /* Con las dos cosas bajo `extender_suscripcion`, el historial no deja ver
       quién recortó qué. */
    expect(extender).toMatch(/dias < 0 \? 'recortar_suscripcion' : 'extender_suscripcion'/)
  })
})

describe('⚠ la fecha exacta', () => {
  const fecha = bloqueDe('fecha')

  it('solo acepta AAAA-MM-DD', () => {
    expect(fecha).toMatch(/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$/)
  })

  it('el día pactado se disfruta entero', () => {
    /* A medianoche en punto, quien pagó «hasta el 15» perdía el 15. */
    expect(fecha).toMatch(/T23:59:59/)
  })

  it('no deja colar un año mal escrito', () => {
    /* Teclear 2206 en vez de 2026 regalaría el plan 180 años y nadie lo notaría
       hasta el balance. */
    expect(fecha).toMatch(/setFullYear\(tope\.getFullYear\(\) \+ 5\)/)
    expect(fecha).toMatch(/status: 400/)
  })

  it('guarda de dónde venía, no solo a dónde va', () => {
    expect(fecha).toMatch(/antes \$\{new Date\(sub\.fechaVencimiento\)/)
  })
})

describe('⚠ el cambio de plan', () => {
  const plan = bloqueDe('plan')

  it('solo los planes que existen', () => {
    /* Un valor fuera del enum revienta con PrismaClientValidationError, que ya
       tumbó este proyecto una vez. */
    expect(plan).toMatch(/!PLANES\.includes\(plan\)/)
  })

  it('la lista es la del enum de Prisma, sin sobras ni faltas', () => {
    const enRuta = [...src.slice(src.indexOf('const PLANES = ['), src.indexOf('function calcularNuevaFecha'))
      .matchAll(/'(\w+)'/g)].map((m) => m[1])
    const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8')
    const enEnum = schema.slice(schema.indexOf('enum Plan {') + 11)
      .slice(0, schema.slice(schema.indexOf('enum Plan {')).indexOf('}') - 11)
      .split('\n').map((l) => l.trim()).filter(Boolean)
    expect(enRuta.sort()).toEqual(enEnum.sort())
  })

  it('cambia el plan en los DOS sitios', () => {
    /* La organización lleva su propia copia y es la que mandan las barreras:
       tocar solo la suscripción deja al negocio con el plan viejo en la app y
       el nuevo en el panel. */
    expect(plan).toMatch(/prisma\.suscripcion\.update/)
    expect(plan).toMatch(/prisma\.organization\.update/)
    expect(plan).toMatch(/\$transaction/)
  })

  it('no toca la fecha', () => {
    /* Son dos decisiones distintas. Mezclarlas obliga a recalcular el
       vencimiento cada vez que alguien sube de plan a mitad de mes. */
    expect(plan).not.toMatch(/fechaVencimiento/)
  })
})

describe('⚠ el cambio y su registro van juntos o no van', () => {
  /* Lo cacé en el espejo: la suscripción se actualizaba, el AdminLog fallaba
     después y el API devolvía 500. El dueño leía «Error» sobre un cambio que SÍ
     se había aplicado, y lo natural es volver a pulsar. Quitar 5 días dos veces
     son 10. En un panel que toca lo que la gente paga, un cambio a medias o sin
     rastro son la misma clase de problema. */
  for (const accion of ['renovar', 'extender', 'fecha', 'plan', 'cancelar']) {
    it(`«${accion}» escribe la fila y el registro en la misma transacción`, () => {
      const b = bloqueDe(accion)
      expect(b, `«${accion}» no usa transacción`).toMatch(/prisma\.\$transaction\(\[/)
      const suelto = b.replace(/prisma\.\$transaction\(\[[\s\S]*?\n    \]\)/, '')
      expect(suelto, `«${accion}» escribe el AdminLog fuera de la transacción`)
        .not.toMatch(/await prisma\.adminLog\.create/)
    })
  }
})

describe('⚠ el mensaje dice lo que pasó', () => {
  it('quitar días no se anuncia como «Extendida»', () => {
    const b = bloqueDe('extender')
    expect(b).toMatch(/dias < 0[\s\S]{0,120}quitaste/)
  })

  it('y avisa si la deja vencida', () => {
    expect(bloqueDe('extender')).toMatch(/queda VENCIDA/)
  })
})

describe('⚠ todo esto sigue siendo solo del superadmin', () => {
  it('la puerta está antes de cualquier acción', () => {
    const guarda = src.indexOf("rol !== 'superadmin'")
    const primera = src.indexOf("if (accion === '")
    expect(guarda).toBeGreaterThan(0)
    expect(guarda).toBeLessThan(primera)
  })
})
