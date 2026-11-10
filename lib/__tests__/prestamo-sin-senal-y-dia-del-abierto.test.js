/**
 * DOS VÍAS QUE SE HABÍAN SEPARADO (10 nov 2026).
 *
 * 1) Crear un préstamo SIN SEÑAL mandaba otra lista de campos que con señal:
 *    faltaban `sinPlazo`, `interesPorMes`, `interesAdelantado` y `capitalExtra`.
 *    El abierto se creaba como Globo con plazo, sin un aviso. Ahora las dos vías
 *    salen de `cuerpoDelPrestamo`.
 * 2) «Cambiar día de cobro» dejaba poner día de corte a un abierto que el POST
 *    rechaza, y moverlo con meses de interés ya asentados.
 *
 * Anclas en el código, no en los comentarios (CLAUDE.md).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const form = leer('app/(dashboard)/prestamos/nuevo/page.jsx')
const patch = leer('app/api/prestamos/[id]/route.js')

describe('crear sin señal manda lo mismo que con señal', () => {
  const cuerpo = form.slice(form.indexOf('const cuerpoDelPrestamo = () => ({'), form.indexOf('const crearPrestamoRequest'))

  it('hay un solo cuerpo y las dos vías lo usan', () => {
    expect(cuerpo.length).toBeGreaterThan(200)
    expect(form).toMatch(/\.\.\.cuerpoDelPrestamo\(\),\n\s+\.\.\.\(inyeccionPrevia && \{ inyeccionPrevia \}\),/)
    expect(form).toMatch(/const payloadOffline = cuerpoDelPrestamo\(\)/)
  })
  it('lleva las opciones que sin señal se perdían', () => {
    expect(cuerpo).toMatch(/\.\.\.\(esAbierto && \{ sinPlazo: true \}\),/)
    expect(cuerpo).toMatch(/\.\.\.\(interesPorMesActivo && \{ interesPorMes: true \}\),/)
    expect(cuerpo).toMatch(/\{ interesAdelantado: true \}/)
    expect(cuerpo).toMatch(/\.\.\.\(capitalExtra\.length > 0 && \{ capitalExtra \}\),/)
  })
  it('la inyección de capital sigue siendo solo de la vía con señal', () => {
    expect(cuerpo).not.toMatch(/inyeccionPrevia/)
  })
  it('no queda otro objeto armado a mano para la cola', () => {
    expect(form).not.toMatch(/const payloadOffline = \{/)
  })
})

describe('cambiar el día de cobro de un abierto', () => {
  it('con meses de interés asentados no se mueve', () => {
    expect(patch).toMatch(/if \(asentados > 0\) \{\n\s+return Response\.json\(\{\n\s+error: `No se puede cambiar el día de cobro: este préstamo abierto ya tiene/)
  })
  it('sin «Mes completo» no se le pone día de corte, igual que al crearlo', () => {
    expect(patch).toMatch(/const admiteDia = p\.interesMesCompleto === true\n\s+&& \(\(p\.frecuencia \|\| 'diario'\) === 'mensual' \|\| \(\(p\.frecuencia \|\| 'diario'\) === 'quincenal' && dosDias\)\)/)
    expect(patch).toMatch(/if \(pideDia && !admiteDia\) \{/)
  })
  it('guardar sin cambiar el día no se frena', () => {
    expect(patch).toMatch(/if \(cambiaElDia && p\.sinPlazo === true && p\.modoInteres === 'solo_interes'\)/)
  })
})
