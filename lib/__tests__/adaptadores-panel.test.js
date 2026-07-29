import { describe, it, expect } from 'vitest'
import { adaptarPanel, saludoDe, primerNombre, filasAtencion, porRutaHoy, tonoDeRuta } from '@/lib/adaptadores/panel'

// El panel es la pantalla donde más fácil se cuela un error de plata: la última
// vez restó los gastos dos veces al calcular el patrimonio por su cuenta. Aquí
// no se recalcula nada — se comprueba justamente eso.

describe('saludoDe', () => {
  it('cambia con la hora del usuario', () => {
    expect(saludoDe(7)).toBe('Buenos días')
    expect(saludoDe(11)).toBe('Buenos días')
    expect(saludoDe(12)).toBe('Buenas tardes')
    expect(saludoDe(19)).toBe('Buenas noches')
    expect(saludoDe(23)).toBe('Buenas noches')
  })

  it('sin hora saluda sin inventarse el momento del día', () => {
    expect(saludoDe(undefined)).toBe('Hola')
    expect(saludoDe(NaN)).toBe('Hola')
  })
})

describe('primerNombre', () => {
  it('solo el primero: un saludo con tres apellidos no es un saludo', () => {
    expect(primerNombre('Carlos Andrés Ojeda')).toBe('Carlos')
    expect(primerNombre('  Marta  ')).toBe('Marta')
    expect(primerNombre('')).toBe('')
  })
})

describe('filasAtencion', () => {
  it('no pinta filas en cero: una alarma apagada enseña a ignorar las encendidas', () => {
    expect(filasAtencion({ clientesSinRuta: 0, prestamosSinPagosLargo: 0 }, 0)).toEqual([])
    expect(filasAtencion(null, 0)).toEqual([])
    expect(filasAtencion(undefined, 0)).toEqual([])
  })

  it('la mora NO se repite aqui: ya vive en su tarjeta', () => {
    // T02-01 corrige que «la misma cifra de mora dejo de repetirse tres veces».
    // El conteo va en la tarjeta blanca con su monto expuesto; esta lista lleva
    // un corte DISTINTO —los que pasan de 30 dias—, que es otra decision:
    // «se atraso» y «probablemente no vuelve» no son lo mismo.
    const filas = filasAtencion({ clientesSinRuta: 2, prestamosSinPagosLargo: 3, mora30plus: 13 })
    expect(filas.map((f) => f.texto)).not.toContain('5 clientes en mora')
    expect(filas[0].texto).toBe('13 prestamos con mas de 30 dias de mora'
      .replace('prestamos', 'préstamos').replace('mas', 'más').replace('dias', 'días'))
    expect(filas[0].tono).toBe('mora')
  })

  it('las cuatro filas de la lamina, en su orden', () => {
    const filas = filasAtencion({
      mora30plus: 13, prestamosSinPagosLargo: 41, listosParaRenovar: 5, clientesSinRuta: 1,
    })
    expect(filas.map((f) => f.tono)).toEqual(['mora', 'atraso', 'ok', 'atraso'])
    // «Listos para renovar» va en VERDE: no es un problema, es plata esperando.
    expect(filas[2].texto).toMatch(/5 préstamos listos para renovar/)
  })

  it('sin ruta es ámbar, no rojo: es trabajo pendiente, no plata en riesgo', () => {
    const [fila] = filasAtencion({ clientesSinRuta: 4 }, 0)
    expect(fila.tono).toBe('atraso')
    expect(fila.texto).toBe('4 clientes sin ruta asignada')
  })

  it('singular sin "(s)"', () => {
    expect(filasAtencion({ clientesSinRuta: 1 })[0].texto).toBe('1 cliente sin ruta asignada')
    expect(filasAtencion({ mora30plus: 1 })[0].texto).toMatch(/^1 préstamo con/)
    expect(filasAtencion({ listosParaRenovar: 1 })[0].texto).toBe('1 préstamo listo para renovar')
  })
})

describe('adaptarPanel', () => {
  const crudo = {
    clientes: { total: 40, enMora: 5 },
    prestamos: { saldoPorCobrar: 4_200_000, esperadoHoy: 137_334 },
    finanzas: { patrimonio: 8_500_000, cajaDisponible: 2_520_280, gastosMes: 310_000 },
    cobros: { hoy: 68_667 },
    alertas: { clientesSinRuta: 0, prestamosSinPagosLargo: 0 },
  }

  it('usa el patrimonio del servidor TAL CUAL, sin volver a restar gastos', () => {
    const p = adaptarPanel(crudo, { pais: 'co' })
    // 8.500.000 exacto. Si alguien vuelve a restar gastosMes aquí, salen
    // 8.190.000 y esta prueba lo dice.
    expect(p.patrimonio).toContain('8.500.000')
  })

  it('el cobrador no ve patrimonio ni caja: el servidor manda finanzas null', () => {
    const p = adaptarPanel({ ...crudo, finanzas: null }, { pais: 'co' })
    expect(p.patrimonio).toBeNull()
    expect(p.enCaja).toBeNull()
    // Lo que sí es suyo se sigue viendo.
    expect(p.porCobrar).toContain('4.200.000')
    expect(p.clientesEnMora).toBe(5)
  })

  it('el porcentaje del día es recaudado sobre lo esperado', () => {
    expect(adaptarPanel(crudo, { pais: 'co' }).hoy.porcentaje).toBe(50)
  })

  it('sin nada esperado el porcentaje es 0, no una división por cero', () => {
    const p = adaptarPanel({ ...crudo, prestamos: { saldoPorCobrar: 0, esperadoHoy: 0 } }, { pais: 'co' })
    expect(p.hoy.porcentaje).toBe(0)
    expect(p.hoy.esperado).toBeNull()
  })

  it('cobrar de más no pasa del 100%', () => {
    const p = adaptarPanel({ ...crudo, cobros: { hoy: 500_000 } }, { pais: 'co' })
    expect(p.hoy.porcentaje).toBe(100)
  })

  it('sin cobrar nada devuelve null, no "$0" en verde', () => {
    const p = adaptarPanel({ ...crudo, cobros: { hoy: 0 } }, { pais: 'co' })
    expect(p.hoy.recaudado).toBeNull()
  })

  it('aguanta una respuesta vacía sin reventar la pantalla', () => {
    const p = adaptarPanel(null, { pais: 'co' })
    expect(p.clientesEnMora).toBe(0)
    expect(p.atencion).toEqual([])
    expect(p.hoy.porcentaje).toBe(0)
  })
})

describe('el hero dorado y las dos tarjetas (T02-01)', () => {
  const crudo = {
    clientes: { total: 25, enMora: 20, saldoEnMora: 3100000 },
    prestamos: { esperadoHoy: 872867, clientesConCobroHoy: 20 },
    finanzas: { cajaDisponible: 2520280, patrimonio: 6589938 },
    cobros: { hoy: 412000, cantidadHoy: 9, ayer: 79000 },
  }

  it('el hero trae recaudado, meta, porcentaje y el pie de tres', () => {
    const p = adaptarPanel(crudo, { pais: 'CO', hora: 7, clientesHoy: 20 })
    expect(p.hero.recaudado).toBe('$412.000')
    expect(p.hero.meta).toBe('$872.867')
    expect(p.hero.porcentaje).toBe(47)
    expect(p.hero.cobrados).toBe(9)
    expect(p.hero.pendientes).toBe(11)
    expect(p.hero.ayer).toBe('$79.000')
  })

  it('los pendientes nunca son negativos', () => {
    // Si cobran a alguien que no tocaba hoy, `cobrados` puede pasar de
    // `clientesHoy`, y un «-2 pendientes» no significa nada.
    const p = adaptarPanel({ ...crudo, cobros: { ...crudo.cobros, cantidadHoy: 30 } },
      { pais: 'CO', hora: 7, clientesHoy: 20 })
    expect(p.hero.pendientes).toBe(0)
  })

  it('la mora dice cuantos, de cuantos, y CUANTA PLATA', () => {
    // El conteo solo no dice el tamano del problema.
    const p = adaptarPanel(crudo, { pais: 'CO', hora: 7 })
    expect(p.mora).toMatchObject({ cuantos: 20, deCuantos: 25 })
    expect(p.mora.expuesto).toBe('$3.100.000')
  })

  it('sin ayer no escribe «ayer $0»', () => {
    const p = adaptarPanel({ ...crudo, cobros: { ...crudo.cobros, ayer: 0 } }, { pais: 'CO', hora: 7 })
    expect(p.hero.ayer).toBeNull()
  })

  it('al cobrador no le dice la caja: el servidor le manda finanzas null', () => {
    const p = adaptarPanel({ ...crudo, finanzas: null }, { pais: 'CO', hora: 7 })
    expect(p.caja).toBeNull()
  })
})

describe('porRutaHoy', () => {
  const rutas = [
    { id: 'a', nombre: 'Ruta norte', esperadoHoy: 100000, recaudadoHoy: 78000 },
    { id: 'b', nombre: 'Ruta sur',   esperadoHoy: 100000, recaudadoHoy: 34000 },
    { id: 'c', nombre: 'Ruta goty',  esperadoHoy: 100000, recaudadoHoy: 0 },
    { id: 'd', nombre: 'Sin cobros', esperadoHoy: 0,      recaudadoHoy: 0 },
  ]

  it('deja fuera las rutas sin nada que cobrar hoy', () => {
    // Una ruta al 0% porque hoy no le toca no es una ruta atrasada.
    const r = porRutaHoy(rutas, 'CO')
    expect(r.rutas.map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })

  it('el color responde «a quien llamo»: verde desde 60', () => {
    const r = porRutaHoy(rutas, 'CO')
    expect(r.rutas.map((x) => x.tono)).toEqual(['ok', 'oro', 'nada'])
    expect(tonoDeRuta(60)).toBe('ok')
    expect(tonoDeRuta(59)).toBe('oro')
    expect(tonoDeRuta(0)).toBe('nada')
  })

  it('el encabezado es la SUMA de las barras, para que cuadre a la vista', () => {
    const r = porRutaHoy(rutas, 'CO')
    expect(r.recaudado).toBe('$112.000')
    expect(r.meta).toBe('$300.000')
  })

  it('sin rutas no revienta', () => {
    expect(porRutaHoy(null, 'CO').rutas).toEqual([])
    expect(porRutaHoy([], 'CO').rutas).toEqual([])
  })
})
