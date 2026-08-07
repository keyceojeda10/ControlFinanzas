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
    // Se ancla en el `<Etiqueta>` del campo: `documentConfig.label` a secas
    // aparece antes en un mensaje de validación, que no es el campo.
    const i = src.indexOf('<Etiqueta texto={documentConfig.label}')
    expect(i).toBeGreaterThan(-1)
    /* «opcional» va en la ETIQUETA, no dentro del placeholder: metida en el
       placeholder salía «opcional · ej. 1023456789», una frase larga y gris que
       compite con lo que se escribe. Y el placeholder conserva el ejemplo del
       documento del país, que se internacionalizó para que a alguien en
       Argentina no le saliera «CC». */
    expect(src.slice(i, i + 60)).toMatch(/opcional/)
    const campo = src.slice(i, i + 700)
    expect(campo, 'volvió a perderse el ejemplo del documento del país')
      .toMatch(/\$\{documentConfig\.placeholder\}/)
  })

  it('y debajo se dice una vez, en una frase', () => {
    expect(src).toMatch(/Solo el nombre es obligatorio/)
  })

  it('el teléfono también dice que es opcional', () => {
    /* Lo era ya —la validación solo comprueba el formato SI hay algo escrito,
       igual que la cédula— pero el campo no lo decía, así que en la calle se
       leía como obligatorio y frenaba lo mismo. */
    const i = src.indexOf('<Etiqueta texto={phoneConfig.label}')
    expect(i).toBeGreaterThan(-1)
    expect(src.slice(i, i + 60)).toMatch(/opcional/)
    expect(src.slice(i, i + 400), 'se perdió el ejemplo del formato del país')
      .toMatch(/\$\{phoneConfig\.placeholder\}/)
  })

  it('y NO lleva el icono de WhatsApp dentro del campo', () => {
    /* Lo puse dibujado a mano dentro de un campo gris y quedaba nefasto. Su
       trabajo —decir para qué sirve dejar el número— lo hace mejor la frase de
       debajo, sin meter un dibujo dentro de un control. */
    const i = src.indexOf('<Etiqueta texto={phoneConfig.label}')
    expect(src.slice(i, i + 600)).not.toMatch(/<svg/)
  })

  it('y la validación sigue exigiendo que lo escrito sea válido', () => {
    /* Opcional no es «vale cualquier cosa»: un teléfono a medias es peor que
       ninguno, porque el recordatorio se manda y no llega. */
    expect(src).toMatch(/form\.telefono\.trim\(\) && !validatePhone/)
    expect(src).toMatch(/!form\.nombre\.trim\(\)/)
  })

  it('el subtítulo no enumera campos que no hacen falta', () => {
    // Decía «Nombre, documento y teléfono. Lo mínimo para registrarlo», y de
    // los tres dos son opcionales: se leía como tres campos obligatorios.
    expect(src).not.toMatch(/Nombre, documento y tel[eé]fono/)
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
    // Se ancla en el `<Etiqueta>` del campo: `documentConfig.label` a secas
    // aparece antes en un mensaje de validación, que no es el campo.
    /* La ventana va holgada: `sinComentarios` VACÍA los comentarios pero
       mantiene su longitud —para no correr los números de línea—, así que entre
       la rejilla y el campo puede haber más de mil caracteres de espacios. */
    const i = src.indexOf('<Etiqueta texto={documentConfig.label}')
    expect(src.slice(Math.max(0, i - 2000), i)).toMatch(/grid sm:grid-cols-2/)
  })

  it('dirección y referencia también', () => {
    const i = src.indexOf('<Etiqueta texto="Dirección"')
    expect(i, 'cambió la etiqueta de dirección').toBeGreaterThan(-1)
    expect(src.slice(Math.max(0, i - 2000), i)).toMatch(/grid sm:grid-cols-2/)
  })

  it('el nombre es el que manda', () => {
    const i = src.indexOf('label="Nombre completo"')
    expect(src.slice(i, i + 500)).toMatch(/cf-campo-grande/)
  })
})

describe('los campos se ven como cajas, no como huecos grises', () => {
  it('todos los del formulario van sobre papel', () => {
    /* ESTA es la diferencia entre las dos pantallas de la tanda. El relleno
       gris de `--cf-fill` funciona cuando el formulario va sobre el fondo de la
       app: el campo es el hueco más claro dentro de una zona gris. Sobre una
       hoja blanca se invierte —el campo pasa a ser una mancha gris sobre
       papel— y el formulario se lee apagado. En crear préstamo los campos son
       blancos con borde; aquí se habían quedado grises. */
    const campos = (src.match(/<(Input|Select)\b/g) ?? []).length
    const enPapel = (src.match(/tono="papel"/g) ?? []).length
    expect(enPapel, `${enPapel} de ${campos} campos sobre papel: alguno se quedó gris`)
      .toBeGreaterThanOrEqual(campos - 1)
  })

  it('la variante existe de verdad en el componente', () => {
    // Un `tono` que el componente no conoce no falla: se ignora y el campo
    // sigue gris, con las pruebas en verde.
    const input = readFileSync(resolve(RAIZ, 'components/ui/Input.jsx'), 'utf8')
    expect(input).toMatch(/const fieldStylePapel/)
    expect(input).toMatch(/tono === 'papel' \? fieldStylePapel : fieldStyle/)
  })
})

describe('la ubicación en el mapa', () => {
  const mapa = readFileSync(resolve(RAIZ, 'components/clientes/LocationPicker.jsx'), 'utf8')

  it('el botón dice lo que hace', () => {
    /* «Mi ubicación» puede entenderse como «ver dónde estoy». Lo que hace es
       CLAVAR la del cliente donde estás parado, que es como se usa: de pie en
       la puerta de su casa. */
    expect(mapa).toMatch(/Fijar en la ubicación actual/)
    expect(mapa).not.toMatch(/>\s*Mi ubicación/)
  })

  it('y tiene tamaño de control, no de enlace', () => {
    // Es la acción principal del bloque y salía del mismo tamaño que «ocultar
    // mapa», que es una preferencia de vista.
    const i = mapa.indexOf('onClick={handleGPS}')
    expect(mapa.slice(i, i + 800)).toMatch(/h-11/)
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
