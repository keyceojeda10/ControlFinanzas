// lib/__tests__/topes-de-plan-una-sola-fuente.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Aquí en cambiar plan aún dice que el plan inicial es hasta 150 clientes
//  cuando lo bajamos a 100. No sé si aquí o en qué otras partes más está esa
//  información equivocada.» — el dueño, 19 ago 2026.
//
// La segunda frase era la buena pregunta. Estaba en tres sitios más, y uno de
// ellos costaba plata:
//
//   1. `configuracion/plan/page.jsx` — la pantalla que le enseña el plan al
//      cliente ANTES DE COBRARLE. Ya importaba `PLANES_CONFIG` y aun así tenía
//      la lista escrita a mano.
//   2. ⚠ `lib/bot-v2/producto.js` — el bot de VENTAS recomendaba el Inicial a
//      quien dijera tener hasta 150 clientes. Pagaba $39.000, llegaba a 100 y
//      se quedaba bloqueado.
//   3. El prompt de `scripts/compare-models.cjs`.
//
// Y NO ERA LA PRIMERA VEZ: `lib/bot/prompts/contexto.js` lleva escrito que «el
// bot llevaba meses vendiendo un tope que la aplicación no daba». Se corrigió
// el dato del prompt y se quedó el umbral que decide la recomendación.
//
// `lib/planes.js` lo dice en su primera línea: «TODOS los archivos deben
// importar de aquí en vez de hardcodear límites». Esta prueba es lo que hace
// que esa frase sea cierta.

import { describe, it, expect } from 'vitest'
import { PLANES_CONFIG } from '@/lib/planes'
import { PLANES, planRecomendado, textoPlanes } from '@/lib/bot-v2/producto'

describe('⚠ el bot recomienda según el tope REAL', () => {
  it('con 100 clientes cabe en Inicial; con 101 ya no', () => {
    expect(planRecomendado('tengo 100 clientes').nombre).toBe('Inicial')
    expect(planRecomendado('tengo 101 clientes').nombre).toBe('Básico')
  })

  it('⚠ 120 y 150 NO son Inicial — es el caso que se cobraba y se bloqueaba', () => {
    for (const n of [120, 150]) {
      const p = planRecomendado(`tengo ${n} clientes`)
      expect(p.nombre, `${n} clientes salía como ${p.nombre}`).not.toBe('Inicial')
      expect(n).toBeLessThanOrEqual(p.clientes)
    }
  })

  it('el plan recomendado SIEMPRE aguanta los clientes que dijo', () => {
    for (const n of [1, 50, 99, 100, 101, 449, 450, 451, 999, 1000, 1001, 2000, 2001, 9999]) {
      const p = planRecomendado(`somos ${n}`)
      expect(n, `${n} clientes → ${p.nombre}, que solo aguanta ${p.clientes}`).toBeLessThanOrEqual(p.clientes)
    }
  })

  it('por encima del más grande, el más grande', () => {
    const p = planRecomendado('tengo 50000 clientes')
    expect(p.nombre).toBe(PLANES_CONFIG.professional.nombre)
  })
})

describe('⚠ nadie escribe un tope a mano', () => {
  it('los topes del bot son los de la configuración', () => {
    for (const p of PLANES) {
      expect(p.clientes).toBe(PLANES_CONFIG[p.key].maxClientes)
      expect(p.precio).toBe(PLANES_CONFIG[p.key].precio)
    }
  })

  it('el texto que el bot manda lleva el tope bueno', () => {
    expect(textoPlanes()).toContain(`${PLANES_CONFIG.starter.maxClientes} clientes`)
    expect(textoPlanes(), 'volvió el 150').not.toContain('150 clientes')
  })

  it('la pantalla de cambiar plan deriva la lista, no la escribe', () => {
    const src = require('fs').readFileSync(
      require('path').resolve(process.cwd(), 'app/(dashboard)/configuracion/plan/page.jsx'), 'utf8')
    expect(src).toMatch(/Hasta \$\{c\.maxClientes/)
    expect(src, 'volvió a escribirse un tope a mano')
      .not.toMatch(/'Hasta [\d.,]+ clientes'/)
  })
})
