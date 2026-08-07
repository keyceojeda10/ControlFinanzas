import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── T07-03 · CREAR CLIENTE ─────────────────────────────────────────────────
//
// La nota de la lámina es lo más importante de esta pantalla: «Un solo campo
// obligatorio: el nombre. La cédula dice "opcional" en el propio campo, porque
// exigirla en la calle frena la carga y es la razón por la que muchos negocios
// se quedan en cinco clientes.»
//
// Medido antes de tocar nada, a 1440px: 1.835px de alto para 8 campos, todos
// apilados a ancho completo —575px para diez dígitos de cédula— y flotando
// sobre el fondo sin nada detrás.

const RAIZ = process.cwd()
const crudo = readFileSync(resolve(RAIZ, 'components/clientes/ClienteForm.jsx'), 'utf8')

/* Sin comentarios: los de esta pantalla CITAN lo que explican —«la casilla
   No tengo la cédula se va»—, así que buscar el literal en el texto crudo se
   caza a sí mismo. Se vacían conservando la longitud. */
const src = crudo
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .split('\n').map((l) => (/^\s*(\/\/|\*)/.test(l) ? '' : l)).join('\n')

const pagina = readFileSync(resolve(RAIZ, 'app/(dashboard)/clientes/nuevo/page.jsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .split('\n').map((l) => (/^\s*(\/\/|\*)/.test(l) ? '' : l)).join('\n')

describe('un solo campo obligatorio', () => {
  it('la cédula lo dice en el propio campo', () => {
    // `label={...}`, no `documentConfig.label` a secas: la primera aparición
    // de eso es un mensaje de validación, no el campo.
    const i = src.indexOf('label={`${documentConfig.label}`}')
    expect(i).toBeGreaterThan(-1)
    /* «opcional» al principio, y detrás el ejemplo del documento del país.
       Poner solo la palabra borraba el formato, que se internacionalizó justo
       para que a alguien en Argentina no le saliera «CC». */
    const campo = src.slice(i, i + 700)
    expect(campo).toMatch(/placeholder=\{`opcional/)
    expect(campo, 'volvió a perderse el ejemplo del documento del país')
      .toMatch(/\$\{documentConfig\.placeholder\}/)
  })

  it('y debajo se dice una vez, en una frase', () => {
    expect(src).toMatch(/Solo el nombre es obligatorio/)
  })

  it('la casilla «No tengo la cédula» ya no está', () => {
    /* No perdía nada: dejar el campo vacío hacía exactamente lo mismo. Era de
       cuando la cédula era obligatoria y hacía falta una escapatoria. */
    expect(src).not.toMatch(/No tengo la c[eé]dula/)
  })

  it('pero el marcador SIN- se sigue poniendo con el campo vacío', () => {
    // ⚠ ESTO es lo que hacía la casilla de verdad. Si se cae, crear un cliente
    // sin cédula rompe: el backend la usa como clave.
    expect(src).toMatch(/sinCedula \|\| !form\.cedula\.trim\(\)/)
    expect(src).toMatch(/`SIN-\$\{Date\.now\(\)/)
  })

  it('y el estado `sinCedula` se queda, que es lo que arregla la EDICIÓN', () => {
    /* Al editar un cliente cuya cédula es un marcador `SIN-…`, es lo que hace
       que el campo salga vacío en vez de enseñar «SIN-m3k9x2». */
    expect(src).toMatch(/cedulaExistente\.startsWith\('SIN-'\)/)
    expect(src).toMatch(/cedula:\s+sinCedula \? '' : cedulaExistente/)
  })
})

describe('los campos dejan de ir apilados a ancho completo', () => {
  it('cédula y teléfono van a la par', () => {
    // 575px para diez dígitos de cédula, y otra fila igual para el celular.
    // `label={...}`, no `documentConfig.label` a secas: la primera aparición
    // de eso es un mensaje de validación, no el campo.
    const i = src.indexOf('label={`${documentConfig.label}`}')
    expect(src.slice(i - 700, i)).toMatch(/grid sm:grid-cols-2/)
  })

  it('dirección y referencia también', () => {
    const i = src.indexOf('label="Dirección"')
    expect(src.slice(i - 400, i)).toMatch(/grid sm:grid-cols-2/)
  })

  it('el nombre es el que manda', () => {
    const i = src.indexOf('label="Nombre completo"')
    expect(src.slice(i, i + 500)).toMatch(/cf-campo-grande/)
  })
})

describe('el formulario descansa sobre papel', () => {
  it('en escritorio', () => {
    // Los campos flotaban sueltos sobre el fondo de la app, como en préstamo.
    expect(src).toMatch(/lg:bg-\[var\(--cf-card\)\]/)
  })

  it('la barra de acción usa el token de barra, no el del fondo', () => {
    /* `tokens-2026.css`: `--cf-card` es «toda tarjeta, fila, campo, BARRA DE
       ACCIÓN»; `--cf-surface` es el fondo de la app. */
    expect(src).not.toMatch(/background: 'var\(--cf-surface\)'/)
  })
})

describe('la cabecera de la pantalla', () => {
  it('ya no tiene el icono suelto', () => {
    /* Un círculo dorado con un monigote flotando sobre el formulario, sin nada
       al lado: el título que lo acompañaba se mudó a la cabecera y el icono se
       quedó huérfano, empujando el primer campo 60px hacia abajo. */
    const i = pagina.indexOf('Cambiar método')
    expect(i, 'se perdió la salida para cambiar de método').toBeGreaterThan(-1)
    expect(pagina.slice(i - 900, i)).not.toMatch(/linear-gradient/)
  })

  it('y «método» va con tilde', () => {
    expect(pagina).not.toMatch(/Cambiar metodo/)
  })
})
