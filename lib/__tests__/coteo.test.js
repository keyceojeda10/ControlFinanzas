/* El coteo: lo cobrado menos los abonos de quien renovó ese día. PRESTA MIL lo
 * hacía con la calculadora: DIEGO #8 cobró $912.000 y $340.000 eran abonos al
 * renovar → $572.000. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { cobrosDeRenovadas, coteo } from '@/lib/dinero/coteo'

const FICHA_API = readFileSync('app/api/caja/cobrador/[id]/route.js', 'utf8')
const LISTA_API = readFileSync('app/api/caja/route.js', 'utf8')
const FICHA = readFileSync('components/caja/CajaCobradorDetalle.jsx', 'utf8')
const LISTA = readFileSync('app/(dashboard)/caja/page.jsx', 'utf8')

describe('coteo', () => {
  it('la cuenta de DIEGO #8', () => {
    expect(coteo(912_000, 340_000)).toEqual({ cobrado: 912_000, abonosAlRenovar: 340_000, monto: 572_000 })
  })

  it('sin abonos al renovar, el coteo es lo cobrado (el cero es un dato)', () => {
    expect(coteo(500_000, 0).monto).toBe(500_000)
    expect(coteo(0, 0).monto).toBe(0)
    expect(coteo(undefined, null).monto).toBe(0)
  })

  it('solo cuentan los cobros de una cartulina renovada ese día', () => {
    const cobros = [
      { prestamoId: 'viejo', montoPagado: 120_000 },
      { prestamoId: 'viejo', montoPagado: 30_000 },
      { prestamoId: 'otro', montoPagado: 50_000 },
    ]
    const renovaciones = [{ renovadoDeId: 'viejo' }, { renovadoDeId: null }]
    expect(cobrosDeRenovadas(cobros, renovaciones).map((p) => p.montoPagado)).toEqual([120_000, 30_000])
    expect(cobrosDeRenovadas(cobros, [])).toEqual([])
  })

  it('la ficha y la lista usan la misma regla (anclado en el código)', () => {
    expect(FICHA_API).toMatch(/const abonosDeRenovadas = cobrosDeRenovadas\(cobros, renovacionesDia\)/)
    expect(FICHA_API).toMatch(/const coteoDia = coteo\(cobradoTotalHoy\.total, cobradoEnDiaDeRenovacion\.monto\)/)
    expect(FICHA_API).toMatch(/coteo: coteoDia,/)
    expect(LISTA_API).toMatch(/for \(const p of cobrosDeRenovadas\(recaudosDiaRaw, renovacionesDiaOrg\)\)/)
    expect(LISTA_API).toMatch(/coteo: coteo\(recaudadoDia, abonosAlRenovarPorCobrador\[c\.id\] \|\| 0\)/)
    // Sin `prestamoId` en el select, ningún pago cruza con una renovación y el
    // coteo sería lo cobrado sin avisar.
    expect(LISTA_API).toMatch(/prestamoId: true,\n\s+prestamo: \{ select: \{ cliente/)
  })

  it('las dos pantallas lo pintan con su nombre', () => {
    expect(FICHA).toMatch(/>Coteo<\/span>/)
    expect(FICHA).toMatch(/\{formatMoney\(data\.coteo\.monto\)\}/)
    expect(LISTA).toMatch(/>Coteo<\/span>/)
    expect(LISTA).toMatch(/\{formatMoney\(c\.coteo\.monto\)\}/)
    // En la lista sale con cierre y sin cierre.
    expect(LISTA.match(/\{filaCoteo\}/g)).toHaveLength(2)
  })
})
