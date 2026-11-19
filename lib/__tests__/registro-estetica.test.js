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

describe('el flujo es el de antes del 16 jul 2026: plan, datos y verificar', () => {
  /* Aquí decía «el flujo NO cambió: siguen siendo los cuatro pasos», y era la
     regla del encargo estético de entonces. El 18 nov el dueño pidió lo
     contrario, con datos: volver al registro que mejor funcionó —«el flujo tal
     cual, pero adaptado al diseño moderno»—, que era 1 · elegir el plan con su
     precio, 2 · los datos en una pantalla, y verificar. Medido por semana: hasta
     el 6 jul cargaba un cliente en 3 días el 71–81 %; desde el registro de
     mini-pasos (16 jul), el 35–53 %. */
  it('dos pasos de registro y la verificación aparte', () => {
    expect(sinComentarios).toMatch(/const PASOS = 2/)
  })

  it('paso 1: el plan, en dos grupos y con su precio', () => {
    expect(sinComentarios).toMatch(/\{ perfil: 'solo', titulo: 'Cobras solo', linea: 'Sin cobradores', tramos: tramosSolo \}/)
    expect(sinComentarios).toMatch(/\{ perfil: 'equipo', titulo: 'Con equipo', linea: 'Tienes cobradores', tramos: tramosEquipo \}/)
    expect(sinComentarios).toMatch(/seguirTexto=\{`Continuar con \$\{nombrePlan\}`\}/)
  })

  it('paso 2: los datos juntos, con correo y contraseña confirmados y el canal del código', () => {
    expect(sinComentarios).toMatch(/label="Confirmar correo"/)
    expect(sinComentarios).toMatch(/label="Confirmar contraseña"/)
    expect(sinComentarios).toMatch(/aria-label="Recibir el código por"/)
  })

  it('el plan elegido y el canal viajan al servidor', () => {
    expect(sinComentarios).toMatch(/plan: planElegido,/)
    expect(sinComentarios).toMatch(/canal: verificarPor,/)
    expect(sinComentarios, 'volvió el plan silencioso').not.toMatch(/planSilencioso/)
  })

  it('y tras crear la cuenta se llega a la verificación, no a una pantalla en blanco', () => {
    /* Aquí decía `setStep(5)` a mano. Al renumerar los pasos, la cuenta se
       creaba bien y la pantalla siguiente salía EN BLANCO. Atado a `PASOS`. */
    expect(sinComentarios).toMatch(/setStep\(PASOS \+ 1\)/)
    expect(sinComentarios, 'volvió el número escrito a mano').not.toMatch(/setStep\(5\)/)
    expect(sinComentarios).toMatch(/\{step === PASOS \+ 1 && \(/)
  })
})

describe('el país es un prefijo, no una fila', () => {
  it('se pinta el prefijo junto al campo', () => {
    expect(sinComentarios).toMatch(/\{countryCfg\.phonePrefix\}/)
  })

  it('en los datos no hay una fila aparte para el país', () => {
    /* En el paso 2 el país es el prefijo del WhatsApp. (En el paso 1 sí va
       arriba, como en julio: de él salen los precios de los planes.) */
    const datos = sinComentarios.slice(sinComentarios.indexOf('{step === 2 && ('))
    expect(datos, 'volvió la fila completa del país en los datos').not.toMatch(/\{nombrePais\}/)
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

  it('los dos pasos lo usan', () => {
    expect((sinComentarios.match(/<PieWizard/g) ?? []).length).toBe(2)
  })

  it('y no quedaron los botones viejos sueltos', () => {
    expect(sinComentarios, 'volvió el botón suelto con `mt-6`').not.toMatch(/function ContinueButton/)
    expect(sinComentarios, 'el «Atrás» de arriba duplicaba el del pie').not.toMatch(/function BackButton/)
  })
})
