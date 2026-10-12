// Soporte del 12 oct 2026: la cuota que tocaba se guarda en el pago y se lee en
// TODAS las listas. Un `select` que no la pide no da error: la etiqueta sale
// «Completo» como antes, callada. Anclado en el código, no en los comentarios.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { misPagos } from '@/lib/adaptadores/portal'

const leer = (f) => readFileSync(f, 'utf8')

describe('cuotaEsperada: se guarda y se pide en cada vía', () => {
  it('el cobro la calcula en el servidor y la guarda solo en pagos de cuota', () => {
    const r = leer('app/api/prestamos/[id]/pagos/route.js')
    expect(r).toMatch(/cuotaEsperada = calcularCuotaQueToca\(prestamo, obtenerDiasSinCobro\(prestamo\.cliente, prestamo\.cliente\?\.ruta, org, prestamo\), festivos\)/)
    expect(r).toMatch(/cuotaEsperada: \['completo', 'parcial'\]\.includes\(tipo\) \? cuotaEsperada : null,/)
  })
  it.each([
    ['app/api/caja/route.js', /tipo: true,\n\s*\/\/[^\n]*\n\s*cuotaEsperada: true,/],
    ['app/api/clientes/[id]/historial/route.js', /tipo: true,\n\s*cuotaEsperada: true,/],
    ['app/api/portal/prestamos/[id]/route.js', /tipo: true,\n\s*cuotaEsperada: true,/],
  ])('%s la pide', (f, re) => expect(leer(f)).toMatch(re))
  it('la ficha y la hoja la usan', () => {
    expect(leer('app/api/prestamos/[id]/route.js')).toMatch(/cuotaQueToca: calcularCuotaQueToca\(p, diasExcluidos, festivos\)/)
    expect(leer('app/(dashboard)/prestamos/[id]/page.jsx')).toMatch(/cuotaQueToca=\{prestamo\?\.cuotaQueToca \?\? null\}/)
  })
})

describe('el portal del cliente', () => {
  it('un «completo» de $200.000 sobre $450.000 sale como abono', () => {
    const [f] = misPagos([{ id: 1, fecha: '12 oct', monto: 200000, tipo: 'completo', cuotaEsperada: 450000 }], String)
    expect(f.fecha).toMatch(/abono/)
  })
  it('sin cuota guardada (pagos viejos), lo de siempre', () => {
    const [f] = misPagos([{ id: 1, fecha: '12 oct', monto: 200000, tipo: 'completo' }], String)
    expect(f.fecha).not.toMatch(/abono/)
  })
})
