/**
 * BOT v3 · sprint 8 (Kimi #7): el soporte al que ya es cliente.
 *
 * Las 35 guías visuales llevaban meses construidas —catálogo, enviador, 119
 * capturas publicadas, webhook cableado— y nunca se mandó ninguna porque el
 * agente devolvía `enviarGuia: null` a fuego. Esto es el hilo que faltaba, con
 * los guardarraíles que se acordaron: solo a registrados, una guía por
 * conversación, y las preguntas de plata jamás las contesta el bot.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { elegirGuia, nivelDeSoporte, yaSeMandoGuia, textoDeGuia } from '@/lib/bot-v2/soporte'
import { GUIAS, urlsDeGuia } from '@/lib/bot/guias-catalogo'
import { ESCALAMIENTO, respuestaEscalamiento } from '@/lib/bot-v2/respuestas-fijas'

describe('las guías que se prometen existen de verdad', () => {
  it('cada paso del catálogo tiene su imagen en public/guias', () => {
    const faltan = []
    for (const slug of Object.keys(GUIAS)) {
      for (const url of urlsDeGuia(slug)) {
        const f = path.join('public', 'guias', slug, path.basename(url))
        if (!fs.existsSync(f)) faltan.push(f)
      }
    }
    expect(faltan, `Sin imagen: ${faltan.join(', ')}`).toEqual([])
  })
})

describe('nivelDeSoporte: qué contesta el bot y qué no', () => {
  const reg = { yaRegistrado: true }
  it('las preguntas de plata van a una persona, siempre', () => {
    for (const t of ['Hermano como quito el saldo en negativo', 'no me cuadra la caja de hoy',
      'por que me sale ese total si yo cobre menos', 'el sistema me calculó mal la mora',
      'me falta plata en el cuadre']) {
      expect(nivelDeSoporte(t, reg), t).toBe('dinero')
    }
  })
  it('los fallos técnicos también', () => {
    for (const t of ['Hoy no me deja entrar', 'me sale un error al guardar',
      'la app no carga', 'se me cierra sola']) {
      expect(nivelDeSoporte(t, reg), t).toBe('tecnico')
    }
  })
  it('la plata gana al parecido de palabras: que exista la guía de cuadrar caja no autoriza a contestar por qué HOY no le cuadra', () => {
    expect(nivelDeSoporte('como hago para cuadrar la caja si no me cuadra', reg)).toBe('dinero')
  })
  it('«cómo hago tal cosa» sí tiene guía', () => {
    expect(nivelDeSoporte('como hago para editar las fecha inicial del prestamo', reg)).toBe('navegacion')
    expect(nivelDeSoporte('Esto puedo enviar recibos por whatsapp? Puedo editar los textos?', reg)).toBe('navegacion')
  })
  it('a quien no está registrado no se le manda nada de esto: está en mitad de una venta', () => {
    expect(nivelDeSoporte('como creo una ruta', { yaRegistrado: false })).toBe(null)
    expect(nivelDeSoporte('no me deja entrar', { yaRegistrado: false })).toBe(null)
  })
})

describe('elegirGuia: mejor ninguna que la equivocada', () => {
  it('acierta en las preguntas reales que se midieron', () => {
    expect(elegirGuia('como hago para editar las fecha inicial del prestamo y la fecha final')).toBe('editar-eliminar-prestamo')
    expect(elegirGuia('Yo puedo agregar el capital inicial? Es decir si tengo un capital de 20 millones')).toBe('inyectar-capital')
    expect(elegirGuia('Esto puedo enviar recibos por whatsapp? Puedo editar los textos?')).toBe('enviar-recibo-whatsapp')
  })
  it('entiende el verbo conjugado, que es como escribe la gente', () => {
    // «Como se crea una ruta a ver» es literalmente el ejemplo más frecuente
    // del grupo más grande medido, y con las claves en infinitivo no casaba.
    expect(elegirGuia('Como se crea una ruta a ver')).toBe('crear-ruta')
    expect(elegirGuia('como creo una ruta a ver')).toBe('crear-ruta')
    expect(elegirGuia('como agrego un cliente')).toBe('crear-cliente')
    expect(elegirGuia('como elimino un prestamo')).toBe('editar-eliminar-prestamo')
  })
  it('un relato largo no es una pregunta puntual', () => {
    // Casaban palabras por acumulación: este pedía «trasladar cliente».
    expect(elegirGuia('Buenas tardes, lo que pasa es que yo necesito una induccion, porque aqui no me dan una induccion de nada y yo tengo mis clientes y quiero saber bien todo el tema porque no me quiero equivocar con la plata de la gente que es lo mas delicado que hay en este negocio y usted sabe como es eso de complicado cuando uno empieza')).toBe(null)
  })
  it('«lo que pasa es que» es una muletilla, no el verbo trasladar', () => {
    expect(elegirGuia('lo que pasa es que necesito una induccion porque aqui no me dan')).toBe(null)
  })
  it('un saludo o un mensaje suelto no dispara ninguna guía', () => {
    for (const t of ['hola', 'ok gracias', 'buenos dias', 'ya', 'si señor', 'hola como esta buenos dias hombre no me ha quedado tiempo']) {
      expect(elegirGuia(t), t).toBe(null)
    }
  })
  it('nombrar algo no es preguntar cómo se hace', () => {
    expect(elegirGuia('ya cree la ruta y quedo bien')).toBe(null)
    expect(elegirGuia('tengo tres cobradores')).toBe(null)
  })
  it('a un registrado nunca se le manda «cómo crear una cuenta»', () => {
    // Se llevaba cuatro de trece emparejamientos por la palabra «registr…».
    expect(elegirGuia('Quiero registrar a un cliente que ya lleva tres cuotas pagadas, como lo registro?')).not.toBe('crear-cuenta')
    expect(elegirGuia('como me registro', { paraRegistrado: true })).not.toBe('crear-cuenta')
  })
  it('si dos guías empatan, no se manda ninguna', () => {
    expect(elegirGuia('como hago')).toBe(null)
  })
})

describe('los guardarraíles', () => {
  it('una guía por conversación', () => {
    expect(yaSeMandoGuia([{ rol: 'bot', texto: 'Cómo crear un cliente — Paso 1 de 4' }])).toBe(true)
    expect(yaSeMandoGuia([{ rol: 'bot', texto: 'https://app.control-finanzas.com/guias/crear-ruta/paso-1.png' }])).toBe(true)
    expect(yaSeMandoGuia([{ rol: 'bot', texto: 'Claro, le cuento' }, { rol: 'lead', texto: 'ok' }])).toBe(false)
    expect(yaSeMandoGuia([])).toBe(false)
  })
  it('el texto que acompaña es corto y remite a soporte si algo falla', () => {
    const t = textoDeGuia('crear-ruta', '301 199 3001')
    expect(t.length).toBeLessThan(220)
    expect(t).toContain('301 199 3001')
    expect(t).not.toMatch(/tú|tienes|puedes/)
  })
  it('los tres niveles se aplican DENTRO del escalamiento de soporte, no después', () => {
    /* Puesto después no se habría mandado una sola guía: el clasificador manda
       a `soporte_registrado` casi todo lo que escribe un cliente, «como creo
       una ruta a ver» incluido, y ese camino devuelve antes. */
    const src = fs.readFileSync('lib/bot-v2/agente.js', 'utf8')
    expect(src).toMatch(/if \(yaRegistrado && \(razon === 'soporte' \|\| razon === 'soporte_registrado'\)\)/)
    expect(src).toMatch(/nivel === 'dinero' \|\| nivel === 'tecnico'/)
    expect(src).toMatch(/nivel === 'navegacion' && !yaSeMandoGuia\(historial\)/)
    expect(src.indexOf("razon === 'soporte' || razon === 'soporte_registrado'"))
      .toBeLessThan(src.indexOf('const razonFinal ='))
  })
})

describe('los textos de escalamiento (Kimi #8)', () => {
  it('hay uno para plata y otro para fallos técnicos', () => {
    expect(respuestaEscalamiento('dinero')).toContain('no adivinar')
    expect(respuestaEscalamiento('tecnico')).toContain('qué le sale en pantalla')
  })
  it('ninguno promete que ya se avisó al equipo: la alerta tiene enfriamiento', () => {
    for (const [k, v] of Object.entries(ESCALAMIENTO)) {
      expect(v, k).not.toMatch(/ya le pas|ya avis|le paso su caso|ya le report/i)
    }
  })
  it('todos dicen a dónde escribir, en qué horario, y tratan de usted', () => {
    for (const [k, v] of Object.entries(ESCALAMIENTO)) {
      expect(v, k).toContain('301 199 3001')
      expect(v, k).toMatch(/7am a 10pm/)
      expect(v, k).not.toMatch(/\b(?:tú|tienes|puedes|escríbeme)\b/)
    }
  })
})

describe('el cliente que quiere pagar recibe dónde se paga, no un teléfono', () => {
  it('las formas reales de preguntarlo se clasifican como intención de pago', async () => {
    const { clasificar } = await import('@/lib/bot-v2/clasificador')
    for (const t of ['Quiero pagar el sistema como hago?', 'A dónde pago', 'donde hago el pago',
      'como pago la mensualidad', 'quiero renovar el plan', 'como activo el plan', 'ya se me vencio, como pago']) {
      expect(clasificar(t, { yaRegistrado: true })?.razon, t).toBe('intencion_pago')
    }
  })
  it('el texto lleva el enlace de la sección de planes y nunca el de registro', () => {
    const t = respuestaEscalamiento('intencion_pago_registrado')
    expect(t).toContain('configuracion/plan')
    expect(t).not.toContain('/registro')
    expect(t).toContain('301 199 3001')
  })
  it('el agente lo cambia solo si ya está registrado, y sigue avisando al equipo', () => {
    const src = fs.readFileSync('lib/bot-v2/agente.js', 'utf8')
    expect(src).toMatch(/razon === 'intencion_pago' && yaRegistrado\) \? 'intencion_pago_registrado' : razon/)
    expect(src).toMatch(/mensaje: respuestaEscalamiento\(razonFinal\),\n\s+temperatura: lead\.temperatura \|\| 50,\n\s+escalar: true/)
  })
})
