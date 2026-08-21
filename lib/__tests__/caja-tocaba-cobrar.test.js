import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (...p) => readFileSync(join(process.cwd(), ...p), 'utf8')
/* ⚠ SIN LOS COMENTARIOS. Este repo explica el porqué al lado del código, y el
   arreglo de abajo cita el rótulo viejo tres veces para contar qué pasaba: una
   prueba que buscara la cadena a secas se pondría roja por su propia
   explicación. Se mira el código, no la prosa. */
const pagina = leer('app', '(dashboard)', 'caja', 'page.jsx')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')

describe('la caja no llama «lo que tienes» a «lo que tocaba cobrar»', () => {
  /* EL CASO, medido en el espejo el 21 ago 2026 con un cobrador que prestó
     $450.000 en la calle y cobró $92.600:

         Te queda en la mano   −$357.400   ← lo que de verdad tiene
         Deberías tener en caja $177.500   ← lo que TOCABA cobrar

     Dos respuestas distintas a la misma pregunta, en la misma pantalla y a
     cuatro renglones. La segunda es `esperadoDeCartera`, que no sabe nada del
     efectivo: con un cobrador que no presta las dos casi coinciden y el nombre
     pasa desapercibido, pero en cuanto entrega plata se separan.

     Y arrastraba a la «Diferencia» del cierre, que se pinta en ROJO cuando es
     negativa: le decía «te falta plata» a quien simplemente no le cobró a
     todo el mundo, que es un día normal. */

  it('el rótulo de `stats.esperado` dice lo que la cifra es', () => {
    expect(pagina, 'volvió «Deberías tener», que es otra pregunta')
      .not.toMatch(/Deber[ií]as tener/)
    expect(pagina).toMatch(/Lo que tocaba cobrar hoy/)
  })

  it('y sigue pegado a la MISMA cifra, no se cambió la cuenta', () => {
    // El rótulo y el valor van en la misma fila: si alguien mueve el nombre a
    // otro número, esto cae.
    const i = pagina.indexOf('Lo que tocaba cobrar hoy')
    expect(i, 'no encuentro el rótulo en vivo').toBeGreaterThan(-1)
    expect(pagina.slice(i, i + 320)).toMatch(/formatMoney\(stats\.esperado/)
  })

  it('el recibo del cierre lo llama igual', () => {
    const i = pagina.indexOf("label: 'Tocaba cobrar'")
    expect(i, 'el cierre volvió a llamarlo de otra manera').toBeGreaterThan(-1)
    expect(pagina.slice(i, i + 160)).toMatch(/cierreHoy\.totalEsperado/)
  })

  it('⚠ y las dos cajas lo llaman igual', () => {
    /* La regla del dueño: «ambas deben reportar lo mismo». Eso empieza por
       llamarlo con la misma palabra — el lado del administrador ponía
       «Esperado» y el del cobrador «Deberías tener» para la MISMA cifra. */
    expect(pagina, 'el administrador volvió a decir «Esperado»')
      .not.toMatch(/>Esperado</)
    const porRuta = leer('components', 'caja', 'CajaPorRuta.jsx')
    expect(porRuta).toMatch(/etiqueta="Tocaba cobrar"/)
  })
})
