// El recibo se ve antes de mandarse (14 sep 2026).
//
// «no muestra una vista previa de la imagen antes de compartir como en nequi o
//  así» — el dueño.
//
// «Compartir recibo» disparaba la hoja del teléfono con el PNG ya adjunto: el
// cobrador no veía el papel hasta que estaba en el chat del cliente, y si salía
// un dato mal ya no había vuelta atrás.
//
// Se anclan las tres cosas que, rotas, devuelven ese comportamiento o rompen la
// hoja de formas que ya han pasado en este repo.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const leer = (f) => readFileSync(path.join(process.cwd(), f), 'utf8')
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const PREVIA    = sinComentarios(leer('components/recibos/HojaReciboPrevio.jsx'))
const COMPARTIR = sinComentarios(leer('components/ui/BotonCompartirRecibo.jsx'))
const REGISTRAR = sinComentarios(leer('components/prestamos/RegistrarPago.jsx'))
const RUTA      = sinComentarios(leer('app/(dashboard)/rutas/[id]/page.jsx'))
const PANTALLA  = sinComentarios(leer('components/pantallas/Recibo.jsx'))
const APIRUTA   = sinComentarios(leer('app/api/rutas/[id]/route.js'))

describe('los tres caminos pasan por la vista previa', () => {
  it('el botón de compartir abre la hoja, no la comparte de una', () => {
    expect(COMPARTIR).toMatch(/<HojaReciboPrevio/)
    expect(COMPARTIR).toMatch(/onClick=\{\(\) => setPrevio\(true\)\}/)
    // Y ya no manda el archivo por su cuenta desde el botón.
    expect(COMPARTIR.slice(COMPARTIR.indexOf('export default function BotonCompartirRecibo')))
      .not.toMatch(/navigator\.share/)
  })

  it('la ficha del préstamo y la ruta también', () => {
    for (const src of [REGISTRAR, RUTA]) {
      expect(src).toMatch(/<HojaReciboPrevio/)
      expect(src).toMatch(/onGuardarImagen=\{\(\) => setPrevioAbierto\(true\)\}/)
    }
  })

  it('y el botón dice lo que va a pasar al tocarlo', () => {
    expect(PANTALLA).toMatch(/>Ver el recibo</)
    expect(PANTALLA, 'el rótulo volvió a prometer una descarga que no ocurre')
      .not.toMatch(/>Guardar imagen</)
  })
})

describe('las trampas de esta hoja', () => {
  it('se monta SIEMPRE, no dentro de un `&&`', () => {
    /* Una hoja montada en el mismo cuadro en que se abre pinta su primer
       fotograma fuera de la pantalla. Ver [[hoja_inferior_primer_cuadro]]. */
    for (const src of [COMPARTIR, REGISTRAR, RUTA]) {
      expect(src).not.toMatch(/&&\s*\(?\s*<HojaReciboPrevio/)
    }
  })

  it('el PNG se prepara al ABRIR, no dentro del toque de compartir', () => {
    /* `navigator.share` exige el gesto del usuario, y un `toBlob` dentro del
       click rompe la cadena del gesto en iOS: la hoja no sale y no hay error. */
    expect(PREVIA).toMatch(/archivoRef\.current = file/)
    expect(PREVIA).toMatch(/compartirArchivo\(archivoRef\.current, \{/)
    const clic = PREVIA.slice(PREVIA.indexOf('const compartir ='), PREVIA.indexOf('const descargar ='))
    expect(clic, 'el archivo volvió a prepararse dentro del click').not.toMatch(/toBlob|await/)
  })

  it('el recibo se dibuja UNA vez, no en cada render', () => {
    /* Quien la monta le pasa objetos recién creados en cada render
       (`{...datosDelComprobante()}`), así que un efecto que dependiera de ellos
       redibujaría el PNG sin parar con la hoja abierta. */
    expect(PREVIA).toMatch(/\}, \[abierta\]\)/)
    expect(PREVIA).toMatch(/datosRef\.current/)
  })

  it('la vista y el archivo salen del MISMO lienzo', () => {
    // Dibujarlo dos veces es como se acaba mandando algo distinto de lo que se vio.
    expect((PREVIA.match(/d\.dibujar\(/g) ?? []).length).toBe(1)
  })
})

describe('el recibo de la calle dice lo mismo que el de la ficha', () => {
  it('el cliente de la ruta lleva SUS campos del recibo', () => {
    /* El `map` de la ruta rearma el cliente campo a campo: lo que no se copie
       llega `undefined` y el comprobante sale con los de fábrica, ignorando el
       checklist del prestamista. El mismo pago daba dos papeles distintos según
       por dónde se pidiera. */
    expect(APIRUTA).toMatch(/camposRecibo: c\.camposRecibo/)
  })

  it('y la pantalla los resuelve en el mismo orden que la ficha', () => {
    // cliente → negocio → fábrica.
    expect(RUTA).toMatch(/const camposDelRecibo = \(cliente\) =>/)
    expect(RUTA).toMatch(/camposRecibo: camposDelRecibo\(c\)/)
    expect(RUTA).toMatch(/camposRecibo: camposReciboOrg/)
    /* Declarada ANTES de quien la usa: en este fichero ya se estrelló tres
       veces una `const` leída por encima de su declaración. */
    expect(RUTA.indexOf('const camposDelRecibo')).toBeLessThan(RUTA.indexOf('const datosDelComprobante'))
  })

  it('el tipo del pago llega al comprobante de la ruta', () => {
    expect(RUTA).toMatch(/tipo: data\?\.pagos\?\.\[0\]\?\.tipo/)
    expect(RUTA).toMatch(/tipo: reciboCobro\?\.tipo/)
  })
})
