/* DETALLES-RUTAS 56, 58, 59 y 60 (vistos al grabar, 18 oct 2026): los conteos
 * de hoy entre la lista de rutas, la ruta por dentro y Auditoría, y la cuota
 * diaria que caía en día sin cobro. Con cifras, y ancladas en el código. */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { calcularProximoCobro, calcularMontoParaPonerseAlDia, tieneCobroPendienteHoy, calcularMontoEnMora, calcularCuotasEnMora, calcularDiasMora } from '@/lib/calculos'

const leer = (f) => readFileSync(f, 'utf8')
const dia = (iso) => new Date(iso).toISOString().slice(0, 10)

// Carmen Rosa Díaz: diario Clásico desde el sábado 17, cuota $13.800, sin pagos;
// su ficha dice que no se le cobra los domingos.
const carmen = {
  estado: 'activo', modoInteres: 'fijo', frecuencia: 'diario',
  montoPrestado: 300000, totalAPagar: 414000, cuotaDiaria: 13800, diasPlazo: 30,
  fechaInicio: '2026-10-17T05:00:00.000Z', totalPagado: 0, pagos: [], cuotasAmortizacion: [],
}
const domingo = [0]
const el = (iso) => { vi.useFakeTimers(); vi.setSystemTime(new Date(iso)) }
afterEach(() => vi.useRealTimers())

describe('#60 · la cuota que cae en día sin cobro se cobra el siguiente', () => {
  it('el domingo: le cobras el lunes, hoy no debe ni está pendiente', () => {
    el('2026-10-18T15:00:00.000Z')
    expect(dia(calcularProximoCobro(carmen, domingo, []))).toBe('2026-10-19')
    expect(calcularMontoParaPonerseAlDia(carmen, domingo, [])).toBe(0)
    expect(tieneCobroPendienteHoy(carmen, domingo, [])).toBe(false)
    expect(calcularDiasMora(carmen, domingo, [])).toBe(0)
  })
  it('el lunes: le toca hoy y no está atrasada', () => {
    el('2026-10-19T15:00:00.000Z')
    expect(dia(calcularProximoCobro(carmen, domingo, []))).toBe('2026-10-19')
    expect(calcularMontoParaPonerseAlDia(carmen, domingo, [])).toBe(13800)
    expect(tieneCobroPendienteHoy(carmen, domingo, [])).toBe(true)
    expect(calcularMontoEnMora(carmen, domingo, [])).toBe(0)
  })
  it('el martes sin pagar: una cuota en mora, y la plata dice lo mismo', () => {
    el('2026-10-20T15:00:00.000Z')
    expect(calcularCuotasEnMora(carmen, domingo, [])).toBe(1)
    expect(calcularMontoEnMora(carmen, domingo, [])).toBe(13800)
    expect(calcularMontoParaPonerseAlDia(carmen, domingo, [])).toBe(27600)
  })
  it('sin días sin cobro, el domingo es un día como otro (lo de siempre)', () => {
    el('2026-10-18T15:00:00.000Z')
    expect(dia(calcularProximoCobro(carmen, [], []))).toBe('2026-10-18')
    expect(calcularMontoParaPonerseAlDia(carmen, [], [])).toBe(13800)
  })
})

describe('#56 #58 #59 · lo de hoy cuenta a quien hoy debe algo o pagó hoy', () => {
  it('la ruta por dentro: la meta no suma al que ya lo tiene cubierto', () => {
    const api = leer('app/api/rutas/[id]/route.js')
    expect(api).toMatch(/const pendienteEste = !_hoySinCobro && tieneCobroPendienteHoy\(p, diasExcluidosPrestamo, festivos\)/)
    expect(api).toMatch(/const debeOPagoHoy = montoPagadoHoy > 0 \|\| pendienteEste/)
    expect(api).toMatch(/esperadoHoy   \+= tocaHoyEste && debeOPagoHoy \? cuota : 0/)
  })
  it('la lista de rutas cuenta los cobros como la ruta por dentro', () => {
    const lista = leer('app/api/rutas/route.js')
    expect(lista).toMatch(/const pendienteEste = vivo && !hoySinCobro && tieneCobroPendienteHoy\(prestamo, diasDelPrestamo, festivos\)/)
    expect(lista).toMatch(/tocaHoy = !hoySinCobro && \(pendienteCliente \|\| pagoHoyCliente\)/)
    expect(lista).toMatch(/if \(vivo && \(pendienteEste \|\| cobradoDeEste > 0\) && tienePeriodoEsperadoHoy\(/)
  })
  it('Auditoría no llama «pendiente» a quien hoy no debe nada', () => {
    expect(leer('app/(dashboard)/rutas/[id]/page.jsx')).toMatch(/if \(!tienePendiente && !c\.pagoHoy\) return 'sin_cobro'/)
  })
})

describe('#61 · «Ya cobra en …» con todas sus rutas', () => {
  it('el lápiz nombra todas menos esta', () => {
    expect(leer('app/api/cobradores/route.js')).toMatch(/rutas:\s+c\.rutas\.map\(\(r\) => \(\{ id: r\.id, nombre: r\.nombre \}\)\),/)
    expect(leer('app/(dashboard)/rutas/[id]/page.jsx')).toMatch(/const otraRuta = otras\.length \? otras\.join\(' y '\) : null/)
  })
  it('unir dice «Ya cobra en», y las dos si lleva las dos', () => {
    const unir = leer('components/rutas/UnirRutas.jsx')
    expect(unir).toMatch(/`Ya cobra en \$\{vista\.destino\.nombre\} y \$\{vista\.origen\.nombre\}`/)
    expect(unir).not.toMatch(/`Ya cobra \$\{vista\.destino\.nombre\}`/)
  })
})

describe('#62 · «Falta» es lo que les queda a los pendientes', async () => {
  const { loDeHoy } = await import('@/lib/adaptadores/ruta')
  const { bandaDelDia, adaptarRutas } = await import('@/lib/adaptadores/rutas')
  it('un pago grande de uno no tapa lo que deben los otros', () => {
    // Recaudó $307.067 (uno cerró su préstamo) y quedan tres con $73.700.
    const r = loDeHoy({ esperadoHoy: 158100, recaudadoHoy: 307067, faltaHoy: 73700, clientesConCobroHoy: 8, clientesPagaronHoy: 5 }, (n) => `$${n}`)
    expect(JSON.stringify(r)).toMatch(/73700/)
  })
  it('sin el dato del servidor, la resta de siempre', () => {
    const r = loDeHoy({ esperadoHoy: 158100, recaudadoHoy: 84400 }, (n) => `$${n}`)
    expect(JSON.stringify(r)).toMatch(/73700/)
  })
  it('la banda de /rutas suma lo que falta de cada ruta', () => {
    const b = bandaDelDia([
      { esperadoHoy: 158100, recaudadoHoy: 307067, faltaHoy: 73700, cobrosHoy: 8 },
      { esperadoHoy: 50000, recaudadoHoy: 0, faltaHoy: 50000, cobrosHoy: 3 },
    ], 'CO')
    expect(b.faltan).toBe('$123.700')
  })
  it('el servidor y las pantallas leen `faltaHoy`', () => {
    const api = leer('app/api/rutas/[id]/route.js')
    expect(api).toMatch(/if \(tocaHoyEste && pendienteEste\) faltaHoy \+= Math\.max\(0, cuota - montoPagadoHoy\)/)
    expect(leer('app/api/rutas/route.js')).toMatch(/if \(pendienteEste\) faltaHoy \+= Math\.max\(0, prestamo\.cuotaDiaria - cobradoDeEste\)/)
    expect(leer('app/(dashboard)/rutas/[id]/page.jsx')).toMatch(/porCobrarHoy=\{formatMoney\(ruta\.faltaHoy != null \?/)
    expect(leer('lib/adaptadores/rutas.js')).toMatch(/falta: formatMoney\(r\.faltaHoy != null \?/)
  })
})

describe('#51 #52 · agregar clientes', () => {
  const ruta = leer('app/(dashboard)/rutas/[id]/page.jsx')
  it('#51 al refrescar se espera y no se vuelve a la copia vieja', () => {
    expect(ruta).toMatch(/const refresco = yaPintadaRef\.current\n\s+const ctrl = refresco \? new AbortController\(\) : null/)
    expect(ruta).toMatch(/const corte = ctrl \? setTimeout\(\(\) => ctrl\.abort\(\), 30000\) : null/)
    expect(ruta).toMatch(/\} catch \{\n\s+if \(refresco\) return null/)
  })
  it('#52 «se mueven de su ruta» es una ventana de la app', () => {
    expect(ruta).not.toMatch(/serán MOVIDOS/)
    expect(ruta).toMatch(/if \(!\(await preguntarMover\(\{ cuantos: deOtraRuta\.length, nombres \}\)\)\) return/)
    expect(ruta).toMatch(/onConfirm=\{\(\) => responderMover\(true\)\}/)
  })
})
