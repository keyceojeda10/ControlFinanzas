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
  it('«Enviar resumen por WhatsApp» preselecciona credito_aprobado', () => {
    const i = fuente.indexOf('Enviar resumen por WhatsApp')
    expect(i, 'el botón ya no existe: revisa este test').toBeGreaterThan(0)
    // El onClick va ANTES del rótulo dentro del mismo <button>.
    const abre = fuente.lastIndexOf('<button', i)
    const bloque = fuente.slice(abre, i)
    expect(bloque).toContain("setWaSugerida('credito_aprobado')")
  })

  it('las familias rápidas NO traen el crédito aprobado (por eso hace falta)', async () => {
    const { FAMILIAS } = await import('../adaptadores/plantillas')
    expect(FAMILIAS.map((f) => f.id)).not.toContain('credito_aprobado')
  })
})
