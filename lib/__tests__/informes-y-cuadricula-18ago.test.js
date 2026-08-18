import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { INFORMES } from '@/lib/reportes/catalogo'

/* ══════════════════════════════════════════════════════════════════════════
   LOS CUATRO ARREGLOS DEL 18 DE AGOSTO, cada uno con su queja textual.

   Son pruebas de FUENTE: leen el archivo como texto. No comprueban que se vea
   bien —eso se mide en el navegador— sino que no vuelva el arreglo atrás sin
   que nadie se entere, que es como han vuelto los tres últimos.
   ══════════════════════════════════════════════════════════════════════════ */

const informe = fs.readFileSync('app/(dashboard)/reportes/[informe]/page.jsx', 'utf8')
const indice  = fs.readFileSync('app/(dashboard)/reportes/page.jsx', 'utf8')
const listado = fs.readFileSync('app/(dashboard)/prestamos/page.jsx', 'utf8')
const piezas  = fs.readFileSync('components/cf/primitivos2.jsx', 'utf8')

describe('«me toca desplazarme hasta abajo para ver los botones de descarga»', () => {
  it('el bloque de descargas va ANTES que el contenido del informe', () => {
    /* Con 32 clientes había que recorrer la lista entera; con mil, un rato.
       La posición se mide por el orden en el archivo, que es el orden en que se
       pintan: si alguien lo vuelve a mandar al final, esto cae. */
    const descargas = informe.indexOf('Bajar este informe')
    const contenido = informe.indexOf('{!cargando && vista && (')
    expect(descargas, 'no está el bloque de descargas').toBeGreaterThan(0)
    expect(contenido, 'no está el bloque de contenido').toBeGreaterThan(0)
    expect(descargas, 'las descargas volvieron a quedar debajo de la lista')
      .toBeLessThan(contenido)
  })
})

describe('«la franja de ver todos está cuadrada y nuestros diseños no son cuadrados»', () => {
  it('la franja suelta hereda el radio de su tarjeta', () => {
    expect(piezas).toMatch(/borderRadius: suelto \? 'inherit' : 0/)
  })

  it('y suelta no lleva la raya de arriba, que no separaba de nada', () => {
    expect(piezas).toMatch(/borderTop: suelto \? 0 :/)
  })

  it('el pie del teléfono se declara suelto y su tarjeta recorta', () => {
    /* Sin `overflow: hidden` el fondo de la franja se le sale por las esquinas
       redondas de la tarjeta, que es justo como volvía a verse cuadrada. */
    /* ⚠ La ventana se toma del ÚLTIMO `filasMovil.length`, no del primero: el
       primero está en el bucle que pinta las fichas y allí no hay ningún
       `suelto` que encontrar; y el ancla es la CONDICIÓN del pie, porque
       `visibles={filasMovil.length}` ya va DESPUÉS del `suelto`. Con las dos
       versiones anteriores esta prueba fallaba sobre código correcto. */
    const bloque = informe.slice(informe.indexOf('todas.length > filasMovil.length'))
    expect(bloque.slice(0, 400)).toMatch(/suelto/)
    expect(informe).toMatch(/padding: 0, overflow: 'hidden' \}\}>\s*<PieTabla\s*\n\s*suelto/)
  })
})

describe('«Todo en bruto solo tiene un botón, sin nada más»', () => {
  it('todo informe sin vista dice qué trae', () => {
    /* Su pantalla no puede enseñar nada —son papeles— así que si no declara
       `trae` queda un botón suelto que no dice ni qué baja ni de cuándo. */
    const sinVista = INFORMES.filter((i) => !i.ver)
    expect(sinVista.length, 'ya no hay informes sin vista').toBeGreaterThan(0)
    for (const i of sinVista) {
      expect(i.trae?.length, `«${i.titulo}» no dice qué trae`).toBeGreaterThan(0)
    }
  })

  it('y la pantalla lo pinta', () => {
    expect(informe).toMatch(/informe\.trae\?\.length > 0/)
    expect(informe).toMatch(/informe\.trae\.map/)
  })

  it('«Todo en bruto» ya no se presenta con las palabras de «Para el contador»', () => {
    /* Los dos decían «para el contador» y parecían el mismo informe repetido.
       No lo son: aquel calcula la utilidad, este vuelca las tablas. */
    const crudo = INFORMES.find((i) => i.id === 'crudo')
    const contador = INFORMES.find((i) => i.id === 'contador')
    expect(crudo.contesta).not.toMatch(/contador/i)
    expect(contador.titulo).toMatch(/contador/i)
  })
})

describe('«el selector de fecha de la derecha se sale de su caja»', () => {
  it('en el teléfono las dos fechas ocupan su renglón y se parten el ancho', () => {
    /* `globals.css` fuerza 16px a todo input por debajo de 1024px (antizoom de
       iOS) y pisa el `text-[11px]` de aquí: lo que manda es el ALTO y el
       reparto, no el tamaño de letra que se lee en el JSX. */
    const caja = indice.slice(indice.indexOf('sm:ml-auto'))
    expect(caja.slice(0, 900)).toMatch(/h-9 sm:h-7/)
    expect(caja.slice(0, 900)).toMatch(/min-w-0 flex-1 sm:flex-none/)
    expect(indice, 'volvieron a pegarlas a la derecha en el teléfono')
      .not.toMatch(/gap-1\.5 ml-auto/)
  })
})

describe('«en la vista de cuadritos hay números montados encima de etiquetas»', () => {
  const tarjeta = listado.slice(
    listado.indexOf('function PrestamoCardCompacto'),
    listado.indexOf('function PrestamoCardCompacto') + 4000,
  )

  it('la plata va en su propio renglón y no se recorta', () => {
    /* La regla del proyecto: una cifra de dinero NUNCA lleva puntos
       suspensivos. En 180px de ancho compartía renglón con dos pastillas. */
    expect(tarjeta).toMatch(/whitespace-nowrap/)
    const renglonPlata = tarjeta.slice(tarjeta.indexOf('whitespace-nowrap') - 300, tarjeta.indexOf('whitespace-nowrap') + 300)
    expect(renglonPlata, 'la cifra volvió a llevar truncate').not.toMatch(/truncate[^"]*"[^>]*>\s*\{?\s*formatMoney/)
  })

  it('la pastilla del modo sí puede encogerse, que es una etiqueta', () => {
    /* Era `shrink-0` como la del estado y salía «Cuota fij». Se encoge ella,
       que no es una cifra, y así el modo se sigue viendo entero o casi. */
    const modo = tarjeta.slice(tarjeta.indexOf('MODO_TAG[p.modoInteres] && ('))
    expect(modo.slice(0, 500)).toMatch(/min-w-0 truncate/)
    expect(modo.slice(0, 500), 'la pastilla del modo volvió a ser rígida').not.toMatch(/shrink-0/)
  })
})
