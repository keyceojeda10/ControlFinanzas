// lib/__tests__/ruta-pc-pagado-hoy.test.js
//
// «Los abonos en las tarjetas dentro de la ruta, cuando el cliente paga, no
//  está saliendo cuánto pagó» — reportado al dueño el 2 oct 2026. En el
// teléfono la tarjeta sí lo dice («Ya abonó $5.000 hoy»); la TABLA del PC, que
// es la vista por defecto en el computador, no decía nada: «Cobrar» igual que
// si no hubiera entrado un peso. Anclado en el JSX y en la expresión, no en
// los comentarios.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const tabla = leer('components/pantallas/RutaEscritorio.jsx')
const pagina = leer('app/(dashboard)/rutas/[id]/page.jsx')

describe('la tabla de la ruta en el PC dice lo pagado hoy', () => {
  it('la página le pasa a cada fila el monto pagado hoy', () => {
    expect(pagina).toMatch(/pagadoHoy: c\.pagoHoy && \(c\.montoPagadoHoy \?\? 0\) > 0 \? formatMoney\(c\.montoPagadoHoy\) : null,/)
  })

  it('la tabla lo pinta debajo de la cuota: «Pagó» o «Abonó» con su monto', () => {
    expect(tabla).toMatch(/\{f\.pagadoHoy && \(/)
    expect(tabla).toMatch(/\{f\.cobrada \? 'Pagó' : 'Abonó'\} \{f\.pagadoHoy\}/)
  })
})
