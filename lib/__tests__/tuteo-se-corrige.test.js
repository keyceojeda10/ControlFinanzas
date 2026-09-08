/* El tuteo se corrige, no solo se anota (BOT v3, 8 sep 2026). 13 tuteos en 27
   turnos de la muestra real llegaron al cliente con el detector mirando. */
import { describe, it, expect } from 'vitest'
import { sanitizar, corregirTuteo, detectarViolaciones } from '@/lib/bot-v2/sanitizador'

describe('corregirTuteo', () => {
  it('pasa a usted las formas inequívocas, conservando la mayúscula', () => {
    expect(corregirTuteo('Tú puedes probarlo. Mándame tu negocio y dime cuántos clientes tienes.'))
      .toBe('Usted puede probarlo. Mándeme su negocio y dígame cuántos clientes tiene.')
    expect(corregirTuteo('Con el sistema tus cobradores registran y te muestra todo')).toBe('Con el sistema sus cobradores registran y le muestra todo')
  })
  it('no toca lo que ya es de usted ni rompe palabras', () => {
    const ok = 'Usted tiene el control. Puede tener claridad. El sistema le calcula todo y sus clientes ven el recibo.'
    expect(corregirTuteo(ok)).toBe(ok)
  })
})

describe('sanitizar aplica la corrección solo si el lead no tuteó', () => {
  it('lead de usted + bot tuteando → sale de usted, sin violación', () => {
    const out = sanitizar('Claro, tú puedes registrar tus clientes y el sistema te calcula la mora.', 'buenas, ¿cómo funciona?')
    expect(out).toBe('Claro, usted puede registrar sus clientes y el sistema le calcula la mora.')
    expect(detectarViolaciones(out, 'buenas, ¿cómo funciona?')).not.toContain('tuteo')
  })
  it('si el lead tutea, se respeta el tuteo del bot', () => {
    const out = sanitizar('Claro, tú puedes registrar tus clientes.', 'hola, tienes videos?')
    expect(out).toBe('Claro, tú puedes registrar tus clientes.')
  })
})
