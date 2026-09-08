/* BOT v3 · sprints 4 y 5: la fuente única de verdad y el contexto estructurado. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { EMPRESA, PLANES, FUNCIONES, NO_EXISTE, planPorNombre, funcionesMencionadas, funcionesTexto } from '@/lib/bot-v2/kb'
import { PLANES_CONFIG } from '@/lib/planes'
import * as producto from '@/lib/bot-v2/producto'
import { contextoDe, textoContexto } from '@/lib/bot-v2/contexto'

describe('la KB es la única fuente', () => {
  it('los planes van por su nombre visible y cuadran con planes.js', () => {
    expect(PLANES.map((p) => p.nombre)).toEqual(['Inicial', 'Básico', 'Crecimiento', 'Profesional', 'Empresarial'])
    expect(planPorNombre('Empresarial').precio).toBe(PLANES_CONFIG.professional.precio)
    expect(planPorNombre('profesional').clientes).toBe(PLANES_CONFIG.standard.maxClientes)
    expect(planPorNombre('no existe')).toBeNull()
  })
  it('producto.js re-exporta lo mismo que la KB (los prompts y el sanitizador no notan el cambio)', () => {
    expect(producto.EMPRESA).toBe(EMPRESA)
    expect(producto.FUNCIONES).toEqual(funcionesTexto())
    expect(producto.NO_EXISTE).toBe(NO_EXISTE)
    expect(producto.FUNCIONES.length).toBeGreaterThanOrEqual(21)
  })
  it('cada función tiene id, texto y claves que se reconocen en su propio texto o en cómo lo dice el bot', () => {
    const ids = FUNCIONES.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(funcionesMencionadas('Con el sistema usted ve al segundo cuanto le deben en la calle, y cada cobrador entra con su propio usuario')).toEqual(expect.arrayContaining(['tiempo_real', 'saldo_calle', 'cobradores']))
    expect(funcionesMencionadas('hola buenas')).toEqual([])
  })
  it('los dos bots leen la empresa de la KB, no de constantes propias', () => {
    const anuncio = readFileSync('lib/bot/flujo-anuncio.js', 'utf8')
    const cartera = readFileSync('lib/bot/cartera-post-registro.js', 'utf8')
    for (const src of [anuncio, cartera]) {
      expect(src).toMatch(/from '@\/lib\/bot-v2\/kb'/)
      expect(src).not.toMatch(/'301 199 3001'/)
      expect(src).not.toMatch(/'https:\/\/app\.control-finanzas\.com\/registro\?r=2'/)
    }
  })
})

describe('el contexto sale del historial, una vez', () => {
  const H = [
    { rol: 'bot', texto: 'Hola, ¿cómo lleva el control de su cartera hoy?' },
    { rol: 'lead', texto: 'en un cuaderno, está muy caro todo' },
    { rol: 'bot', texto: 'Con el sistema usted ve al segundo cuanto le deben en la calle. El plan Inicial son $39.000 al mes. Puede probarlo 14 dias gratis. ¿Tiene cobradores?' },
  ]
  it('detecta lo que ya pasó', () => {
    const c = contextoDe(H, { lead: { metodoActual: 'cuaderno' } })
    expect(c.linkEnviado).toBe(false)
    expect(c.pruebaOfrecida).toBe(true)
    expect(c.precioDado).toEqual(['Inicial'])
    expect(c.argumentosUsados).toEqual(expect.arrayContaining(['saldo_calle', 'prueba']))
    expect(c.ultimaPreguntaBot).toBe('¿Tiene cobradores?')
    expect(c.objecionesDelLead).toEqual(['en un cuaderno, está muy caro todo'])
    expect(c.turnosBot).toBe(2); expect(c.turnosLead).toBe(1)
  })
  it('el bloque del prompt solo dice lo que hay', () => {
    expect(textoContexto(contextoDe([]))).toBe('')
    const t = textoContexto(contextoDe(H))
    expect(t).toMatch(/precio del plan Inicial/)
    expect(t).toMatch(/Argumentos que YA usaste/)
    expect(t).toMatch(/Tu última pregunta fue: «¿Tiene cobradores\?»/)
    expect(t).not.toMatch(/link de registro YA/)
    expect(textoContexto(contextoDe([...H, { rol: 'bot', texto: 'aqui: https://app.control-finanzas.com/registro?r=2' }])))
      .toMatch(/link de registro YA se le mandó/)
  })
})
