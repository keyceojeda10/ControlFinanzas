/**
 * LOS ABONOS EN LA TARJETA DE LA RUTA (9 nov 2026).
 *
 * Pedido por el cliente que manda al supervisor a revisar la ruta: ver todos los
 * abonos sin entrar a la ficha, porque con mala señal la ficha se queda en
 * blanco. Y lo que salió en su video: «Al día» encima de «hace 22 días» y
 * «Debe hoy $78.000».
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { abonosDeLaTarjeta, filaDeCobro } from '@/lib/adaptadores/cobros'
import { contextoZona, gruposDeRuta, paradasDeRuta } from '@/lib/adaptadores/ruta'
import { marcaDelPago } from '@/lib/dinero/cuota-de-referencia'

const leer = (f) => readFileSync(resolve(process.cwd(), f), 'utf8')

describe('abonosDeLaTarjeta: la misma frase que la ficha', () => {
  // El caso del video, al peso: 8 oct parcial → 144.000; 15 oct $8.000 de más
  // → 128.000; 27 oct → 78.000. Las fechas a las 13:00Z = 8 a. m. en Bogotá.
  const abonos = [
    { fecha: '2026-10-27T13:00:00.000Z', monto: 50000, metodo: 'efectivo', tipo: 'completo', saldo: 78000 },
    { fecha: '2026-10-15T13:00:00.000Z', monto: 16000, metodo: 'efectivo', tipo: 'completo', cuotaEsperada: 8000, saldo: 128000 },
    { fecha: '2026-10-08T13:00:00.000Z', monto: 16000, metodo: 'transferencia', tipo: 'parcial', saldo: 144000 },
  ]
  const filas = abonosDeLaTarjeta(abonos, 'co')

  it('escribe fecha, cómo pagó, la marca y en cuánto quedó', () => {
    expect(filas[0].fecha).toBe('27 de octubre')
    expect(filas[0].detalle).toBe('efectivo · quedó en $78.000')
    expect(filas[0].monto).toBe('$50.000')
    expect(filas[1].detalle).toBe('efectivo · $8.000 de más · quedó en $128.000')
    expect(filas[2].detalle).toBe('transferencia · parcial · quedó en $144.000')
  })

  it('sin saldo reconstruible (abierto, abono con tabla) no inventa cifra', () => {
    const [f] = abonosDeLaTarjeta([{ fecha: '2026-10-27T13:00:00.000Z', monto: 20000, metodo: 'efectivo', tipo: 'intereses', saldo: null }], 'co')
    expect(f.detalle).toBe('efectivo · intereses')
  })

  it('la fecha va en el día de Bogotá: un pago a las 9 p. m. no salta al día siguiente', () => {
    const [f] = abonosDeLaTarjeta([{ fecha: '2026-10-28T02:00:00.000Z', monto: 1000, metodo: 'efectivo', tipo: 'completo', saldo: 0 }], 'co')
    expect(f.fecha).toBe('27 de octubre')
  })
})

describe('marcaDelPago: una sola regla para la ficha y la ruta', () => {
  const f = (n) => `$${n}`
  it('parcial con cuota dice cuánto faltó; sin cuota, solo «parcial»', () => {
    expect(marcaDelPago({ tipo: 'parcial', montoPagado: 6000, cuotaEsperada: 8000 }, f)).toBe('parcial, faltaron $2000')
    expect(marcaDelPago({ tipo: 'parcial', montoPagado: 6000 }, f)).toBe('parcial')
  })
  it('la cuota justa no lleva marca; capital e interés dicen su tipo', () => {
    expect(marcaDelPago({ tipo: 'completo', montoPagado: 8000, cuotaEsperada: 8000 }, f)).toBeNull()
    expect(marcaDelPago({ tipo: 'capital', montoPagado: 8000 }, f)).toBe('capital')
  })
  it('la ficha del préstamo usa esta misma función', () => {
    expect(leer('app/(dashboard)/prestamos/[id]/page.jsx')).toMatch(/const marcaDelPago = \(p\) => marcaDelPagoComun\(p, formatMoney\)/)
  })
})

describe('la tarjeta solo ofrece los abonos cuando la pantalla los trae', () => {
  const base = { id: 'c1', nombre: 'Ana', prestamosActivos: [{ id: 'p1', totalAPagar: 100, totalPagado: 50, saldoPendiente: 50 }] }
  it('Cobrar hoy no los trae: `null`, no una lista vacía', () => {
    expect(filaDeCobro(base, { pais: 'co' }).prestamos[0].abonos).toBeNull()
  })
  it('la ruta sí: los convierte', () => {
    const c = { ...base, prestamosActivos: [{ ...base.prestamosActivos[0], abonos: [{ fecha: '2026-10-27T13:00:00.000Z', monto: 50, metodo: 'efectivo', tipo: 'completo', saldo: 50 }] }] }
    expect(filaDeCobro(c, { pais: 'co' }).prestamos[0].abonos).toHaveLength(1)
  })
})

describe('la API de la ruta manda los abonos con la tasa pedida', () => {
  const src = leer('app/api/rutas/[id]/route.js')
  it('cada préstamo vivo lleva sus abonos', () => {
    expect(src).toMatch(/abonos: abonosDe\(p, saldoPendientePrestamo\),/)
  })
  it('pide `tasaInteres` aparte: sin ella el abono a capital deshace mal y en silencio', () => {
    expect(src).toMatch(/select: \{ id: true, tasaInteres: true \}/)
    expect(src).toMatch(/tasaInteres: tasaDe\.get\(p\.id\)/)
  })
  it('la tarjeta pinta el desplegable', () => {
    expect(leer('components/cf/ParadaDeCobro.jsx')).toMatch(/\{!cobrada && <AbonosDeLaParada prestamos=\{prestamos\} \/>\}/)
  })
})

describe('«Al día» solo si lo está', () => {
  const vivo = { prestamosActivos: [{ id: 'p1' }], proximoCobroAt: '2026-10-17T05:00:00.000Z', diasParaCobro: -22 }
  it('con días de atraso lleva su pastilla de atraso, no «Al día»', () => {
    const ctx = contextoZona({ ...vivo, diasMora: 18 })
    expect(ctx.zona).toBe('aldia')
    expect(ctx.pastilla).toEqual({ texto: '18d', tono: 'mora' })
    expect(contextoZona({ ...vivo, diasMora: 3 }).pastilla).toEqual({ texto: '3d', tono: 'atraso' })
  })
  it('sin atraso sigue diciendo «Al día»', () => {
    expect(contextoZona({ ...vivo, diasMora: 0 }).pastilla).toEqual({ texto: 'Al día', tono: 'aldia' })
  })
})

describe('la vista agrupada no mete a los atrasados bajo «Al día»', () => {
  /* ⚠ Por `paradasDeRuta`, con clientes como los manda la API: la primera
     versión de esta prueba le pasaba a `gruposDeRuta` filas con `diasMora` a
     mano, y la fila de verdad NO lo trae. Pasaba en verde con el grupo vacío. */
  const cli = (id, extra) => ({
    id, nombre: id, direccion: 'Cl 1', cuota: 8000,
    prestamosActivos: [{ id: `p-${id}`, saldoPendiente: 100000, totalAPagar: 200000, totalPagado: 100000 }],
    ...extra,
  })
  const hoyNo = { cobroPendienteHoy: false, pagoHoy: false }
  it('el atrasado sin cobro hoy va a su propio grupo, antes de «Al día»', () => {
    const { filas } = paradasDeRuta([
      cli('a', { cobroPendienteHoy: true, diasMora: 0 }),
      cli('b', { ...hoyNo, diasMora: 5 }),
      cli('c', { ...hoyNo, diasMora: 0 }),
    ])
    const g = gruposDeRuta(filas)
    expect(g.map((x) => x.clave)).toEqual(['hoy', 'atrasados', 'aldia'])
    expect(g.find((x) => x.clave === 'atrasados').titulo).toBe('Atrasados, hoy no les toca')
    expect(g.find((x) => x.clave === 'atrasados').filas.map((f) => f.id)).toEqual(['b'])
    expect(g.find((x) => x.clave === 'aldia').filas.map((f) => f.id)).toEqual(['c'])
  })
  it('el de hoy sigue en «Por cobrar hoy» aunque esté atrasado', () => {
    const { filas } = paradasDeRuta([cli('a', { cobroPendienteHoy: true, diasMora: 9 })])
    expect(gruposDeRuta(filas).map((x) => x.clave)).toEqual(['hoy'])
  })
})
