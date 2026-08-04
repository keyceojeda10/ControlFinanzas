import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { bandaDelDia, adaptarRutas } from '@/lib/adaptadores/rutas'

// El dueño comparo la lamina T04-01 con lo que tenemos: «no tenemos la cabecera
// naranja y las tarjetas son diferentes, con mas datos».
//
// El pie de la lamina: «Cada ruta trae lo que decide a cual entrar: plata de
// hoy, cobros hechos, cartera y atraso acumulado».
const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('la banda del dia', () => {
  it('trae la meta, lo recaudado y el detalle', () => {
    const b = bandaDelDia([
      { esperadoHoy: 500000, recaudadoHoy: 0, cobrosHoy: 12 },
      { esperadoHoy: 372867, recaudadoHoy: 0, cobrosHoy: 8 },
    ], 'CO')
    expect(b.esperado).toBe('$872.867')
    expect(b.recaudado).toBe('$0')
    expect(b.detalle).toBe('2 rutas · 20 cobros hoy')
  })

  it('no sale si hoy no hay nada que cobrar', () => {
    // Una banda con dos ceros ocupa el sitio de la primera ruta sin decir nada.
    expect(bandaDelDia([{ esperadoHoy: 0, recaudadoHoy: 0 }], 'CO')).toBeNull()
    expect(bandaDelDia([], 'CO')).toBeNull()
  })

  it('solo cuenta las rutas con cobros hoy', () => {
    // Una ruta dormida no sube la meta del dia.
    const b = bandaDelDia([
      { esperadoHoy: 100000, recaudadoHoy: 40000, cobrosHoy: 3 },
      { esperadoHoy: 0, recaudadoHoy: 0, cobrosHoy: 0 },
    ], 'CO')
    expect(b.esperado).toBe('$100.000')
    expect(b.recaudado).toBe('$40.000')
  })
})

describe('las cuatro cifras de la tarjeta', () => {
  it('el adaptador las produce', () => {
    const [r] = adaptarRutas([{
      id: 'r1', nombre: 'Ruta #1', cantidadClientes: 7,
      esperadoHoy: 79000, recaudadoHoy: 0,
      cobrosHoy: 2, cobradosHoy: 0,
      totalAPagarRuta: 1200000, atrasoRuta: 344000,
      cobrador: { nombre: 'Carlos' },
    }], 'CO')
    expect(r.recaudado).toBe('$0')
    expect(r.cobros).toBe('0 / 2')
    // `cartera` ya existia en el adaptador, con `abreviarMillones` y sujeta al
    // permiso de ver capital. Mi primera version la duplico y la de abajo la
    // pisaba, asi que salia `null` con el dato puesto. Lo cazo esta prueba.
    expect(r.cartera).toBe('$1,2M')
    expect(r.atraso).toBe('$344.000')
    expect(r.atrasoNumero).toBe(344000)
  })

  it('sin las cifras del servidor no inventa ceros', () => {
    // Un «$0» de cartera diria que la ruta no tiene nada puesto, que es otra
    // cosa muy distinta a no saberlo. La tarjeta pinta «—».
    const [r] = adaptarRutas([{ id: 'r1', nombre: 'X', esperadoHoy: 1000 }], 'CO')
    expect(r.cartera).toBeNull()
    expect(r.atraso).toBeNull()
  })
})

describe('la pantalla', () => {
  const jsx = leer('components/pantallas/ListaRutas.jsx')

  it('pinta la banda en ambar', () => {
    expect(jsx).toMatch(/background: 'var\(--cf-gold\)', color: 'var\(--cf-gold-ink\)'/)
    expect(jsx).toContain('Esperado hoy')
  })

  it('la tarjeta lleva las cuatro, y el atraso en rojo si lo hay', () => {
    for (const r of ['Hoy', 'Cobros', 'Cartera', 'Atraso']) {
      expect(jsx, `falta la cifra «${r}»`).toContain(`rotulo="${r}"`)
    }
    expect(jsx).toMatch(/atrasoNumero > 0 \? 'contra' : undefined/)
  })

  it('no repite el detalle arriba y dentro de la banda', () => {
    expect(jsx).toMatch(/\{banda \? banda\.detalle : resumen\}/)
  })
})
