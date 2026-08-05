import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Los tres botones del recibo de pago pasaron de `BotonWhatsApp` —que genera
// el texto y salta a WhatsApp de una vez— a la hoja, donde el cobrador LEE el
// mensaje antes de mandarlo. En el recibo importa más que en ningún sitio:
// ese mensaje lleva cifras.
//
// Esta prueba existe por el patrón del proyecto: el rediseño pierde funciones
// en silencio. Sustituir un componente por otro se lleva por delante lo que el
// viejo hacía ADEMÁS de pintarse, y aquí hacía dos cosas.
const RUTA = 'app/(dashboard)/prestamos/[id]/page.jsx'
const src = readFileSync(resolve(process.cwd(), RUTA), 'utf8')

describe('el recibo de pago abre la hoja', () => {
  it('los tres caminos del recibo la usan', () => {
    // Éxito recién registrado, tras cerrar la animación, y préstamo saldado.
    // Son el mismo momento en tres estados: si uno se queda con el botón
    // viejo, ese camino sigue mandando a ciegas.
    const nuevos = src.split('<BotonAbrirHojaWA').length - 1
    expect(nuevos, 'no están los tres botones del recibo').toBe(3)
    expect(src, 'quedó un `BotonWhatsApp tipo="pago"` sin migrar')
      .not.toMatch(/<BotonWhatsApp tipo="pago"/)
  })

  it('no sale el botón si el cliente no tiene teléfono', () => {
    // Lo hacía el componente viejo por dentro (`if (!cliente?.telefono) return
    // null`). Al cambiarlo por uno que solo se pinta, la guardia tiene que
    // estar FUERA o el botón sale para gente a la que no se puede escribir.
    const bloques = src.split('<BotonAbrirHojaWA')
    // Cada aparición lleva su `cliente?.telefono` en las líneas de antes.
    for (let i = 1; i < bloques.length; i++) {
      const antes = bloques[i - 1].slice(-260)
      expect(antes, `al botón nº${i} le falta la guardia de teléfono`).toContain('cliente?.telefono')
    }
  })

  it('la hoja recibe el pago y lo suelta al cerrar', () => {
    // Sin `pago` la hoja abre en las familias normales y el recibo pierde su
    // detalle. Sin soltarlo al cerrar, el siguiente mensaje —uno de cobro,
    // pongamos— saldría arrastrando el pago anterior.
    expect(src, 'la hoja no recibe el pago').toMatch(/pago=\{waPago\}/)
    expect(src, 'el pago no se suelta al cerrar').toMatch(/setWaPago\(null\)/)
    expect(src, 'no se preselecciona la confirmación de pago').toContain("setWaSugerida('pago_confirmacion')")
  })
})
