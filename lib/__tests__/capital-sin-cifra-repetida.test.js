import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Capital, 18 nov 2026: la misma cifra salía dos veces seguidas —«Lista para
// prestar» en «Toda tu plata» y otra vez, gigante, en «Saldo del capital»— y
// «Capital prestado» repetía el «En la calle» del bloque negro. Se quitó lo
// repetido, pero ninguna cifra puede quedarse sin sitio donde verse.
//
// Sobre el CÓDIGO, sin comentarios: los comentarios citan lo que se quitó.
const fuente = readFileSync(resolve(process.cwd(), 'components/capital/CapitalTab.jsx'), 'utf8')
const codigo = fuente.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('Capital no repite cifras y no pierde ninguna', () => {
  it('«Toda tu plata» sale cuando el total es positivo', () => {
    expect(codigo).toMatch(/\{todaLaPlata > 0 && \(/)
  })

  it('«Saldo del capital» sale solo cuando «Toda tu plata» no está', () => {
    // Si las dos condiciones dejaran de ser complementarias, o se repetiría la
    // cifra o, peor, no saldría en ningún lado.
    expect(codigo).toMatch(/\{resumen\?\.configurado && todaLaPlata <= 0 && \(\(\) => \{/)
  })

  it('el aviso de capital en negativo vive dentro de «Toda tu plata»', () => {
    const i = codigo.indexOf('{todaLaPlata > 0 && (')
    const f = codigo.indexOf('<RegistrarAcciones')
    expect(codigo.slice(i, f)).toMatch(/\{saldoCapital < 0 && \(/)
    expect(codigo.slice(i, f)).toContain('Capital en negativo')
  })

  it('«Capital prestado» vuelve a «En la calle» cuando el bloque negro no sale', () => {
    expect(codigo).toMatch(/todaLaPlata <= 0 && \{ etiqueta: 'Capital prestado', valor: formatMoney\(resumen\.cartera\.capitalEnCalle\) \}/)
    expect(codigo).toContain("{ etiqueta: 'Por cobrar, con intereses', valor: formatMoney(resumen.cartera.total) }")
  })
})
