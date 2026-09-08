/**
 * BOT v3 · sprints 6 y 7: el validador con motivos y el link como acción.
 *
 * Las tres auditorías del 8 sep pidieron que la respuesta se VALIDE antes de
 * salir, con motivos estructurados, y que el link lo autorice el código y no
 * el reflejo del modelo. Estas pruebas anclan el contrato en código puro
 * (sin Prisma, sin modelo).
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import { validar, correccionPara, linkPermitidoEn, DUROS } from '@/lib/bot-v2/validador'
import { contextoDe } from '@/lib/bot-v2/contexto'
import { EMPRESA } from '@/lib/bot-v2/kb'

const LINK = EMPRESA.linkRegistro

describe('validar: motivos duros', () => {
  it('un precio que no existe es precio_falso; un precio real no', () => {
    expect(validar('El plan Inicial cuesta $45.000 al mes.').motivos).toContain('precio_falso')
    expect(validar('El plan Inicial cuesta $39.000 al mes.').motivos).not.toContain('precio_falso')
    expect(validar('El anual del Inicial sale en $390.000.').motivos).not.toContain('precio_falso')
    expect(validar('El trimestral del Inicial sale en $105.300.').motivos).not.toContain('precio_falso')
    expect(validar('Con el Inicial son $179 al mes.', { pais: 'mx' }).motivos).not.toContain('precio_falso')
  })
  it('una cifra que dijo el lead no cuenta como precio falso', () => {
    expect(validar('Con $500.000 por cliente le sirve el Inicial.', { textoLead: 'presto 500.000 por cliente' }).motivos).not.toContain('precio_falso')
  })
  it('una función que no existe es funcion_inexistente', () => {
    const r = validar('Sí, el sistema le manda recordatorios automáticos por WhatsApp a sus clientes.')
    expect(r.motivos).toContain('funcion_inexistente')
    expect(r.duros).toContain('funcion_inexistente')
  })
  it('explicar un procedimiento de dinero es procedimiento', () => {
    expect(validar('Eso lo registra como egreso de caja y le cuadra solo.').motivos).toContain('procedimiento')
    expect(validar('Vaya al menú de cobros y toque la opción de mora.').motivos).toContain('procedimiento')
    expect(validar('El sistema le calcula la mora solo, sin que usted haga cuentas.').motivos).not.toContain('procedimiento')
  })
  it('presentarse con nombre es nombre_propio', () => {
    expect(validar('Hola, soy Daniela de Control Finanzas.').motivos).toContain('nombre_propio')
  })
  it('prometer débito automático es cobro_automatico', () => {
    expect(validar('Se debita automáticamente de su cuenta bancaria cada mes.').motivos).toContain('cobro_automatico')
    expect(validar('Usted paga cuando quiera desde la sección de planes.').motivos).not.toContain('cobro_automatico')
  })
  it('el link donde no toca es link_no_permitido; donde toca, no', () => {
    const m = `Le cuento más.\n\n${LINK}`
    expect(validar(m, { linkPermitido: false }).motivos).toContain('link_no_permitido')
    expect(validar(m, { linkPermitido: true }).motivos).not.toContain('link_no_permitido')
  })
  it('los duros están en DUROS y se separan', () => {
    const r = validar(`Soy Carlos. ${LINK}`, { linkPermitido: false })
    expect(r.duros.sort()).toEqual(['link_no_permitido', 'nombre_propio'])
    for (const d of r.duros) expect(DUROS.has(d)).toBe(true)
  })
})

describe('validar: motivos blandos', () => {
  const historial = [
    { rol: 'bot', texto: 'Con el sistema usted ve en tiempo real lo que cobra cada cobrador en la calle. ¿Cuántos cobradores tiene?' },
    { rol: 'lead', texto: 'Tengo dos cobradores' },
  ]
  const contexto = contextoDe(historial, { lead: {}, yaRegistrado: false })

  it('repetir un argumento ya usado es argumento_repetido', () => {
    const m = 'Con Control Finanzas usted ve en tiempo real cada cobro que hace el cobrador en la calle, sin llamarlo.'
    expect(validar(m, { contexto, textoLead: 'Tengo dos cobradores', stage: 'VALOR', historial }).motivos).toContain('argumento_repetido')
  })
  it('si el lead PREGUNTA por eso, desarrollarlo no es repetirlo', () => {
    // Medido sobre los 679 turnos reales: sin esta excepción se marcaban 49
    // turnos y la respuesta regenerada decía lo mismo. Con ella, 26.
    const m = 'Usted entra al sistema y ve al segundo cuánto cobró cada muchacho, sin tener que esperarlo ni que le muestre la libreta.'
    expect(validar(m, { contexto, textoLead: 'y como hago para ver lo que cobran ellos', stage: 'VALOR', historial }).motivos).not.toContain('argumento_repetido')
    expect(validar(m, { contexto, textoLead: 'no entiendo bien como funciona eso', stage: 'VALOR', historial }).motivos).not.toContain('argumento_repetido')
  })
  it('un argumento nuevo no lo es', () => {
    const m = 'Y de paso le arma la ruta del día a cada uno, ordenada por barrio. ¿Hoy cómo les entrega la lista?'
    expect(validar(m, { contexto, textoLead: 'Tengo dos cobradores', stage: 'VALOR', historial }).motivos).not.toContain('argumento_repetido')
  })
  it('repetir la última pregunta del bot es pregunta_repetida', () => {
    const m = 'Perfecto. ¿Cuántos cobradores tiene?'
    expect(validar(m, { contexto, textoLead: 'Tengo dos cobradores', historial }).motivos).toContain('pregunta_repetida')
  })
  it('despedirse cuando el lead dijo que tiene dudas es despedida_con_dudas', () => {
    const r = validar('Quedo atento a cualquier cosa. Que esté bien.', { textoLead: 'tengo una duda, no entiendo cómo funciona', historial })
    expect(r.motivos).toContain('despedida_con_dudas')
  })
  it('un «quedo atento» pasivo en VALOR sin pregunta es sin_siguiente_paso', () => {
    expect(validar('El sistema le lleva la cartera al día. Quedo atento.', { stage: 'VALOR' }).motivos).toContain('sin_siguiente_paso')
    expect(validar('El sistema le lleva la cartera al día. ¿Lo prueba gratis?', { stage: 'VALOR' }).motivos).not.toContain('sin_siguiente_paso')
  })
  it('tutear a quien no tutea es tuteo; si el lead tuteó, no', () => {
    expect(validar('Tú puedes probarlo gratis.', { textoLead: 'cuánto vale?' }).motivos).toContain('tuteo')
    expect(validar('Tú puedes probarlo gratis.', { textoLead: 'y tú qué me ofreces?' }).motivos).not.toContain('tuteo')
    expect(validar('Usted puede probarlo gratis.', { textoLead: 'cuánto vale?' }).motivos).not.toContain('tuteo')
  })
  it('más de 900 caracteres es demasiado_largo', () => {
    expect(validar('a'.repeat(901)).motivos).toContain('demasiado_largo')
  })
  it('un mensaje limpio pasa', () => {
    const r = validar('Claro. Con dos cobradores lo que más ayuda es ver en la app lo que cada uno cobró, al momento. ¿Hoy cómo le reportan?', { contexto: contextoDe([], {}), textoLead: 'Tengo dos cobradores', stage: 'VALOR' })
    expect(r).toEqual({ ok: true, motivos: [], duros: [] })
  })
})

describe('correccionPara: cada motivo le dice al modelo qué arreglar', () => {
  it('cubre todos los motivos que emite validar', () => {
    const todos = ['precio_falso', 'funcion_inexistente', 'procedimiento', 'nombre_propio', 'cobro_automatico', 'link_no_permitido',
      'argumento_repetido', 'pregunta_repetida', 'calco_largo', 'despedida_con_dudas', 'sin_siguiente_paso', 'demasiado_largo', 'tuteo']
    const texto = correccionPara(todos, { contexto: { argumentosUsados: ['rutas'], ultimaPreguntaBot: '¿Cuántos cobradores tiene?' }, textoLead: 'no entiendo' })
    expect(texto.split('\n')).toHaveLength(todos.length)
    for (const l of texto.split('\n')) { expect(l.startsWith('- ')).toBe(true); expect(l.length).toBeGreaterThan(30) }
    expect(texto).toContain('rutas')
    expect(texto).toContain('¿Cuántos cobradores tiene?')
  })
})

describe('linkPermitidoEn: el link es una acción que autoriza el código', () => {
  it('nunca al registrado', () => {
    expect(linkPermitidoEn({ stage: 'CIERRE', yaRegistrado: true, leadPideLink: true })).toBe(false)
  })
  it('siempre si el lead lo pide', () => {
    for (const stage of ['SALUDO', 'DESCUBRIMIENTO', 'VALOR', 'OBJECION']) expect(linkPermitidoEn({ stage, leadPideLink: true })).toBe(true)
  })
  it('en CIERRE, PRECIOS y POST_LINK sí; en SALUDO, DESCUBRIMIENTO, VALOR y OBJECION no', () => {
    for (const stage of ['CIERRE', 'PRECIOS', 'POST_LINK']) expect(linkPermitidoEn({ stage })).toBe(true)
    for (const stage of ['SALUDO', 'DESCUBRIMIENTO', 'VALOR', 'OBJECION']) expect(linkPermitidoEn({ stage })).toBe(false)
  })
  it('la intención de compra con confianza abre la puerta aunque la etapa sea VALOR', () => {
    expect(linkPermitidoEn({ stage: 'VALOR', intencion: { intencion: 'compra', confianza: 0.85 } })).toBe(true)
    expect(linkPermitidoEn({ stage: 'VALOR', intencion: { intencion: 'compra', confianza: 0.5 } })).toBe(false)
  })
})

describe('el agente obedece la política (anclado en código)', () => {
  const src = fs.readFileSync('lib/bot-v2/agente.js', 'utf8')
  it('procesarLink recibe linkPermitido y quita el link cuando no toca', () => {
    expect(src).toMatch(/function procesarLink\(mensaje, yaRegistrado, historial, textoEntrante, \{ linkPermitido = true \} = \{\}\)/)
    expect(src).toMatch(/if \(linkPermitido && !yaRegistrado && mencionaRegistro/)
    expect(src).toMatch(/Última red: si tras la corrección el link sigue donde no toca/)
  })
  it('la respuesta se valida y se regenera con los motivos delante', () => {
    expect(src).toMatch(/let v = validar\(mensaje, ctxValidar\)/)
    expect(src).toMatch(/correccionPara\(v\.motivos/)
    expect(src).toMatch(/const violaciones = \[\.\.\.new Set\(\[\.\.\.motivosFinales/)
  })
  it('el aviso del link va en el prompt, y el promptId no cambia por él', () => {
    // Avisar cuesta una línea; corregir cuesta una llamada entera.
    expect(src).toMatch(/if \(!linkPermitido\) \{\n\s+prompt \+=/)
    expect(src).toMatch(/NO toca mandar el enlace de registro/)
    expect(src).toMatch(/YA ESTÁ REGISTRADO\. NO escribas el enlace de registro/)
    expect(src).not.toMatch(/promptIdDe\(stage, prompt,/)
    expect((src.match(/promptIdDe\(stage, promptBase,/g) || []).length).toBe(2)
  })
  it('las REGLAS_BASE bajaron a ~20 (Kimi #4): lo verificable vive en el validador', () => {
    const p = fs.readFileSync('lib/bot-v2/prompts.js', 'utf8')
    const reglas = (p.match(/const REGLAS_BASE = `([\s\S]*?)`\n/)[1].match(/^- /gm) || []).length
    expect(reglas).toBeLessThanOrEqual(22)
  })
})
