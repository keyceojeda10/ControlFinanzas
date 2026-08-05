import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Un dueño reportó: «antes salía un mensaje describiendo el crédito y ahora
// sale un mensaje muy sencillo». La causa: el botón que dice «Enviar resumen
// por WhatsApp» abría la hoja SIN preseleccionar, y la hoja nueva solo ofrece
// las cuatro familias de cobro —que no incluyen «crédito aprobado»—.
//
// Se mira el código porque el fallo no está en el mensaje generado (ese está
// bien) sino en QUÉ plantilla se abre.
const fuente = readFileSync(
  resolve(process.cwd(), 'app/(dashboard)/prestamos/[id]/page.jsx'), 'utf8')

describe('el botón de resumen abre el resumen', () => {
  it('el WhatsApp de la ficha preselecciona credito_aprobado', () => {
    /* ⚠ ESTA PRUEBA MIRABA «Enviar resumen por WhatsApp», el botón de la barra
       lateral, y ese botón SE QUITÓ a propósito (E02): hacía exactamente lo
       mismo que el chip «WhatsApp» de la columna izquierda, así que WhatsApp
       salía dos veces en la misma pantalla con el mismo destino.

       Lo que defendía sigue vigente y por eso la prueba se queda: el WhatsApp
       de esta ficha tiene que abrir «crédito aprobado», no las familias de
       cobro. Ahora se comprueba en el chip, que es donde quedó. */
    expect(fuente, 'volvió el botón duplicado de la barra lateral')
      .not.toContain('Enviar resumen por WhatsApp')

    const i = fuente.indexOf("label: 'WhatsApp'")
    expect(i, 'ya no existe el chip de WhatsApp: revisa este test').toBeGreaterThan(0)
    const bloque = fuente.slice(i, i + 1800)
    expect(bloque, 'el chip abre la hoja sin preseleccionar el resumen')
      .toContain("setWaSugerida('credito_aprobado')")
  })

  it('las familias rápidas NO traen el crédito aprobado (por eso hace falta)', async () => {
    const { FAMILIAS } = await import('../adaptadores/plantillas')
    expect(FAMILIAS.map((f) => f.id)).not.toContain('credito_aprobado')
  })
})
