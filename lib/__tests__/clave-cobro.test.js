/* Un deslizar = un pago (DETALLES-PRESTAMOS #60, 17 oct 2026).
   La app corta a los 8 s; el servidor lento guardaba el pago y el teléfono, sin
   respuesta, lo metía en la cola, que lo volvía a crear: 97 cobros duplicados
   en producción. La clave del cobro va en el envío en línea Y en la cola, y el
   servidor no crea dos pagos con la misma. Ancladas en el código. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { nuevaClaveCobro, claveCobroValida } from '@/lib/pagos-sin-senal'

const lee = (p) => readFileSync(p, 'utf8')
const api = lee('app/api/prestamos/[id]/pagos/route.js')

describe('la clave', () => {
  it('es nueva cada vez y tiene forma de clave', () => {
    const a = nuevaClaveCobro()
    const b = nuevaClaveCobro()
    expect(a).not.toBe(b)
    expect(claveCobroValida(a)).toBe(a)
  })
  it('el servidor no acepta cualquier cosa como clave', () => {
    expect(claveCobroValida(undefined)).toBeNull()
    expect(claveCobroValida('corta')).toBeNull()
    expect(claveCobroValida("x'; DROP TABLE Pago; --")).toBeNull()
    expect(claveCobroValida(12345678901234)).toBeNull()
  })
})

describe('el servidor', () => {
  it('mira la clave antes que todo lo demás, también antes del préstamo inactivo', () => {
    const clave = api.indexOf('if (mismo) return yaRegistrado(mismo)')
    expect(clave).toBeGreaterThan(-1)
    expect(clave).toBeLessThan(api.indexOf("error: 'No se pueden registrar pagos en préstamos inactivos'"))
    expect(clave).toBeLessThan(api.indexOf("error: 'Posible pago duplicado'"))
  })
  it('la vuelve a mirar con el préstamo bloqueado, y la guarda en el pago', () => {
    const candado = api.indexOf('SELECT id FROM Prestamo WHERE id = ${prestamoId} FOR UPDATE')
    const dentro = api.indexOf('throw new Error(`COBRO_YA_REGISTRADO:${mismo.id}`)')
    expect(dentro).toBeGreaterThan(candado)
    expect(dentro).toBeLessThan(api.indexOf("throw new Error('PRESTAMO_NO_ACTIVO')"))
    expect(api).toMatch(/longitud: coordsPago\.longitud,\n\s+claveCobro,\n\s+\},/)
  })
  it('un choque de clave contesta con el pago que ya existe', () => {
    expect(api).toMatch(/err\?\.message\?\.startsWith\('COBRO_YA_REGISTRADO:'\) \|\| err\?\.code === 'P2002'/)
  })
})

describe('las cuatro vías mandan la MISMA clave en línea y en la cola', () => {
  const pantallas = {
    'components/prestamos/RegistrarPago.jsx': [/JSON\.stringify\(\{ claveCobro, montoPagado: m,/, /guardarPagoPendiente\(\{\n\s+prestamoId,\n\s+claveCobro,/],
    'app/(dashboard)/cobros-hoy/page.jsx': [/JSON\.stringify\(\{ claveCobro, montoPagado: montoFinal,/, /guardarPagoPendiente\(\{\n\s+prestamoId: prestamoActivo,\n\s+claveCobro,/],
    'app/(dashboard)/rutas/[id]/page.jsx': [/\? \{ claveCobro, montoPagado: cuota, tipo: 'completo'/, /: \{ claveCobro, montoPagado: cuota, tipo: 'parcial'/, /guardarPagoPendiente\(\{\n\s+prestamoId: prestamoActivo,\n\s+claveCobro,/],
  }
  for (const [archivo, anclas] of Object.entries(pantallas)) {
    it(archivo, () => {
      const src = lee(archivo)
      expect((src.match(/const claveCobro = nuevaClaveCobro\(\)/g) || []).length).toBe(1)
      for (const a of anclas) expect(src).toMatch(a)
    })
  }
  it('la cola y el service worker la suben', () => {
    expect(lee('lib/offline.js')).toMatch(/\.\.\.\(pago\.claveCobro \? \{ claveCobro: pago\.claveCobro \} : \{\}\)/)
    const sw = lee('public/sw.js')
    expect(sw).toMatch(/\.\.\.\(p\.claveCobro \? \{ claveCobro: p\.claveCobro \} : \{\}\)/)
    expect(sw).toMatch(/\.\.\.\(p\.aplazarUnPeriodo \? \{ aplazarUnPeriodo: true \} : \{\}\)/)
  })
})
