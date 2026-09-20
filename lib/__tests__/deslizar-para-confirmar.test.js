// Deslizar para confirmar el cobro (13 sep 2026).
//
// Vitest corre en `node`, sin DOM: el gesto se prueba de verdad con playwright en
// el espejo. Aquí se anclan en CÓDIGO las reglas que, rotas, guardarían un pago
// sin querer o dejarían a alguien sin forma de cobrar.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const leer = (f) => readFileSync(path.join(process.cwd(), f), 'utf8')
// Sin comentarios: aquí se citan las propias reglas y una prueba que las busque
// en prosa pasaría aunque el código no las cumpla.
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const DESLIZAR = sinComentarios(leer('components/cf/DeslizarParaConfirmar.jsx'))
const PIE = sinComentarios(leer('components/pantallas/RegistrarCobro.jsx'))
const PAGO = sinComentarios(leer('components/prestamos/RegistrarPago.jsx'))
const TACTIL = sinComentarios(leer('lib/tactil.js'))
const ATAJOS = sinComentarios(leer('components/pantallas/AtajosCobro.jsx'))
const GESTION = sinComentarios(leer('components/pantallas/Gestion.jsx'))
const FICHA = sinComentarios(leer('app/(dashboard)/prestamos/[id]/page.jsx'))
const MORATORIO = sinComentarios(leer('app/(dashboard)/prestamos/moratorio/page.jsx'))

describe('el gesto', () => {
  it('confirma solo al pasar el umbral del recorrido', () => {
    expect(DESLIZAR).toMatch(/const UMBRAL = 0\.88/)
    expect(DESLIZAR).toMatch(/if \(g\.max > 0 && g\.x >= g\.max \* UMBRAL\) return confirmar\(\)/)
  })

  it('un toque sin arrastre enseña, no confirma', () => {
    expect(DESLIZAR).toMatch(/if \(g\.x < 6\) return ensenar\(\)/)
    expect(DESLIZAR).toMatch(/>\s*\{pista \? 'Desliza la flecha hasta el final' : texto\}/)
  })

  it('el clic del asa solo confirma desde el teclado', () => {
    // Soltar el dedo sobre el asa dispara un clic con detail 1: si confirmara,
    // tocar el asa guardaría el pago sin deslizar.
    expect(DESLIZAR).toMatch(/onClick=\{\(e\) => \{ if \(e\.detail === 0\) confirmar\(\) \}\}/)
  })

  it('tocar la pista no confirma', () => {
    const clicPista = DESLIZAR.match(/ref=\{refPista\}\s*onClick=\{([^\n]+)\}/)
    expect(clicPista).not.toBeNull()
    expect(clicPista[1]).toMatch(/ensenar\(\)/)
    expect(clicPista[1]).not.toMatch(/confirmar\(/)
  })

  it('muerto no confirma ni arrastra', () => {
    expect(DESLIZAR).toMatch(/const confirmar = \(\) => \{\s*if \(muerto\) return/)
    expect(DESLIZAR).toMatch(/const alAgarrar = \(e\) => \{\s*if \(muerto \|\| e\.button > 0\) return/)
  })

  it('si no llegó a guardar, el asa vuelve al principio', () => {
    expect(DESLIZAR).toMatch(/setTimeout\(\(\) => \{ if \(!refConfirmando\.current\) pintar\(0, true\) \}, 350\)/)
    expect(DESLIZAR).toMatch(/pintar\(confirmando \? recorrido\(\) : 0, true\)/)
  })
})

describe('dónde sale', () => {
  it('«¿dedo o ratón?» vive en un solo sitio', () => {
    /* Estaba escrito y privado dentro de `RegistrarCobro.jsx`, así que ninguna
       otra pantalla de cobro podía alcanzarlo: es como se acaba con el mismo
       gesto en una pantalla y otro distinto en la de al lado. */
    expect(TACTIL).toMatch(/const CONSULTA = '\(pointer: coarse\)'/)
    expect(TACTIL).toMatch(/export function useTactil/)
    for (const src of [PIE, ATAJOS, GESTION, FICHA, MORATORIO]) {
      expect(src).toMatch(/from '@\/lib\/tactil'/)
    }
    // Y nadie se escribe su propia consulta.
    for (const src of [PIE, ATAJOS, GESTION, FICHA, MORATORIO]) {
      expect(src).not.toMatch(/pointer: coarse/)
    }
  })

  it('el pie usa el deslizador solo con `deslizar` y pantalla táctil', () => {
    expect(PIE).toMatch(/const tactil = useTactil\(\)/)
    expect(PIE).toMatch(/\{deslizar && tactil \? \(\s*<DeslizarParaConfirmar/)
    // Sin eso, el botón de siempre.
    expect(PIE).toMatch(/<button type="button" onClick=\{onConfirmar\} disabled=\{muerto\}/)
  })

  it('la hoja de cobro lo pide; «Abonar por días» no', () => {
    const pies = [...PAGO.matchAll(/<PieRegistrarCobro[\s\S]*?\/>/g)].map((m) => m[0])
    const cobro = pies.filter((p) => p.includes('onConfirmar={handleSubmit}'))
    expect(cobro).toHaveLength(1)
    expect(cobro[0]).toMatch(/\n\s*deslizar\n/)
    // Los demás pies no guardan nada: «Poner $X» solo rellena el monto.
    for (const p of pies.filter((x) => x !== cobro[0])) expect(p).not.toMatch(/\bdeslizar\b/)
  })

  /* ══ LA ALINEACIÓN, QUE ES EL PUNTO ════════════════════════════════════════
   *
   * «no que en un lado va a confirmar el pago rodándose hacia el lado y en
   *  otros lados no, entonces quedaría desalineado» — el dueño, 14 sep 2026.
   *
   * Cada superficie donde un toque MUEVE PLATA tiene su ancla aquí. Si alguien
   * añade otra y no pasa por el deslizador, esto no lo caza —ninguna prueba
   * puede— pero al menos las que hay no se pierden en el siguiente rediseño.
   */
  describe('todas las superficies que mueven plata', () => {
    it('el cobro de la calle no cobra de un toque: en el teléfono solo se cobra deslizando', () => {
      /* Era `onClick={() => onCobrarCuota?.(p)}`: un roce en el bolsillo
         registraba un pago, y es la pantalla más usada en la calle. Desde el
         20 sep 2026 la pista está a la vista al abrir; lo que NO puede existir
         en táctil es otro camino que llame a cobrar. */
      expect(ATAJOS).toMatch(/\{tactil \? \(\s*<DeslizarParaConfirmar/)
      expect(ATAJOS).toMatch(/onConfirmar=\{cobrar\}/)
      // `cobrar` se llama desde la pista y desde el botón de ratón. Nada más.
      expect(ATAJOS.match(/[^a-zA-Z]cobrar\}/g)).toHaveLength(2)
      expect(ATAJOS).not.toMatch(/onClick=\{\(\) => onCobrarCuota/)
    })

    it('«Otro monto» también: es la misma pista, con la cifra tecleada', () => {
      expect(ATAJOS).toMatch(/const cuanto = opcion === 'otro' \? tecleado : \(elegida\?\.monto \?\? 0\)/)
      expect(ATAJOS).toMatch(/deshabilitado=\{!listo\}/)
    })

    it('el pie de gestión lo ofrece, y no en las hojas de peligro', () => {
      expect(GESTION).toMatch(/if \(deslizar && tactil && !peligro\)/)
    })

    it('recargo, descuento, interés y liquidación lo encienden', () => {
      const pies = [...FICHA.matchAll(/<PieGestion[\s\S]*?\/>/g)].map((m) => m[0])
      const conPlata = pies.filter((p) => /Aplicar |Perdonar |Cobrar |Cerrar por /.test(p))
      expect(conPlata.length).toBeGreaterThanOrEqual(4)
      for (const p of conPlata) expect(p, p.slice(0, 120)).toMatch(/\n\s*deslizar\n/)
      // Y las de peligro NO: su barrera es el rojo de contorno (T13-03).
      for (const p of pies.filter((x) => /\bpeligro\b/.test(x))) expect(p).not.toMatch(/\n\s*deslizar\n/)
    })

    it('el recargo por mora de la ficha, que era un botón suelto', () => {
      expect(FICHA).toMatch(/onConfirmar=\{aplicarMoratorio\}/)
      expect(FICHA).toMatch(/onClick=\{aplicarMoratorio\}/)
      /* El botón y el deslizador llaman a la MISMA función: escrito dos veces
         es como se acaba con dos caminos que cobran distinto. */
      expect(FICHA).toMatch(/const aplicarMoratorio = async \(\) => \{/)
    })

    it('y el moratorio en lote, que toca a veinte clientes de una vez', () => {
      expect(MORATORIO).toMatch(/<DeslizarParaConfirmar/)
      expect(MORATORIO).toMatch(/onConfirmar=\{aplicar\}/)
    })
  })
})
