// Tests del clasificador determinístico del bot v2.
// Foco: los falsos positivos de RECHAZO que despedían a clientes reales.
import { describe, it, expect } from 'vitest'
import { clasificar } from './clasificador.js'

const tipo = (texto, opts) => clasificar(texto, opts).tipo

describe('clasificador — RECHAZO no debe tener falsos positivos', () => {
  it('"bastantes clientes" NO es rechazo (antes "basta" hacía match)', () => {
    expect(tipo('tengo bastantes clientes')).toBe('ventas')
    expect(tipo('me sirve bastante')).toBe('ventas')
  })

  it('"no quiero mensual" es objeción, NO rechazo', () => {
    // "no quiero pagar mensual" contiene "quiero pagar" -> escala a humano
    // (aceptable: un asesor atiende la objeción). Lo clave: NO es rechazo.
    expect(tipo('no quiero pagar mensual')).not.toBe('rechazo')
    expect(tipo('no quiero mensual, hay anual?')).toBe('ventas')
  })

  it('"puedo bloquear un cliente" es pregunta de función, NO rechazo', () => {
    expect(tipo('puedo bloquear un cliente en el sistema?')).toBe('ventas')
  })

  it('cliente YA REGISTRADO nunca recibe la despedida dura', () => {
    // Bug real: a este mensaje se le mandó la despedida de RECHAZO.
    expect(tipo('quiero retirar una plata del saldo de la caja', { yaRegistrado: true })).not.toBe('rechazo')
    // Aunque el registrado diga algo tipo "no me interesa", no lo despedimos.
    expect(tipo('no me interesa ese plan', { yaRegistrado: true })).not.toBe('rechazo')
  })
})

describe('clasificador — RECHAZO sí funciona con frases claras', () => {
  it('opt-out explícito de un lead no registrado sí es rechazo', () => {
    expect(tipo('no me interesa')).toBe('rechazo')
    expect(tipo('no me escriba mas')).toBe('rechazo')
    expect(tipo('dejen de escribirme')).toBe('rechazo')
    expect(tipo('no, gracias')).toBe('rechazo')
  })
})

describe('clasificador — otras rutas siguen intactas', () => {
  it('intención de pago escala', () => {
    expect(tipo('quiero pagar el plan')).toBe('escalar')
    expect(tipo('como pago')).toBe('escalar')
  })

  it('pedir humano escala', () => {
    expect(tipo('quiero hablar con un asesor')).toBe('escalar')
  })

  it('soporte técnico duro escala', () => {
    expect(tipo('no me funciona la app, error')).toBe('escalar')
  })

  it('pedir una LLAMADA escala (antes se escapaba y nadie devolvía la llamada)', () => {
    expect(tipo('Me pueden llamar al 3154467925')).toBe('escalar')
    expect(tipo('me puede llamar por favor')).toBe('escalar')
    expect(tipo('pueden llamarme?')).toBe('escalar')
    expect(tipo('llamenme')).toBe('escalar')
    expect(tipo('que me llamen mañana')).toBe('escalar')
    expect(tipo('necesito una llamada')).toBe('escalar')
  })

  it('NO confunde presentarse con pedir llamada', () => {
    expect(tipo('me llamo Carlos y presto plata')).toBe('ventas')
    expect(tipo('como se llama el sistema?')).toBe('ventas')
    expect(tipo('mis clientes me llaman todos los dias')).toBe('ventas')
  })

  it('mensaje vacío se ignora', () => {
    expect(tipo('')).toBe('ignorar')
    expect(tipo('   ')).toBe('ignorar')
  })

  it('mensaje normal de venta es ventas', () => {
    expect(tipo('hola, cuanto cuesta?')).toBe('ventas')
    expect(tipo('presto y cobro diario')).toBe('ventas')
  })
})
