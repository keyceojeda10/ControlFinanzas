/* Lo que decidió Carlos el 18 oct 2026 sobre los informes del agente de los
 * videos: el cierre desde la ruta va al Cuadre (Rutas #1), pagar lo atrasado no
 * es «de más» (Préstamos #61) y en Clásico el abono a capital dice lo que hace
 * (Préstamos #63). Ancladas en el código, y con cifras donde hay cuenta. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { referenciaDelPago, comoFueElPago } from '@/lib/dinero/cuota-de-referencia'

const leer = (f) => readFileSync(f, 'utf8')

describe('#61 · la referencia que se guarda en el pago', () => {
  // Carmen: cuota $12.000, 10 días atrasada; para quedar al día, $132.000.
  const base = { cuotaQueToca: 12000, alDia: 132000 }
  const como = (monto) => comoFueElPago({ tipo: 'completo', montoPagado: monto, cuotaEsperada: referenciaDelPago({ ...base, monto }) })
  it('ponerse al día es completo, no «de más»', () => {
    expect(referenciaDelPago({ ...base, monto: 132000 })).toBe(132000)
    expect(como(132000).clase).toBe('completo')
  })
  it('pagar parte de lo atrasado, también completo', () => {
    expect(como(60000).clase).toBe('completo')
  })
  it('menos de una cuota sigue siendo parcial, contra la cuota', () => {
    const r = como(5000)
    expect(r.clase).toBe('parcial')
    expect(r.cuota).toBe(12000)
    expect(r.diferencia).toBe(-7000)
  })
  it('lo que pasa de lo que debe hoy es «de más», contado desde ahí', () => {
    const r = como(150000)
    expect(r.clase).toBe('extra')
    expect(r.diferencia).toBe(18000)
  })
  it('al día, como antes: lo que pasa de la cuota es de más', () => {
    const r = comoFueElPago({ tipo: 'completo', montoPagado: 20000, cuotaEsperada: referenciaDelPago({ cuotaQueToca: 12000, alDia: 12000, monto: 20000 }) })
    expect(r.clase).toBe('extra')
    expect(r.diferencia).toBe(8000)
  })
  it('sin cuota no inventa nada', () => {
    expect(referenciaDelPago({ cuotaQueToca: null, alDia: 0, monto: 5000 })).toBeNull()
  })
  it('el servidor la guarda con el monto final', () => {
    const api = leer('app/api/prestamos/[id]/pagos/route.js')
    expect(api).toMatch(/alDiaAntes = calcularMontoParaPonerseAlDia\(prestamo, excluidos, festivos\)/)
    expect(api).toMatch(/cuotaEsperada: cuotaEsperadaGuardada\(\),/)
    expect(api).toMatch(/cuotaEsperadaDelPago: cuotaEsperadaGuardada\(\),/)
  })
})

describe('Rutas #1 · el cierre de la caja de un cobrador va al Cuadre', () => {
  const ruta = leer('app/(dashboard)/rutas/[id]/page.jsx')
  it('el dueño en una ruta con cobrador va a Caja → Cuadre de ese cobrador', () => {
    expect(ruta).toMatch(/if \(esOwner && ruta\?\.cobrador\?\.id\) \{\n\s+router\.push\(`\/caja\?tab=cuadre&cobrador=\$\{ruta\.cobrador\.id\}`\)/)
    // La ventana propia solo se abre desde `abrirCierre`, cuando la cobra el dueño.
    expect((ruta.match(/setModalCaja\(true\)/g) || []).length).toBe(1)
    expect((ruta.match(/abrirCierre/g) || []).length).toBeGreaterThanOrEqual(5)
  })
  it('la Caja abre el Cuadre y el «Cerrar y cuadrar» de ese cobrador', () => {
    expect(leer('app/(dashboard)/caja/page.jsx')).toMatch(/tabParam === 'cuadre' \? 'cuadre' : 'cobros'/)
    expect(leer('app/(dashboard)/caja/page.jsx')).toMatch(/abrirCobradorId=\{searchParams\.get\('cobrador'\)\}/)
    const cuadre = leer('components/caja/CuadreDia.jsx')
    expect(cuadre).toMatch(/const fila = data\.filas\.find\(\(f\) => f\.cobradorId === abrirCobradorId\)/)
    expect(cuadre.indexOf('const abrirConfirmar = (fila) =>')).toBeLessThan(cuadre.indexOf('const yaAbierto = useRef(false)'))
  })
})

describe('Préstamos #63 · en Clásico el abono dice las cuotas que cubre', () => {
  it('la hoja y el formulario largo dicen lo mismo', () => {
    const hoja = leer('components/prestamos/RegistrarPago.jsx')
    expect(hoja).toMatch(/if \(prestamo\?\.modoInteres === 'fijo'\) \{/)
    expect(hoja).toMatch(/const cubre = cuota > 0 \? Math\.floor\(\(pagado \+ m\) \/ cuota\) - Math\.floor\(pagado \/ cuota\) : 0/)
    expect(hoja).toMatch(/`Descuenta el interés que ahorra y cubre \$\{cubre === 1 \? 'la próxima cuota' : `las próximas \$\{cubre\} cuotas`\}: hasta entonces no le toca cobro\.`/)
    expect(hoja).toMatch(/\{explicacionAplicacion\?\.texto \?\? \(conTablaAbono/)
  })
})
