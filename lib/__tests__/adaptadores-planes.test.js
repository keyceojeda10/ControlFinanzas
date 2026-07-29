import { describe, it, expect } from 'vitest'
import { tramosDePlan, limiteInicial } from '@/lib/adaptadores/planes'
import { PLANES_CONFIG, getPrecioPlan } from '@/lib/planes'

// La pantalla tenía «Hasta 20 clientes $39.000» escrito a mano, copiado del
// handoff. El precio coincidía; el límite real de ese plan es 150. Vendía el
// producto siete veces peor de lo que es, en la pantalla que decide si la
// persona sube su cartera. Estas pruebas fijan que no vuelva a haber números
// escritos dos veces.

describe('tramosDePlan', () => {
  it('los límites salen de PLANES_CONFIG, no de la pantalla', () => {
    const t = tramosDePlan('co', String)
    expect(t.map((x) => x.limite)).toEqual([
      PLANES_CONFIG.starter.maxClientes,
      PLANES_CONFIG.basic.maxClientes,
      PLANES_CONFIG.growth.maxClientes,
    ])
    // Y son los de verdad, no los 20/40/100 del handoff.
    expect(t[0].limite).toBe(150)
    expect(t[0].limite).not.toBe(20)
  })

  it('los precios salen de getPrecioPlan, con el país', () => {
    const co = tramosDePlan('co', (n) => String(n))
    const mx = tramosDePlan('mx', (n) => String(n))
    expect(co[0].precio).toBe(String(getPrecioPlan('starter', 'co')))
    expect(mx[0].precio).toBe(String(getPrecioPlan('starter', 'mx')))
    // Colombia y México NO pueden enseñar la misma cifra.
    expect(co[0].precio).not.toBe(mx[0].precio)
  })

  it('van de barato a caro: una escalera que baja de precio no se entiende', () => {
    const t = tramosDePlan('co', (n) => n)
    expect(t[0].precio).toBeLessThan(t[1].precio)
    expect(t[1].precio).toBeLessThan(t[2].precio)
  })

  it('el primero dice «clientes» y los demás no lo repiten', () => {
    const t = tramosDePlan('co', String)
    expect(t[0].texto).toBe('Hasta 150 clientes')
    expect(t[1].texto).toBe('Hasta 450')
  })

  it('tres tramos: con más, la tabla deja de ser referencia y hay que leerla', () => {
    expect(tramosDePlan('co', String)).toHaveLength(3)
    expect(tramosDePlan('co', String, 2)).toHaveLength(2)
  })

  // getPrecioPlan cae a Colombia cuando el país no está en la tabla. Se deja
  // así a propósito: entre enseñar una tabla vacía —que parece que la app está
  // rota— y enseñar la referencia en pesos, la segunda informa más. La prueba
  // fija ese comportamiento para que el día que alguien lo cambie sea a sabiendas.
  it('un país desconocido cae a la tabla de Colombia, no a una tabla vacía', () => {
    const xx = tramosDePlan('xx', String)
    expect(xx).toHaveLength(3)
    expect(xx.map((t) => t.precio)).toEqual(tramosDePlan('co', String).map((t) => t.precio))
  })
})

describe('limiteInicial', () => {
  it('es el tope del plan más barato, el mismo que enseña el primer tramo', () => {
    expect(limiteInicial()).toBe(PLANES_CONFIG.starter.maxClientes)
    expect(limiteInicial()).toBe(tramosDePlan('co', String)[0].limite)
  })
})
