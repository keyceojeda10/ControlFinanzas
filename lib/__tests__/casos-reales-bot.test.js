/**
 * BOT v3 · sprint 8: la suite de casos reales.
 *
 * 204 turnos sacados de los 733 que de verdad ocurrieron entre mayo y
 * septiembre de 2026, anonimizados (nombres propios, números largos y correos
 * sustituidos) y estratificados: TODOS los de las etapas escasas —objeción,
 * post-enlace, cierre, precios, tutoriales, escalamiento, rechazo— más una
 * muestra de valor, saludo y descubrimiento.
 *
 * Son dos cosas distintas y conviene no confundirlas:
 *
 *   EL CONTRATO — lo que el bot TIENE que hacer, escrito a mano. Si esto falla,
 *   hay un fallo. Son las reglas que las tres auditorías del 8 sep señalaron.
 *
 *   LA INSTANTÁNEA — lo que el código decide HOY para cada uno de los 230.
 *   Si esto falla no hay necesariamente un fallo: hay un cambio. Toca mirar
 *   caso por caso si el cambio es el que se buscaba y, si lo es, regenerar el
 *   fichero. Está para que ningún cambio de etapa pase inadvertido.
 *
 * Todo esto corre sin modelo y sin base de datos: es el árbol de regex, el
 * clasificador y la política del enlace.
 */
import { describe, it, expect } from 'vitest'
import casos from './casos-reales-bot.json'
import { detectarStage } from '@/lib/bot-v2/stages'
import { clasificar } from '@/lib/bot-v2/clasificador'
import { linkPermitidoEn, leadPideLink } from '@/lib/bot-v2/validador'

/* La ventana es de seis turnos a propósito: el caso ES lo que aquí se ve, así
   que la prueba reproduce exactamente lo que se congeló. */
const hist = (c) => c.hist.map((h) => ({ rol: h.r, texto: h.t }))
const decidir = (c) => {
  const clas = clasificar(c.lead)
  const stage = detectarStage(hist(c), c.lead, false, {})
  return { clas: clas?.tipo || 'ventas', stage, pideLink: leadPideLink(c.lead),
    linkPermitido: linkPermitidoEn({ stage, leadPideLink: leadPideLink(c.lead), yaRegistrado: false }) }
}
const de = (f) => casos.filter(f)

describe('el contrato: lo que el bot tiene que hacer con los mensajes reales', () => {
  it('los 230 casos vienen anonimizados: ni teléfonos, ni cédulas, ni correos', () => {
    const todo = JSON.stringify(casos)
    expect(todo).not.toMatch(/\b\d{7,}\b/)
    expect(todo).not.toMatch(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/)
  })

  it('con el enlace ya enviado, solo el acuse corto va a post-enlace', () => {
    // El fallo central de las tres auditorías: la regla «enlace enviado →
    // POST_LINK» se tragaba 129 de 658 turnos de venta.
    for (const c of de((x) => x.linkEnviado && x.lead.split(/\s+/).length > 4)) {
      expect(decidir(c).stage, `${c.id}: «${c.lead.slice(0, 70)}»`).not.toBe('POST_LINK')
    }
  })

  it('quien pregunta el precio acaba en precios, escriba como escriba', () => {
    const precios = de((x) => /\b(?:cuanto|cuánto|q|que|qué)\s+(?:vale|cuesta|sale)\b|\bprecios?\b|\bmensualidad\b/i.test(x.lead))
    expect(precios.length).toBeGreaterThanOrEqual(12)
    for (const c of precios) {
      const d = decidir(c)
      expect(['PRECIOS', 'OBJECION'], `${c.id}: «${c.lead.slice(0, 70)}»`).toContain(d.stage)
    }
  })

  it('quien dice que no le gusta o que es caro acaba en objeción', () => {
    for (const c of de((x) => /\bno me gusta\b|\bcar[oa]s?\b|\bcostos[oa]\b/i.test(x.lead) && !/no me gusta.*(?:excel|cuaderno|libreta|papel)/i.test(x.lead))) {
      const d = decidir(c)
      expect(['OBJECION', 'PRECIOS'], `${c.id}: «${c.lead.slice(0, 70)}»`).toContain(d.stage)
    }
  })

  it('el rechazo explícito se clasifica como rechazo, no como venta', () => {
    for (const c of de((x) => x.esperado.clas === 'rechazo')) expect(decidir(c).clas).toBe('rechazo')
  })

  it('quien pide ayuda de dinero o humano se escala', () => {
    for (const c of de((x) => x.esperado.clas === 'escalar')) expect(decidir(c).clas).toBe('escalar')
  })

  it('el enlace no se ofrece en saludo, descubrimiento, valor ni objeción salvo que lo pidan', () => {
    // Sprint 6. Medido sobre los 679 turnos: 75 llevaban el enlace en VALOR.
    for (const c of de((x) => ['SALUDO', 'DESCUBRIMIENTO', 'VALOR', 'OBJECION'].includes(x.esperado.stage))) {
      const d = decidir(c)
      if (d.pideLink) expect(d.linkPermitido).toBe(true)
      else expect(d.linkPermitido, `${c.id}: «${c.lead.slice(0, 60)}»`).toBe(false)
    }
  })

  it('quien pide el enlace lo recibe, esté donde esté la conversación', () => {
    // Pedirlo con todas las letras es raro de verdad: uno solo en 204 turnos.
    // Los casos construidos están en validador.test.js.
    for (const c of de((x) => x.esperado.pideLink)) expect(decidir(c).linkPermitido, `${c.id}: «${c.lead.slice(0, 60)}»`).toBe(true)
    expect(de((x) => x.esperado.pideLink).length).toBeGreaterThan(0)
  })
})

describe('la instantánea: si algo de esto cambia, es un cambio de comportamiento', () => {
  it('los 230 casos deciden lo mismo que el día que se congelaron', () => {
    const distintos = []
    for (const c of casos) {
      const d = decidir(c)
      for (const k of ['clas', 'stage', 'linkPermitido', 'pideLink']) {
        if (d[k] !== c.esperado[k]) distintos.push(`${c.id} ${k}: ${c.esperado[k]} → ${d[k]}  «${c.lead.slice(0, 60)}»`)
      }
    }
    expect(distintos, `${distintos.length} casos cambiaron:\n${distintos.slice(0, 25).join('\n')}\n\nSi el cambio es el que se buscaba, regenerar casos-reales-bot.json.`).toEqual([])
  })

  it('la distribución sigue siendo la del embudo de venta, no la del enlace', () => {
    const n = {}
    for (const c of casos) { const s = decidir(c).stage; n[s] = (n[s] || 0) + 1 }
    // POST_LINK dejó de ser el sumidero: antes del sprint 2 se tragaba 243 de 679.
    expect(n.POST_LINK).toBeLessThan(30)
    expect(n.VALOR + n.PRECIOS + n.CIERRE).toBeGreaterThan(100)
  })
})
