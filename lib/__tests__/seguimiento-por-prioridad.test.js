/**
 * BOT v3 · sprint 8: a quién se le escribe primero.
 *
 * El cron manda diez por pasada. Cuando hay más candidatos que cupo, el orden
 * decide quién se queda sin seguimiento hoy, y hasta ahora lo decidía solo el
 * atraso. Un lead que preguntó el precio ayer vale más que uno que nunca
 * contestó y lleva tres intentos.
 */
import { describe, it, expect } from 'vitest'
import { prioridadDeSeguimiento, ordenarPorPrioridad, intencionDeClasificacion } from '@/lib/bot-v2/cadencia'

const ahora = new Date('2026-09-08T18:00:00Z')
const hace = (h) => new Date(ahora.getTime() - h * 3600000)

describe('intencionDeClasificacion', () => {
  it('saca la intención de la traza y aguanta lo que no la trae', () => {
    expect(intencionDeClasificacion('ventas>precio(0.90)')).toBe('precio')
    expect(intencionDeClasificacion('ventas>dato_negocio(0.85)')).toBe('dato_negocio')
    expect(intencionDeClasificacion('ventas')).toBe(null)
    expect(intencionDeClasificacion(null)).toBe(null)
  })
})

describe('prioridadDeSeguimiento', () => {
  it('el que preguntó el precio va por delante del que nunca contestó', () => {
    const caliente = { temperatura: 60, intentosSeguimiento: 1, proximoSeguimiento: hace(2) }
    const frio = { temperatura: 0, intentosSeguimiento: 2, proximoSeguimiento: hace(30) }
    expect(prioridadDeSeguimiento(caliente, { ultimaIntencion: 'precio', ahora }))
      .toBeGreaterThan(prioridadDeSeguimiento(frio, { ultimaIntencion: null, ahora }))
  })
  it('cada intento gastado resta', () => {
    const base = { temperatura: 50, proximoSeguimiento: hace(1) }
    expect(prioridadDeSeguimiento({ ...base, intentosSeguimiento: 0 }, { ahora }))
      .toBeGreaterThan(prioridadDeSeguimiento({ ...base, intentosSeguimiento: 2 }, { ahora }))
  })
  it('quien pidió soporte o rechazó cae al fondo', () => {
    const l = { temperatura: 40, intentosSeguimiento: 0, proximoSeguimiento: hace(1) }
    expect(prioridadDeSeguimiento(l, { ultimaIntencion: 'rechazo', ahora })).toBeLessThan(0)
    expect(prioridadDeSeguimiento(l, { ultimaIntencion: 'soporte', ahora })).toBeLessThan(
      prioridadDeSeguimiento(l, { ultimaIntencion: 'aclaracion', ahora }))
  })
  it('el atraso pesa, pero con tope de un día: nadie se queda esperando siempre', () => {
    const l = { temperatura: 10, intentosSeguimiento: 0 }
    const dia = prioridadDeSeguimiento({ ...l, proximoSeguimiento: hace(24) }, { ahora })
    const semana = prioridadDeSeguimiento({ ...l, proximoSeguimiento: hace(24 * 7) }, { ahora })
    expect(semana).toBe(dia)
    expect(dia).toBeGreaterThan(prioridadDeSeguimiento({ ...l, proximoSeguimiento: hace(1) }, { ahora }))
  })
})

describe('ordenarPorPrioridad', () => {
  const leads = [
    { id: 'a', temperatura: 0, intentosSeguimiento: 2, proximoSeguimiento: hace(48) },
    { id: 'b', temperatura: 70, intentosSeguimiento: 0, proximoSeguimiento: hace(3) },
    { id: 'c', temperatura: 30, intentosSeguimiento: 1, proximoSeguimiento: hace(5) },
    { id: 'd', temperatura: 0, intentosSeguimiento: 0, proximoSeguimiento: hace(1) },
  ]
  const intenciones = new Map([['b', 'precio'], ['c', 'dato_negocio'], ['a', null]])
  it('con cupo para dos, salen los dos que más valen', () => {
    expect(ordenarPorPrioridad(leads, intenciones, 2, ahora).map((l) => l.id)).toEqual(['b', 'c'])
  })
  it('no pierde a nadie cuando hay cupo para todos', () => {
    expect(ordenarPorPrioridad(leads, intenciones, 10, ahora)).toHaveLength(4)
  })
  it('a igualdad de prioridad manda el más atrasado', () => {
    const iguales = [
      { id: 'nuevo', temperatura: 20, intentosSeguimiento: 0, proximoSeguimiento: hace(1) },
      { id: 'viejo', temperatura: 20, intentosSeguimiento: 0, proximoSeguimiento: hace(1) },
    ]
    expect(ordenarPorPrioridad(iguales, new Map(), 1, ahora)[0].id).toBe('nuevo')
  })
})

describe('el cron usa la prioridad (anclado en código)', () => {
  const src = require('fs').readFileSync('lib/bot-v2/sender.js', 'utf8')
  it('pide más candidatos de los que caben y ordena', () => {
    expect(src).toMatch(/take: Math\.min\(limite \* 6, 90\)/)
    expect(src).toMatch(/ordenarPorPrioridad\(posibles, intencionPorLead, limite\)/)
  })
  it('la intención sale de la traza en una sola consulta', () => {
    expect(src).toMatch(/clasificacion: \{ not: null \}/)
    expect(src).toMatch(/intencionDeClasificacion\(t\.clasificacion\)/)
  })
})

describe('el seguimiento retoma de qué venía hablando el lead', () => {
  it('el prompt cambia según la última intención de la traza', async () => {
    const { promptSeguimiento } = await import('@/lib/bot-v2/prompts')
    const base = { nombre: 'Ana', historial: 'lead: uy muy caro', intento: 1, linkEnviado: false, leadRespondio: true, franja: 'tarde' }
    const conPrecio = promptSeguimiento({ ...base, ultimaIntencion: 'precio' })
    const conObjecion = promptSeguimiento({ ...base, ultimaIntencion: 'objecion' })
    const sinNada = promptSeguimiento({ ...base })
    expect(conPrecio).toContain('DE QUÉ VENÍA HABLANDO')
    expect(conPrecio).toContain('PRECIO')
    expect(conObjecion).toContain('OBJECIÓN')
    expect(sinNada).not.toContain('DE QUÉ VENÍA HABLANDO')
    // Una intención sin estrategia propia no rompe nada.
    expect(promptSeguimiento({ ...base, ultimaIntencion: 'saludo' })).not.toContain('DE QUÉ VENÍA HABLANDO')
  })
  it('generarSeguimiento saca la intención del último mensaje del bot con traza', () => {
    const src = require('fs').readFileSync('lib/bot-v2/agente.js', 'utf8')
    expect(src).toMatch(/const ultimaIntencion = intencionDeClasificacion\(/)
    expect(src).toMatch(/msgs\.filter\(\(m\) => m\.rol === 'bot' && m\.clasificacion\)\.at\(-1\)/)
  })
})
