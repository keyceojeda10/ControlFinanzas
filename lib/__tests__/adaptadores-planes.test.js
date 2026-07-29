import { describe, it, expect } from 'vitest'
import { tramosDePlan, limiteInicial, recomendarPlan, planMinimo, pesoDelPlan, adaptarPlanExcedido, razonDelPlan } from '@/lib/adaptadores/planes'
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

// «03 · Plan excedido» — la pantalla más delicada del sistema, porque es donde
// la app le cobra. Las tres decisiones del diseñador, fijadas aquí.

describe('recomendarPlan — por la cartera, no por el mínimo que cabe', () => {
  it('con 160 clientes NO recomienda el de 450, que lo bloquea otra vez pronto', () => {
    // 160 × 2 = 320. basic (450) ya deja sitio, así que ese es el bueno…
    expect(recomendarPlan(160)).toBe('basic')
    // …pero con 240 el de 450 ya queda justo y salta al siguiente.
    expect(recomendarPlan(240)).toBe('growth')
  })

  it('el mínimo que cabe y el recomendado NO son el mismo cuando queda justo', () => {
    expect(planMinimo(400)).toBe('basic')      // en 450 caben
    expect(recomendarPlan(400)).toBe('growth') // pero 400×2 = 800, no caben
  })

  it('cuando ya no hay plan más grande, no devuelve null: devuelve el mayor', () => {
    expect(recomendarPlan(9000)).toBe('professional')
  })

  it('sin clientes no recomienda nada', () => {
    expect(recomendarPlan(0)).toBeNull()
    expect(recomendarPlan(null)).toBeNull()
  })
})

describe('pesoDelPlan — el precio contra lo que tiene en la calle', () => {
  it('un decimal, que es lo que se lee', () => {
    expect(pesoDelPlan(79000, 25_100_000)).toBe(0.3)
  })

  it('sin cartera NO calcula: sobre cero es infinito, y un 0% es mentira', () => {
    expect(pesoDelPlan(79000, 0)).toBeNull()
    expect(pesoDelPlan(79000, null)).toBeNull()
  })
})

describe('adaptarPlanExcedido', () => {
  const base = { plan: 'starter', clientes: 160, carteraPorCobrar: 25_100_000, pais: 'co' }

  it('el rótulo y el título salen del plan real, no del handoff', () => {
    const v = adaptarPlanExcedido(base, String)
    expect(v.rotulo).toBe('Plan Inicial · 150 clientes')
    expect(v.titulo).toBe('Tienes 160 clientes y tu plan cubre 150')
    // Nada de «Plan Negocio» ni «Plan Medio»: esos no existen en el código.
    expect(v.recomendado.nombre).not.toMatch(/Negocio|Medio/)
  })

  it('el detalle nombra el cliente que NO puede crear', () => {
    expect(adaptarPlanExcedido(base, String).detalle).toContain('el número 161')
  })

  it('no enseña dos veces el mismo plan', () => {
    // Con 160, mínimo y recomendado coinciden en basic.
    expect(adaptarPlanExcedido(base, String).alternativa).toBeNull()
    // Con 400 son distintos, y ahí sí se ofrecen los dos.
    const v = adaptarPlanExcedido({ ...base, clientes: 400 }, String)
    expect(v.alternativa?.id).toBe('basic')
    expect(v.recomendado.id).toBe('growth')
  })

  it('la acción lleva el precio, no «gestionar suscripción»', () => {
    const v = adaptarPlanExcedido(base, (n) => `$${n}`)
    expect(v.accion).toBe('Subir a Básico · $59000')
  })
})

// El fallo que solo se vio al mirar la captura: a alguien del plan Básico la
// pantalla le ofrecía subir… al plan Básico. No es un error de cálculo, es la
// app pidiendo plata por nada.
describe('nunca ofrece el plan que ya tiene', () => {
  it('el recomendado está por encima del actual', () => {
    expect(recomendarPlan(400, { planActual: 'basic' })).toBe('growth')
    expect(recomendarPlan(160, { planActual: 'starter' })).toBe('basic')
  })

  it('la alternativa tampoco puede ser el suyo', () => {
    const v = adaptarPlanExcedido({ plan: 'basic', clientes: 400, carteraPorCobrar: 61_000_000 }, String)
    expect(v.alternativa?.id).not.toBe('basic')
    expect(v.recomendado.id).not.toBe('basic')
  })

  it('en el plan más grande no hay a qué subir', () => {
    expect(recomendarPlan(20_000, { planActual: 'professional' })).toBeNull()
    expect(adaptarPlanExcedido({ plan: 'professional', clientes: 20_000, carteraPorCobrar: 1 }, String)).toBeNull()
  })
})

describe('razonDelPlan — no promete lo que no da', () => {
  it('«triplicar» solo cuando de verdad triplica', () => {
    expect(razonDelPlan(31, 100)).toBe('te alcanza para triplicar tu cartera')
    expect(razonDelPlan(400, 1000)).toBe('te alcanza para doblar tu cartera')
    expect(razonDelPlan(400, 450)).toBe('te deja sitio para crecer')
  })

  it('si no cabe ni uno más, no inventa una razón', () => {
    expect(razonDelPlan(500, 450)).toBeNull()
  })
})
