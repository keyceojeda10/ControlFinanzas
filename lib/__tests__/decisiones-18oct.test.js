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

describe('Préstamos #62 · en Clásico diario la mora en plata cuenta días de cobro', async () => {
  const { calcularMontoEnMora, calcularCuotasEnMora, calcularMontoParaPonerseAlDia } = await import('@/lib/calculos')
  const { vi, afterAll } = await import('vitest')
  // Diario Clásico desde el martes 6 de octubre, cuota $12.000, sin pagos.
  // Hoy es el sábado 17 a las 10 a. m. El negocio no cobra los domingos y el
  // lunes 12 es festivo: dos días que la tabla de calendario contaba como cuota.
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-17T15:00:00.000Z'))
  afterAll(() => vi.useRealTimers())
  const prestamo = {
    estado: 'activo', modoInteres: 'fijo', frecuencia: 'diario',
    montoPrestado: 200000, totalAPagar: 240000, cuotaDiaria: 12000, diasPlazo: 20,
    fechaInicio: '2026-10-06T05:00:00.000Z', fechaFin: '2026-10-26T05:00:00.000Z',
    totalPagado: 0, pagos: [], cuotasAmortizacion: [],
  }
  const domingo = [0]
  const festivos = [{ fecha: '2026-10-12T05:00:00.000Z' }]

  it('las cuotas en mora y la plata en mora dicen lo mismo', () => {
    const cuotas = calcularCuotasEnMora(prestamo, domingo, festivos)
    const plata = calcularMontoEnMora(prestamo, domingo, festivos)
    expect(cuotas).toBe(8)
    expect(plata).toBe(96000) // 8 × 12.000; antes, 120.000 (10 días de calendario)
  })
  it('«Al día» es la mora más la cuota de hoy', () => {
    expect(calcularMontoParaPonerseAlDia(prestamo, domingo, festivos)).toBe(108000)
  })
  it('sin días sin cobro ni festivos, igual que antes', () => {
    expect(calcularMontoEnMora(prestamo, [], [])).toBe(120000)
  })
})

describe('Rutas #5 · solo se borra una ruta vacía', () => {
  it('el servidor no borra con préstamos activos o capital', () => {
    const api = leer('app/api/rutas/[id]/route.js')
    expect(api).toMatch(/where: \{ rutaId: id, organizationId, prestamos: \{ some: \{ estado: 'activo' \} \} \},/)
    expect(api).toMatch(/if \(clientesConPrestamo > 0 \|\| capital !== 0\) \{/)
    // Solo el capital propio frena.
    expect(api).toMatch(/const capital = ruta\.capitalHabilitado \? Math\.round\(ruta\.saldoCapital \|\| 0\) : 0/)
    expect(api.indexOf('if (clientesConPrestamo > 0 || capital !== 0)')).toBeLessThan(api.indexOf('prisma.ruta.delete({ where: { id } })'))
  })
  it('la pantalla lo ofrece en «Editar la ruta» y dice por qué no', () => {
    const ruta = leer('app/(dashboard)/rutas/[id]/page.jsx')
    expect(ruta).toMatch(/onClick=\{\(\) => \{ cerrarEditarRuta\(\); eliminarRuta\(\) \}\}/)
    expect(ruta).toMatch(/title="Esta ruta no se puede eliminar"/)
    expect(ruta).toMatch(/onConfirm=\{\(\) => \{ setBloqueoEliminar\(null\); setUnirAbierta\(true\) \}\}/)
  })
})

describe('Préstamos #70 · el abono previo por el total', () => {
  it('crear lo deja completado, y con el límite de tiempo configurable', () => {
    const api = leer('app/api/prestamos/route.js')
    expect(api).toMatch(/if \(fresco && Math\.round\(\(fresco\.totalAPagar \|\| 0\) - \(fresco\.totalPagado \|\| 0\)\) <= 0\) \{\n\s+await tx\.prestamo\.update\(\{ where: \{ id: nuevo\.id \}, data: \{ estado: 'completado' \} \}\)/)
    expect(api).toMatch(/timeout: Number\(process\.env\.PRISMA_TX_TIMEOUT_MS\) \|\| 5000,/)
  })
  it('aprobar la solicitud también', () => {
    expect(leer('app/api/prestamos/[id]/aprobar/route.js')).toMatch(/data: \{\s*estado: abonoPrevio && saldoAlAprobar <= 0 \? 'completado' : 'activo',/)
  })
})
