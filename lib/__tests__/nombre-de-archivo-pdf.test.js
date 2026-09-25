// lib/__tests__/nombre-de-archivo-pdf.test.js
//
// ⚠ EL PAGARÉ NO SE DESCARGABA A 209 CLIENTES (5 negocios, medido el 25 sep
// 2026). El nombre del archivo lleva el del cliente, y una cabecera HTTP solo
// admite Latin-1: un nombre que empieza por un emoji o trae comillas «“ ”»
// reventaba con «Cannot convert argument to a ByteString». El 23 sep alguien lo
// intentó 12 veces en 45 minutos.

import { describe, it, expect } from 'vitest'
import { respuestaPdf, disposicionAdjunto } from '@/lib/papel/documento'

const pdf = Buffer.from('%PDF-1.4 prueba')

describe('el nombre del archivo de un PDF', () => {
  it('⚠ un cliente cuyo nombre empieza por un emoji ya no revienta', () => {
    expect(() => respuestaPdf(pdf, 'pagare-🌟-María-López.pdf')).not.toThrow()
  })

  it('⚠ ni uno con comillas tipográficas', () => {
    expect(() => respuestaPdf(pdf, 'pagare-Juan-“el-Mono”-Pérez.pdf')).not.toThrow()
  })

  it('el navegador recibe el nombre real en UTF-8 y uno de respaldo en ASCII', () => {
    const d = disposicionAdjunto('pagare-María-López.pdf')
    expect(d).toBe(`attachment; filename="pagare-Maria-Lopez.pdf"; filename*=UTF-8''pagare-Mar%C3%ADa-L%C3%B3pez.pdf`)
  })

  it('el de respaldo nunca lleva comillas ni nada fuera de ASCII', () => {
    const d = disposicionAdjunto('pagare-🌟-Ana-"la"-Ruiz.pdf')
    const respaldo = /filename="([^"]*)"/.exec(d)[1]
    expect(respaldo).toMatch(/^[\x20-\x7E]+$/)
    expect(respaldo).not.toContain('"')
    expect(respaldo.endsWith('.pdf')).toBe(true)
  })

  it('un emoji partido por la mitad (recortar a 30 caracteres) tampoco rompe', () => {
    const partido = 'pagare-' + '🌟'.slice(0, 1) + '.pdf'
    expect(() => disposicionAdjunto(partido)).not.toThrow()
    expect(() => respuestaPdf(pdf, partido)).not.toThrow()
  })

  it('los nombres fijos de siempre quedan igual en el de respaldo', () => {
    expect(disposicionAdjunto('quien-me-debe-2026-09-25.pdf')).toMatch(/^attachment; filename="quien-me-debe-2026-09-25\.pdf"; /)
  })
})
