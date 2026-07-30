import { describe, it, expect } from 'vitest'

import {
  loPuestoAqui, colorDeParada, avisoDeRobo, cobradoresParaElegir,
  tramosDelRecorrido, moverParada, propuestaPorCercania,
  cierreDelDia, resumenDeCierre, loQuePasoHoy,
  pinesDelMapa, LEYENDA_MAPA, cabeceraMapa,
} from '../adaptadores/ruta.js'

const fmt = (n) => `$${Number(n).toLocaleString('es-CO')}`

/* ══════════════════════════════════════════════════════════════════════════
   T24-01 crear · T24-02 reordenar · T04-03 cierre del día · T11-02 mapa
   ══════════════════════════════════════════════════════════════════════════ */

describe('las dos terceras columnas son preguntas distintas', () => {
  const ruta = { carteraTotal: 11_600_000, capitalPendiente: 8_400_000, totalAPagarRuta: 40_000_000 }

  it('«cumple» mide avance y «rinde» mide rentabilidad', () => {
    // Las dos láminas usan las mismas cifras (8,4M puesto · 3,2M por ganar · 11,6M
    // de cartera) y las dos salen bien: 3,2/8,4 = 38% y (40−11,6)/40 = 71%.
    // Confundirlas sería el cuarto miembro de la familia de funciones de ruta que
    // se contradicen.
    expect(loPuestoAqui(ruta, fmt, 'cumple').numeros.cumple).toBe(71)
    expect(loPuestoAqui(ruta, fmt, 'rinde').numeros.rinde).toBe(38)
  })

  it('la pantalla enseña la que pide, no las dos', () => {
    expect(loPuestoAqui(ruta, fmt, 'cumple').columnas.map((c) => c.id))
      .toEqual(['prestado', 'porganar', 'cumple'])
    expect(loPuestoAqui(ruta, fmt, 'rinde').columnas.map((c) => c.id))
      .toEqual(['prestado', 'porganar', 'rinde'])
  })

  it('sin capital puesto no hay rinde: 0/0 no se enseña como 0%', () => {
    const r = loPuestoAqui({ carteraTotal: 0, capitalPendiente: 0, totalAPagarRuta: 100 }, fmt, 'rinde')
    expect(r.numeros.rinde).toBeNull()
    expect(r.columnas.map((c) => c.id)).not.toContain('rinde')
  })
})

describe('crear ruta (T24-01)', () => {
  const cobradores = [
    { id: 'p', nombre: 'Pepito Perez', rutas: 1 },
    { id: 'c1', nombre: 'Carlos 1', rutas: 0 },
    { id: 'c2', nombre: 'Ana', rutas: 0 },
  ]

  it('los cobradores sin ruta van primero', () => {
    // Es el hallazgo de las rutas vacías atacado desde el otro lado: una lista que
    // empieza por los que ya tienen ruta esconde a los que no tienen.
    expect(cobradoresParaElegir(cobradores).filas.map((f) => f.id)).toEqual(['c1', 'c2', 'p'])
  })

  it('el dueño va al final, con su nombre real debajo', () => {
    const r = cobradoresParaElegir(cobradores, { id: 'yo', nombre: 'Carlos Castro' })
    const ultimo = r.filas[r.filas.length - 1]
    expect(ultimo.nombre).toBe('Yo mismo')
    expect(ultimo.detalle).toBe('Carlos Castro')
    expect(ultimo.iniciales).toBe('CC')
  })

  it('el verbo de la nota concuerda con el número', () => {
    // «Te quedan 1 cobrador» es lo que sale de pluralizar solo el sustantivo.
    expect(cobradoresParaElegir([{ id: 'a', nombre: 'A', rutas: 0 }]).nota)
      .toBe('Te queda 1 cobrador sin ruta.')
    expect(cobradoresParaElegir(cobradores).nota).toBe('Te quedan 2 cobradores sin ruta.')
  })

  it('sin cobradores libres no se dice nada', () => {
    expect(cobradoresParaElegir([{ id: 'a', nombre: 'A', rutas: 2 }]).nota).toBeNull()
  })

  it('el aviso nombra al cobrador al que le rompes la ruta', () => {
    // La lámina dice «la de Pepito», no «la de Ruta #1»: lo que se rompe es el día
    // de trabajo de una persona, y un nombre propio se reconoce mejor.
    const clientes = [
      { id: 1, nombre: 'A', rutaNombre: 'Ruta 2', rutaCobrador: 'Pepito' },
      { id: 2, nombre: 'B', rutaNombre: 'Ruta #1', rutaCobrador: 'Carlos' },
      { id: 3, nombre: 'C' },
    ]
    expect(avisoDeRobo(clientes, [1, 2, 3]))
      .toBe('2 de estos clientes ya tienen ruta. Al guardarlos aquí salen de la de Pepito y la de Carlos.')
  })

  it('la misma ruta dos veces se nombra una vez', () => {
    const clientes = [
      { id: 1, nombre: 'A', rutaCobrador: 'Pepito' },
      { id: 2, nombre: 'B', rutaCobrador: 'Pepito' },
    ]
    expect(avisoDeRobo(clientes, [1, 2])).toMatch(/salen de la de Pepito\.$/)
  })
})

describe('reordenar el recorrido (T24-02)', () => {
  const paradas = [
    { id: 1, orden: 1, nombre: 'Steven', direccion: 'Cl 8', diasMora: 36, tramoMetros: 240 },
    { id: 2, orden: 2, nombre: 'Pepito', direccion: 'Cl 65', tramoMetros: 520 },
    { id: 3, orden: 3, nombre: 'Luz', direccion: 'Cra 7', tramoMetros: 410 },
  ]

  it('la primera distancia es «de ti» y las demás son del tramo anterior', () => {
    // Una lista de distancias al cobrador no dice nada del zigzag; el tramo sí.
    const t = tramosDelRecorrido(paradas)
    expect(t[0].tramo).toBe('240 m de ti')
    expect(t[1].tramo).toBe('520 m')
  })

  it('sin tramo no se inventa una distancia', () => {
    expect(tramosDelRecorrido([{ id: 1, nombre: 'X' }])[0].tramo).toBeNull()
  })

  it('aquí manda la dirección y la mora va detrás', () => {
    // No se está cobrando: se está decidiendo el camino.
    expect(tramosDelRecorrido(paradas)[0].detalle).toBe('Cl 8 · 36d de atraso')
  })

  it('mover renumera, porque el orden guardado y el visible no pueden diferir', () => {
    const r = moverParada(paradas, 2, 0)
    expect(r.map((p) => p.nombre)).toEqual(['Luz', 'Steven', 'Pepito'])
    expect(r.map((p) => p.orden)).toEqual([1, 2, 3])
  })

  it('mover no toca el original: el «deshacer» lo necesita', () => {
    const antes = paradas.map((p) => p.nombre)
    moverParada(paradas, 0, 2)
    expect(paradas.map((p) => p.nombre)).toEqual(antes)
  })

  it('índices imposibles no rompen la lista', () => {
    expect(moverParada(paradas, -1, 0)).toBe(paradas)
    expect(moverParada(paradas, 0, 99)).toBe(paradas)
    expect(moverParada(paradas, 1, 1)).toBe(paradas)
  })

  it('la propuesta dice cuánto se ahorra', () => {
    // Sin la cifra es un botón que hay que probar a ver qué pasa.
    const p = propuestaPorCercania({ actualMetros: 3400, propuestaMetros: 2600 })
    expect(p.detalle).toBe('bajaría el recorrido a 2,6 km')
    expect(p.ahorroMetros).toBe(800)
  })

  it('sin ahorro no se ofrece nada', () => {
    // Proponer un orden que no mejora quema el botón para cuando sí sirva.
    expect(propuestaPorCercania({ actualMetros: 2600, propuestaMetros: 2600 })).toBeNull()
    expect(propuestaPorCercania({ actualMetros: 2000, propuestaMetros: 3000 })).toBeNull()
    expect(propuestaPorCercania({})).toBeNull()
  })
})

describe('el cierre del día (T04-03)', () => {
  it('la cuenta es cobrado menos prestado menos gastos, la del endpoint', () => {
    // La lámina dibuja «$61.500 − $200.000» y luego «a entregar $61.500»: no cuadra
    // consigo misma y omite los gastos. Manda `app/api/caja/cobrador/[id]`.
    const c = cierreDelDia({ cobradoEfectivo: 200_000, prestadoEfectivo: 50_000, gastos: 10_000 }, fmt)
    expect(c.numeros.neto).toBe(140_000)
    expect(c.total).toBe('$140.000')
    expect(c.aFavor).toBe(false)
    expect(c.totalTexto).toBe('A entregar')
  })

  it('si prestó más de lo que cobró, la casa le debe a él', () => {
    // Un `Math.max(0, …)` aquí esconderia una deuda real: le pediría poner de su
    // bolsillo lo que la casa le debe.
    const c = cierreDelDia({ cobradoEfectivo: 61_500, prestadoEfectivo: 200_000, gastos: 8_000 }, fmt)
    expect(c.numeros.neto).toBe(-146_500)
    expect(c.aFavor).toBe(true)
    expect(c.totalTexto).toBe('Te deben')
    expect(c.total).toBe('$146.500')          // sin el menos: el título ya lo dice
    expect(c.titulo).toBe('Hoy te deben a ti')
  })

  it('las líneas en cero no se enseñan', () => {
    const c = cierreDelDia({ cobradoEfectivo: 61_500, prestadoEfectivo: 0, gastos: 0 }, fmt)
    expect(c.lineas.map((l) => l.id)).toEqual(['cobrado'])
  })

  it('lo que sale de la caja va marcado como resta', () => {
    const c = cierreDelDia({ cobradoEfectivo: 100, prestadoEfectivo: 50, gastos: 10 }, fmt)
    expect(c.lineas.filter((l) => l.resta).map((l) => l.id)).toEqual(['prestado', 'gastos'])
  })

  it('el resumen no promete un porcentaje sin nada esperado', () => {
    expect(resumenDeCierre({ recaudadoHoy: 0, esperadoHoy: 0 }, fmt).porcentaje).toBeNull()
  })

  it('el resumen cuenta cobrados y no pagaron', () => {
    const r = resumenDeCierre({
      recaudadoHoy: 61_500, esperadoHoy: 74_500,
      clientesConCobroHoy: 5, clientesPagaronHoy: 4,
    }, fmt)
    expect(r.porcentaje).toBe('83%')
    expect(r.datos).toEqual(['4 cobrados', '1 no pagó', 'de $74.500'])
  })

  it('el que no pagó lleva su motivo entre comillas', () => {
    const [a, b] = loQuePasoHoy([
      { id: 1, nombre: 'Steven', hora: '14:12', concepto: 'cuota completa', monto: 27_500 },
      { id: 2, nombre: 'Carmen', hora: '17:02', tipo: 'no_pago', motivo: 'vuelve mañana', monto: 13_000 },
    ], fmt)
    expect(a.detalle).toBe('14:12 · cuota completa')
    expect(a.pago).toBe(true)
    expect(b.detalle).toBe('17:02 · no pagó · “vuelve mañana”')
    expect(b.pago).toBe(false)
    // El monto sigue ahí: es lo que se dejó de cobrar.
    expect(b.monto).toBe('$13.000')
  })
})

describe('la ruta en mapa (T11-02)', () => {
  const clientes = [
    { id: 1, orden: 1, diasMora: 36 },
    { id: 2, orden: 2, cobradoHoy: true },
    { id: 3, orden: 3, diasMora: 9 },
  ]

  it('el color del pin sale de la misma función que el filete de la lista', () => {
    // Dos vistas de lo mismo no pueden discrepar.
    expect(pinesDelMapa(clientes).map((p) => p.color)).toEqual(['rojo', 'verde', 'oro'])
    expect(pinesDelMapa(clientes).map((p) => p.color)).toEqual(clientes.map((c) => colorDeParada(c)))
  })

  it('la leyenda cubre los tres colores que se pintan', () => {
    expect(LEYENDA_MAPA.map((l) => l.color).sort()).toEqual(['oro', 'rojo', 'verde'])
  })

  it('el tiempo del mapa es una estimación y lo dice', () => {
    // «~1 h 20» promete menos que «1 h 20».
    expect(cabeceraMapa({ cobros: 5, metros: 3400, minutos: 80 })).toBe('5 cobros · 3,4 km · ~1 h 20')
  })

  it('sin datos no quedan separadores colgando', () => {
    expect(cabeceraMapa({ cobros: 1 })).toBe('1 cobro')
    expect(cabeceraMapa({})).toBe('')
  })
})
