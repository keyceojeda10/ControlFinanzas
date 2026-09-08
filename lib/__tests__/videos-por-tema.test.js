/**
 * Cada tutorial por su URL.
 *
 * Antes, a quien preguntaba «cómo creo una ruta» se le mandaba la lista de 17
 * vídeos y que buscara el suyo. Ahora se le manda el de rutas.
 *
 * ⚠ Las URL se verificaron una a una contra la playlist el 8 sep 2026. El
 * modelo nunca escribe una URL de vídeo: un enlace inventado mandado a un
 * cliente es peor que no mandar nada.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import { VIDEOS, elegirVideo, textoDeVideo, textoDeTodos, pideVer } from '@/lib/bot-v2/videos'
import { EMPRESA } from '@/lib/bot-v2/kb'

describe('el catálogo', () => {
  it('cada entrada tiene id, url, duración y claves', () => {
    for (const v of VIDEOS) {
      expect(v.id, v.titulo).toMatch(/^[\w-]{11}$/)
      expect(v.url).toBe(`https://youtu.be/${v.id}${v.desde ? `?t=${v.desde}` : ''}`)
      expect(v.dur, v.titulo).toMatch(/^\d+:\d{2}$/)
      expect(v.claves.split(',').length, v.titulo).toBeGreaterThan(3)
      expect(v.titulo).not.toMatch(/\bt[uú]\b|tienes|puedes/) // el bot habla de usted
    }
    // 17 vídeos vivos; una entrada extra apunta al 13 en su minuto 3:40.
    expect(new Set(VIDEOS.map((v) => v.id)).size).toBe(17)
    expect(new Set(VIDEOS.map((v) => v.clave)).size).toBe(VIDEOS.length)
  })
  it('un tema que vive dentro de otro vídeo se manda con su minuto', () => {
    /* «Asignarle una ruta a un cobrador» es la toma 10 del vídeo 13, en el
       3:40. No había que grabar nada: había que encontrarlo. La pregunta salió
       dos veces en las conversaciones reales. */
    const v = elegirVideo('como asigno un cobrador a la ruta')
    expect(v.n).toBe(13)
    expect(v.url).toBe('https://youtu.be/RGK62rs0Sg8?t=220')
    expect(elegirVideo('a esa ruta le puedo asignar un cobrador')?.desde).toBe(220)
    // Y el vídeo entero sigue saliendo para quien pregunta por crear cobradores.
    expect(elegirVideo('como creo un cobrador')?.desde).toBeUndefined()
  })
  it('«cómo vuelvo a entrar» —una de cada cuatro preguntas— tiene respuesta', () => {
    for (const t of ['como entro a la aplicacion', 'se me perdio la aplicacion, como entro', 'por donde entro al sistema']) {
      expect(elegirVideo(t)?.n, t).toBe(2)
    }
  })
  it('están los 17 de la playlist, incluido el 06 que volvió tras la apelación', () => {
    expect(new Set(VIDEOS.map((v) => v.id)).size).toBe(17)
    expect(VIDEOS.find((v) => v.n === 6)?.id).toBe('5AB_n3BU8OU')
  })
})

describe('elegirVideo: la pregunta concreta lleva a su vídeo', () => {
  const casos = [
    ['tienen un video de como se crea una ruta', 12],
    ['como creo una ruta', 12],
    ['me manda el video de como hago un prestamo', 8],
    ['donde descargo la app', 2],
    ['como instalo la aplicacion en el celular', 2],
    ['como paso mis clientes del cuaderno', 5],
    ['como cuadro la caja del dia', 15],
    ['como creo un cobrador', 13],
    ['no entiendo como funciona el sistema', 3],
    ['como agrego un cliente', 6],
    ['puedo agregar capital', 17],
  ]
  for (const [texto, n] of casos) {
    it(`«${texto}» → vídeo ${n}`, () => expect(elegirVideo(texto)?.n).toBe(n))
  }
  it('lo que no es una pregunta de cómo no lleva a ninguno', () => {
    for (const t of ['hola buenas', 'cuanto vale', 'ok gracias', 'si', 'tienen videos?']) {
      expect(elegirVideo(t), t).toBe(null)
    }
  })
})

describe('los textos', () => {
  it('el de un vídeo lleva su URL, su duración y trata de usted', () => {
    const t = textoDeVideo(VIDEOS[0], { registrado: true })
    expect(t).toContain(VIDEOS[0].url)
    expect(t).toContain(VIDEOS[0].dur)
    expect(t).toContain(EMPRESA.telefonoSoporte)
    expect(t).not.toMatch(/\bt[uú]\b|tienes|puedes|tu negocio/)
  })
  it('al que no está registrado se le recuerda la prueba, no el soporte', () => {
    const t = textoDeVideo(VIDEOS[0], { registrado: false })
    expect(t).toContain(`${EMPRESA.diasPrueba} días gratis`)
  })
  it('sin tema claro, la lista entera', () => {
    expect(textoDeTodos({ registrado: false })).toContain(EMPRESA.linkTutoriales)
    expect(textoDeTodos({ registrado: true })).toContain(EMPRESA.telefonoSoporte)
  })
  it('pideVer distingue pedir de charlar', () => {
    expect(pideVer('tienen videos?')).toBe(true)
    expect(pideVer('como creo una ruta')).toBe(true)
    expect(pideVer('gracias, muy amable')).toBe(false)
  })
})

describe('el agente los usa en las tres vías', () => {
  const src = fs.readFileSync('lib/bot-v2/agente.js', 'utf8')
  it('quien pide tutoriales por regex recibe el suyo si se entiende cuál', () => {
    expect(src).toMatch(/const suyo = elegirVideo\(entrante\.texto\)\n\s+if \(suyo\)/)
  })
  it('y por la vía semántica también', () => {
    expect(src).toMatch(/mensaje: suyo \? textoDeVideo\(suyo, \{ registrado: yaRegistrado \}\)/)
  })
  it('el cliente registrado que pregunta cómo se hace algo recibe el vídeo', () => {
    expect(src).toMatch(/const video = elegirVideo\(entrante\.texto\)\n\s+if \(video\)/)
    expect(src).toMatch(/promptId: `video:\$\{video\.n\}`/)
  })
})

describe('el cliente que pregunta fuera del camino de soporte también recibe su vídeo', () => {
  it('«dónde descargo la app» se clasifica como venta y aun así llega al vídeo', async () => {
    const { clasificar } = await import('@/lib/bot-v2/clasificador')
    expect(clasificar('donde descargo la app', { yaRegistrado: true })?.tipo).toBe('ventas')
    expect(elegirVideo('donde descargo la app')?.n).toBe(2)
    const src = fs.readFileSync('lib/bot-v2/agente.js', 'utf8')
    expect(src).toMatch(/const video = elegirVideo\(entrante\.texto\)\n\s+if \(video\) \{\n\s+return \{ mensaje: textoDeVideo\(video, \{ registrado: true \}\)/)
    expect((src.match(/elegirVideo\(entrante\.texto\)/g) || []).length).toBe(4)
  })
  it('si dos vídeos empatan no se manda ninguno: eso va a una persona', () => {
    expect(elegirVideo('como hago para editar las fecha inicial del prestamo')).toBe(null)
  })
})
