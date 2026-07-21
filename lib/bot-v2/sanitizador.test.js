// Tests del sanitizador: la última línea de defensa antes de enviar.
// Foco: la alucinación de "recordatorios automáticos a los clientes" que SÍ
// llegó a leads reales, sin borrar funciones que sí existen.
import { describe, it, expect } from 'vitest'
import { sanitizar, detectarViolaciones } from './sanitizador.js'

describe('sanitizador — bloquea que el sistema "contacte al deudor"', () => {
  it('borra "le envía recordatorios automáticos a sus clientes" (con tilde)', () => {
    const out = sanitizar('Con el sistema organiza todo desde el celular. Además le envía recordatorios automáticos a sus clientes para que paguen a tiempo.')
    expect(out.toLowerCase()).not.toContain('recordatorios automáticos')
    expect(out).toContain('Con el sistema organiza todo desde el celular')
  })

  it('borra "le avisa automáticamente cuando un cliente está por vencer"', () => {
    const out = sanitizar('El sistema le avisa automáticamente cuando un cliente está por vencer.')
    expect(out.toLowerCase()).not.toContain('avisa automáticamente')
  })

  it('detectarViolaciones marca el recordatorio inventado', () => {
    const v = detectarViolaciones('le avisa automáticamente cuando un cliente esta por vencer')
    expect(v).toContain('recordatorio_inventado')
  })
})

describe('sanitizador — NO borra funciones reales', () => {
  it('conserva "calcula la mora automáticamente de cada cliente"', () => {
    const out = sanitizar('El sistema le calcula la mora automáticamente de cada cliente.')
    expect(out.toLowerCase()).toContain('calcula la mora automáticamente')
  })

  it('conserva "calcula las cuotas automáticamente"', () => {
    const out = sanitizar('El sistema calcula las cuotas automáticamente y usted no suma nada.')
    expect(out.toLowerCase()).toContain('calcula las cuotas automáticamente')
  })
})

describe('sanitizador — regresiones básicas siguen bien', () => {
  it('corrige 15 días -> 14 días', () => {
    expect(sanitizar('Son 15 dias gratis').toLowerCase()).toContain('14 días')
  })

  it('mensaje vacío devuelve fallback', () => {
    expect(sanitizar('')).toBe('Quedo atento si necesita algo.')
  })
})
