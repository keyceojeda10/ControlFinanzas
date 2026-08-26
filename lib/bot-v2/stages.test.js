import { describe, it, expect } from 'vitest'
import { detectarStage } from './stages.js'

// historial alternando bot/lead, empezando por el bot
const hist = (n) => Array.from({ length: n }, (_, i) => ({
  rol: i % 2 === 0 ? 'bot' : 'lead',
  texto: i % 2 === 0 ? 'mensaje del bot' : 'mensaje del lead',
}))
const leadFB = { metodoActual: 'cuaderno_papel', cantClientes: '20_50' }
const stage = (h, txt, reg = false, lead = {}) => detectarStage(h, txt, reg, lead)

describe('stages — atajos que mandan', () => {
  it('precios y objeción ganan sobre todo lo demás', () => {
    expect(stage(hist(6), 'cuanto vale el plan?')).toBe('PRECIOS')
    expect(stage(hist(6), 'esta muy caro')).toBe('OBJECION')
  })

  it('registrado siempre va a POST_LINK', () => {
    expect(stage(hist(6), 'una consulta', true)).toBe('POST_LINK')
  })

  it('si ya se envió el link, va a POST_LINK', () => {
    const h = [{ rol: 'bot', texto: 'aqui: https://app.control-finanzas.com/registro?r=2' }, { rol: 'lead', texto: 'ok listo' }]
    expect(stage(h, 'una duda')).toBe('POST_LINK')
  })
})

describe('stages — SALUDO ya no está muerto', () => {
  it('saluda cuando el bot todavía no ha hablado', () => {
    // El webhook guarda el mensaje entrante ANTES de llamar, así que siempre
    // hay >=1 mensaje del lead: la condición vieja (counts.lead===0) nunca daba.
    expect(stage([{ rol: 'lead', texto: 'hola' }], 'hola')).toBe('SALUDO')
  })

  it('si el bot ya habló, no vuelve a saludar', () => {
    expect(stage(hist(2), 'hola')).not.toBe('SALUDO')
  })
})

describe('stages — cerrar rápido se conserva (es una mejora ya medida)', () => {
  it('una confirmación corta cierra de una', () => {
    expect(stage(hist(8), 'dale')).toBe('CIERRE')
    expect(stage(hist(8), 'listo')).toBe('CIERRE')
  })

  it('una señal de compra explícita cierra de una', () => {
    expect(stage(hist(8), 'quiero probarlo')).toBe('CIERRE')
    expect(stage(hist(8), 'mandeme el link')).toBe('CIERRE')
  })

  it('con datos de Facebook se salta DESCUBRIMIENTO', () => {
    expect(stage(hist(2), 'pues mas o menos', false, leadFB)).toBe('VALOR')
    expect(stage(hist(2), 'pues mas o menos')).toBe('DESCUBRIMIENTO')
  })
})

describe('stages — [FIX] un «Sí» a una pregunta de descubrimiento NO es compra', () => {
  /* Lección de la autocrítica (24-25-ago, tres citas): el bot preguntaba
     «Sabe exactamente cuánto le deben en total hoy?», el lead respondía «Si»,
     y el bot saltaba directo a CIERRE — ofreciendo el link sin explorar nada.
     El «Si» era la respuesta a una pregunta de diagnóstico, no una compra. */

  const botPreguntaDeuda = [
    { rol: 'bot', texto: 'Sabe exactamente cuanto le deben en total hoy?' },
    { rol: 'lead', texto: 'Si' },
  ]

  it('«Si» temprano NO salta a CIERRE: sigue explorando', () => {
    expect(detectarStage(botPreguntaDeuda, 'Si', false, {})).toBe('DESCUBRIMIENTO')
  })

  it('«Si» temprano con contexto FB tampoco cierra: va a VALOR', () => {
    expect(detectarStage(botPreguntaDeuda, 'Si', false, leadFB)).toBe('VALOR')
  })

  it('«Si» a una pregunta de diagnóstico NUNCA cierra en etapa temprana', () => {
    // Aunque lleve 3 mensajes totales, un «Si» no es señal de compra.
    const h = [...botPreguntaDeuda, { rol: 'bot', texto: 'Y mas o menos, cuanto le deben hoy?' }]
    expect(detectarStage(h, 'como 20 millones', false, {})).not.toBe('CIERRE')
  })

  it('pero si el bot YA ofreció la prueba (sin link aún), el «dale» sí cierra', () => {
    const h = [
      { rol: 'bot', texto: 'Sabe cuanto le deben?' },
      { rol: 'lead', texto: 'Si' },
      { rol: 'bot', texto: 'El sistema se lo calcula todo. Puede probarlo 14 dias gratis sin tarjeta.' },
    ]
    expect(detectarStage(h, 'dale', false, {})).toBe('CIERRE')
  })

  it('y una señal de compra EXPLÍCITA temprana sí cierra de una', () => {
    expect(detectarStage(botPreguntaDeuda, 'mandeme el link', false, {})).toBe('CIERRE')
    expect(detectarStage(botPreguntaDeuda, 'quiero probarlo ya', false, {})).toBe('CIERRE')
  })
})

describe('stages — [FIX] ya no atropella una pregunta con el cierre', () => {
  it('si el lead pregunta y no dio señal de compra, aporta VALOR', () => {
    // Antes: todo lo que pasaba de 5 mensajes caía a CIERRE por defecto, así
    // que el bot empujaba el link en vez de contestar lo que le preguntaron.
    expect(stage(hist(8), 'sirve para prestamos quincenales?')).toBe('VALOR')
    expect(stage(hist(8), 'como manejo dos cobradores')).toBe('VALOR')
  })

  it('sin pregunta y sin señal de compra, sí cierra', () => {
    expect(stage(hist(8), 'estaba mirando el tema')).toBe('CIERRE')
  })
})
