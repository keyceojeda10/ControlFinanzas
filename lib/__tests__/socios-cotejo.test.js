import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  loQuePusieron, cuentaDelSocio, repartoDe, deDondeSale,
  loQueQuedaDebiendo, cabeceraSocios, redondearPorcentaje, NOTA_NO_SACA_PLATA,
} from '../adaptadores/socios.js'

const RAIZ = process.cwd()
const fmt = (n) => `$${Number(n).toLocaleString('es-CO')}`
const schema = readFileSync(join(RAIZ, 'prisma/schema.prisma'), 'utf8')

const DOS = [
  { id: 'c', nombre: 'Carlos Andrés', puesto: 8_000_000 },
  { id: 'm', nombre: 'Marta Ruiz', puesto: 4_000_000 },
]

describe('el reparto cuadra al peso, siempre', () => {
  it('la suma de las partes es exactamente lo repartido', () => {
    // «$826.667 + $413.333 = $1.240.000». Un reparto que no cuadra es una
    // discusión familiar — y redondear cada parte por su lado NO cuadra: con
    // otras cifras la suma se pasa o se queda corta por uno o dos pesos.
    const p = loQuePusieron(DOS, fmt)
    for (const ganancia of [
      1_240_000, 1, 7, 100, 999_999, 1_000_000, 3_333_333, 8_838_907, 12_345_678,
    ]) {
      const r = repartoDe(ganancia, p.socios, fmt)
      const suma = r.numeros.partes.reduce((t, x) => t + x, 0)
      expect(suma).toBe(r.numeros.total)
    }
  })

  it('cuadra también con tres y con siete socios', () => {
    for (const n of [3, 7]) {
      const socios = Array.from({ length: n }, (_, i) => ({
        id: `s${i}`, nombre: `Socio ${i}`, puesto: 1_000_000 * (i + 1),
      }))
      const p = loQuePusieron(socios, fmt)
      const r = repartoDe(1_000_000, p.socios, fmt)
      expect(r.numeros.partes.reduce((t, x) => t + x, 0)).toBe(1_000_000)
    }
  })

  it('la diferencia de redondeo se la lleva el que más puso', () => {
    // Unos pesos sobre $826.667 no se ven; sobre $413.333 sí.
    const p = loQuePusieron(DOS, fmt)
    const r = repartoDe(1_240_000, p.socios, fmt)
    expect(r.numeros.partes).toEqual([826_667, 413_333])
  })

  it('el reparto usa la proporción exacta, no el porcentaje redondeado', () => {
    // Con «66,7%» de 1.240.000 saldría 827.080, y la suma no cuadraría.
    const p = loQuePusieron(DOS, fmt)
    expect(p.socios[0].parte).toBeCloseTo(2 / 3, 10)
    expect(repartoDe(1_240_000, p.socios, fmt).numeros.partes[0]).toBe(826_667)
  })

  it('repartir cero no rompe nada', () => {
    const p = loQuePusieron(DOS, fmt)
    const r = repartoDe(0, p.socios, fmt)
    expect(r.numeros.partes.reduce((t, x) => t + x, 0)).toBe(0)
  })
})

describe('la sociedad en una imagen', () => {
  it('la barra suma 100 y cada trozo lleva su ancho exacto', () => {
    const p = loQuePusieron(DOS, fmt)
    expect(p.barra.reduce((t, b) => t + b.ancho, 0)).toBeCloseTo(100, 6)
    expect(p.barra[0].ancho).toBeCloseTo(200 / 3, 6)
  })

  it('sin nadie que haya puesto nada no hay barra', () => {
    // Una barra vacía no dice «no hay socios», dice «algo se rompió».
    expect(loQuePusieron([{ id: 'x', nombre: 'X', puesto: 0 }], fmt).barra).toEqual([])
  })

  it('el porcentaje lleva un decimal', () => {
    // Con dos socios cercanos, un punto de redondeo es la diferencia entre
    // discutir y no discutir.
    expect(redondearPorcentaje(200 / 3)).toBe('66,7%')
    expect(redondearPorcentaje(50)).toBe('50%')
  })

  it('la leyenda y la barra usan el mismo color por socio', () => {
    const p = loQuePusieron(DOS, fmt)
    expect(p.socios.map((s) => s.color)).toEqual(p.barra.map((b) => b.color))
  })
})

describe('la relación con un socio es una deuda, no un balance', () => {
  it('son dos cifras: le has dado y le debes', () => {
    // «Balance neto» junta las dos y esconde justo la que hay que mirar antes de
    // que se la pidan.
    const c = cuentaDelSocio({ id: 'c', nombre: 'Carlos', puesto: 8_000_000, pagado: 1_200_000, repartido: 1_980_000 }, fmt)
    expect(c.dado).toBe('$1.200.000')
    expect(c.debe).toBe('$780.000')
  })

  it('sin repartos registrados «le debes» NO se enseña', () => {
    // Un «$0» ahí se lee como «no le debo nada», y lo cierto es que todavía no se
    // ha repartido. Hoy es siempre este caso: falta el tipo de movimiento.
    const c = cuentaDelSocio({ id: 'c', nombre: 'Carlos', puesto: 8_000_000, pagado: 1_200_000 }, fmt)
    expect(c.debe).toBeNull()
    expect(c.numeros.debe).toBeNull()
  })

  it('pagarle de más no deja la deuda en negativo', () => {
    const c = cuentaDelSocio({ id: 'c', nombre: 'C', pagado: 2_000_000, repartido: 1_000_000 }, fmt)
    expect(c.numeros.debe).toBe(0)
  })
})

describe('la cifra a repartir se puede defender', () => {
  it('dice de dónde sale', () => {
    // Sin esa línea, «$1.240.000» es un número que el dueño no puede defender
    // cuando un socio pregunte.
    const t = deDondeSale({ entro: 8_838_907, gastos: 10_000 }, fmt)
    expect(t).toBe('De $8.838.907 que entró, quitando el capital que volvió y $10.000 de gastos.')
  })

  it('sin gastos la frase sigue siendo una frase', () => {
    expect(deDondeSale({ entro: 1_000_000 }, fmt))
      .toBe('De $1.000.000 que entró, quitando el capital que volvió.')
  })

  it('la ganancia NO es lo recaudado: la frase lo dice', () => {
    // Lo recaudado incluye el capital que vuelve. Es el bug que ya infló las
    // analíticas 7,9 veces.
    expect(deDondeSale({ entro: 1, gastos: 0 }, fmt)).toMatch(/quitando el capital que volvió/)
  })

  it('sin nada que entrara no se inventa una explicación', () => {
    expect(deDondeSale({ entro: 0 }, fmt)).toBeNull()
  })

  it('el antes → después suma el reparto a lo que ya se debía', () => {
    const d = loQueQuedaDebiendo({ antes: 1_380_000, reparto: 1_240_000 }, fmt)
    expect(d.antes).toBe('$1.380.000')
    expect(d.despues).toBe('$2.620.000')
  })

  it('sin repartos previos no hay «antes» que tachar', () => {
    expect(loQueQuedaDebiendo({ reparto: 100 }, fmt)).toBeNull()
  })
})

describe('repartir no saca plata de la caja', () => {
  it('la nota lo dice con todas las letras', () => {
    // Un dueño que crea que al repartir ya pagó, va a pagar dos veces.
    expect(NOTA_NO_SACA_PLATA).toMatch(/no saca plata de tu caja/)
    expect(NOTA_NO_SACA_PLATA).toMatch(/Cuando le pagues, registras el retiro/)
  })

  it('y hoy no hay dónde registrarlo — prueba escrita para morir', () => {
    // `AporteSocio.tipo` solo admite 'aporte' y 'retiro'. Si alguien implementara
    // «repartir» como un retiro, SACARÍA la plata de la caja: el error exacto que
    // la nota advierte. El día que exista el tipo 'reparto', esta prueba falla y
    // recuerda que hay que activar «le debes» y borrar el PENDIENTE.
    const linea = schema.match(/tipo\s+String\s+@default\("aporte"\).*/)?.[0] ?? ''
    expect(linea).toMatch(/aporte \| retiro/)
    expect(linea).not.toMatch(/reparto/)
  })

  it('el PENDIENTE sigue documentado', () => {
    const adaptador = readFileSync(join(RAIZ, 'lib/adaptadores/socios.js'), 'utf8')
    expect(adaptador).toMatch(/PENDIENTE-BACKEND/)
    expect(adaptador).toMatch(/periodoDesde/)
  })
})

describe('la cabecera dice el modelo en cinco palabras', () => {
  it('«reparten por lo que pusieron»', () => {
    // Es el único modelo que quedó tras la decisión de julio: por porcentaje del
    // capital aportado, no por préstamo asignado.
    expect(cabeceraSocios(DOS).detalle).toBe('2 activos · reparten por lo que pusieron')
  })

  it('sin socios no promete un reparto', () => {
    expect(cabeceraSocios([]).detalle).toBe('todavía no hay socios')
  })
})
