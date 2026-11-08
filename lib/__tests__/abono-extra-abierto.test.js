// En un abierto, «Hacer abono extraordinario» entra por Capital.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('el botón de abono extraordinario', () => {
  const s = readFileSync('app/(dashboard)/prestamos/[id]/page.jsx', 'utf8')
  const fin = s.indexOf('>\n            Hacer abono extraordinario')
  const boton = s.slice(s.lastIndexOf('<button', fin), fin)

  it('en un abierto abre la hoja en Capital', () => {
    expect(boton).toContain("if (esAbierto) {\n                setPresetPago({ tipo: 'capital' })\n                setModalPago(true)\n                return\n              }")
  })
  it('los demás préstamos siguen abriendo el cobro normal', () => {
    expect(boton).toContain('abrirPagoNormal()')
  })
  it('la hoja respeta el tipo que llega en el preset', () => {
    const hoja = readFileSync('components/prestamos/RegistrarPago.jsx', 'utf8')
    expect(hoja).toContain("setTipo(presetPago?.tipo ?? (montoFinal >= montoBase ? 'completo' : 'parcial'))")
  })
})
