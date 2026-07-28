// Campos de recibo pedidos por un prestamista el 28 jul 2026.
//
// Su queja de fondo no era el formato: es que el cliente final paga de mas y el
// recibo no le dice a donde fue esa plata. En su propio Excel el excedente sale
// DESPUES de descontar la cuota y la mora del dia.
//
// El recibo ya era configurable (14 campos, cada negocio elige cuales). Esto
// agrega 5 mas; no reordena nada, porque el orden ya lo decide cada negocio.

import { describe, it, expect } from 'vitest'
import { generarTextoPlantilla } from '@/lib/whatsapp-plantillas'
import { CAMPOS_PREDEFINIDOS, getDefaultCampos } from '@/lib/campos-recibo'

// Saca el valor que quedo impreso para un campo del recibo.
function valorEnRecibo(campo, { prestamo, pago, cliente = { nombre: 'Ana' } }) {
  const nombre = CAMPOS_PREDEFINIDOS.find(c => c.campo === campo)?.nombre || campo
  const texto = generarTextoPlantilla('pago_confirmacion', {
    cliente, prestamo, pago, orgNombre: 'Test',
    camposRecibo: [{ tipo: 'dato', campo, nombre }],
  })
  const linea = String(texto).split('\n').find(l => l.includes(nombre))
  return linea ? linea.split(':').slice(1).join(':').trim() : null
}

const BASE = {
  id: 'p1', estado: 'activo', frecuencia: 'mensual', modoInteres: 'lineal',
  montoPrestado: 258080, totalAPagar: 277195, totalPagado: 100000,
  saldoPendiente: 177195, cuotaDiaria: 72300, porcentajePagado: 36,
  cuotasAmortizacion: [
    { numeroPeriodo: 1, cuotaTotal: 72300, interes: 7742, pagado: 72300 },
    { numeroPeriodo: 2, cuotaTotal: 72300, interes: 5806, pagado: 27700 },
    { numeroPeriodo: 3, cuotaTotal: 72300, interes: 3811, pagado: 0 },
    { numeroPeriodo: 4, cuotaTotal: 60295, interes: 1756, pagado: 0 },
  ],
}

describe('excedente — el caso que reporto', () => {
  it('pagar $100.000 con cuota de $72.300 deja $27.700 de excedente', () => {
    const v = valorEnRecibo('excedente', { prestamo: BASE, pago: { montoPagado: 100000 } })
    expect(v).toContain('27.700')
  })

  it('dice a donde va, que es lo que el deudor no entiende', () => {
    const v = valorEnRecibo('excedenteAplicado', { prestamo: BASE, pago: { montoPagado: 100000 } })
    expect(v).toContain('27.700')
    expect(v).toMatch(/próxima cuota/i)
  })

  it('pagar justo la cuota no deja excedente', () => {
    const v = valorEnRecibo('excedente', { prestamo: BASE, pago: { montoPagado: 72300 } })
    expect(v).toMatch(/\b0\b/)
  })

  it('pagar de menos tampoco', () => {
    const v = valorEnRecibo('excedente', { prestamo: BASE, pago: { montoPagado: 40000 } })
    expect(v).toMatch(/\b0\b/)
  })

  it('la mora se descuenta ANTES del excedente', () => {
    // Si no se descontara, el recibo diria "te sobraron $27.700" a alguien que
    // sigue debiendo $10.000 de recargo.
    const conMora = {
      ...BASE,
      moratorio: { aplicable: true, montoMoratorio: 10000, diasMoraEfectivos: 5, montoBase: 72300, tope: 88597 },
    }
    const v = valorEnRecibo('excedente', { prestamo: conMora, pago: { montoPagado: 100000 } })
    expect(v).toContain('17.700')   // 100.000 - 72.300 - 10.000
  })
})

describe('mora', () => {
  const conMora = {
    ...BASE,
    moratorio: { aplicable: true, montoMoratorio: 10000, diasMoraEfectivos: 5, montoBase: 72300, tope: 88597 },
  }

  it('el total sale de calcularInteresMoratorio, no de una formula nueva', () => {
    expect(valorEnRecibo('totalMora', { prestamo: conMora, pago: { montoPagado: 0 } })).toContain('10.000')
  })

  it('la diaria se deriva del total, asi no pueden contradecirse', () => {
    // 10.000 / 5 dias = 2.000
    expect(valorEnRecibo('moraDiaria', { prestamo: conMora, pago: { montoPagado: 0 } })).toContain('2.000')
  })

  it('sin mora configurada muestra 0, no basura', () => {
    expect(valorEnRecibo('totalMora', { prestamo: BASE, pago: { montoPagado: 0 } })).toMatch(/\b0\b/)
    expect(valorEnRecibo('moraDiaria', { prestamo: BASE, pago: { montoPagado: 0 } })).toMatch(/\b0\b/)
  })
})

describe('cuotas restantes', () => {
  it('cuenta las filas de la tabla que aun no estan pagadas', () => {
    // la 1 esta completa; la 2 va a medias; faltan 3
    expect(valorEnRecibo('cuotasRestantes', { prestamo: BASE, pago: { montoPagado: 0 } })).toBe('3')
  })

  it('sin tabla, lo deduce del saldo y la cuota', () => {
    const sinTabla = { ...BASE, cuotasAmortizacion: [], modoInteres: 'fijo', saldoPendiente: 144600 }
    expect(valorEnRecibo('cuotasRestantes', { prestamo: sinTabla, pago: { montoPagado: 0 } })).toBe('2')
  })
})

describe('no rompe lo que ya habia', () => {
  it('los campos por defecto siguen siendo los mismos cinco', () => {
    expect(getDefaultCampos().map(c => c.campo)).toEqual([
      'totalPagado', 'saldoPendiente', 'totalAPagar', 'cuota', 'progreso',
    ])
  })

  it('los cinco campos nuevos vienen APAGADOS', () => {
    for (const campo of ['cuotasRestantes', 'excedente', 'excedenteAplicado', 'moraDiaria', 'totalMora']) {
      const def = CAMPOS_PREDEFINIDOS.find(c => c.campo === campo)
      expect(def, `${campo} deberia existir`).toBeTruthy()
      expect(def.porDefecto, `${campo} no deberia venir encendido`).toBe(false)
    }
  })

  it('un recibo sin pago no revienta', () => {
    expect(() => valorEnRecibo('excedente', { prestamo: BASE, pago: null })).not.toThrow()
    expect(() => valorEnRecibo('cuotasRestantes', { prestamo: {}, pago: null })).not.toThrow()
  })
})
