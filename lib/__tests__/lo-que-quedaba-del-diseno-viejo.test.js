import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ── «CREO QUE TIENEN EL DISEÑO ANTERIOR» ────────────────────────────────────
//
// El dueño señaló tres cosas dentro del préstamo y acertó en las tres, aunque
// las tres fallaban por motivos distintos:
//
//   · la tarjeta de la FIRMA / pagaré
//   · el botón de ENVIAR ALERTA DE MORA
//   · CANCELAR PRÉSTAMO, suelto al fondo y a todo el ancho en escritorio
//
// Y adivinó algo que no se ve mirando: «cuando la firma está vacía tiene un
// diseño, y cuando está firmada sale el diseño anterior». Es cierto, y la causa
// era un color: dos de los tres botones iban con `rgba(255,255,255,0.06)` —un
// resto del tema OSCURO— que sobre el papel blanco no pinta NADA. Firmada, el
// botón principal también caía en ese fondo y los tres desaparecían a la vez.
//
// Esta prueba fija lo que se corrigió, para que no vuelva por copiar y pegar.

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
/* ⚠ SIN COMENTARIOS: las notas de estos archivos NOMBRAN lo prohibido para
   poder explicarlo, así que una prueba sobre el texto entero se acusa a sí
   misma. Ya mordió cuatro veces en este proyecto. */
const sinNotas = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')

const firma = sinNotas(leer('components/prestamos/FirmaDigital.jsx'))
const wa = sinNotas(leer('components/ui/BotonWhatsApp.jsx'))
const prestamo = sinNotas(leer('app/(dashboard)/prestamos/[id]/page.jsx'))

describe('la tarjeta de la firma', () => {
  it('⚠ ya no pinta botones con blanco al 6 %, que en el tema claro es nada', () => {
    // El fallo que el dueño notó como «dos diseños según haya firma o no».
    expect(firma).not.toMatch(/rgba\(255,\s*255,\s*255/)
  })

  it('los tres botones salen del mismo molde', () => {
    // Antes cada uno traía su propio alto, radio y cuerpo de letra a mano.
    expect(firma).toMatch(/const BASE_BOTON = \{/)
    expect(firma).toMatch(/const SECUNDARIO = \{/)
  })

  it('con radios de la escala, no 12/10/8', () => {
    expect(firma).toMatch(/var\(--cf-r-card\)/)
    expect(firma).toMatch(/var\(--cf-r-control\)/)
    expect(firma).not.toMatch(/rounded-\[(8|10|12)px\]/)
  })

  it('y sin tamaños de letra con coma', () => {
    /* `text-[13.5px]`. La escala del sistema no lleva decimales y hay una
       prueba —`escalas-cerradas`— que lo cierra; este archivo se le escapaba
       porque el tamaño iba dentro de una clase de Tailwind. */
    expect(firma).not.toMatch(/\[\d+\.\d+px\]/)
  })

  it('el dorado del pagaré se lee: `--cf-gold-text`, no `--cf-gold` sobre su propio tinte', () => {
    expect(firma).toMatch(/var\(--cf-gold-text\)/)
  })

  it('pero el verde de «ya está firmada» se queda', () => {
    // Eso no era diseño viejo: firmado y sin firmar son dos estados y la
    // tarjeta hace bien en distinguirlos.
    expect(firma).toMatch(/--cf-green-dark/)
  })
})

describe('la alerta de mora', () => {
  it('⚠ deja el amber-500 de Tailwind y usa el dorado de la app', () => {
    /* #F59E0B contra #E7A400. Al lado de la pastilla de mora se leían como dos
       estados que no existen. */
    expect(wa).not.toMatch(/245,\s*158,\s*11/)
    expect(wa).toMatch(/var\(--cf-gold-tint\)/)
    expect(wa).toMatch(/var\(--cf-gold-border\)/)
  })

  it('pero el verde de WhatsApp NO se toca', () => {
    /* Es el color de la marca: dice a dónde lleva el botón. Cambiarlo por
       `--cf-green` —que aquí significa «al día»— haría que «enviar el recibo»
       se leyera como «ya pagó». */
    expect(wa).toMatch(/#25d366/)
  })

  it('y la caja pasa a la medida del sistema', () => {
    expect(wa).toMatch(/h-\[46px\]/)
    expect(wa).toMatch(/rounded-\[var\(--cf-r-control\)\]/)
  })
})

describe('cancelar el préstamo', () => {
  it('⚠ ya no es un botón a todo el ancho al fondo de la página', () => {
    /* Así lo fotografió el dueño en escritorio: un rectángulo de 1.200px, la
       acción MÁS grande de la pantalla siendo la más destructiva. */
    expect(prestamo).not.toMatch(/w-full[^"']*\n?[^"']*Cancelar préstamo/)
    expect(prestamo).not.toMatch(/>\s*Cancelar préstamo\s*</)
  })

  it('entra al grupo «Cierra el préstamo», junto a renovar y mover a perdidos', () => {
    expect(prestamo).toMatch(/id: 'cancelar', nombre: 'Cancelar el préstamo', peligro: true/)
  })

  it('y la confirmación es un modal, no un panel al que hay que bajar', () => {
    expect(prestamo).toMatch(/title="¿Cancelar este préstamo\?"/)
  })

  it('con el rojo del sistema, no el de Tailwind', () => {
    /* `rgba(239,68,68,…)` es red-500. `--cf-red-dark` es el de la app.

       ⚠ EL RECORTE VA HASTA `</Modal>`, no a tantos caracteres: mi primera
       versión cogía una ventana fija y se llevaba por delante el modal de al
       lado —«Opciones de cobro»—, que sí trae ese rojo. La prueba señalaba
       código que no es el suyo. */
    const desde = prestamo.indexOf('¿Cancelar este préstamo?')
    const bloque = prestamo.slice(desde, prestamo.indexOf('</Modal>', desde))
    expect(bloque).not.toMatch(/239,\s*68,\s*68/)
    expect(bloque).toMatch(/var\(--cf-red-dark\)/)
  })

  it('⚠ y queda anotado: ese rojo de Tailwind sigue en 26 archivos más', () => {
    /* No es de este lote. Se deja escrito para que la próxima vez que alguien
       mire este archivo sepa que la limpieza está a medias y por qué: cambiar
       26 pantallas a la vez es exactamente lo que el dueño pidió NO hacer
       («llevar a producción por tandas»). */
    expect(prestamo).toMatch(/239,\s*68,\s*68/)
  })
})
