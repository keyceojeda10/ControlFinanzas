/* El motor de movimiento de las hojas, probado con números y no con capturas.
 *
 * Es la parte que NO se puede juzgar mirando: si el muelle se pasa de largo, si
 * no para nunca, o si al volver de otra pestaña sale disparado, en una captura
 * se ve una hoja quieta y parece que todo está bien. */
import { describe, it, expect } from 'vitest'
import { paso, asentado, proyectar, resistencia, constantes, velocidadDe } from '@/lib/muelle'

const correr = (desde, destino, opciones = {}, velocidad = 0) => {
  let e = { valor: desde, velocidad }
  let maximo = desde, cuadros = 0
  while (!asentado(e, destino) && cuadros < 600) {
    e = paso(e, destino, 1 / 60, opciones)
    maximo = Math.max(maximo, e.valor)
    cuadros += 1
  }
  return { ...e, maximo, cuadros, segundos: cuadros / 60 }
}

describe('el muelle llega y se queda', () => {
  it('llega al destino', () => {
    const r = correr(300, 0)
    expect(r.valor).toBeCloseTo(0, 0)
    expect(r.cuadros).toBeLessThan(600)   // ⚠ o el bucle no para nunca
  })

  it('con amortiguación 1 NO se pasa de largo', () => {
    /* «Un rebote en un menú que apareció solo se siente mal.» Ésta es la
       cortesía por defecto de toda la interfaz. */
    const r = correr(0, 300, { amortiguacion: 1, respuesta: 0.4 })
    expect(r.maximo).toBeLessThanOrEqual(300.5)
  })

  it('menos amortiguación = más rebote, y con 1 no hay ninguno', () => {
    /* ⚠ MEDIDO, NO SUPUESTO. Escribí primero que con 0,8 se pasaba de 300 y la
       prueba cayó en 299,9. No era el motor: con amortiguación 0,8 el rebote
       teórico son 4,5px sobre 300 —un 1,5%— y a 60 cuadros por segundo el
       método numérico se lo come. Comprobado contra la teoría en las cinco
       amortiguaciones: 0,5 → 338 medidos de 349 teóricos; 0,7 → 304 de 314.

       Lo que sí hay que garantizar es la PROPIEDAD, no un número concreto: que
       bajar la amortiguación añade rebote y que 1 no rebota nunca. */
    const suave  = correr(0, 300, { amortiguacion: 0.5, respuesta: 0.3 })
    const firme  = correr(0, 300, { amortiguacion: 0.8, respuesta: 0.3 })
    const seco   = correr(0, 300, { amortiguacion: 1.0, respuesta: 0.3 })
    expect(suave.maximo).toBeGreaterThan(320)          // se pasa y se ve
    expect(suave.maximo).toBeLessThan(360)             // un guiño, no un salto
    expect(suave.maximo).toBeGreaterThan(firme.maximo)
    expect(firme.maximo).toBeGreaterThanOrEqual(seco.maximo)
    expect(seco.maximo).toBeLessThanOrEqual(300.5)
  })

  it('la respuesta manda en lo rápido que llega', () => {
    const rapido = correr(300, 0, { respuesta: 0.2 })
    const lento  = correr(300, 0, { respuesta: 0.6 })
    expect(rapido.segundos).toBeLessThan(lento.segundos)
  })

  it('⚠ un salto de tiempo enorme NO lo dispara', () => {
    /* Al volver de otra pestaña el navegador entrega varios segundos de golpe.
       Sin acotar el paso, el muelle salía disparado y la hoja se iba de la
       pantalla. Se comprueba que un `dt` de 3 segundos no lo aleja más de donde
       estaba. */
    const e = paso({ valor: 300, velocidad: 0 }, 0, 3)
    expect(Math.abs(e.valor)).toBeLessThan(300)
    expect(Number.isFinite(e.valor)).toBe(true)
  })

  it('los dos números se traducen a la física', () => {
    const { rigidez, freno } = constantes(1, 0.4)
    expect(rigidez).toBeCloseTo(((2 * Math.PI) / 0.4) ** 2, 5)
    expect(freno).toBeCloseTo(2 * ((2 * Math.PI) / 0.4), 5)
  })
})

describe('la proyección del impulso', () => {
  it('un empujón rápido llega mucho más lejos que uno lento', () => {
    expect(proyectar(2000)).toBeGreaterThan(proyectar(400) * 4)
  })

  it('hacia arriba proyecta negativo, y sin velocidad no se mueve', () => {
    expect(proyectar(-1200)).toBeLessThan(0)
    expect(proyectar(0)).toBe(0)
  })

  it('⚠ NO es la fórmula del libro de física', () => {
    /* v²/(2a) da un número muy distinto, y con él un empujón suave cerraría
       hojas que no querías cerrar. A 1.000 px/s la caída exponencial proyecta
       casi 500px; conviene que esté en ese orden y no en el de 30. */
    expect(proyectar(1000)).toBeGreaterThan(400)
    expect(proyectar(1000)).toBeLessThan(600)
  })
})

describe('la resistencia del borde', () => {
  it('cuanto más tiras, proporcionalmente menos te sigue', () => {
    const poco  = resistencia(20, 600)
    const mucho = resistencia(200, 600)
    expect(mucho).toBeGreaterThan(poco)          // sigue moviéndose: está vivo
    expect(mucho / 200).toBeLessThan(poco / 20)  // pero cada vez menos
  })

  it('nunca deja pasar más de lo que tiras', () => {
    for (const x of [5, 50, 500, 5000]) expect(resistencia(x, 600)).toBeLessThan(x)
  })

  it('sin dimensión no revienta', () => {
    expect(resistencia(100, 0)).toBe(0)
  })
})

describe('la velocidad con la que se soltó', () => {
  const historia = (puntos) => puntos   // [ms, posición]

  it('un tirón reciente da velocidad', () => {
    // 60px en 100ms = 600 px/s
    expect(velocidadDe(historia([[1000, 0], [1100, 60]]), 1100)).toBeCloseTo(600, 0)
  })

  it('⚠ si el dedo se paró, la velocidad es CERO', () => {
    /* El fallo que encontré probando: bajas la hoja, te lo piensas un segundo
       con el dedo quieto y sueltas. No llegan eventos mientras estás parado, así
       que la historia guarda el tirón viejo — y la hoja se cerraba sola. */
    const h = historia([[1000, 0], [1100, 60]])
    expect(velocidadDe(h, 1100)).toBeGreaterThan(0)   // recién soltado: sí
    expect(velocidadDe(h, 2000)).toBe(0)              // un segundo después: no
  })

  it('cuenta el recorrido reciente, no el último par', () => {
    /* Dos puntos seguidos dan saltos enormes en cuanto el dedo duda: aquí el
       último par sugiere 100 px/s y el tramo reciente entero, mucho más. */
    const h = historia([[1000, 0], [1050, 50], [1100, 55]])
    expect(velocidadDe(h, 1100)).toBeGreaterThan(300)
  })

  it('hacia arriba es negativa, y con basura no revienta', () => {
    expect(velocidadDe(historia([[1000, 60], [1100, 0]]), 1100)).toBeLessThan(0)
    expect(velocidadDe(null, 1)).toBe(0)
    expect(velocidadDe([], 1)).toBe(0)
    expect(velocidadDe([[1, 0]], 1)).toBe(0)
  })
})
