import { describe, it, expect } from 'vitest'
import { generarTextoPlantilla } from '../whatsapp-plantillas'

// El mensaje va TAL CUAL al WhatsApp del deudor. «1 meses» lo lee un cliente.
function plazoDe(frecuencia, diasPlazo) {
  const texto = generarTextoPlantilla('credito_aprobado', {
    cliente: { nombre: 'Ana' },
    prestamo: {
      montoPrestado: 1000000, totalAPagar: 1100000, cuotaDiaria: 1100000,
      frecuencia, diasPlazo,
      fechaInicio: '2026-08-02T05:00:00.000Z', fechaFin: '2026-09-02T05:00:00.000Z',
    },
    orgNombre: 'Préstamo Olaya',
  }, 'org-x')
  return /Plazo: (.+)/.exec(texto)?.[1]
}

describe('plazo del mensaje de crédito aprobado', () => {
  it('una sola unidad va en singular', () => {
    expect(plazoDe('mensual', 30)).toBe('1 mes (30 días)')
    expect(plazoDe('semanal', 7)).toBe('1 semana (7 días)')
    expect(plazoDe('quincenal', 15)).toBe('1 quincena (15 días)')
  })

  it('varias unidades siguen en plural', () => {
    expect(plazoDe('mensual', 90)).toBe('3 meses (90 días)')
    expect(plazoDe('semanal', 28)).toBe('4 semanas (28 días)')
  })

  it('diario no repite el paréntesis, y un día es singular', () => {
    expect(plazoDe('diario', 24)).toBe('24 días')
    expect(plazoDe('diario', 1)).toBe('1 día')
  })

  it('el plazo nunca sale sin tilde', () => {
    for (const f of ['diario', 'semanal', 'quincenal', 'mensual']) {
      expect(plazoDe(f, 30)).not.toMatch(/\bdias\b/)
    }
  })
})
