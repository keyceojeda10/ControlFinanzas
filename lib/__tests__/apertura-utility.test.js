/* La apertura de utilidad y el pitch fijo (7 sep 2026). El dueño: «que lo que
   escriba después de la plantilla sea totalmente correcto y venda». */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  esAperturaUtility, textoAperturaUtility, esPrimerTurnoTrasApertura, esRespuestaGenerica, pitchTrasSolicitud,
} from '@/lib/bot-v2/respuestas-fijas'
import { detectarViolaciones } from '@/lib/bot-v2/sanitizador'
import { detectarStage } from '@/lib/bot-v2/stages'
import { tipoDeSeguimiento } from '@/lib/bot-v2/cadencia'

const lee = (p) => readFileSync(p, 'utf8')
const apertura = { rol: 'bot', texto: textoAperturaUtility('Carlos') }

describe('la apertura', () => {
  it('es exactamente el texto aprobado en Meta (solicitud_recibida)', () => {
    expect(textoAperturaUtility('Carlos')).toBe('Hola Carlos, recibimos tu solicitud en Control Finanzas. ¿Quieres que te contemos por aquí cómo funciona? Responde a este mensaje y te atendemos.')
    expect(esAperturaUtility(textoAperturaUtility('Ana'))).toBe(true)
    expect(esAperturaUtility('[rescate utility] ' + textoAperturaUtility('Ana'))).toBe(true)
    expect(esAperturaUtility('Hola Ana, vimos tu interes en Control Finanzas…')).toBe(false)
  })
  it('se reconoce el primer turno del lead después de ella, y solo ese', () => {
    expect(esPrimerTurnoTrasApertura([apertura])).toBe(true)
    expect(esPrimerTurnoTrasApertura([apertura, { rol: 'lead', texto: 'si' }])).toBe(true)
    expect(esPrimerTurnoTrasApertura([apertura, { rol: 'lead', texto: 'si' }, { rol: 'bot', texto: 'pitch' }, { rol: 'lead', texto: 'ok' }])).toBe(false)
    expect(esPrimerTurnoTrasApertura([{ rol: 'bot', texto: 'Hola, vimos tu interes…' }])).toBe(false)
  })
})

describe('qué va al pitch fijo y qué va al modelo', () => {
  it('«sí», «claro», «hola cómo funciona», un pulgar: al pitch', () => {
    for (const t of ['si', 'Sí', 'claro', 'Dale', 'Hola, sí cuénteme cómo funciona', 'Me interesa saber más', '👍', 'ok listo', 'Buenas noches, quiero información']) {
      expect(esRespuestaGenerica(t), t).toBe(true)
    }
  })
  it('una pregunta o un dato suyo: al modelo', () => {
    for (const t of ['sirve para gota a gota diario?', 'tengo 3 cobradores', 'cuánto vale', 'yo uso Excel', 'me sirve para vender motos a crédito?']) {
      expect(esRespuestaGenerica(t), t).toBe(false)
    }
  })
})

describe('el pitch', () => {
  const p = pitchTrasSolicitud({ nombre: 'Carlos Andrés', diasPrueba: 14 })
  it('trata de usted, sin tuteo, y el sanitizador no le ve violaciones', () => {
    expect(p).toMatch(/usted registra el préstamo/)
    expect(detectarViolaciones(p, 'si')).toEqual([])
  })
  it('vende lo medido: le calcula todo, cobradores en tiempo real, prueba gratis, y el dolor de sumar a mano', () => {
    expect(p).toMatch(/le calcula todo: cuotas, intereses, la ganancia del día y la mora/)
    expect(p).toMatch(/tiempo real/)
    expect(p).toMatch(/desde su celular, computador o tablet/)
    expect(p).toMatch(/probar gratis 14 días/)
    expect(p).toMatch(/Sin sumar a mano/)
  })
  it('es WhatsApp: párrafos cortos, sin listas ni markdown, y termina preguntando por dónde seguir', () => {
    const parrafos = p.split('\n\n')
    expect(parrafos.length).toBeLessThanOrEqual(4)
    for (const x of parrafos) expect(x.length).toBeLessThanOrEqual(320)
    expect(p).not.toMatch(/^[-*•]|\*\*|#/m)
    expect(p.trim().endsWith('¿Usted cobra solo o tiene cobradores?')).toBe(true)
  })
  it('no promete nada que no exista ni dice 15 días', () => {
    expect(p).not.toMatch(/recordatorio|descarg|autom[aá]tic|15 d/i)
    expect(pitchTrasSolicitud({ nombre: 'x', diasPrueba: 7 })).toMatch(/gratis 7 días/)
  })
  it('usa el primer nombre limpio, y sin nombre (o nombre de negocio) no inventa uno', () => {
    expect(p.startsWith('Claro, Carlos.')).toBe(true)
    expect(pitchTrasSolicitud({ nombre: '' }).startsWith('Claro. ')).toBe(true)
    expect(pitchTrasSolicitud({ nombre: 'Prestamos JR 2026' }).startsWith('Claro. ')).toBe(true)
  })
})

describe('la etapa tras la apertura no cierra con el link', () => {
  it('un «sí» a «¿quieres que te contemos?» no es señal de compra', () => {
    expect(detectarStage([apertura], 'si', false, {})).not.toBe('CIERRE')
    expect(detectarStage([apertura], 'claro', false, { metodoActual: 'libreta' })).not.toBe('CIERRE')
  })
})

describe('el seguimiento que toca después', () => {
  const hook = { rol: 'bot', texto: '[Plantilla contacto_v2] (hook de venta)' }
  const elegirPlantilla = (h) => ({
    postlink: 'seguimiento_postlink', hook: 'contacto_v2',
    descubrimiento: 'seguimiento_descubrimiento', lead: 'seguimiento_lead',
  })[tipoDeSeguimiento(h, { esApertura: esAperturaUtility, esGenerico: esRespuestaGenerica })]
  it('sin contestar a la apertura, el siguiente es el hook de venta', () => {
    expect(elegirPlantilla([apertura])).toBe('contacto_v2')
  })
  it('sin contestar tampoco al hook, sigue la secuencia normal', () => {
    expect(elegirPlantilla([apertura, hook])).toBe('seguimiento_lead')
  })
  it('quien solo dijo «sí» NO recibe «vi que me contó cómo lleva su cartera»', () => {
    const hist = [apertura, { rol: 'lead', texto: 'si' }, { rol: 'bot', texto: pitchTrasSolicitud({ nombre: 'Carlos' }) }]
    expect(elegirPlantilla(hist)).toBe('seguimiento_lead')
  })
  it('quien sí contó algo recibe el de descubrimiento', () => {
    const hist = [apertura, { rol: 'lead', texto: 'llevo todo en un cuaderno, tengo 3 cobradores' }, { rol: 'bot', texto: 'ya veo' }]
    expect(elegirPlantilla(hist)).toBe('seguimiento_descubrimiento')
  })
  it('si ya se mandó el link, el de post-link manda', () => {
    const hist = [apertura, { rol: 'lead', texto: 'si' }, { rol: 'bot', texto: 'aquí: https://app.control-finanzas.com/registro?r=2' }]
    expect(elegirPlantilla(hist)).toBe('seguimiento_postlink')
  })
})

describe('quien dice que no, deja de recibir', () => {
  it('el agente marca el rechazo y el webhook lo apaga sin apagar el bot', () => {
    const A = lee('lib/bot-v2/agente.js')
    expect(A).toMatch(/temperatura: 0, escalar: false, rechazo: true,/)
    const W = lee('app/api/webhook/whatsapp-cloud/route.js')
    expect(W).toMatch(/if \(decision\.rechazo\) \{/)
    expect(W).toMatch(/data: \{ estado: 'no_interesado', proximoSeguimiento: null, botActivo: true \}/)
    expect(W).toMatch(/notificarEstadoLead\(lead\.id, 'unqualified'\)/)
  })
})

describe('el cableado', () => {
  it('el primer contacto sale de la variable, con contacto_v2 de reserva, y espera 4 h', () => {
    const B = lee('lib/bot/bridge.js')
    expect(B).toMatch(/const TEMPLATE_HOOK = process\.env\.WA_TEMPLATE_PRIMER_CONTACTO \|\| 'contacto_v2'/)
    expect(B).toMatch(/solicitud_recibida: textoAperturaUtility\(nombre\)/)
    expect(B).toMatch(/templateName === APERTURA_UTILITY \? 4 \* 3600000 : 24 \* 3600000/)
  })
  it('quien no contesta a la apertura recibe el hook, no un seguimiento genérico', () => {
    const S = lee('lib/bot-v2/sender.js')
    expect(S).toMatch(/tipoDeSeguimiento\(historial, \{ esApertura: esAperturaUtility, esGenerico: esRespuestaGenerica \}\)/)
    expect(S).toMatch(/hook: TEMPLATE_HOOK,/)
    expect(S).toMatch(/const TEMPLATE_HOOK = 'contacto_v2'/)
    expect(S).toMatch(/^\s*contacto_v2: '\(hook de venta/m)
  })
  it('el agente contesta con el pitch fijo solo al «sí» genérico, nunca a precio u objeción', () => {
    const A = lee('lib/bot-v2/agente.js')
    expect(A).toMatch(/if \(!\['PRECIOS', 'OBJECION', 'POST_LINK'\]\.includes\(stage\)\n\s+&& esPrimerTurnoTrasApertura\(historial\) && esRespuestaGenerica\(entrante\.texto\)\)/)
    expect(A).toMatch(/mensaje: pitchTrasSolicitud\(\{ nombre: lead\.nombre, diasPrueba: EMPRESA\.diasPrueba \}\)/)
  })
  it('el rescate del 130472 cuenta la apertura del bridge para no mandarla dos veces', () => {
    const W = lee('app/api/webhook/whatsapp-cloud/route.js')
    expect(W).toMatch(/OR: \[\{ texto: \{ startsWith: MARCA_RESCATE \} \}, \{ texto: \{ contains: 'recibimos tu solicitud' \} \}\]/)
    expect(W).toMatch(/texto: `\$\{MARCA_RESCATE\} \$\{textoAperturaUtility\(nombre\)\}`/)
  })
})
