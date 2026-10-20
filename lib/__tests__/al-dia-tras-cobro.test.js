/* DETALLES-COBRADORES #10 (20 oct 2026): un cobro guardado sin señal pintaba
   «Cobrado · queda con atraso de $29.000» aunque fuera la cuota completa de hoy.
   La cuenta del teléfono no bajaba `montoParaPonerseAlDia`. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { alDiaTrasCobro, adaptarCobrosHoy } from '@/lib/adaptadores/cobros'

// Fabián Quintero: al día, le toca la cuota de hoy ($29.000) y la paga entera.
const fabian = () => ({
  id: 'c1', nombre: 'Fabián Quintero', rutaId: 'r1', rutaNombre: 'Ruta',
  pagoHoy: false, cobroPendienteHoy: true, pideHoy: 29000, cuota: 29000,
  montoParaPonerseAlDia: 29000, diasMora: 0,
  prestamos: [{ id: 'p1', cuota: 29000, pagadoHoy: false, montoPagadoHoy: 0, montoParaPonerseAlDia: 29000 }],
})
// Lo mismo que hace la pantalla al cobrar, sin servidor.
const cobrarSinSenal = (c, monto, prestamoId) => {
  const pide = Math.max(0, (Number(c.pideHoy ?? c.cuota) || 0) - monto)
  return { ...c, pagoHoy: true, pideHoy: pide, cobroPendienteHoy: pide > 0, ...alDiaTrasCobro(c, monto, prestamoId) }
}
const tarjeta = (c) => adaptarCobrosHoy({ clientes: [c], resumen: {} }).grupos[0].filas[0]

describe('lo que un cobro hecho en el teléfono le quita a «ponerse al día»', () => {
  it('Fabián paga la cuota de hoy sin señal: cobrado, sin «queda con atraso»', () => {
    const despues = cobrarSinSenal(fabian(), 29000, 'p1')
    expect(despues.montoParaPonerseAlDia).toBe(0)
    expect(despues.prestamos[0]).toMatchObject({ montoParaPonerseAlDia: 0, pagadoHoy: true, montoPagadoHoy: 29000 })
    const t = tarjeta(despues)
    expect(t.cobrada).toBe(true)
    expect(t.quedaAtraso).toBeNull()
    expect(t.cifras.find((x) => x.clave === 'atraso')?.etiqueta).not.toBe('Atraso')
  })

  it('quien de verdad queda debiendo sigue diciéndolo', () => {
    // Debe $58.000 (ayer y hoy) y paga solo los $29.000 de hoy: queda atraso.
    const c = { ...fabian(), montoParaPonerseAlDia: 58000, diasMora: 1 }
    c.prestamos = [{ ...c.prestamos[0], montoParaPonerseAlDia: 58000 }]
    const t = tarjeta(cobrarSinSenal(c, 29000, 'p1'))
    expect(t.cobrada).toBe(true)
    expect(t.quedaAtraso).toBe(adaptarCobrosHoy({ clientes: [{ ...c, pagoHoy: true, cobroPendienteHoy: false, montoParaPonerseAlDia: 29000 }], resumen: {} }).grupos[0].filas[0].quedaAtraso)
    expect(t.quedaAtraso).toMatch(/29/)
  })

  it('un abono grande a un préstamo no le borra el atraso al otro', () => {
    const c = {
      montoParaPonerseAlDia: 25000,
      prestamos: [{ id: 'A', montoParaPonerseAlDia: 10000, montoPagadoHoy: 0 }, { id: 'B', montoParaPonerseAlDia: 15000, montoPagadoHoy: 0 }],
    }
    const r = alDiaTrasCobro(c, 30000, 'A')
    expect(r.montoParaPonerseAlDia).toBe(15000)
    expect(r.prestamos[0].montoParaPonerseAlDia).toBe(0)
    expect(r.prestamos[1]).toBe(c.prestamos[1])
  })

  it('un abono parcial baja lo que paga, ni más ni menos', () => {
    expect(alDiaTrasCobro(fabian(), 10000, 'p1').montoParaPonerseAlDia).toBe(19000)
  })

  it('sin el dato por préstamo, baja el monto entero; un préstamo suelto (la ficha) también', () => {
    expect(alDiaTrasCobro({ montoParaPonerseAlDia: 29000 }, 29000).montoParaPonerseAlDia).toBe(0)
    expect(alDiaTrasCobro({ montoParaPonerseAlDia: 29000, prestamos: [] }, 5000, 'x').montoParaPonerseAlDia).toBe(24000)
    // Si no venía el campo, no se inventa: la cifra «Debe hoy» solo sale con dato.
    expect(alDiaTrasCobro({ saldoPendiente: 100 }, 29000)).toEqual({})
  })

  it('las tres vías de cobro lo usan: Cobrar hoy, la ruta y la ficha', () => {
    expect(readFileSync('app/(dashboard)/cobros-hoy/page.jsx', 'utf8')).toContain('cobroPendienteHoy: pide > 0, ...alDiaTrasCobro(c, montoFinal, prestamoActivo) }')
    expect(readFileSync('app/(dashboard)/rutas/[id]/page.jsx', 'utf8')).toContain('cobroPendienteHoy: pide > 0, ...alDiaTrasCobro(c, cuota, prestamoActivo) }')
    expect(readFileSync('components/prestamos/RegistrarPago.jsx', 'utf8')).toContain('          ...alDiaTrasCobro(prestamo, m),\n')
  })
})
