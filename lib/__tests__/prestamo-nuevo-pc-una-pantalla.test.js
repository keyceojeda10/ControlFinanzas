import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

/* ══════════════════════════════════════════════════════════════════════════
   T16-00 · «EN PC NO HAY QUE HACER WIZARD»

   Medido a 1440px antes de tocar: el primer paso enseñaba tres clientes
   ocupando media pantalla, con dos tercios vacíos, y había que pulsar
   «Continuar» dos veces para poder escribir el monto.

   Estas son pruebas de fuente. Lo que de verdad protege el dinero es
   `.auditoria/_crear-igual-pc-y-movil.mjs`, que crea el MISMO préstamo por los
   dos caminos y compara las 34 columnas en la base. Esto de aquí es lo que
   avisa cuando alguien deshace la reorganización sin querer.
   ══════════════════════════════════════════════════════════════════════════ */

const p = fs.readFileSync('app/(dashboard)/prestamos/nuevo/page.jsx', 'utf8')

describe('cliente y condiciones, en la misma pantalla', () => {
  it('el bloque de condiciones se pinta también en el paso 0 cuando hay sitio', () => {
    expect(p).toMatch(/const verCondiciones = paso === 1 \|\| \(unaPantalla && paso === 0\)/)
    expect(p).toMatch(/\{verCondiciones && \(/)
    // Y ya no puede quedar el `{paso === 1 && (` que lo escondía.
    expect(p, 'volvió el bloque atado al paso 1').not.toMatch(/\n {6}\{paso === 1 && \(\n/)
  })

  it('«Revisar préstamo» exige el monto, no solo el cliente', () => {
    /* Si se quedara en `!!clienteId`, en PC el botón se encendía con solo
       elegir cliente y saltaba a la firma con el préstamo en blanco. */
    expect(p).toMatch(/if \(paso === 0\) return unaPantalla \? \(!!clienteId && condicionesListas\(\)\) : !!clienteId/)
  })

  it('las condiciones se comprueban con UNA sola función, no dos copias', () => {
    /* El paso 0 de PC y el paso 1 del teléfono piden lo mismo. Copiado, se
       separan al primer cambio y uno de los dos deja pasar lo que el otro no. */
    /* Dos LLAMADAS —la del paso 0 en PC y la del paso 1— y UNA definición. La
       definición no cuenta aquí porque se escribe `= () =>`, no `()`; puse 3 a
       ojo y la prueba falló sobre código correcto. */
    const veces = [...p.matchAll(/condicionesListas\(\)/g)].length
    expect(veces, 'alguien volvió a escribir las condiciones a mano').toBe(2)
    expect([...p.matchAll(/const condicionesListas = /g)].length).toBe(1)
  })
})

describe('el contador dice la verdad', () => {
  it('en PC son dos pasos, no tres', () => {
    /* «Paso 1 de 3» sin un paso 2 al que ir es prometer una pantalla que no
       existe. */
    expect(p).toMatch(/const PASOS_PC = \[/)
    expect(p).toMatch(/steps=\{unaPantalla \? PASOS_PC : PASOS\}/)
    expect(p).toMatch(/activeIndex=\{unaPantalla \? \(paso === 0 \? 0 : 1\) : paso\}/)
  })

  it('avanzar y retroceder se saltan el paso que no existe', () => {
    expect(p).toMatch(/setPaso\(p => \(unaPantalla && p === 0 \? 2 : Math\.min/)
    expect(p).toMatch(/setPaso\(p => \(unaPantalla && p === 2 \? 0 : Math\.max/)
  })

  it('los índices de paso siguen siendo 0·1·2 por dentro', () => {
    /* Renumerarlos en PC habría cambiado el significado de cada `paso === 2`
       repartido por el archivo —la firma, el canvas— sin que nadie lo note. */
    expect(p).toMatch(/if \(paso === 2\) setTimeout\(setupFirmaCanvas, 80\)/)
  })
})

describe('las dos trampas de leer el ancho', () => {
  it('se usa el hook que ya había, no un matchMedia copiado', () => {
    /* Lo escribí a mano sin ver que `usePantallaAncha` estaba tres líneas más
       abajo, ya importado en este mismo archivo. Su efecto resuelve lo de
       siempre: leer `matchMedia` al pintar hace que servidor y navegador digan
       cosas distintas y React tire el árbol entero. */
    expect(p).toMatch(/const unaPantalla = usePantallaAncha\(1280\)/)
    expect(p, 'volvió el matchMedia copiado').not.toMatch(/setUnaPantalla/)
  })

  it('el salto por cartulina lee el ancho a mano, no el estado', () => {
    /* Ese efecto corre en el MISMO montaje que el que calcula `unaPantalla`,
       así que ahí todavía vale `false` y el salto se haría igual. */
    expect(p).toMatch(/const cabenJuntos = typeof window !== 'undefined' && window\.matchMedia\('\(min-width: 1280px\)'\)\.matches/)
    expect(p).toMatch(/setPaso\(cabenJuntos \? 0 : 1\)/)
  })
})
