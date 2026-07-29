import { describe, it, expect } from 'vitest'
import { adaptarPanel, saludoDe, primerNombre, filasAtencion } from '@/lib/adaptadores/panel'

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

  it('la mora va primero y en rojo', () => {
    const filas = filasAtencion({ clientesSinRuta: 2, prestamosSinPagosLargo: 3 }, 5)
    expect(filas[0].titulo).toBe('5 clientes en mora')
    expect(filas[0].tono).toBe('mal')
  })

  it('sin ruta es ámbar, no rojo: es trabajo pendiente, no plata en riesgo', () => {
    const [fila] = filasAtencion({ clientesSinRuta: 4 }, 0)
    expect(fila.tono).toBe('ambar')
    expect(fila.titulo).toBe('4 clientes sin ruta')
  })

  it('singular sin "(s)"', () => {
    expect(filasAtencion({}, 1)[0].titulo).toBe('1 cliente en mora')
    expect(filasAtencion({ clientesSinRuta: 1 }, 0)[0].titulo).toBe('1 cliente sin ruta')
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
