import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── EL REGISTRO, COMO LO PIDE LA LÁMINA ─────────────────────────────────────
//
// El dueño preguntó si el registro estaba para rediseño. Contrastado contra
// `T07-02-registro`, cumplía lo esencial —4 pasos, sin portada, solo la espina—
// pero le faltaban DOS cosas que la lámina dice con todas las letras:
//
//   «el wizard baja de 6 pantallas a 4: nombre y negocio CABEN JUNTOS»
//   «el selector de país pasa de fila completa a PREFIJO, y "sin el código de
//    país" deja de ser una nota gris bajo el campo»
//
// Y él añadió una tercera, que también es de la lámina:
//
//   «el botón no está muy pegado al input… se ve un espacio todo feo ahí»
//
// La lámina pone la acción en un pie con borde superior y «Atrás» y «Continuar»
// EN LA MISMA FILA. El botón iba suelto bajo el campo con un `mt-6`.

const src = readFileSync(resolve(process.cwd(), 'app/registro/RegistroForm.jsx'), 'utf8')
const sinComentarios = src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('{/*')).join('\n')

describe('el flujo NO cambió: siguen siendo los cuatro pasos', () => {
  it('nombre y negocio siguen en pantallas separadas', () => {
    /* ⚠ Probé a juntarlos —la lámina lo sugiere— y lo revertí: el encargo era
       estético y cambiar el número de pasos toca el flujo, que es otra
       decisión. «Pueden ser cuatro, cinco, diez pasos, pero que todo el flujo
       quedara funcionando igual. Lo único que tenía que cambiar era la estética
       y el diseño, más nada.» */
    expect(sinComentarios).toMatch(/const PASOS = 4/)
    expect(sinComentarios).toMatch(/const handleStep1 = \(\) => \{\s*if \(!form\.nombre\.trim\(\)\)/)
    expect(sinComentarios).toMatch(/const handleStep2 = \(\) => \{\s*if \(!form\.nombreOrganizacion\.trim\(\)\)/)
  })

  it('y tras crear la cuenta se llega a la verificación, no a una pantalla en blanco', () => {
    /* Aquí decía `setStep(5)` a mano. Al renumerar los pasos, la cuenta se
       creaba bien y la pantalla siguiente salía EN BLANCO — ningún bloque
       respondía a ese número. No lo cazó ni el build ni las pruebas: solo se ve
       registrándose de verdad, y lo reportó el dueño.

       Atado a `PASOS` para que no se vuelva a desincronizar. */
    expect(sinComentarios).toMatch(/setStep\(PASOS \+ 1\)/)
    expect(sinComentarios, 'volvió el número escrito a mano').not.toMatch(/setStep\(5\)/)
    // Y el bloque que responde a ese número existe.
    expect(sinComentarios).toMatch(/\{step === 5 && \(/)
  })
})

describe('el país es un prefijo, no una fila', () => {
  it('se pinta el prefijo junto al campo', () => {
    expect(sinComentarios).toMatch(/\{countryCfg\.phonePrefix\}/)
  })

  it('y ya no ocupa una fila entera con el nombre del país', () => {
    /* Antes: una caja aparte con bandera + «Colombia» + flecha, y debajo el
       campo. Dos filas para un solo dato. */
    expect(sinComentarios, 'volvió la fila completa del país')
      .not.toMatch(/\{PAISES\.find\(p => p\.code === country\)\?\.name \|\| 'Colombia'\}/)
  })

  it('la nota «sin el código de país» se va, la promesa se queda', () => {
    /* La lámina quita la nota porque el prefijo ya la responde. Lo que NO se
       toca es «nunca te vamos a escribir para venderte nada»: eso no es una
       instrucción, es lo que hace que alguien deje su número. */
    expect(sinComentarios, 'volvió la nota que el prefijo ya resuelve')
      .not.toMatch(/Sin el código de país\. Solo el número\./)
    expect(sinComentarios).toMatch(/Nunca te vamos a escribir para venderte nada/)
  })
})

describe('la acción va al pie, no flotando bajo el campo', () => {
  it('existe el pie con su borde superior', () => {
    expect(sinComentarios).toMatch(/function PieWizard\(/)
    expect(sinComentarios).toMatch(/borderTop: `1px solid \$\{theme\.borderLight\}`/)
  })

  it('«Atrás» y «Continuar» comparten fila, y el que avanza es más ancho', () => {
    // `flex: 2` contra `flex: 1`: no es cosmético, dice cuál de los dos es la
    // acción. Sale de la lámina.
    expect(sinComentarios).toMatch(/flex: onAtras \? 2 : 1/)
  })

  it('⚠ y baja de verdad al borde inferior', () => {
    /* Sin esto el pie existía pero se quedaba donde acabara el contenido —a
       media pantalla— y debajo quedaba el vacío que el dueño reportó. Medido a
       393×852: el botón caía en y=412 de 852; ahora en 772. */
    expect(sinComentarios).toMatch(/mt-auto/)
    expect(sinComentarios, 'la columna no estira y el `mt-auto` no tiene contra qué empujar')
      .toMatch(/max-w-md flex-1 flex flex-col/)
  })

  it('los cuatro pasos lo usan', () => {
    expect((sinComentarios.match(/<PieWizard/g) ?? []).length).toBe(4)
  })

  it('y no quedaron los botones viejos sueltos', () => {
    expect(sinComentarios, 'volvió el botón suelto con `mt-6`').not.toMatch(/function ContinueButton/)
    expect(sinComentarios, 'el «Atrás» de arriba duplicaba el del pie').not.toMatch(/function BackButton/)
  })
})
