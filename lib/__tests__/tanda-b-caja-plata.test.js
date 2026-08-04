import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

// T16-00 pone bajo el monto «Te quedan $3.2M disponibles en caja despues de
// este prestamo»: es la pregunta que el prestamista se hace justo ahi, y antes
// habia que salir a Capital, mirarlo y volver.
describe('«te quedan en caja» al crear un prestamo', () => {
  const pagina = leer('app/(dashboard)/prestamos/nuevo/page.jsx')

  it('lo pinta bajo el monto', () => {
    expect(pagina).toContain('disponibles en caja después de este préstamo')
  })

  it('avisa en rojo si el prestamo deja la caja en negativo', () => {
    // Prestar mas de lo que hay es una decision valida —se repone— pero tiene
    // que verse ANTES de darle a crear, no despues en la caja.
    expect(pagina).toContain('es más de lo que hay en caja')
    expect(pagina).toMatch(/queda < 0 \? 'var\(--cf-red-dark\)'/)
  })

  it('SOLO para el dueño', () => {
    // `/api/capital` devuelve 403 a un cobrador, y el capital del negocio no es
    // dato suyo. Sin esta guarda seria una peticion fallida en cada carga.
    expect(pagina).toMatch(/if \(!esOwner\) return\s*\n\s*fetch\('\/api\/capital'\)/)
  })

  it('no sale sin monto escrito', () => {
    expect(pagina).toMatch(/saldoCaja != null && Number\(monto\) > 0/)
  })
})

// T30-01 «Mi plata», y su pie lo llama «el error de fondo»: la pantalla
// enseñaba solo lo que hay en caja, y el prestamista concluia que su negocio
// valia eso. Su plata es lo que tiene listo MAS lo que esta en la calle.
describe('«toda tu plata»', () => {
  const tab = leer('components/capital/CapitalTab.jsx')
  const api = leer('app/api/capital/resumen/route.js')

  it('el dato ya venia del endpoint', () => {
    // `capitalEnCalle` se calculaba y se devolvia; no se pintaba en ningun
    // sitio. No hubo que tocar el servidor.
    expect(api).toMatch(/capitalEnCalle: Math\.round\(capitalEnCalle\)/)
  })

  it('la pantalla suma las dos mitades', () => {
    expect(tab).toMatch(/const todaLaPlata = saldoCapital \+ enCalle/)
    expect(tab).toContain('Lista para prestar')
    expect(tab).toContain('En la calle, cobrándose')
  })

  it('no sale con el negocio en cero', () => {
    // Un bloque negro con tres ceros ocupa la pantalla de quien todavia no ha
    // puesto nada, y no le dice nada.
    expect(tab).toMatch(/\{todaLaPlata > 0 && \(/)
  })

  it('la barra no desaparece con el saldo en cero', () => {
    // Misma regla del 2% que ya usan las rutas: un ancho cero borra la barra y
    // la pantalla parece rota.
    expect(tab).toMatch(/Math\.max\(2, Math\.round\(\(saldoCapital \/ todaLaPlata\)/)
  })
})
