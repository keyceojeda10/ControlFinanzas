import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// Inducción del 18 nov 2026, error 1: «estaba pasando su cartera tomando fotos
// desde el cuaderno, se salió y ya no pudo retomar desde donde quedó». Lo leído
// vivía solo en la memoria de la pantalla. Comprobado en el espejo con
// .auditoria/_lote-retomar.mjs (lote sembrado → «Seguir donde iba» → 2 filas).

const src = readFileSync('components/migrador/LoteFotos.jsx', 'utf8')

describe('el lote de fotos se retoma', () => {
  it('se guarda en el teléfono, por negocio', () => {
    expect(src).toMatch(/const claveLote = `migrador:lote:\$\{organizationId \|\| 'sin-negocio'\}`/)
    expect(src).toMatch(/guardarEnCache\(claveLote, filas\.length \? \{ filas, base, guardadoEn: Date\.now\(\) \} : null\)/)
  })

  it('no pisa el lote de antes mientras lo ofrece', () => {
    expect(src).toMatch(/if \(!organizationId \|\| !loteLeido\.current \|\| pendiente\) return/)
  })

  it('ofrece seguir o empezar de nuevo', () => {
    expect(src).toMatch(/>Seguir donde iba<\/BotonPrimario>/)
    expect(src).toMatch(/>Empezar de nuevo<\/button>/)
  })

  it('al crear, lo guardado sale del lote en el acto y el cliente queda anotado', () => {
    // Si sale a mitad de «Crear», al retomar no se duplica nadie.
    expect(src).toMatch(/setFilas\(\(prev\) => prev\.map\(\(x\) => \(x\._id === f\._id \? \{ \.\.\.x, _clienteId: idCliente \} : x\)\)\)/)
    expect(src).toMatch(/setFilas\(\(prev\) => prev\.filter\(\(x\) => x\._id !== f\._id\)\)/)
  })
})
