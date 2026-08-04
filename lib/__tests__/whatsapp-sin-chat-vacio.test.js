import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// El cobrador está en la puerta del cliente y toca «WhatsApp». Si eso abre el
// chat VACÍO, tiene que escribir el aviso a mano, de pie en la calle. Pasó dos
// veces: en la tarjeta de cobrar hoy y en «Avisar» de la parada de la ruta.
//
// Se comprueba leyendo el archivo porque el fallo no está en la lógica —el
// `window.open` funciona perfectamente— sino en QUE NO SE ABRE LA HOJA. Ninguna
// prueba de comportamiento lo iba a ver: no hay nada roto que atrapar.
//
// Las pantallas donde el destinatario es un CLIENTE. Fuera quedan a propósito
// soporte, socios, credenciales del cobrador y el bot: ahí el `wa.me` directo es
// lo correcto, no hay plantilla de cobro que aplicar.
const PANTALLAS_DE_CLIENTE = [
  'app/(dashboard)/rutas/[id]/page.jsx',
  'app/(dashboard)/cobros-hoy/page.jsx',
  'app/(dashboard)/clientes/[id]/page.jsx',
  'app/(dashboard)/prestamos/[id]/page.jsx',
]

describe('escribirle a un cliente', () => {
  it.each(PANTALLAS_DE_CLIENTE)('%s no abre el chat vacío', (ruta) => {
    const src = readFileSync(resolve(process.cwd(), ruta), 'utf8')
    const pelados = src
      .split('\n')
      .map((l, i) => ({ l, n: i + 1 }))
      // Un `wa.me` SIN `?text=` es un chat en blanco. Con texto puede ser
      // legítimo (lo generó el motor antes de abrir).
      .filter(({ l }) => /wa\.me\//.test(l) && !/\?text=|text=\$\{/.test(l))
    expect(
      pelados.length,
      `chat vacío en ${ruta}:${pelados.map((p) => p.n)} — usa <HojaWhatsApp>`,
    ).toBe(0)
  })

  it('la ruta monta la hoja y le pasa el préstamo', () => {
    // Sin préstamo la hoja solo ofrece el mensaje libre: se pierden las
    // plantillas de cobro, que son justo lo que hace falta en la parada.
    const src = readFileSync(resolve(process.cwd(), PANTALLAS_DE_CLIENTE[0]), 'utf8')
    expect(src).toContain('<HojaWhatsApp')
    const avisar = /onAvisar=\{\(\) => \{[\s\S]*?\n {8}\}\}/.exec(src)
    expect(avisar, 'ya no existe `onAvisar`: revisa esta prueba').toBeTruthy()
    expect(avisar[0], '«Avisar» no abre la hoja').toContain('setModalWA')
    expect(avisar[0], '«Avisar» abre la hoja sin préstamo').toContain('prestamosActivos')
  })
})
