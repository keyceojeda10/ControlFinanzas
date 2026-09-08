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

  /* ⚠ CAMBIÓ EL 8 SEP 2026 (BOT v3 · sprint 2). Antes «una duda» con el link
     enviado iba a POST_LINK, cuyo prompt pregunta si ya se registró. Ahora el
     enlace solo atrapa el acuse corto; una duda es una duda. */
  it('con el link enviado, una duda va a VALOR, no a post-enlace', () => {
    const h = [{ rol: 'bot', texto: 'aqui: https://app.control-finanzas.com/registro?r=2' }, { rol: 'lead', texto: 'ok listo' }]
    expect(stage(h, 'una duda')).toBe('VALOR')
  })

  it('con el link enviado, SOLO el acuse corto va a POST_LINK', () => {
    const h = [{ rol: 'bot', texto: 'aqui: https://app.control-finanzas.com/registro?r=2' }]
    for (const t of ['ok', 'Gracias', 'listo', 'Muchas gracias', 'ya vi', 'perfecto']) expect(stage(h, t), t).toBe('POST_LINK')
  })
})

describe('stages — [BOT v3] el enlace no decide; la intención decide', () => {
  const conLink = [
    { rol: 'bot', texto: 'Hola, vimos tu interes…' }, { rol: 'lead', texto: 'si' },
    { rol: 'bot', texto: 'Perfecto, aqui se registra: https://app.control-finanzas.com/registro?r=2' },
  ]
  /* Los cuatro salen de la traza de 733 turnos reales del 8 sep 2026: todos
     cayeron en post-enlace y ninguno de esos leads se registró. */
  it('«No me gusta» es una objeción', () => {
    expect(stage(conLink, 'No me gusta')).toBe('OBJECION')
  })
  it('«No muy cara muchas gracias» es una objeción de precio (el regex tenía «caro» y no «cara»)', () => {
    expect(stage(conLink, 'No muy cara muchas gracias')).toBe('OBJECION')
    expect(stage(conLink, 'está muy cara')).toBe('OBJECION')
  })
  it('«El básico q cuesta» pregunta el precio', () => {
    expect(stage(conLink, 'El básico q cuesta')).toBe('PRECIOS')
    expect(stage(conLink, 'q vale')).toBe('PRECIOS')
  })
  it('«llevo de 600 a mil clientes» es un dato del negocio: VALOR, no «¿ya se registró?»', () => {
    expect(stage(conLink, 'Si si claro llevo por hay de 600 a mil clientes')).toBe('VALOR')
  })
  it('«Y los siguientes días» pide que le expliquen: VALOR', () => {
    expect(stage(conLink, 'Y los sigiente dia')).toBe('VALOR')
  })
  it('y una señal de compra con el link ya enviado sigue cerrando (se lo vuelve a mandar)', () => {
    expect(stage(conLink, 'mandeme el link otra vez')).toBe('CIERRE')
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

  /* ⚠ CAMBIÓ EL 8 SEP 2026 (BOT v3 · sprint 2). El defecto era CIERRE: lo que
     ninguna regla entendía significaba «empuja el enlace». Ahora lo que no se
     reconoce se conversa. Cerrar se gana con una señal. */
  it('sin pregunta y sin señal de compra, NO cierra: conversa', () => {
    expect(stage(hist(8), 'estaba mirando el tema')).toBe('VALOR')
    expect(stage(hist(8), 'Yo misma cobro')).toBe('VALOR')
    expect(stage(hist(8), 'Información')).toBe('VALOR')
  })
})
