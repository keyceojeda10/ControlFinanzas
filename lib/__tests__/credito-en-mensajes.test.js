import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { numerarPorCliente, camposDeNumero } from '@/lib/prestamos/numero'
import { referenciaDelCredito } from '@/lib/prestamos/referencia'
import { generarTextoPlantilla, PLANTILLAS } from '@/lib/whatsapp-plantillas'

/* Soporte, 6 oct 2026: «si un cliente tiene varios créditos, en las plantillas
 * de WhatsApp —la de atraso, la de abono, todas— no se sabe de qué préstamo se
 * le está dando la información. Pasa lo mismo con los comprobantes: si paga
 * uno, no sabe cuál está pagando.» */
const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('el número de cada crédito dentro de su cliente', () => {
  it('#1 el más antiguo, contando todos sus créditos; cada cliente por su lado', () => {
    const m = numerarPorCliente([
      { id: 'b', clienteId: 'ana', createdAt: '2026-09-10' },
      { id: 'a', clienteId: 'ana', createdAt: '2026-08-01' },
      { id: 'c', clienteId: 'ana', createdAt: '2026-10-01' },
      { id: 'z', clienteId: 'luis', createdAt: '2026-09-15' },
    ])
    expect(m.get('a')).toEqual({ numero: 1, de: 3 })
    expect(m.get('c')).toEqual({ numero: 3, de: 3 })
    expect(m.get('z')).toEqual({ numero: 1, de: 1 })
    expect(camposDeNumero(m, 'b')).toEqual({ numeroCliente: 2, creditosCliente: 3 })
  })
})

const prestamo = (extra = {}) => ({
  id: 'p2', montoPrestado: 500000, totalAPagar: 640000, totalPagado: 120000, saldoPendiente: 520000,
  cuotaDiaria: 20000, frecuencia: 'diario', diasPlazo: 32, modoInteres: 'fijo', estado: 'activo',
  fechaInicio: '2026-09-07T05:00:00.000Z', fechaFin: '2026-10-09T05:00:00.000Z', diasMora: 3,
  pagos: [{ id: 'g1', montoPagado: 120000, fechaPago: '2026-09-20T15:00:00.000Z', tipo: 'completo' }], ...extra,
})

describe('cómo se nombra ante el cliente', () => {
  it('con un solo crédito: cuánto y cuándo', () => {
    expect(referenciaDelCredito(prestamo({ numeroCliente: 1, creditosCliente: 1 }))).toBe('Crédito de $500.000 del 7 sept')
  })
  it('con varios: el número que ve el prestamista, más cuánto y cuándo', () => {
    expect(referenciaDelCredito(prestamo({ numeroCliente: 2, creditosCliente: 3 }))).toBe('Crédito #2 · $500.000 del 7 sept')
  })
  it('sin préstamo, nada', () => {
    expect(referenciaDelCredito(null)).toBeNull()
  })
})

describe('TODAS las plantillas que tratan de un préstamo lo dicen, justo después del saludo', () => {
  const ctx = {
    cliente: { nombre: 'Ana Pérez', telefono: '3001234567' },
    prestamo: prestamo({ numeroCliente: 2, creditosCliente: 3 }),
    pago: { id: 'g1', montoPagado: 20000, fechaPago: '2026-10-05T15:00:00.000Z', tipo: 'completo' },
    orgNombre: 'Inversiones X',
  }
  for (const t of PLANTILLAS) {
    const sinCredito = t.id === 'oferta_credito' || t.id === 'libre'
    it(`«${t.id}» ${sinCredito ? 'no la lleva' : 'la lleva'}`, () => {
      const texto = generarTextoPlantilla(t.id, ctx, 'org1')
      expect(texto.length).toBeGreaterThan(0)
      if (sinCredito) expect(texto).not.toContain('Crédito #2')
      else expect(texto.split('\n').slice(0, 3).join('\n')).toContain('*Crédito #2 · $500.000 del 7 sept*')
    })
  }
  it('las otras dos vías que arman el texto (la hoja y el modal) ponen la misma línea', () => {
    expect(leer('components/whatsapp/HojaWhatsApp.jsx')).toMatch(/return conLineaDelCredito\(t, plantillaMotor\.id, ctx\?\.prestamo\)/)
    const modal = leer('components/ui/ModalWhatsAppTemplates.jsx')
    expect(modal.match(/conLineaDelCredito\(/g).length).toBeGreaterThanOrEqual(2)
  })
})

describe('el comprobante dice qué crédito se pagó', () => {
  it('el recibo impreso, en sus dos formatos (térmico y hoja)', () => {
    const src = leer('components/ui/BotonImprimirRecibo.jsx')
    expect(src).toMatch(/\$\{referenciaDelCredito\(prestamo\) \? `<div>\$\{referenciaDelCredito\(prestamo\)\}<\/div>` : ''\}/)
    expect(src).toMatch(/<b>Crédito:<\/b> \$\{referenciaDelCredito\(prestamo\)\.replace/)
  })
  it('la imagen que se comparte', () => {
    expect(leer('components/ui/BotonCompartirRecibo.jsx')).toMatch(/if \(credito\) cabeceraTabla\.push\(\['Crédito', credito\.replace/)
  })
})

describe('el número viaja con el préstamo desde el servidor, en todas las vías', () => {
  for (const f of ['app/api/prestamos/route.js', 'app/api/prestamos/[id]/route.js', 'app/api/prestamos/[id]/pagos/route.js',
    'app/api/clientes/route.js', 'app/api/clientes/[id]/route.js', 'app/api/cobros-hoy/route.js', 'app/api/rutas/[id]/route.js',
    'app/api/offline/sync/route.js']) {
    it(f, () => expect(leer(f)).toMatch(/camposDeNumero\(numeros, p(restamoFinal)?\.id\)/))
  }
})

describe('la ficha del cliente: del más antiguo al más nuevo', () => {
  it('ordena por el número y lo enseña con la misma regla que los mensajes', () => {
    const f = leer('app/(dashboard)/clientes/[id]/page.jsx')
    expect(f).toMatch(/const enOrden = \[\.\.\.prestamosActivos\]\.sort\(\(a, b\) => numeroDelPrestamo\(a\.id\) - numeroDelPrestamo\(b\.id\)\)/)
    expect(f).toMatch(/const conNumero = \(cliente\.prestamos\?\.length \?\? 0\) > 1/)
  })
})
