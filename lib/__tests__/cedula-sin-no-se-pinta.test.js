import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { documentoParaMostrar } from '@/lib/documento'

// Inducción del 18 nov 2026, error 3b: en «Nuevo préstamo» salía
// «CC SIN-mwmnlpw8odkl», el relleno que el sistema guarda cuando el cliente no
// tiene cédula. `documentoParaMostrar` ya existía para eso; quince sitios
// pintaban la cédula a mano y se lo saltaban.

function jsx(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) { if (n !== 'node_modules' && !n.startsWith('.')) jsx(p, out) }
    else if (p.endsWith('.jsx')) out.push(p)
  }
  return out
}

describe('la cédula de relleno no se pinta', () => {
  it('documentoParaMostrar la esconde', () => {
    expect(documentoParaMostrar('SIN-mwmnlpw8odkl')).toBeNull()
    expect(documentoParaMostrar('')).toBeNull()
    expect(documentoParaMostrar('1020304050')).toMatch(/1020304050$/)
  })

  it('ninguna pantalla pinta «abreviatura + cédula» a mano', () => {
    const malos = []
    for (const f of [...jsx('app'), ...jsx('components')]) {
      const s = readFileSync(f, 'utf8')
      for (const linea of s.split('\n')) {
        if (/abreviaturaDocumento\(\)\}? \{?\$?\{?[\w.?]*cedula\}/.test(linea) && !linea.includes("startsWith('SIN-')")) malos.push(`${f}: ${linea.trim().slice(0, 90)}`)
      }
    }
    expect(malos).toEqual([])
  })
})
