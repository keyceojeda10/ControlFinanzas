import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// El dueño comparo la lamina T03-01 con lo que tenemos: «faltan muchos
// elementos, las tarjetas son ligeramente diferentes, tienen mas botones».
//
// Lo mas visible: en la lamina el PRIMER cobro pendiente lleva borde dorado y
// tres acciones —WhatsApp, Mapa y los tres puntos—. Hoy las veinte tarjetas
// eran iguales y ninguna tenia acciones.
const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const pantalla = leer('components/pantallas/CobrarHoy.jsx')
const pagina = leer('app/(dashboard)/cobros-hoy/page.jsx')
const api = leer('app/api/cobros-hoy/route.js')
const schema = leer('prisma/schema.prisma')

describe('la parada actual', () => {
  it('es la PRIMERA sin cobrar de toda la lista, no la primera de cada grupo', () => {
    // Con una ruta ya terminada, su primera fila sigue arriba pero ya no es
    // donde esta el cobrador.
    expect(pantalla).toMatch(/grupos\.flatMap\(\(g\) => g\.filas\)\.find\(\(f\) => !f\.cobrada\)\?\.id/)
  })

  it('se marca con el anillo dorado, y solo si no esta cobrada', () => {
    expect(pantalla).toMatch(/activa && !cobrada \? '1\.5px solid var\(--cf-gold\)'/)
  })

  it('sus tres acciones salen SOLO ahi', () => {
    // Veinte tarjetas con tres botones cada una son sesenta botones en una
    // pantalla que se opera caminando.
    expect(pantalla).toMatch(/\{activa && !cobrada && \(onWhatsApp \|\| onMapa \|\| onMas\)/)
  })

  it('pulsar una accion NO abre el cobro', () => {
    // La tarjeta entera es pulsable: sin parar la propagacion, tocar «Mapa»
    // abriria ademas la hoja de registrar pago.
    expect(pantalla).toMatch(/onClick=\{\(e\) => e\.stopPropagation\(\)\}/)
  })
})

describe('las acciones tienen con que funcionar', () => {
  it('el API devuelve telefono y coordenadas', () => {
    // Sin `telefono`, el boton de WhatsApp mandaria a TODOS a la ficha del
    // cliente en vez de abrir el chat. Sin las coordenadas, el mapa caeria
    // siempre en la direccion escrita.
    for (const campo of ['telefono: true', 'latitud: true', 'longitud: true']) {
      expect(api, `el select no pide ${campo}`).toContain(campo)
    }
  })

  it('esos campos existen de verdad en el esquema', () => {
    // Un campo inventado en un `select` es un 500 en runtime que el build no ve.
    // ⚠ Sin `new RegExp` con cadena: se come un nivel de escapado y el patrón
    // acababa buscando un salto de línea real seguido de una «s», así que daba
    // rojo con los campos ya puestos. Comparando línea a línea no hay escapes
    // que valgan, y comprueba lo mismo.
    const cliente = /model Cliente [\s\S]*?\n}/.exec(schema)[0]
    for (const campo of ['telefono', 'latitud', 'longitud']) {
      const tiene = cliente.split('\n').some((l) => l.trim().startsWith(campo + ' '))
      expect(tiene, `Cliente no tiene ${campo}`).toBe(true)
    }
  })

  it('WhatsApp abre la hoja de plantillas', () => {
    // Esta prueba fijaba el `wa.me/` directo, que abria el chat VACIO: el
    // cobrador tenia que escribir el mensaje a mano delante de alguien que le
    // debe plata. Reportado por el dueño — «no manda ni siquiera a las
    // plantillas»— y sustituido por la hoja, que es la misma que usa la ficha.
    // Lo que le pase sin telefono lo decide la hoja, no esta pantalla.
    expect(pagina).toContain('setWaCliente')
    expect(pagina).toContain('<HojaWhatsApp')
  })

  it('el mapa prefiere el punto marcado y si no usa la direccion', () => {
    expect(pagina).toMatch(/c\?\.latitud && c\?\.longitud/)
    expect(pagina).toMatch(/\[c\?\.direccion, c\?\.referencia\]\.filter\(Boolean\)/)
  })
})
