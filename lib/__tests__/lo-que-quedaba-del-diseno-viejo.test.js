import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join, sep } from 'node:path'

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

// ── LOS VIDEOS, FUERA DE TODAS PARTES ───────────────────────────────────────
//
// «Todos los videos hay que quitarlos y reemplazarlos por imágenes, porque todo
// eso tanto texto como contenido están super viejos.»
//
// Los 13 son de marzo y enseñan la interfaz de antes del rediseño de julio. El
// bot v2 ya tenía la regla escrita —«NUNCA ofrezcas ni envies videos… muestran
// una interfaz vieja»— pero seguían vivos en tres sitios que esa regla no
// tocaba: la pantalla de tutoriales, ocho correos, y las constantes de las que
// se sacaban.
describe('ni un enlace de YouTube en la app, salvo el del bot', () => {
  /* ⚠ ESTA REGLA SE ABRIÓ, Y SOLO UN DEDO.
   *
   * Nació porque los tutoriales eran de marzo y enseñaban la interfaz anterior
   * al rediseño: cada enlace repartido por correos, prompts y pantallas mandaba
   * al cliente a ver algo que ya no existe.
   *
   * Los diecisiete están rehechos sobre la interfaz de hoy y publicados en una
   * lista, así que el bot vuelve a poder mandarlos. Pero la regla sigue viva
   * para todo lo demás: un enlace de YouTube suelto en cualquier otro sitio es
   * otra vez un enlace que nadie va a acordarse de actualizar.
   *
   * Dos ficheros y ni uno más:
   *   · `producto.js`    la constante, que es la única fuente
   *   · `sanitizador.js` la guarda que impide que se borre al limpiar el
   *                      mensaje. Necesita el literal para reconocerlo. */
  const PERMITIDOS = ['lib/bot-v2/producto.js', 'lib/bot-v2/sanitizador.js']

  it('⚠ no queda ninguno, ni en correos, ni en prompts, ni en tutoriales', () => {
    const raiz = process.cwd()
    const jsFiles = (dir, out = []) => {
      for (const e of readdirSync(dir)) {
        if (['node_modules', '.next', '.git'].includes(e)) continue
        const f = join(dir, e)
        if (statSync(f).isDirectory()) jsFiles(f, out)
        else if (/\.(js|jsx)$/.test(f)) out.push(f)
      }
      return out
    }
    const culpables = []
    for (const f of jsFiles(resolve(raiz, 'lib')).concat(jsFiles(resolve(raiz, 'app')), jsFiles(resolve(raiz, 'components')))) {
      const rel = f.slice(raiz.length + 1).split(sep).join('/')
      if (rel.startsWith('lib/__tests__/')) continue   // las pruebas nombran lo prohibido
      if (PERMITIDOS.includes(rel)) continue            // el enlace del bot, a propósito
      const src = readFileSync(f, 'utf8')
      // Sin comentarios: las notas explican POR QUÉ se fueron y citan el dominio.
      const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')
      if (/youtu\.be|youtube\.com/i.test(codigo)) culpables.push(rel)
    }
    expect(culpables, 'todavía mandan a YouTube').toEqual([])
  })
})

describe('los tutoriales, rehechos', () => {
  const datos = readFileSync(resolve(process.cwd(), 'lib/tutorialesData.js'), 'utf8')

  it('ninguno lleva ya `videoId`', () => {
    expect(datos).not.toMatch(/videoId/)
    expect(readFileSync(resolve(process.cwd(), 'components/TutorialesList.jsx'), 'utf8')).not.toMatch(/videoId/)
  })

  it('⚠ y TODOS tienen al menos una imagen', () => {
    /* Antes ocho se explicaban solo con texto —abono a capital, recargos,
       capital, socios, medios de pago, el portal, «Más» y el recorrido— y ese
       texto era de marzo. Si se quitan los videos y no se ponen imágenes, el
       tutorial queda peor que antes, no mejor. */
    const bloques = datos.split('    id: ').slice(1)
    const sinImagen = bloques.filter((b) => /images: \[\]/.test(b.split('  },')[0]))
    expect(sinImagen.length, 'tutoriales sin ni una captura').toBe(0)
    /* ⚠ UN MÍNIMO, NO UN NÚMERO EXACTO. Estaba clavado en 29 y falló al
       añadir las guías de gestión del préstamo, con la invariante intacta.
       Lo que esto protege es que NINGUNA se quede sin captura; que sean 29
       o 34 no dice nada, y un número exacto convierte cada guía nueva en
       una prueba en rojo. */
    expect(bloques.length).toBeGreaterThanOrEqual(29)
  })

  it('y ya no mandan a sitios que no existen', () => {
    // Los rótulos viejos que medí: 15 de los 29 los nombraban.
    /* ⚠ SIN LA CABECERA DEL ARCHIVO. Es la quinta vez que muerde: las notas de
       `tutorialesData.js` CITAN los rótulos muertos para explicar por qué se
       fueron, así que una prueba sobre el texto entero se acusa a sí misma. */
    const cuerpo = sinNotas(datos)
    for (const muerto of ['Cartera activa', 'Cuota diaria total', 'botón verde']) {
      expect(cuerpo, `sigue diciendo «${muerto}»`).not.toMatch(new RegExp(muerto))
    }
  })
})
