import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (...p) => readFileSync(join(process.cwd(), ...p), 'utf8')
const sinComentarios = (s) => s
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

const prestamoRaw = leer('app', '(dashboard)', 'prestamos', 'nuevo', 'page.jsx')
const clienteRaw  = leer('components', 'clientes', 'ClienteForm.jsx')
const prestamo = sinComentarios(prestamoRaw)
const cliente  = sinComentarios(clienteRaw)

describe('T01-06 · la franja de acción es UNA sola pieza', () => {
  it('la cuota vive DENTRO de la barra de botones', () => {
    // Eran dos bloques flotantes, uno sobre otro, cada uno con su fondo y su
    // borde. Encajarlos costó dos rondas —primero se solapaban, luego se
    // separaban demasiado— y las dos veces el fallo era el mismo: dos cajas
    // que hay que alinear a mano no se alinean nunca.
    const barra = prestamo.match(/className="fixed left-0 right-0 lg:left-\[var\(--cf-w-sidebar\)\] bottom-0[\s\S]*?\n      <\/div>/)
    expect(barra, 'no encuentro la franja de acción').toBeTruthy()
    expect(barra[0]).toContain('calculo.cuotaDiaria')
    expect(barra[0]).toContain('calculo.totalAPagar')
  })

  it('ya no hay una tira flotante aparte', () => {
    // La marca de la tira vieja: un segundo bloque `fixed` con su propio
    // `bottom` calculado para esquivar a la barra.
    expect(prestamo).not.toMatch(/z-\[44\][^"]*bottom-\[calc\(\d+px/)
    expect(prestamo).not.toMatch(/bottom: 'calc\(\d+px \+ env\(safe-area/)
  })

  it('la cuota se lee: es la cifra que se está buscando', () => {
    // La lámina la pone a 30px. Estaba a `text-lg`(18) dentro de una tira de
    // 13, con el mismo peso que el total.
    const barra = prestamo.match(/className="fixed left-0 right-0 lg:left-\[var\(--cf-w-sidebar\)\] bottom-0[\s\S]*?\n      <\/div>/)[0]
    expect(barra).toMatch(/text-\[(2[6-9]|3\d)px\]/)
  })

  it('la franja no lleva sombra: se apoya, no flota', () => {
    const barra = prestamo.match(/className="fixed left-0 right-0 lg:left-\[var\(--cf-w-sidebar\)\] bottom-0[\s\S]{0,400}/)[0]
    expect(barra).not.toContain('boxShadow')
    expect(barra).toContain('borderTop')
  })

  it('el contenido reserva hueco para la franja', () => {
    // Sin `pb`, el último campo queda debajo de una barra `fixed` y no se
    // puede ni ver ni tocar.
    expect(prestamo).toMatch(/className="max-w-2xl mx-auto pb-\d+ lg:pb-\d+"/)
  })
})

/* El `onClick` del botón «Cargar otro cliente», y SOLO ese.
   Buscarlo por `/onClick=\{\(\) => \{[\s\S]*?window.scrollTo/` se tragaba 300
   líneas: arrancaba en el `onClick` de «Quitar foto» y no paraba hasta el mío,
   así que las pruebas pasaban por accidente, midiendo medio archivo. Se corta
   hacia atrás desde el texto del botón, que es lo único que lo identifica. */
function reinicioDeCadena() {
  const fin = cliente.indexOf('Cargar otro cliente')
  if (fin === -1) return null
  const desde = cliente.lastIndexOf('onClick=', fin)
  return desde === -1 ? null : cliente.slice(desde, fin)
}

describe('T07-03 · cargar clientes en cadena', () => {
  it('ofrece seguir con otro sin volver a la lista', () => {
    // Las dos salidas que había —«crear préstamo» y «ver ficha»— SACAN del
    // formulario. Quien carga su cartera quiere meter el siguiente: 311 de 411
    // negocios están en cinco clientes o menos.
    expect(cliente).toContain('Cargar otro cliente')
  })

  it('al encadenar limpia los datos de la persona', () => {
    // Si quedara el nombre anterior, el siguiente cliente se guardaría con los
    // datos del previo. Es un fallo de datos, no de diseño.
    //
    // Se ancla al `onClick` que termina en `window.scrollTo`: hay VARIOS
    // `setForm((prev) => ...)` en el archivo —el manejador genérico de campos
    // es el primero— y sin anclar, el regex cazaba ese y la prueba medía el
    // bloque equivocado. Comprobado: fallaba contra el código correcto.
    const flujo = reinicioDeCadena()
    expect(flujo, 'no encuentro el reinicio del formulario').toBeTruthy()
    for (const campo of ['nombre', 'cedula', 'telefono', 'direccion']) {
      expect(flujo, `no limpia ${campo}`).toMatch(new RegExp(`${campo}: ''`))
    }
  })

  it('CONSERVA la ruta al encadenar', () => {
    // Se cargan de una en una y casi siempre en la misma ruta. Volver a
    // elegirla veinte veces es la fricción que hace abandonar a media carga.
    // Mismo anclaje que la prueba de arriba, y por el mismo motivo.
    const reinicio = reinicioDeCadena()
    expect(reinicio).toContain('...prev')
    expect(reinicio).not.toMatch(/rutaId: ''/)
  })

  it('vuelve al primer paso y cierra el aviso', () => {
    const flujo = reinicioDeCadena()
    expect(flujo).toContain('setPaso(0)')
    expect(flujo).toContain('setClienteCreado(null)')
  })

  it('ya no queda la validación muerta que exigía los tres campos', () => {
    // Su comentario decía que controlaba el botón «Continuar» y contradecía al
    // de la validación viva. No la llamaba nadie: leyéndola, cualquiera
    // concluye que el botón sigue bloqueado sin cédula ni teléfono.
    expect(cliente).not.toContain('camposRequeridosLlenos')
  })

  it('solo el nombre es obligatorio', () => {
    const validar = cliente.match(/const validarPasoEstricto[\s\S]*?\n  \}/)[0]
    expect(validar).toMatch(/if \(!form\.nombre\.trim\(\)\)/)
    // Cédula y teléfono solo se comprueban SI se escribieron.
    expect(validar).toMatch(/form\.cedula\.trim\(\) &&/)
    expect(validar).toMatch(/form\.telefono\.trim\(\) &&/)
  })
})

describe('la trampa del comentario en JSX', () => {
  it('ningún `{/* */}` va justo después de un `return (` o un `&& (`', () => {
    // Es error de sintaxis y ya me ha costado DIEZ veces en este proyecto. El
    // build lo caza, pero solo después de esperar la compilación entera.
    for (const [nombre, src] of [['préstamo', prestamoRaw], ['cliente', clienteRaw]]) {
      expect(src, `${nombre}: comentario tras 'return ('`).not.toMatch(/return \(\s*\{\/\*/)
      expect(src, `${nombre}: comentario tras '&& ('`).not.toMatch(/&& \(\s*\n\s*\{\/\*/)
    }
  })
})
