/* BOT v3 · sprint 3 · el clasificador semántico, en lo que es puro. */
import { describe, it, expect } from 'vitest'
import { interpretar, necesitaSemantica, varianteDe, INTENCIONES } from './intencion.js'
import { etapaDesdeIntencion, CONFIANZA_MINIMA } from './stages.js'

describe('lo que devuelve el modelo se valida antes de usarse', () => {
  it('una intención válida pasa, con sus campos normalizados', () => {
    const r = interpretar({ intencion: 'precio', es_pregunta: 1, frustracion: 0, intencion_compra: 140, confianza: 0.93 })
    expect(r).toEqual({ intencion: 'precio', esPregunta: true, frustracion: false, intencionCompra: 100, confianza: 0.93 })
  })
  it('basura → null, y el árbol de siempre decide', () => {
    expect(interpretar(null)).toBeNull()
    expect(interpretar({ intencion: 'comprar-ya', confianza: 0.9 })).toBeNull()
    expect(interpretar({ intencion: 'precio', confianza: 7 })).toBeNull()
    expect(interpretar({ intencion: 'precio' })).toBeNull()
  })
  it('las intenciones son las trece acordadas', () => {
    expect(INTENCIONES).toHaveLength(13)
    expect(INTENCIONES).toContain('dato_negocio')
  })
})

describe('el regex fuerte no gasta modelo', () => {
  it('lo inequívoco se resuelve sin semántica', () => {
    for (const t of ['cuánto cuesta', 'q vale', 'mándeme el link', 'quiero probarlo', 'ok', 'gracias', 'listo']) {
      expect(necesitaSemantica(t), t).toBe(false)
    }
  })
  it('lo ambiguo sí la necesita', () => {
    for (const t of ['Y después', 'Todo', 'No me gusta', 'llevo 600 clientes', 'Información', 'Yo misma cobro', 'no pude iniciar']) {
      expect(necesitaSemantica(t), t).toBe(true)
    }
  })
})

describe('el A/B por lead es estable y reparte', () => {
  it('mismo lead, misma variante; off → regex; on → semántica', () => {
    expect(varianteDe('abc', 'ab')).toBe(varianteDe('abc', 'ab'))
    expect(varianteDe('abc', 'off')).toBe('regex')
    expect(varianteDe('abc', 'on')).toBe('semantica')
    const ids = Array.from({ length: 200 }, (_, i) => `cm${i}x${i * 7}`)
    const sem = ids.filter((id) => varianteDe(id, 'ab') === 'semantica').length
    expect(sem).toBeGreaterThan(70); expect(sem).toBeLessThan(130)
  })
})

describe('de la intención a la etapa', () => {
  const I = (intencion, extra = {}) => ({ intencion, esPregunta: false, frustracion: false, intencionCompra: 50, confianza: 0.9, ...extra })
  const conLink = [{ rol: 'bot', texto: 'aqui se registra: https://app.control-finanzas.com/registro?r=2' }]
  it('sin confianza, null: decide el árbol', () => {
    expect(etapaDesdeIntencion(I('precio', { confianza: CONFIANZA_MINIMA - 0.01 }))).toBeNull()
    expect(etapaDesdeIntencion(null)).toBeNull()
  })
  it('lo que el regex no vio: soporte, humano, rechazo, tutoriales', () => {
    expect(etapaDesdeIntencion(I('soporte'))).toEqual({ escalar: 'soporte' })
    expect(etapaDesdeIntencion(I('soporte'), { yaRegistrado: true })).toEqual({ escalar: 'soporte_registrado' })
    expect(etapaDesdeIntencion(I('humano'))).toEqual({ escalar: 'pide_humano' })
    // el rechazo NO lo decide la semántica: «No» a secas salió como rechazo 0,95
    expect(etapaDesdeIntencion(I('rechazo'))).toEqual({ etapa: 'OBJECION' })
    expect(etapaDesdeIntencion(I('tutoriales'))).toEqual({ tutoriales: 'lead' })
    expect(etapaDesdeIntencion(I('tutoriales', { confianza: 0.8 }))).toEqual({ etapa: 'VALOR' })
  })
  it('precio, objeción y compra van a su etapa', () => {
    expect(etapaDesdeIntencion(I('precio')).etapa).toBe('PRECIOS')
    expect(etapaDesdeIntencion(I('objecion')).etapa).toBe('OBJECION')
    expect(etapaDesdeIntencion(I('compra')).etapa).toBe('CIERRE')
  })
  /* ⚠ 8 sep 2026: una confirmación cierra cuando el bot ofreció la prueba Y el
     lead ya contó algo suyo. El pitch de apertura menciona la prueba, así que
     sin lo segundo un «sí» al segundo mensaje se llevaba el enlace sin haber
     vendido nada: el «cierre prematuro» de las auditorías. */
  it('una confirmación no cierra si el lead todavía no ha contado nada', () => {
    const pregunta = [{ rol: 'bot', texto: '¿Sabe cuánto le deben hoy?' }]
    expect(etapaDesdeIntencion(I('confirmacion'), { historial: pregunta }).etapa).toBe('DESCUBRIMIENTO')
    expect(etapaDesdeIntencion(I('confirmacion'), { historial: conLink }).etapa).toBe('DESCUBRIMIENTO')
  })
  it('pero sí cierra si ya contó algo, o si la intención de compra es alta', () => {
    const conteo = [
      { rol: 'bot', texto: '¿Sabe cuánto le deben hoy?' },
      { rol: 'lead', texto: 'no, tengo como 40 clientes y sumo a mano' },
      { rol: 'bot', texto: 'Puede probarlo 14 dias gratis, sin tarjeta.' },
    ]
    expect(etapaDesdeIntencion(I('confirmacion'), { historial: conteo }).etapa).toBe('CIERRE')
    expect(etapaDesdeIntencion(I('confirmacion', { intencionCompra: 85 }), { historial: [{ rol: 'bot', texto: '¿Sabe cuánto le deben hoy?' }] }).etapa).toBe('CIERRE')
  })
  it('un dato del negocio, una pregunta o una aclaración se conversan', () => {
    expect(etapaDesdeIntencion(I('dato_negocio'), { historial: conLink, lead: {} }).etapa).toBe('VALOR')
    expect(etapaDesdeIntencion(I('pregunta_producto'), { historial: conLink }).etapa).toBe('VALOR')
    expect(etapaDesdeIntencion(I('aclaracion'), { historial: conLink }).etapa).toBe('VALOR')
    // muy al principio y sin datos de Facebook, un dato del negocio sigue descubriendo
    expect(etapaDesdeIntencion(I('dato_negocio'), { historial: [{ rol: 'bot', texto: 'hola' }], lead: {} }).etapa).toBe('DESCUBRIMIENTO')
  })
  it('el registrado va a post-registro pase lo que pase', () => {
    for (const k of ['pregunta_producto', 'aclaracion', 'compra', 'confirmacion']) {
      expect(etapaDesdeIntencion(I(k), { yaRegistrado: true }).etapa, k).toBe('POST_LINK')
    }
  })
})
