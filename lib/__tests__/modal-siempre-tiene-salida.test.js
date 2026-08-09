import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

// ── «QUEDA UNO ESTÁTICO, SIN SALIDA» ────────────────────────────────────────
//
// Reportado con captura del modal de la firma: si no firmas no puedes darle a
// «Listo», y no hay nada más que tocar. Salir era tirar del botón de atrás del
// navegador — «si la persona no es ingeniosa para salir, se queda ahí».
//
// Al medirlo salieron DOS fallos distintos, y el segundo era mucho más grande
// que el reportado:
//
//  1. La X vivía dentro de `{title && …}`. Sin título no hay cabecera y no hay
//     salida. Le pasa a los dos modales que traen su propio encabezado dentro:
//     la FIRMA y RENOVAR.
//
//  2. ⚠ EL CLIC AFUERA NO CERRABA NINGUNO DE LOS 47. El manejador compara
//     `e.target === overlayRef.current`, y ese contenedor nunca es lo que se
//     toca: el div del fondo lo cubre entero y se queda el clic. Comprobado con
//     `elementFromPoint` en la pantalla —devuelve `DIV.absolute.inset-0`— en
//     móvil de 393 y en escritorio de 1280. Él lo dijo como «a veces»; era
//     siempre.

const raiz = process.cwd()
const leer = (p) => readFileSync(resolve(raiz, p), 'utf8')
const modal = leer('components/ui/Modal.jsx')

/* Sin comentarios: las notas de `Modal.jsx` citan el manejador roto para poder
   explicarlo, y una prueba sobre el texto entero se acusaría a sí misma. */
const sinNotas = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')

describe('el clic afuera cierra', () => {
  it('⚠ quien escucha es el FONDO, que es donde aterriza el dedo', () => {
    /* No basta con que exista un `onClick` en el contenedor: ese es el que
       había y no se disparaba nunca. */
    const codigo = sinNotas(modal)
    const fondo = codigo.match(/<div\s+className="absolute inset-0 cf-modal-overlay[\s\S]{0,200}?\/>/)
    expect(fondo, 'no encontré el div del fondo').not.toBeNull()
    expect(fondo[0], 'el fondo tiene que cerrar al tocarlo').toMatch(/onClick=\{\(\) => onClose\?\.\(\)\}/)
  })

  it('y Escape sigue cerrando', () => {
    expect(modal).toMatch(/e\.key === 'Escape'/)
  })
})

describe('siempre hay una salida visible', () => {
  it('⚠ con título O sin él', () => {
    // Dos ramas: la X de la cabecera y la X flotante.
    const cerrar = sinNotas(modal).match(/aria-label="Cerrar"/g) ?? []
    expect(cerrar.length, 'falta una de las dos X').toBe(2)
    expect(sinNotas(modal)).toMatch(/\{!title && \(/)
  })

  it('la X flotante se lee encima de lo que haya debajo', () => {
    /* Va sobre el contenido, no en una cabecera: necesita fondo propio o
       desaparece sobre un lienzo blanco — que es justo el caso de la firma. */
    const flotante = sinNotas(modal).slice(sinNotas(modal).indexOf('{!title && ('))
    expect(flotante).toMatch(/absolute top-3 right-3/)
    expect(flotante).toMatch(/background: 'var\(--cf-card\)'/)
  })

  it('y el contenido le deja el sitio SOLO donde estorba, no en todo el modal', () => {
    /* «Firma aquí, {nombre}» ocupa todo el ancho, así que la X necesita hueco.
       Pero el hueco es de su ALTURA, no de todo el alto del modal.

       ⚠ Esta prueba exigía literalmente `title ? 'pr-5' : 'pr-16'`, y con ese
       `pr-16` la X reservaba una franja de 64px de arriba abajo: el formulario
       se corría a la izquierda y quedaba un canal vacío. Reportado como «le
       pone un borde lateral a todo el modal y se ve terrible».
       Fijar la clase exacta no protegía nada: protegía la implementación, y la
       implementación era el fallo. */
    const cuerpo = sinNotas(modal)
    expect(cuerpo, 'sitio reservado solo cuando no hay título').toMatch(/!title && <div[^>]*float-right/)
    expect(cuerpo, 'ya no se le cobra el hueco a todo el contenido').not.toMatch(/pr-16/)
  })

  it('el área de toque llega a 44px', () => {
    expect(sinNotas(modal)).toMatch(/w-11 h-11/)
  })
})

/* ── LA RED, para que esto no vuelva por otro lado ─────────────────────────
   No basta con arreglar `Modal.jsx`: media app monta sus propias capas con
   `fixed inset-0`. Esta prueba recorre TODAS y exige que cada una tenga alguna
   forma de salir.

   ⚠ La lista de exentas es corta y cada una dice por qué. Si mañana alguien
   añade una capa sin salida, esta prueba falla y le toca justificarla aquí. */
const EXENTAS = {
  'components/onboarding/Confetti.jsx': 'no se puede tocar: es una animación que se va sola',
  'components/onboarding/SpotlightOverlay.jsx': 'recorta un hueco sobre la pantalla de abajo; no atrapa',
  'components/layout/CompletarTelefonoModal.jsx': 'es una puerta a propósito: sin teléfono no se sigue',
  'components/layout/SuscripcionBanner.jsx': 'es una franja del flujo, no una capa encima',
  'components/onboarding/TourStep.jsx': 'el paso del tour lleva su propio «Saltar»',
}

function jsx(dir, salida = []) {
  for (const e of readdirSync(dir)) {
    if (['node_modules', '.next', '.git'].includes(e)) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) jsx(p, salida)
    else if (p.endsWith('.jsx')) salida.push(p)
  }
  return salida
}

describe('ninguna capa de la app deja sin salida', () => {
  it('todas las que cubren la pantalla se pueden cerrar', () => {
    const atrapadas = []
    for (const f of jsx(resolve(raiz, 'app')).concat(jsx(resolve(raiz, 'components')))) {
      const rel = f.slice(raiz.length + 1).replace(/\\/g, '/')
      if (rel === 'components/ui/Modal.jsx' || EXENTAS[rel]) continue
      const src = sinNotas(readFileSync(f, 'utf8'))
      if (!/fixed inset-0/.test(src)) continue
      // Cualquiera de las tres vale: pasa por <Modal>, tiene X, o tiene botón.
      const usaModal = /<Modal\b/.test(src)
      const equis = /aria-label=["']Cerrar|M6 18L18 6M6 6l12 12/.test(src)
      const boton = /(Cerrar|Cancelar|Volver|Entendido|Listo|Ahora no|Saltar|Después)\s*</.test(src)
      // Y lo que de verdad importa: un manejador que cierre o que navegue.
      const manejador = /onClick=\{[^}]*(onClose|set\w*\((false|null)\)|router\.(push|back))/.test(src)
      const escape = /['"]Escape['"]/.test(src)
      if (!usaModal && !equis && !boton && !manejador && !escape) atrapadas.push(rel)
    }
    expect(atrapadas, 'capas sin forma de salir').toEqual([])
  })
})

describe('el banner de fotos deja tomarlas, no solo buscarlas', () => {
  const banner = leer('components/dashboard/BannerFotosDonadas.jsx')

  it('⚠ hay una puerta a la cámara, no solo al carrete', () => {
    /* Mi primera versión daba por hecho que «la mayoría ya tiene las fotos
       tomadas». A nadie se le ocurre fotografiar su cuaderno hasta que se lo
       pedimos: si la única puerta es la galería, hay que salir de la app y
       volver a buscar el banner. */
    expect(banner).toMatch(/capture="environment"/)
    expect(banner).toMatch(/Tomar foto/)
    expect(banner).toMatch(/De la galería/)
  })

  it('y son dos input, no uno con el atributo puesto y quitado', () => {
    // En escritorio `capture` se ignora y el botón se comporta como el otro.
    const inputs = banner.match(/<input ref=\{(inputRef|camaraRef)\}/g) ?? []
    expect(inputs.length).toBe(2)
  })
})
